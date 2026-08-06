// @lang zh-CN Tauri P4 真实渲染采集模块：用 chromiumoxide 启动独立无头 chromium 真实加载目标网址，
//   注入与 Electron 同源的 scanner bundle 采集 DOM 证据，截图返回 PNG base64（前端经 core.analyzeThemeV2 评分并量化截图）。
//   scanner 由 include_str! 编译期嵌入，保证两端算法一致与 hash 可同步测试。
// @lang en Tauri P4 real-render collection module: uses chromiumoxide to launch a standalone headless chromium that really
//   loads the URL, injects the same scanner bundle as Electron to collect DOM evidence, screenshots to PNG base64
//   (front scores via core.analyzeThemeV2 and quantizes). Scanner embedded via include_str! at compile time to keep
//   both ends algorithmically identical and hash-testable.

use chromiumoxide::browser::{Browser, BrowserConfig};
use chromiumoxide::cdp::browser_protocol::emulation::{MediaFeature, SetEmulatedMediaParams};
use chromiumoxide::page::Page;
use futures::StreamExt;
use serde_json::{json, Value};
use std::env;
use std::net::ToSocketAddrs;

/// @lang zh-CN 统一日志：打到 stderr，Tauri 运行时捕获到应用日志，便于排查渲染/代理/CDP 问题。
/// @lang en Unified logging to stderr; Tauri runtime captures it for diagnosing render/proxy/CDP issues.
macro_rules! rlog {
    ($($arg:tt)*) => {
        eprintln!("[render] {}", format_args!($($arg)*))
    };
}

// 编译期嵌入 scanner bundle（与 Electron 共用同一份自包含 IIFE，确保算法一致）。
// <lang zh-CN>路径相对本文件：src-tauri/src/render.rs → extractor/dist/browser-scanner.bundle.js。</lang>
// <lang en>Path relative to this file: src-tauri/src/render.rs → extractor/dist/browser-scanner.bundle.js.</lang>
const SCANNER_SRC: &str = include_str!("../../../extractor/dist/browser-scanner.bundle.js");

// 固定分析视口（与 Electron/跨端契约测试一致：1440×900 DPR 1）。
// <lang zh-CN>指令六节默认；通过 --window-size 让截图尺寸对齐。</lang>
// <lang en>Spec §6 default; --window-size aligns screenshot dimensions.</lang>
const VIEWPORT_W: u32 = 1440;
const VIEWPORT_H: u32 = 900;

/// @lang zh-CN 判断主机是否为私网/元数据（Rust 侧 SSRF 校验，纵深防御）。
/// @lang en Decide if host is private/metadata (Rust SSRF check, defense in depth).
pub fn is_blocked_host(host: &str) -> bool {
    let h = host.trim_end_matches('.').to_lowercase();
    if h == "localhost" || h.ends_with(".localhost") || h == "0.0.0.0" || h == "[::1]" {
        return true;
    }
    if h == "169.254.169.254" || h == "metadata.google.internal" {
        return true;
    }
    if let Ok(octets) = parse_ipv4(&h) {
        let [a, b, _c, _d] = octets;
        if a == 10 || a == 127 || a == 0 || (a == 169 && b == 254) {
            return true;
        }
        if a == 172 && (16..=31).contains(&b) {
            return true;
        }
        if a == 192 && b == 168 {
            return true;
        }
        if a == 100 && (64..=127).contains(&b) {
            return true;
        }
        if a >= 224 {
            return true;
        }
    }
    false
}

/// @lang zh-CN 解析点分十进制 IPv4 为四段数字。
/// @lang en Parse dotted-decimal IPv4 into four octets.
fn parse_ipv4(s: &str) -> Result<[u8; 4], ()> {
    let mut parts = s.split('.');
    let mut out = [0u8; 4];
    for i in 0..4 {
        let p = parts.next().ok_or(())?;
        out[i] = p.parse::<u8>().map_err(|_| ())?;
    }
    if parts.next().is_some() {
        return Err(());
    }
    Ok(out)
}

