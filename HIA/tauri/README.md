# HIA-Theme-Builder · Tauri

Tauri 桌面版（MIT，轻量运行时：Rust 后端 + WebView）。在 `core` 基础上具备额外能力：从指定网址获取颜色集，经 `core.analyze` 多信号加权解析主副色候选。

本目录属于公开主库，独立包管理、测试与发布边界。许可证 MIT（与 web 一致；electron 为 Apache-2.0 例外）。

## 功能

- Tauri 应用骨架：Rust 后端（`src-tauri`） + 前端 WebView（`src`，复用 web 共享渲染器），窗口与取色命令。
- 网址取色：`extract_signals` 命令经 `chromiumoxide`（CDP 无头渲染）真实加载目标页、注入同源 scanner bundle、截图量化，Rust 端再校验 SSRF，回传 `core.analyze`（V2 契约）所需信号；前端通过 `createAdaptivePlatform` 回退链的 `tauriExplorer` 调 `__TAURI_INVOKE__` 接入。
- 深色双模式：导航后以 `Emulation.setEmulatedMedia(prefers-color-scheme:dark)` + reload 复采，再恢复 light，产出 `darkMode.evidence`。
- 复用 web 共享渲染器（ADR-001）：前端 `npm run build:front` 经 `scripts/copy-front.js` 复制 `web/dist` 到 `src-tauri/dist`，桌面与 web 版呈现、操作一致。

## 安全

- Rust `src-tauri/src/main.rs` 与 `render.rs` 双重 SSRF 校验（字面量关卡 + 导航前 DNS 解析二次校验，fail-closed）；纵深防御，不在 WebView JS 重复。
- connect 优先模式：`HIA_CHROME_WS` 复用已运行的 Chrome CDP（避开 chromiumoxide launch 与新版 Chrome 的兼容问题），launch 作离线/CI 回退。

## 开发

- 前端：`npm install` → `npm run build:front`（`tsc` + 复制资源到 `src-tauri/dist`）；`npm test` 跑 SSRF 单测。
- Rust：`src-tauri/` 为 Tauri v1 工程，需 Rust 工具链；`cargo check` / `cargo build` 验证。
- 桌面启动/打包：`npm run tauri dev`（调试）或 `npm run build`（产 release 便携 `exe`，位于 `src-tauri/target/release/`）。本机未装 WiX，已关闭 bundle，故不产 `.msi`；便携 `exe` 依赖系统 WebView2 Runtime。
- chromiumoxide 已升级至 `0.9.1` 以兼容 Chrome 148（修复 `new_page` 的 `oneshot canceled` 与导航后 CDP 连接断开）。

## 发布

- 便携版：`npm run build` 后复制 `src-tauri/target/release/HIA Theme Builder.exe` 为 `HIA-Theme-Builder-Tauri-<ver>-portable.exe`。
- GitHub Release `v0.2.0` 上传便携版 + MSI 安装包（WiX），附 SHA-256 校验和。
