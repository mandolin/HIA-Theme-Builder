# HIA-Theme-Builder · Electron

Electron 桌面版（Apache-2.0）。在 `core` 基础上具备额外能力：从指定网址获取颜色集，并通过 `core.analyze` 多信号加权解析主副色候选。

本目录属于公开主库，独立包管理、测试与发布边界。许可证为 **Apache-2.0**（混合许可证策略，见根 `LICENSE` 与 `dev/audits/license-audit-electron-2026-08-05.md`）。

## 功能（W-tb-P3.2）

- Electron 应用骨架：主进程 / 预加载 / 渲染进程，窗口与取色 IPC。
- 网址取色：主进程经 `collectSignals` 抓取页面，先用 `ssrf.ts` 做 SSRF 安全校验（禁私网/回环/元数据、限协议端口），再调用 `core.analyze` 解析。
- 渲染进程精简操作台：取色按钮 + 主副色候选/置信度展示 + 写回主题。

## 安全

- `src/ssrf.ts` 为取色强制关卡，已单测覆盖（8 项）。
- 抓取为最小可用版（HTTP + 正则抽取 CSS 变量/颜色）；后续可换无头浏览器（Electron Chromium / Playwright）采集 DOM 最终样式与截图，复用同一信号结构（见规划 ADR 预留）。

## 开发

- `npm install`（Electron 二进制下载可能需联网；可用 `--ignore-scripts` 跳过仅验证编译/测试）。
- `npm run build`：`tsc` 编译 `src→dist` 并复制渲染资源到 `dist/renderer`。
- `npm test`：运行 `ssrf` 单测。
- `npm start`：构建并启动窗口。

## 发布

- 便携版：`npm run dist` 经 `electron-builder` 产出 `dist/HIA-Theme-Builder-Electron-<ver>-portable.exe`（内置 Electron 运行时，双击即用，未签名）。
- 本地依赖 `@hia/theme-core` / `@hia/theme-url-extractor` 经 `file:` 链接，打包时跟随实际内容进入 `app.asar`。
- GitHub Release `v0.2.0` 上传便携版 + NSIS 安装器（`...-setup.exe`，可选安装目录），附 SHA-256 校验和。