/// @lang zh-CN 判断 IPv6 是否为私网/保留段：ULA(fd00::/8、fc00::/8)、回环(::1)、链路本地(fe80::/10)、
///   未指定(::)、IPv4 映射地址(::ffff:a.b.c.d 且内嵌 IPv4 私网)、映射元数据(::ffff:169.254.169.254)。
/// @lang en Decide if IPv6 is private/reserved: ULA(fd00::/8, fc00::/8), loopback(::1), link-local(fe80::/10),
///   unspecified(::), IPv4-mapped (::ffff:a.b.c.d with embedded private IPv4), mapped metadata (::ffff:169.254.169.254).
fn is_private_ipv6(ip: &str) -> bool {
    let v = ip.trim().to_lowercase();
    if v == "::1" || v == "::" || v == "fe80::" || v.starts_with("fe80:") {
        return true; // <lang zh-CN>回环/未指定/链路本地</lang> // <lang en>loopback/unspecified/link-local</lang>
    }
    if v.starts_with("fd") || v.starts_with("fc") {
        return true; // <lang zh-CN>ULA fd00::/8 / fc00::/8</lang> // <lang en>ULA fd00::/8 / fc00::/8</lang>
    }
    // <lang zh-CN>抽取 IPv4 映射地址（::ffff:a.b.c.d）的裸 IPv4 部分复用私网判断。</lang>
    // <lang en>Extract bare IPv4 from mapped (::ffff:a.b.c.d) for private reuse.</lang>
    let mapped = if let Some(stripped) = v.strip_prefix("::ffff:") {
        stripped.to_string()
    } else if v.starts_with("::") && v[2..].split('.').count() == 4 {
        v[2..].to_string()
    } else {
        String::new()
    };
    if !mapped.is_empty() && parse_ipv4(&mapped).is_ok() && is_blocked_host(&mapped) {
        return true;
    }
    if mapped == "169.254.169.254" {
        return true; // <lang zh-CN>映射云元数据</lang> // <lang en>mapped cloud metadata</lang>
    }
    false
}

/// @lang zh-CN 统一私网判定入口：IPv4 走 is_blocked_host，IPv6 走 is_private_ipv6；兼容方括号/裸地址。
/// @lang en Unified private check: IPv4→is_blocked_host, IPv6→is_private_ipv6; tolerant of brackets/bare.
pub fn is_private_ip(ip: &str) -> bool {
    let v = ip.trim();
    let bare = if v.starts_with('[') && v.ends_with(']') {
        &v[1..v.len() - 1]
    } else {
        v
    };
    if bare.split('.').count() == 4 && bare.chars().all(|c| c.is_ascii_digit() || c == '.') {
        return is_blocked_host(bare);
    }
    is_private_ipv6(bare)
}

/// @lang zh-CN 运行时 DNS 解析二次校验：阻塞解析 host 的全部 A/AAAA，逐个检查私网/保留/元数据。
///   解析失败按 fail-closed 处理（阻断），防止 DNS rebinding 在连接时把公开域名跳私网。
///   用 spawn_blocking 包标准库解析，避免阻塞异步运行时。
/// @lang en Runtime DNS resolution 2nd-check: blocking-resolve all A/AAAA of host, check each for private/reserved/metadata.
///   Resolution failure is fail-closed (blocked) to stop DNS rebinding jumping a public name to a private IP at connect time.
///   Wrapped in spawn_blocking to avoid blocking the async runtime.
pub async fn resolve_host_safe(host: &str) -> Result<bool, String> {
    let host = host.to_string();
    let blocked = tokio::task::spawn_blocking(move || {
        // <lang zh-CN>用标准库 ToSocketAddrs 解析（带端口占位，不影响主机解析）。</lang>
        // <lang en>Use std ToSocketAddrs (port placeholder, host resolution unaffected).</lang>
        let addrs = format!("{host}:0").to_socket_addrs();
        match addrs {
            Ok(iter) => {
                let mut any = false;
                for sa in iter {
                    any = true;
                    if is_private_ip(&sa.ip().to_string()) {
                        return true; // <lang zh-CN>任一解析地址为私网即阻断</lang> // <lang en>block if any resolved addr is private</lang>
                    }
                }
                !any // <lang zh-CN>无解析结果亦阻断（fail-closed）</lang> // <lang en>no records also blocked (fail-closed)</lang>
            }
            Err(_) => true, // <lang zh-CN>解析失败一律阻断</lang> // <lang en>resolution failure always blocked</lang>
        }
    })
    .await
    .map_err(|e| format!("解析任务失败：{e}"))?;
    Ok(blocked)
}

