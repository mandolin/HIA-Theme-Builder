// @lang zh-CN Tauri 后端入口与取色命令。前端采集信号前已在 JS 侧做 SSRF 校验，此处 Rust 侧再确认一次（纵深防御）。
// @lang en Tauri backend entry and extraction command. Front JS guards SSRF before collecting; Rust re-checks (defense in depth).

use serde::Serialize;
use tauri::command;

/// @lang zh-CN 取色信号结构（与 core.analyze 对齐的简化 JSON）。
/// @lang en Extraction signal shape (simplified JSON aligned with core.analyze).
#[derive(Serialize)]
struct CssVarSignal {
    name: String,
    hex: String,
}

#[derive(Serialize)]
struct DomColorSignal {
    hex: String,
    count: u32,
    region: String,
}

#[derive(Serialize)]
struct ExtractSignals {
    css_vars: Vec<CssVarSignal>,
    dom_colors: Vec<DomColorSignal>,
}

#[derive(Serialize)]
struct ExtractReply {
    ok: bool,
    signals: Option<ExtractSignals>,
    reason: Option<String>,
}

/// @lang zh-CN 判断主机是否为私网/元数据（Rust 侧 SSRF 校验，纵深防御）。
/// @lang en Decide if host is private/metadata (Rust SSRF check, defense in depth).
fn is_blocked_host(host: &str) -> bool {
    let h = host.trim_end_matches('.').to_lowercase();
    if h == "localhost" || h.ends_with(".localhost") || h == "0.0.0.0" || h == "[::1]" {
        return true;
    }
    if h == "169.254.169.254" || h == "metadata.google.internal" {
        return true;
    }
    // @lang zh-CN>字面量 IPv4 私网段判断。
    // @lang en>Literal IPv4 private-range check.
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

/// @lang zh-CN 取色命令：Rust 侧再次 SSRF 校验后可由 reqwest 抓取页面并解析信号；本骨架返回占位（待接入 HTTP 客户端）。
/// @lang en Extraction command: Rust re-checks SSRF, then may fetch+parse via reqwest; this skeleton returns a stub (HTTP client pending).
#[command]
fn extract_signals(url: String) -> ExtractReply {
    match url::Url::parse(&url) {
        Ok(u) if (u.scheme() == "http" || u.scheme() == "https") => {
            let host = u.host_str().unwrap_or("").to_string();
            let port = u.port().unwrap_or(if u.scheme() == "https" { 443 } else { 80 });
            if is_blocked_host(&host) || ![80, 443, 8080, 8443].contains(&port) {
                return ExtractReply { ok: false, signals: None, reason: Some("SSRF: blocked host/port".into()) };
            }
            // @lang zh-CN>此处接入 reqwest 抓取与正则解析（沿用前端等价逻辑），当前返回空信号占位。
            // @lang en>Hook reqwest fetch + regex parse here (same logic as front); returns empty stub now.
            ExtractReply {
                ok: true,
                signals: Some(ExtractSignals { css_vars: vec![], dom_colors: vec![] }),
                reason: None,
            }
        }
        _ => ExtractReply { ok: false, signals: None, reason: Some("invalid URL".into()) },
    }
}

/// @lang zh-CN 构建并运行 Tauri 应用，注册取色命令。
/// @lang en Build and run Tauri app, register extraction command.
fn main() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![extract_signals])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
