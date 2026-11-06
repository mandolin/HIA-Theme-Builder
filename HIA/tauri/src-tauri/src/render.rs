// @lang zh-CN Tauri P4 真实渲染采集模块：用 chromiumoxide 启动独立无头 chromium 真实加载目标网址，
//   注入与 Electron 同源的 scanner bundle 采集 DOM 证据，截图返回 PNG base64（前端经 core.analyzeThemeV2 评分并量化截图）。
//   scanner 由 include_str! 编译期嵌入，保证两端算法一致与 hash 可同步测试。
//   遗留问题清理：C4（就绪轮询注释与代码一致）、B3（finalUrl 取真实终址）、C11（CDP Fetch 请求级 SSRF 拦截）、
//   C9（采集前预取站点 manifest 颜色）。
// @lang en Tauri P4 real-render collection module: uses chromiumoxide to launch a standalone headless chromium that really
//   loads the URL, injects the same scanner bundle as Electron to collect DOM evidence, screenshots to PNG base64
//   (front scores via core.analyzeThemeV2 and quantizes). Scanner embedded via include_str! at compile time to keep
//   both ends algorithmically identical and hash-testable.
//   Leftover cleanup: C4 (readyState polling comment matches code), B3 (finalUrl from real location), C11 (CDP Fetch
//   request-level SSRF interception), C9 (site manifest colors pre-fetched before scanning).

use chromiumoxide::browser::{Browser, BrowserConfig};
use chromiumoxide::cdp::browser_protocol::emulation::{MediaFeature, SetEmulatedMediaParams};
use chromiumoxide::cdp::browser_protocol::fetch::{
    ContinueRequestParams, DisableParams, EnableParams, EventRequestPaused, FailRequestParams,
    RequestPattern, RequestStage,
};
use chromiumoxide::cdp::browser_protocol::network::{ErrorReason, ResourceType};
use chromiumoxide::page::Page;
use futures::StreamExt;
use serde_json::{json, Value};
use std::env;
use std::net::ToSocketAddrs;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;

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

/// @lang zh-CN 请求级字面量关卡（C11）：仅放行 http/https，host 不得命中私网/保留/元数据/localhost。
///   覆盖 file:/data:/javascript: 等注入面与 IP 字面量变体；DNS 深检由调用方对主文档请求另行执行。
/// @lang en Per-request literal gate (C11): only http/https pass, host must not be private/reserved/metadata/localhost.
///   Covers file:/data:/javascript: injection and IP-literal variants; DNS deep-check is caller's job for document requests.
fn blocked_request_url(raw: &str) -> bool {
    match url::Url::parse(raw) {
        Ok(u) => {
            let s = u.scheme();
            if s != "http" && s != "https" {
                return true; // <lang zh-CN>阻断非 http(s) 协议注入面</lang> // <lang en>block non-http(s) scheme injection</lang>
            }
            match u.host_str() {
                Some(h) => is_blocked_host(h) || is_private_ip(h),
                None => true, // <lang zh-CN>http(s) 但无 host 属畸形，阻断</lang> // <lang en>http(s) without host is malformed; block</lang>
            }
        }
        Err(_) => true, // <lang zh-CN>解析失败一律阻断</lang> // <lang en>parse failure always blocked</lang>
    }
}