/// @lang zh-CN 单页真实渲染采集：启动无头 chromium → 导航 → 注入 scanner 采集 DOM 证据 → 截图返回 PNG base64。
///   emulate_dark（默认 true）时额外以 prefers-color-scheme:dark 复采一次，对称 Electron 的双模式深色证据。
/// @lang en Per-page real render: launch headless chromium → navigate → inject scanner for DOM evidence → screenshot to PNG base64.
///   When emulate_dark (default true) also re-scans under prefers-color-scheme:dark to mirror Electron's dual-mode dark evidence.
pub async fn render_collect(url: &str) -> Result<Value, String> {
    render_collect_impl(url, true).await
}

/// @lang zh-CN 带开关的内部实现：emulate_dark=false 时跳过深色复采（受限多页面/性能场景用）。
/// @lang en Internal impl with toggle: emulate_dark=false skips dark re-scan (limited multi-page/perf cases).
pub async fn render_collect_impl(url: &str, emulate_dark: bool) -> Result<Value, String> {
    // 连接/启动无头 chromium（独立渲染上下文，不污染应用 WebView）。
    // <lang zh-CN>优先 connect 到已运行的 Chrome（HIA_CHROME_WS），避开新版 Chrome 与 chromiumoxide
    //   launch 的 CDP 兼容问题（oneshot canceled）；否则回退 Browser::launch 自动下载/探测。</lang>
    // <lang en>Prefer connecting to a running Chrome (HIA_CHROME_WS) to avoid CDP incompatibility between
    //   new Chrome and chromiumoxide launch (oneshot canceled); fall back to Browser::launch otherwise.</lang>
    // 环境变量 HIA_CHROME_PATH（仅 launch 模式用，指向系统浏览器）与 HIA_CHROME_WS（connect 模式 ws/http URL）。
    // <lang zh-CN>两者皆可选。</lang>
    // <lang en>Both env vars are optional.</lang>
    // 标记是否为 connect 模式：connect 复用外部 Chrome，结束时不能 close（否则关闭外部进程）；
    // launch 模式由 Tauri 启动子进程，结束时需 close 释放资源。
    // <lang zh-CN>connect 模式下 close() 会关闭用户 Chrome，必须跳过。</lang>
    // <lang en>In connect mode close() kills the user's Chrome; must skip.</lang>
    let is_connect_mode = env::var("HIA_CHROME_WS")
        .map(|v| !v.trim().is_empty())
        .unwrap_or(false);
    rlog!("render_collect start url={url} connect_mode={is_connect_mode} emulate_dark={emulate_dark}");

    let (mut browser, mut handler) = match env::var("HIA_CHROME_WS") {
        Ok(ws) if !ws.trim().is_empty() => {
            // connect 模式：复用外部已启动的 --remote-debugging-port Chrome。
            // <lang zh-CN>http(s) URL 时 chromiumoxide 会自动从 /json/version 取 ws 地址。</lang>
            // <lang en>For http(s) URL chromiumoxide auto-fetches ws from /json/version.</lang>
            rlog!("connect mode: connecting to {ws}");
            Browser::connect(ws.trim())
                .await
                .map_err(|e| format!("连接 chromium 失败：{e}"))?
        }
        _ => {
            // launch 模式：--no-sandbox 等参数在受限/容器环境必需；--window-size 对齐 1440×900 契约。
            // <lang zh-CN>若 HIA_CHROME_PATH 指向系统浏览器则复用，避免受限网络下下载失败。</lang>
            // <lang en>If HIA_CHROME_PATH points to a system browser, reuse it to avoid download failures.</lang>
            // 代理：默认继承系统/环境变量代理（HTTP_PROXY/HTTPS_PROXY），用户可用 HIA_CHROME_NO_PROXY=1 关闭。
            // <lang zh-CN>baidu 等站点对直连/代理敏感，未走代理易超时或重置。</lang>
            // <lang en>baidu etc. are proxy-sensitive; without proxy they may time out or reset.</lang>
            let mut args: Vec<String> = vec![
                "--no-sandbox".into(),
                "--disable-gpu".into(),
                "--disable-dev-shm-usage".into(),
                format!("--window-size={VIEWPORT_W},{VIEWPORT_H}"),
            ];
            let no_proxy = env::var("HIA_CHROME_NO_PROXY").map(|v| v == "1").unwrap_or(false);
            if !no_proxy {
                let proxy = env::var("HTTPS_PROXY")
                    .or_else(|_| env::var("HTTP_PROXY"))
                    .ok()
                    .filter(|p| !p.trim().is_empty());
                if let Some(p) = proxy {
                    rlog!("launch mode: applying proxy {p}");
                    args.push(format!("--proxy-server={p}"));
                } else {
                    rlog!("launch mode: no proxy env found, direct connect");
                }
            } else {
                rlog!("launch mode: proxy disabled by HIA_CHROME_NO_PROXY");
            }
            let arg_refs: Vec<&str> = args.iter().map(|s| s.as_str()).collect();
            let mut builder = BrowserConfig::builder().args(arg_refs);
            if let Ok(p) = env::var("HIA_CHROME_PATH") {
                if !p.trim().is_empty() {
                    builder = builder.chrome_executable(p);
                }
            }
            let config = builder
                .build()
                .map_err(|e| format!("构建 chromium 配置失败：{e}"))?;
            rlog!("launch mode: launching chromium");
            Browser::launch(config)
                .await
                .map_err(|e| format!("启动 chromium 失败：{e}"))?
        }
    };
    rlog!("browser ready");

    // 后台驱动浏览器事件循环。
    // <lang zh-CN>必须轮询 handler，否则浏览器命令无响应。</lang>
    // <lang en>Must poll handler or browser commands hang.</lang>
    let browser_handle = tokio::task::spawn(async move {
        while let Some(Ok(_)) = handler.next().await {}
    });

    let result = async {
        let t0 = std::time::Instant::now();
        // 创建/复用页面：优先 new_page；connect 模式下若 new_page 因 CDP 兼容失败（oneshot canceled），
        // 回退复用现有第一个页面（Chrome 启动时通常已有一个 about:blank 标签）。
        // <lang zh-CN>chromiumoxide 0.5.7 与 Chrome 148 的 Target.createTarget 存在兼容问题，复用现有页面可绕过。</lang>
        // <lang en>chromiumoxide 0.5.7 + Chrome 148 Target.createTarget has a compat issue; reuse an existing page to bypass.</lang>
        let page: Page = match browser.new_page("about:blank").await {
            Ok(p) => {
                rlog!("new_page ok (+{:.1?})", t0.elapsed());
                p
            }
            Err(e) => {
                rlog!("new_page failed ({e}), falling back to existing pages (+{:.1?})", t0.elapsed());
                let pages = browser
                    .pages()
                    .await
                    .map_err(|e2| format!("新建页面失败且无法枚举页面：{e} / {e2}"))?;
                pages
                    .into_iter()
                    .next()
                    .ok_or_else(|| format!("新建页面失败且无现有页面可复用：{e}"))?
            }
        };
        rlog!("page acquired (+{:.1?})", t0.elapsed());
        // 导航前 DNS 解析二次校验（防 DNS rebinding）：解析 host 全部 A/AAAA，命中私网/元数据即阻断。
        // <lang zh-CN>字面量关卡由 main.rs 的 is_blocked_host 完成；此处补连接级解析校验，fail-closed。</lang>
        // <lang en>Literal gate done by main.rs is_blocked_host; this adds connect-time resolution check, fail-closed.</lang>
        if let Ok(parsed) = url::Url::parse(url) {
            let host = parsed.host_str().unwrap_or("").to_string();
            if !host.is_empty() {
                rlog!("resolve_host_safe start host={host} (+{:.1?})", t0.elapsed());
                match resolve_host_safe(&host).await {
                    Ok(true) => return Err(format!("SSRF: DNS 解析到私网/保留地址 / resolved to private: {host}")),
                    Ok(false) => rlog!("resolve_host_safe ok (public) (+{:.1?})", t0.elapsed()),
                    Err(e) => return Err(format!("SSRF: {e}")),
                }
            }
        }
        // 导航到目标网址（真实渲染）。
        // Chrome 148 与 chromiumoxide 0.5.7 的 Page.navigate（page.goto）在复杂/重定向页面下不稳定，
        // 统一用 Runtime.evaluate 设置 location.href 触发导航（connect 模式 new_page 可用，此路径已验证）。
        // <lang zh-CN>用 JS 导航 + 轮询 readyState；缩短轮询以减少复杂页面下的 CDP 连接窗口。</lang>
        // <lang en>JS navigation + readyState polling; shorter poll to reduce CDP window on complex pages.</lang>
        let nav_js = format!(
            r#"window.location.href = {}; "navigating""#,
            serde_json::to_string(url).map_err(|e| format!("URL 序列化失败：{e}"))?
        );
        rlog!("nav evaluate send (+{:.1?})", t0.elapsed());
        page.evaluate(nav_js)
            .await
            .map_err(|e| { rlog!("nav evaluate failed: {e} (+{:.1?})", t0.elapsed()); format!("导航注入失败：{e}") })?;
        rlog!("nav evaluate done, waiting readyState (+{:.1?})", t0.elapsed());
        // 轮询等待页面加载完成。注意：不能用“单条 evaluate 内长 Promise 等 readyState”——
        // baidu 等跨域重定向会销毁原 JS 上下文，导致该 Promise 被 Chrome 中断（oneshot canceled）。
        // 改为 Rust 侧循环、每次独立短 evaluate 查 document.readyState；上下文切换瞬间命令可能失败，短暂重试。
        // <lang zh-CN>最多等 15 秒，每 500ms 查一次；complete 即继续，超时仅记警告继续采集。</lang>
        // <lang en>Poll up to 15s, checking every 500ms via independent short evaluate; timeout is a warning, not fatal.</lang>
        let mut ready_ok = false;
        for _ in 0..10 {
            match page.evaluate("document.readyState").await {
                Ok(v) => {
                    let s = v.into_value().unwrap_or_else(|_| "\"loading\"".to_string());
                    // baidu 等 SPA 有持续后台轮询，readyState 可能停在 interactive；DOM 已就绪即可采集。
                    // <lang zh-CN>接受 interactive/complete 两种就绪态，缩短等待（最多 5 秒）。</lang>
                    // <lang en>Accept interactive/complete; DOM ready suffices. Cap at 5s.</lang>
                    if s.contains("complete") || s.contains("interactive") {
                        ready_ok = true;
                        break;
                    }
                }
                Err(_) => { /* 上下文切换瞬间失败，下一轮重试 */ }
            }
            tokio::time::sleep(std::time::Duration::from_millis(500)).await;
        }
        if ready_ok {
            rlog!("readyState ready (+{:.1?})", t0.elapsed());
        } else {
            rlog!("WARN readyState polling timed out (continue anyway) (+{:.1?})", t0.elapsed());
        }
        // 浅色主采集：注入同源 scanner bundle，返回 evidence JSON。
        // <lang zh-CN>scanner 每次 evaluate 重新注入，故 reload 后仍可复用。</lang>
        // <lang en>Scanner re-injected on each evaluate, so it survives reload.</lang>
        rlog!("scan_once(light) start (+{:.1?})", t0.elapsed());
        let light_evidence = scan_once(&page, None)
            .await
            .map_err(|e| format!("浅色采集失败：{e}"))?;
        rlog!("scan_once(light) done (+{:.1?})", t0.elapsed());
        // 截图（PNG bytes）转 base64，供前端量化。
        // <lang zh-CN>截图仅内存短暂存在；base64 回传前端做 median-cut 量化。</lang>
        // <lang en>Screenshot lives briefly in memory; base64 back to front for median-cut.</lang>
        rlog!("screenshot start (+{:.1?})", t0.elapsed());
        let shot: Vec<u8> = page
            .screenshot(chromiumoxide::page::ScreenshotParams::default())
            .await
            .map_err(|e| format!("截图失败：{e}"))?;
        let screenshot_b64 = base64_encode(&shot);
        rlog!("screenshot done bytes={} (+{:.1?})", shot.len(), t0.elapsed());

        // 深色双模式复采（P5 对称 Electron）：用 CDP Emulation.setEmulatedMedia 强制暗色，
        // reload 后重新注入 scanner 复采，最后恢复浅色媒体查询避免影响后续。
        // <lang zh-CN>失败不致命：仅记录警告，浅色证据仍可用。</lang>
        // <lang en>Non-fatal: on failure keep a warning; light evidence still usable.</lang>
        let mut dark_evidence: Value = Value::Null;
        let mut dark_warning: Option<String> = None;
        if emulate_dark {
            rlog!("emulate_dark_and_rescan start (+{:.1?})", t0.elapsed());
            match emulate_dark_and_rescan(&page).await {
                Ok(dark) => {
                    dark_evidence = dark;
                    rlog!("emulate_dark_and_rescan done (+{:.1?})", t0.elapsed());
                }
                Err(e) => {
                    dark_warning = Some(e.clone());
                    rlog!("WARN emulate_dark_and_rescan failed: {e} (+{:.1?})", t0.elapsed());
                }
            }
        }

        let mut out = json!({
            "evidence": light_evidence,
            "screenshot": screenshot_b64,
            "finalUrl": url
        });
        if emulate_dark {
            out["darkEvidence"] = dark_evidence;
            if let Some(w) = dark_warning {
                out["darkWarning"] = json!(w);
            }
        }
        rlog!("render_collect success (+{:.1?})", t0.elapsed());
        Ok::<Value, String>(out)
    }
    .await;

    // 关闭浏览器并等待 handler 结束（释放 chromium 进程）。
    // <lang zh-CN>connect 模式下跳过 close（否则关闭外部 Chrome），且必须 abort handler 任务——
    //   否则 handler 循环永不结束，await 死锁。launch 模式正常 close 并等待。</lang>
    // <lang en>Skip close in connect mode (would kill external Chrome), and must abort the handler task—
    //   otherwise the handler loop never ends and await deadlocks. Launch mode closes and waits normally.</lang>
    rlog!("teardown connect_mode={is_connect_mode}");
    if is_connect_mode {
        browser_handle.abort();
    } else {
        let _ = browser.close().await;
        let _ = browser_handle.await;
    }

    result
}

