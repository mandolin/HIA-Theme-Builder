# HIA-Theme-Builder · Tauri

Tauri 桌面版（MIT，轻量运行时：Rust 后端 + WebView）。在 `core` 基础上具备额外能力：从指定网址获取颜色集，经 `core.analyze` 多信号加权解析主副色候选。

本目录属于公开主库，独立包管理、测试与发布边界。许可证 MIT（与 web 一致；electron 为 Apache-2.0 例外）。

## 功能（W-tb-P3.3）

- Tauri 应用骨架：Rust 后端（`src-tauri`） + 前端 WebView（`src/front`），窗口与取色命令。
- 网址取色：前端 `collectSignals` 调 Tauri 命令桥 `extract_signals`（Rust 端再校验 SSRF），返回 `core.analyze` 所需信号；前端未运行于 Tauri 时回退到 `fetch` 正则采集。
- 渲染进程精简操作台：取色按钮 + 主副色候选/置信度展示 + 写回主题。

## 安全

- 前端 `src/ssrf.ts` 与 Rust `src-tauri/src/main.rs` 双重 SSRF 校验（纵深防御）；前端已单测覆盖（6 项）。

## 开发

- 前端：`npm install` → `npm run build:front`（`tsc` + 复制资源到 `src-tauri/dist`）；`npm test` 跑 SSRF 单测。
- Rust：`src-tauri/` 为 Tauri v1 工程，需 Rust 工具链；`extract_signals` 命令当前为 SSRF 校验 + 空信号占位，HTTP 抓取待接入 `reqwest`。
- 完整桌面启动需 `tauri-cli`：`npm run tauri dev`（待 Rust 工具链就绪）。