/// @lang zh-CN launch 模式启动无头 chromium（`W-tb-P8` 自 connect 多端点回退逻辑抽取）：
///   --no-sandbox 等受限环境参数、可选 HIA_CHROME_PATH 指向系统浏览器、继承 HTTPS_PROXY/HTTP_PROXY
///   代理（HIA_CHROME_NO_PROXY=1 关闭）。
/// @lang en Launch-mode headless chromium (extracted for the multi-endpoint connect fallback):
///   sandbox-off args for restricted environments, optional HIA_CHROME_PATH system browser,
///   inherits HTTPS_PROXY/HTTP_PROXY unless HIA_CHROME_NO_PROXY=1.
async fn launch_browser() -> Result<(Browser, chromiumoxide::Handler), String> {
    // 返回 (Browser, Handler)：handler 事件循环由调用方驱动（与 connect 分支对称）。
    // <lang zh-CN>chromiumoxide 的 launch 与 connect 同构返回元组。</lang>
    // <lang en>chromiumoxide launch and connect both return the tuple symmetrically.</lang>
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
        .map_err(|e| format!("启动 chromium 失败：{e}"))
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
    // `W-tb-P8` 多端点：HIA_CHROME_WS 支持逗号分隔（如 ws://a:9222,http://b:9222），按序尝试、全败回退 launch。
    // <lang zh-CN>远程 CDP 端点天然支持（chromiumoxide 自动从 http(s) /json/version 取 ws 地址）。</lang>
    // <lang en>Remote CDP endpoints work natively (chromiumoxide resolves ws from http(s) /json/version).</lang>
    let endpoints: Vec<String> = env::var("HIA_CHROME_WS")
        .ok()
        .map(|v| v.split(',').map(|s| s.trim().to_string()).filter(|s| !s.is_empty()).collect())
        .unwrap_or_default();
    let is_connect_mode = !endpoints.is_empty();
    rlog!("render_collect start url={url} connect_mode={is_connect_mode} endpoints={endpoints:?} emulate_dark={emulate_dark}");

    let (mut browser, mut handler) = if !endpoints.is_empty() {
        // connect 模式：逐端点尝试，全部失败回退 launch（多实例/远程 CDP 场景）。
        // <lang zh-CN>复用外部已启动的 --remote-debugging-port Chrome；连接成功的端点由先到先得。</lang>
        // <lang en>Tries each endpoint in order; falls back to launch when all fail.</lang>
        let mut connected: Option<(Browser, chromiumoxide::Handler)> = None;
        let mut last_err = String::new();
        for ep in &endpoints {
            rlog!("connect mode: attempting {ep}");
            match Browser::connect(ep).await {
                Ok(b) => {
                    rlog!("connect mode: connected to {ep}");
                    connected = Some(b);
                    break;
                }
                Err(e) => {
                    last_err = format!("{e}");
                    rlog!("WARN connect {ep} failed: {e}");
                }
            }
        }
        match connected {
            Some(b) => b,
            None => {
                rlog!("all {} endpoints failed (last: {last_err}); falling back to launch", endpoints.len());
                launch_browser().await?
            }
        }
    } else {
        // launch 模式：无端点配置时自主启动。
        // <lang zh-CN>参数与代理继承详见 launch_browser。</lang>
        // <lang en>Args and proxy inheritance detailed in launch_browser.</lang>
        launch_browser().await?
    };
    rlog!("browser ready");

    // 后台驱动浏览器事件循环。
    // <lang zh-CN>必须轮询 handler，否则浏览器命令无响应。</lang>
    // <lang en>Must poll handler or browser commands hang.</lang>
    let browser_handle = tokio::task::spawn(async move {
        while let Some(Ok(_)) = handler.next().await {}
    });

    // C11 裁决任务句柄与停止标记：result 块内赋值，成功/失败路径均要清理（见 cleanup 段与 teardown）。
    // <lang zh-CN>connect 模式复用页面，若裁决任务被杀而 Fetch 拦截未关，后续导航会挂起，故两者必须成对清理。</lang>
    // <lang en>C11 responder handle + stop flag: assigned in the result block; cleaned on both success/error paths.
    //   In connect mode the page is reused; killing the responder while Fetch stays enabled would hang later navigations.</lang>
    let fetch_done = Arc::new(AtomicBool::new(false));
    let mut fetch_task_slot: Option<tokio::task::JoinHandle<()>> = None;

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
        // <lang zh-CN>字面量关卡由 main.rs 的 is_blocked_host 完成；此处补连接级解析校验，fail-closed。
        //   此时尚未开启 Fetch 拦截，失败无需清理。</lang>
        // <lang en>Literal gate done by main.rs is_blocked_host; this adds connect-time resolution check, fail-closed.
        //   Fetch interception not enabled yet, so no cleanup needed on failure.</lang>
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

        // C11 请求级 SSRF 拦截（补齐 ADR-003 登记的 redirect/子请求级缺口）：
        //   开启 CDP Fetch 域，仅拦截请求发出阶段（RequestStage::Request）；每个请求先暂停再裁决。
        // <lang zh-CN>字面量关卡（blocked_request_url）覆盖所有请求；DNS 深检仅对主文档导航/重定向做——
        //   子资源海量逐个解析代价过高，且初始 host 已在导航前深检。命中即以 BlockedByClient 失败该请求。</lang>
        // <lang en>C11 per-request SSRF interception (closes the redirect/sub-request gap logged in ADR-003):
        //   enable CDP Fetch domain at RequestStage::Request; every request pauses then gets adjudicated.
        //   Literal gate on all requests; DNS deep-check only for main-document navigations/redirects —
        //   per-subresource DNS is too costly, and the initial host was deep-checked pre-navigation. Blocked → BlockedByClient.</lang>
        let pattern = RequestPattern::builder()
            .request_stage(RequestStage::Request)
            .build();
        page.execute(EnableParams::builder().patterns(vec![pattern]).build())
            .await
            .map_err(|e| format!("启用请求级拦截失败：{e}"))?;
        let mut paused_rx = page
            .event_listener::<EventRequestPaused>()
            .await
            .map_err(|e| format!("订阅请求拦截事件失败：{e}"))?;
        let fetch_page = page.clone();
        let fetch_done_task = fetch_done.clone();
        let responder = tokio::task::spawn(async move {
            while let Some(ev) = paused_rx.next().await {
                if fetch_done_task.load(Ordering::Relaxed) {
                    break; // <lang zh-CN>停止标记置位后不再裁决新请求</lang> // <lang en>stop flag set; stop adjudicating new requests</lang>
                }
                let req_url = ev.request.url.clone();
                // 第一关：字面量关卡（协议白名单 + 私网/保留 IP 字面量）。
                // <lang zh-CN>所有请求都过；命中即阻断，不再做 DNS。</lang>
                // <lang en>Applied to every request; on hit, block without DNS.</lang>
                let mut blocked = blocked_request_url(&req_url);
                // 第二关：主文档请求的 DNS 深检（重定向每一跳的 resource_type 均为 Document）。
                // <lang zh-CN>解析异常 fail-closed；子资源仅字面量关卡（与 Electron webRequest 口径一致）。</lang>
                // <lang en>Deep-check for document requests (redirect hops included); resolution errors fail-closed;
                //   subresources get the literal gate only, matching the Electron webRequest bar.</lang>
                if !blocked && ev.resource_type == ResourceType::Document {
                    if let Ok(parsed) = url::Url::parse(&req_url) {
                        if let Some(host) = parsed.host_str() {
                            match resolve_host_safe(host).await {
                                Ok(b) => blocked = b,
                                Err(_) => blocked = true,
                            }
                        }
                    }
                }
                if blocked {
                    let _ = fetch_page
                        .execute(FailRequestParams::new(
                            ev.request_id.clone(),
                            ErrorReason::BlockedByClient,
                        ))
                        .await;
                } else {
                    let _ = fetch_page
                        .execute(ContinueRequestParams::new(ev.request_id.clone()))
                        .await;
                }
            }
        });
        fetch_task_slot.replace(responder);

        // 主采集流程（导航 → 采集 → 深色复采 → 终址）。错误经 work_res 返回，cleanup 在其后必然执行。
        // <lang zh-CN>Fetch 拦截开启后任何失败都必须走到 cleanup，否则 connect 模式复用的页面会挂起。</lang>
        // <lang en>Once Fetch interception is on, every failure must reach the cleanup step, or the reused page in connect mode hangs.</lang>
        let work_res: Result<Value, String> = async {
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
            // <lang zh-CN>最多等 5 秒（10 次 × 500ms），每 500ms 查一次；complete/interactive 即继续，超时仅记警告继续采集（C4：注释与代码对齐）。</lang>
            // <lang en>Poll up to 5s (10 × 500ms) via independent short evaluate; timeout is a warning, not fatal (C4: comment matches code).</lang>
            let mut ready_ok = false;
            for _ in 0..10 {
                match page.evaluate("document.readyState").await {
                    Ok(v) => {
                        let s = v.into_value().unwrap_or_else(|_| "\"loading\"".to_string());
                        // baidu 等 SPA 有持续后台轮询，readyState 可能停在 interactive；DOM 已就绪即可采集。
                        // <lang zh-CN>接受 interactive/complete 两种就绪态。</lang>
                        // <lang en>Accept interactive/complete.</lang>
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
            // <lang zh-CN>scanner 每次 evaluate 重新注入，故 reload 后仍可复用；采集前预取 manifest 颜色（C9）。</lang>
            // <lang en>Scanner re-injected on each evaluate, so it survives reload; manifest colors pre-fetched before scanning (C9).</lang>
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

            // 真实终址（遗留问题清理 B3）：导航/深色复采完成后读 location.href，替换此前直接回填请求 URL 的做法。
            // <lang zh-CN>重定向站点（如 baidu）由此得到真实终址；读取失败或非 http(s) 时回退请求 URL。</lang>
            // <lang en>Real final URL (cleanup B3): read location.href after navigation/dark rescan instead of echoing the request URL;
            //   fall back to the requested URL when unavailable or non-http(s).</lang>
            let final_url: String = match page.evaluate("window.location.href").await {
                Ok(v) => v.into_value().unwrap_or_else(|_| url.to_string()),
                Err(_) => url.to_string(),
            };
            let final_url = if final_url.starts_with("http") { final_url } else { url.to_string() };

            let mut out = json!({
                "evidence": light_evidence,
                "screenshot": screenshot_b64,
                "finalUrl": final_url
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

        // cleanup（成功与失败路径都执行）：关闭 Fetch 拦截并停掉裁决任务。
        // <lang zh-CN>顺序敏感：先 disable（Chrome 停止暂停新请求），再置停止标记并 abort 任务，
        //   使仍在裁决中的请求尽快落地；best-effort，页面可能已销毁。</lang>
        // <lang en>Order matters: disable first (Chrome stops pausing new requests), then set the stop flag and abort
        //   the responder so in-flight adjudications settle; best-effort, the page may already be gone.</lang>
        let _ = page.execute(DisableParams::default()).await;
        fetch_done.store(true, Ordering::Relaxed);
        if let Some(t) = fetch_task_slot.take() {
            t.abort();
        }
        work_res
    }
    .await;

    // 关闭浏览器并等待 handler 结束（释放 chromium 进程）。
    // <lang zh-CN>connect 模式下跳过 close（否则关闭外部 Chrome），且必须 abort handler 任务——
    //   否则 handler 循环永不结束，await 死锁。launch 模式正常 close 并等待。
    //   兜底清理：若 result 块在 cleanup 前提前失败（理论不可达，防御性保留），此处再次 best-effort 关拦截。</lang>
    // <lang en>Skip close in connect mode (would kill external Chrome), and must abort the handler task—
    //   otherwise the handler loop never ends and await deadlocks. Launch mode closes and waits normally.
    //   Safety net: re-run the best-effort fetch cleanup in case the result block failed before its cleanup.</lang>
    rlog!("teardown connect_mode={is_connect_mode}");
    fetch_done.store(true, Ordering::Relaxed);
    if let Some(t) = fetch_task_slot.take() {
        t.abort();
    }
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
///   采集前异步预取站点 manifest 颜色（C9，与 Electron 同口径），失败静默降级。
/// @lang en One DOM scan: build the same scanner injection as Electron, run it, return evidence JSON (errors surfaced).
///   color_scheme None = light primary scan; Some("dark") = dark dual-mode rescan, tags evidence scheme.
///   Site manifest colors are pre-fetched async first (C9, same bar as Electron); silent degrade on failure.
async fn scan_once(page: &Page, color_scheme: Option<&str>) -> Result<Value, String> {
    // 注入脚本包裹 async IIFE：先展开 SCANNER_SRC（自带 true; 收尾），预取 manifest，再用 __hiaScanner.scanDocument 采集。
    // <lang zh-CN>每次 evaluate 重建 scanner 全局，故 reload 后仍能复采；page.evaluate 会等待 Promise 解析。</lang>
    // <lang en>Rebuilds the scanner global each evaluate, so it re-scans after reload; page.evaluate awaits the promise.</lang>
    // <lang zh-CN>colorScheme 仅当深色复采时传入，与 Electron 双模式一致。</lang>
    // <lang en>colorScheme passed only on dark rescan, mirroring Electron dual-mode.</lang>
    let scheme_js = match color_scheme {
        Some(s) => format!("colorScheme: \"{s}\","),
        None => String::new(),
    };
    let scan_js = format!(
        r#"(async function(){{
  {scanner}
  try {{
    const mf = (window.__hiaScanner.fetchManifest ? await window.__hiaScanner.fetchManifest(document).catch(function(){{ return null; }}) : null);
    const ctx = {{ width: {w}, height: {h}, dpr: 1, {scheme} }};
    if (mf) {{ ctx.manifest = mf; }}
    // `W-tb-P8`：scanDocumentDynamic 含 SPA 增量复扫（settle 1.2s）。
    // <lang zh-CN>与 Electron 同口径；无该函数时回退同步 scanDocument。</lang>
    // <lang en>Same bar as Electron; falls back to sync scanDocument when absent.</lang>
    const scanResult = (window.__hiaScanner.scanDocumentDynamic
      ? await window.__hiaScanner.scanDocumentDynamic(document, ctx, {{ settleMs: 1200 }})
      : window.__hiaScanner.scanDocument(document, ctx));
    return JSON.stringify(scanResult.evidence);
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
        // finalUrl 应为真实终址（B3）：location.href 可能带尾斜杠或经历协议升级（http→https），
        // 故断言为 http(s) 且指向同一主机，而非与请求 URL 全等。
        // <lang zh-CN>旧实现回填请求 URL 会掩盖协议升级/重定向；此断言保证报告的是真实 location.href。</lang>
        // <lang en>The old impl echoed the request URL, hiding upgrades/redirects; assert the real location.href instead.</lang>
        let final_url = v
            .get("finalUrl")
            .and_then(|s| s.as_str())
            .expect("应含 finalUrl 字段");
        assert!(
            final_url.starts_with("http") && final_url.contains("example.com"),
            "finalUrl 应为真实终址：{final_url}"
        );
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

    /// @lang zh-CN 单元：请求级字面量关卡（C11）——阻断非 http(s)、私网/保留 IP 字面量与元数据，放行公网 http(s)。
    /// @lang en Unit: per-request literal gate (C11) — blocks non-http(s), private/reserved IP literals and metadata; passes public http(s).
    #[test]
    fn blocked_request_url_covers_schemes_and_hosts() {
        // 非 http(s) 协议阻断
        assert!(blocked_request_url("file:///C:/Windows/system32/config"));
        assert!(blocked_request_url("javascript:alert(1)"));
        assert!(blocked_request_url("data:text/html,<h1>x</h1>"));
        // 私网/保留/元数据 IP 字面量阻断
        assert!(blocked_request_url("http://127.0.0.1/x"));
        assert!(blocked_request_url("http://10.1.2.3/x"));
        assert!(blocked_request_url("http://192.168.1.1/x"));
        assert!(blocked_request_url("http://172.16.0.9/x"));
        assert!(blocked_request_url("http://169.254.169.254/latest/meta-data/"));
        assert!(blocked_request_url("http://[::1]/x"));
        // localhost 命名阻断
        assert!(blocked_request_url("http://localhost:8080/x"));
        // 公网 http(s) 放行
        assert!(!blocked_request_url("http://example.com/"));
        assert!(!blocked_request_url("https://www.baidu.com/s?wd=x"));
        // 畸形 URL 阻断
        assert!(blocked_request_url("not a url"));
    }
}