/// @lang zh-CN 单次 DOM 采集：构造与 Electron 同源的 scanner 注入脚本并执行，返回 evidence JSON（含错误透传）。
///   color_scheme 为 None 表示浅色主采集；Some("dark") 用于深色双模式复采，标记证据配色方案。
/// @lang en One DOM scan: build the same scanner injection as Electron, run it, return evidence JSON (errors surfaced).
///   color_scheme None = light primary scan; Some("dark") = dark dual-mode rescan, tags evidence scheme.
async fn scan_once(page: &Page, color_scheme: Option<&str>) -> Result<Value, String> {
    // 注入脚本包裹 IIFE：先展开 SCANNER_SRC（自带 true; 收尾），再用 __hiaScanner.scanDocument 采集。
    // <lang zh-CN>每次 evaluate 重建 scanner 全局，故 reload 后仍能复采。</lang>
    // <lang en>Rebuilds the scanner global each evaluate, so it re-scans after reload.</lang>
    // <lang zh-CN>colorScheme 仅当深色复采时传入，与 Electron 双模式一致。</lang>
    // <lang en>colorScheme passed only on dark rescan, mirroring Electron dual-mode.</lang>
    let scheme_js = match color_scheme {
        Some(s) => format!("colorScheme: \"{s}\","),
        None => String::new(),
    };
    let scan_js = format!(
        r#"(function(){{
  {scanner}
  try {{
    const ctx = {{ width: {w}, height: {h}, dpr: 1, {scheme} }};
    const {{ evidence }} = window.__hiaScanner.scanDocument(document, ctx);
    return JSON.stringify(evidence);
  }} catch(e) {{ return JSON.stringify({{ error: String(e) }}); }}
}})()"#,
        scanner = SCANNER_SRC,
        w = VIEWPORT_W,
        h = VIEWPORT_H,
        scheme = scheme_js
    );
    // 评估扫描脚本；导航后 CDP 连接可能短暂抖动（receiver is gone），最多重试 2 次。
    // <lang zh-CN>复杂页面首次 evaluate 偶发连接断开，重试可恢复。</lang>
    // <lang en>First evaluate may transiently fail on complex pages; retry recovers.</lang>
    let mut ev_json: String = String::new();
    let mut last_err: Option<String> = None;
    for attempt in 0..3 {
        match page.evaluate(scan_js.clone()).await {
            Ok(v) => {
                ev_json = v
                    .into_value()
                    .map_err(|e| { rlog!("scan_once into_value failed: {e}"); format!("解析 scanner 结果失败：{e}") })?;
                last_err = None;
                break;
            }
            Err(e) => {
                rlog!("scan_once evaluate attempt {attempt} failed: {e}");
                last_err = Some(format!("注入 scanner 失败：{e}"));
                tokio::time::sleep(std::time::Duration::from_millis(500)).await;
            }
        }
    }
    if let Some(e) = last_err {
        return Err(e);
    }
    let evidence: Value = serde_json::from_str(&ev_json)
        .map_err(|e| { rlog!("scan_once parse json failed: {e}"); format!("解析 evidence JSON 失败：{e}") })?;
    if let Some(err) = evidence.get("error") {
        rlog!("scan_once scanner runtime error: {err}");
        return Err(format!("scanner 执行错误：{err}"));
    }
    Ok(evidence)
}

