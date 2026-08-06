# HIA-Theme-Builder

HIA 主题构建器。将原始的 `HIA_theme_manager.html` 单一 HTML 工具，以 TypeScript + 组件化的方式重构为一套可复用、可发布的主题管理体系，并抽离公共核心（`core`），在其基础上派生出网页版、Electron 版与 Tauri 版。

| 入口 | 说明 |
| --- | --- |
| 网页版 (`HIA/web`) | 在线主题构建与预览，发布到 GitHub Pages；共享渲染器为三端 UI 单一事实来源。 |
| Electron 版 (`HIA/electron`) | 桌面版，复用 web 共享渲染器，启动即为一致操作台/预览/渐变/导出，并具备从指定网址获取颜色集等额外能力。 |
| Tauri 版 (`HIA/tauri`) | 桌面版（更轻量），复用 web 共享渲染器，启动即为一致操作台/预览/渐变/导出，并具备从指定网址获取颜色集等额外能力。 |
| 公共核心 (`HIA/core`) | 供以上各端调用的公共主题模型、颜色算法、Token 导出与预览组件。 |

> 跨端一致性：桌面端不重写 UI，直接复用 `HIA/web` 的 Vite 构建产物（`index.html` + `assets`），因此三端呈现与操作一致；桌面端专属能力（从网址取色）通过各自平台桥（`window.hia.extractFromUrl` / `__TAURI_INVOKE__('extract_signals')`）由 `createAdaptivePlatform` 的回退链自动接入。详见 `work-zone/docs/adr/ADR-001-shared-ui-reuse.md`。
>
> 取色算法同源：Electron 注入与 Tauri 编译期 `include_str!` 嵌入的 scanner bundle 均来自同一份 `HIA/extractor/dist/browser-scanner.bundle.js`（IIFE 自包含），且 Electron 运行期读取 `node_modules/@hia/theme-url-extractor/dist/` 副本须与其内容一致。可用 `HIA/extractor/scripts/verify-bundle-consistency.mjs` 校验三端 bundle 内容 hash 一致，保证评分可复现。详见 `work-zone/docs/adr/ADR-002-url-color-extraction.md`。

## 仓库与边界

本项目是一个 mono-repo，顶层文件夹 `HIA-Theme-Builder/` 自身是**公开主库**（映射到 `mandolin/HIA-Theme-Builder`）；`work-zone/` 是独立**私有工作区库**（映射到 `mandolin/HIA-Theme-Builder-WorkZone`），被主库根 `.gitignore` 排除。

| 位置 | 职责 | 仓库 |
| --- | --- | --- |
| `HIA/core/` | 公共主题模型、配色算法、Token 导出、可复用预览组件。 | 主库（公开） |
| `HIA/web/` | 网页版应用，部署 GitHub Pages。 | 主库（公开） |
| `HIA/electron/` | Electron 桌面版，复用 web 共享渲染器，含网址取色等能力。 | 主库（公开） |
| `HIA/tauri/` | Tauri 桌面版，复用 web 共享渲染器，含网址取色等能力。 | 主库（公开） |
| `docs/` | 面向使用者和二次开发者的公开文档。 | 主库（公开） |
| `dev/` | 已整理、可公开的开发材料入口（可为空）。 | 主库（公开） |
| `work-zone/` | 私有规划、研究、审计、评审与 AI 协作证据。 | 私有库（不公开） |

根目录刻意不建立跨 `HIA/*` 的共享依赖树或统一构建流水线；各端独立包管理、测试与发布。跨端联调使用 `HIA/core` 的本地包链接、示例或 fixtures。

## 原始工具

重构起点为内部文档库中的 `I:\HIA_SYS_DOC\工具\主题管理器\HIA_theme_manager.html`：一个以主/副色操作台、预设主题库、渐变设置、PC/小程序预览和 CSS/JSON Token 导出为核心的单文件工作台。本项目在保留其设计语言与能力边界的前提下，进行组件化拆分与多端派生。

## 规划与里程碑

公开侧仅保留定位与能力说明。规划、周期（`W-*`/`C-*`）、里程碑（`M-*`）、ADR、审计与 AI 协作记录统一位于私有 `work-zone/`；公开 `docs/` 不复制内部过程材料。

## 开发环境

- 推荐使用 [mise](https://mise.jdx.dev/) 统一工具链：根目录 `.mise.toml` 已锁定 Node 22（LTS），本地与 CI 版本保持一致。克隆后执行 `mise install` 即自动安装匹配运行时。
- Shell 工作在 Windows 上统一使用 PowerShell 7（`C:\Program Files\PowerShell\7\pwsh.exe`）；`mise run` 任务（如 `build-web`/`test-core`/`test-ssrf`）可一键执行常见流程。
- 各端在对应目录下独立安装与构建；具体内容见各端 README。

## 中英双语代码文档

自首份源码起，所有代码语义节点均执行 ROP（面向阅读的编程），具备紧邻的中英双语文档化注释；JS/TS 当前使用 `@lang zh-CN`、`@lang en` 与 inline `<lang>`。详见 `AGENTS.md` 与 `work-zone/docs/standards/bilingual-code-documentation-policy.md`。

## 字体策略

默认 UI、示例、测试与生成产物只使用来源与许可证明确的开源字体或 generic fallback；闭源或来源不明字体只作为兼容输入，不作默认值或打包资产。

## 构建与发布

三端各自构建与发布，版本号相互独立。

- **网页版（`HIA/web`）**：`npm install && npm run build`（`GITHUB_PAGES=1` 时基路径适配）；产物部署到 GitHub Pages（`.github/workflows/pages.yml` 在 `main` 推送时自动构建四端并部署 `web/dist`）。
- **Electron 版（`HIA/electron`）**：`npm install && npm run build` 编译；`npm run dist` 用 `electron-builder` 产出**便携版** `dist/HIA-Theme-Builder-Electron-<ver>-portable.exe`（内置运行时，双击即用）。
- **Tauri 版（`HIA/tauri`）**：`npm install`（含 `@tauri-apps/cli`）→ `npm run build`（`build:front` + `tauri build`）；release 产物为独立便携 `exe`（`src-tauri/target/release/`，需系统 WebView2 Runtime）。

桌面端产物为**未签名便携版**，运行时会提示"未知发布者"。GitHub Release 聚合桌面端产物，网页版经 Pages 分发。

## 许可证

本项目采用**混合许可证**策略：

- 根文档及 `HIA/core`、`HIA/web`、`HIA/tauri` 默认按 **MIT License** 授权。
- `HIA/electron/` 目录采用 **Apache License 2.0**（子包自决；因其“从指定网址获取颜色集”等额外能力可能引入 Apache-2.0 依赖，且专利授权对企业分发更友好）。具体见根 `LICENSE` 与 `dev/audits/license-audit-electron-2026-08-05.md`。
- `work-zone/` 为独立私有仓库，不随公开主库授权分发。

所有第三方依赖、字体、图标与二进制资产进入发布路径前须记录来源、版本与许可证，优先 MIT、Apache-2.0、BSD、ISC、OFL、CC0 等宽松许可。
