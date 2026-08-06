// @lang zh-CN Tauri 后端入口与取色命令（P4 真实渲染）。
//   注册 extract_signals 命令：Rust 侧 SSRF 校验通过后，调用 render 模块启动无头 chromium 真实渲染采集，
//   返回 V2 信号 JSON（evidence + screenshot base64 + finalUrl），前端经 core.analyzeThemeV2 评分并量化截图。
// @lang en Tauri backend entry and extraction command (P4 real render).
//   Registers extract_signals: after Rust SSRF check, calls the render module to launch headless chromium for real
//   render+collect, returning V2 signal JSON (evidence + screenshot base64 + finalUrl); front scores via core.analyzeThemeV2.

mod render;

use serde::Serialize;
use serde_json::Value;
use tauri::command;

use render::is_blocked_host;

/// @lang zh-CN 取色信号返回结构：evidence 为页面端 scanner 采集的 V2 证据数组；screenshot 为 PNG base64（前端量化）。
/// @lang en Extraction reply: evidence is the V2 array collected by the in-page scanner; screenshot is PNG base64 for front-end quantization.
#[derive(Serialize)]
struct ExtractReply {
    ok: bool,
    signals: Option<Value>,
    reason: Option<String>,
}

/// @lang zh-CN 取色命令（P4 真实渲染）：Rust 侧 SSRF 校验通过后，启动无头 chromium 真实渲染采集，返回 V2 信号 JSON。
/// @lang en Extraction command (P4 real render): after Rust SSRF check, launch headless chromium to render+collect, return V2 signals JSON.
#[command]
async fn extract_signals(url: String) -> ExtractReply {
    // SSRF 校验（纵深防御，与前端/Electron 一致）。
    // <lang zh-CN>阻断私网/元数据/非常规端口。</lang>
    // <lang en>Block private/metadata/unusual ports.</lang>
    match url::Url::parse(&url) {
        Ok(u) if (u.scheme() == "http" || u.scheme() == "https") => {
            let host = u.host_str().unwrap_or("").to_string();
            let port = u.port().unwrap_or(if u.scheme() == "https" { 443 } else { 80 });
            if is_blocked_host(&host) || ![80, 443, 8080, 8443].contains(&port) {
                return ExtractReply {
                    ok: false,
                    signals: None,
                    reason: Some("SSRF: blocked host/port".into()),
                };
            }
        }
        _ => {
            return ExtractReply {
                ok: false,
                signals: None,
                reason: Some("invalid URL".into()),
            };
        }
    }
    // 真实渲染采集。
    // <lang zh-CN>失败返回 ok:false 并给出原因，由前端降级提示。</lang>
    // <lang en>On failure return ok:false with reason; front degrades gracefully.</lang>
    match render::render_collect(&url).await {
        Ok(signals) => ExtractReply { ok: true, signals: Some(signals), reason: None },
        Err(e) => ExtractReply { ok: false, signals: None, reason: Some(e) },
    }
}

/// @lang zh-CN 构建并运行 Tauri 应用，注册真实渲染取色命令。
/// @lang en Build and run Tauri app, register the real-render extraction command.
fn main() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![extract_signals])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