/// @lang zh-CN 强制暗色媒体查询并复采：CDP Emulation.setEmulatedMedia(prefers-color-scheme:dark) → reload → 复采 → 恢复浅色。
/// @lang en Force dark media query and re-scan: CDP Emulation.setEmulatedMedia(prefers-color-scheme:dark) → reload → rescan → restore light.
async fn emulate_dark_and_rescan(page: &Page) -> Result<Value, String> {
    rlog!("dark: setEmulatedMedia(dark) send");
    // 通过 CDP 注入 prefers-color-scheme:dark 媒体特性，覆盖页面 prefers-color-scheme 探测。
    // <lang zh-CN>MediaFeature::new(name, value) 对应 DevTools 的 name/value 媒体特性对。</lang>
    // <lang en>MediaFeature::new(name, value) maps to DevTools name/value media feature pair.</lang>
    page.execute(
        SetEmulatedMediaParams::builder()
            .feature(MediaFeature::new("prefers-color-scheme", "dark"))
            .build(),
    )
    .await
    .map_err(|e| format!("设置暗色媒体查询失败：{e}"))?;
    rlog!("dark: setEmulatedMedia(dark) done; reload send");
    // 重载让页面按暗色重新应用样式与配色。
    // <lang zh-CN>reload 后 JS 上下文重置，下一次 scan_once 会重新注入 scanner。</lang>
    // <lang en>After reload the JS context resets; next scan_once re-injects the scanner.</lang>
    page.reload()
        .await
        .map_err(|e| format!("暗色重载失败：{e}"))?;
    // 用 JS 轮询 readyState 等待 reload 完成（与导航一致，绕过 Page.navigate 系列 CDP 兼容问题）。
    // <lang zh-CN>wait_for_navigation 依赖 Page.navigate 命令，Chrome 148 下不稳定，改用 JS 轮询。</lang>
    // <lang en>wait_for_navigation relies on Page.navigate (unstable on Chrome 148); use JS polling instead.</lang>
    let reload_wait = r#"new Promise(res => {
        const mark = (s) => res(JSON.stringify({ state: s }));
        const check = () => { if (document.readyState === 'complete') mark('complete'); else setTimeout(check, 200); };
        check();
        setTimeout(() => mark('timeout'), 15000);
    })"#;
    let rw: String = match page.evaluate(reload_wait).await {
        Ok(v) => v.into_value().unwrap_or_else(|_| "\"timeout\"".to_string()),
        Err(e) => return Err(format!("暗色等待导航失败：{e}")),
    };
    rlog!("dark: reload readyState={rw}");
    let dark = scan_once(page, Some("dark")).await?;
    // 恢复浅色媒体查询，避免影响后续同进程页面（纵深清理）。
    // <lang zh-CN>失败仅告警，不阻断返回。</lang>
    // <lang en>Failure is non-fatal; only a warning, does not block return.</lang>
    let _ = page
        .execute(
            SetEmulatedMediaParams::builder()
                .feature(MediaFeature::new("prefers-color-scheme", "light"))
                .build(),
        )
        .await;
    rlog!("dark: restore light media; done");
    Ok(dark)
}

/// @lang zh-CN 简易 base64 编码（避免额外依赖；输入为 PNG 字节）。
/// @lang en Minimal base64 encode (no extra dep); input is PNG bytes.
fn base64_encode(bytes: &[u8]) -> String {
    const CHARS: &[u8; 64] =
        b"ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
    let mut out = String::new();
    for chunk in bytes.chunks(3) {
        let b = [
            chunk[0],
            *chunk.get(1).unwrap_or(&0),
            *chunk.get(2).unwrap_or(&0),
        ];
        let n = ((b[0] as u32) << 16) | ((b[1] as u32) << 8) | (b[2] as u32);
        out.push(CHARS[((n >> 18) & 63) as usize] as char);
        out.push(CHARS[((n >> 12) & 63) as usize] as char);
        if chunk.len() > 1 {
            out.push(CHARS[((n >> 6) & 63) as usize] as char);
        } else {
            out.push('=');
        }
        if chunk.len() > 2 {
            out.push(CHARS[(n & 63) as usize] as char);
        } else {
            out.push('=');
        }
    }
    out
}

#[cfg(test)]
mod tests {
    use super::*;

    /// @lang zh-CN 集成测试：真实启动无头 chromium 渲染 example.com，验证返回 evidence 非空且 screenshot base64 长度合理。
    /// @lang en Integration test: really launch headless chromium to render example.com, assert evidence non-empty and screenshot base64 sizable.
    #[tokio::test]
    async fn render_collect_returns_evidence_and_screenshot() {
        let url = "http://example.com";
        let result = render_collect(url).await;
        assert!(result.is_ok(), "render_collect 应成功：{:?}", result.err());
        let v = result.unwrap();
        let evidence = v.get("evidence").expect("应含 evidence 字段");
        // example.com 至少含 <h1>/<p>，scanner 应收集到若干色彩/文本信号。
        // <lang zh-CN>evidence 为数组；断言长度 > 0。</lang>
        // <lang en>evidence is an array; assert length > 0.</lang>
        let arr = evidence.as_array().expect("evidence 应为数组");
        assert!(!arr.is_empty(), "evidence 不应为空");
        let screenshot = v
            .get("screenshot")
            .and_then(|s| s.as_str())
            .expect("应含 screenshot base64");
        assert!(screenshot.len() > 1000, "screenshot base64 应足够长");
        assert_eq!(v.get("finalUrl").and_then(|s| s.as_str()), Some(url));
    }

    /// @lang zh-CN 单元：统一私网判定覆盖 IPv4/IPv6 私网段与公网放行。
    /// @lang en Unit: unified private check covers IPv4/IPv6 private ranges and public pass.
    #[test]
    fn is_private_ip_covers_v4_v6() {
        // IPv4 私网/保留
        assert!(is_private_ip("10.0.0.1"));
        assert!(is_private_ip("192.168.0.1"));
        assert!(is_private_ip("172.16.5.5"));
        assert!(is_private_ip("127.0.0.1"));
        assert!(is_private_ip("169.254.169.254"));
        assert!(is_private_ip("100.64.0.1"));
        // IPv4 公网放行
        assert!(!is_private_ip("93.184.216.34"));
        // IPv6 私网/保留
        assert!(is_private_ip("::1"));
        assert!(is_private_ip("fe80::1"));
        assert!(is_private_ip("fd00::1"));
        assert!(is_private_ip("::"));
        assert!(is_private_ip("::ffff:127.0.0.1"));
        assert!(is_private_ip("::ffff:169.254.169.254"));
        // IPv6 公网放行
        assert!(!is_private_ip("2606:2800:220:1:248:1893:25c8:1946"));
    }
}
