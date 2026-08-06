# Changelog

本项目遵循阶段化发布。以下记录公开可验证的发布与里程碑节点。

## [P5] 桌面端跑通与跨端一致性（2026-08-06）

- 桌面端复用 web 共享渲染器（ADR-001）：`HIA/electron/scripts/copy-renderer.js` 与 `HIA/tauri/scripts/copy-front.js` 改为复制 `HIA/web/dist`（`index.html` + `assets`），使 Electron/Tauri 启动即为与 web 版相同的主题操作台 + PC/小程序预览 + 8 渐变角色 + Token 导出，呈现与操作三端一致。
- 删除桌面端旧独立简化 UI（`electron/src/renderer/*`、`tauri/src/front/*`、`tauri/src/fetch-signals.ts`）；仅保留桌面端专属桥与 SSRF 参考（`electron/src/{main,preload,fetch-signals,ssrf}`、`tauri/src/ssrf.ts`）。
- 三端取色桥按 `createAdaptivePlatform` 回退链自动接入：Electron `preload` 暴露 `window.hia.extractFromUrl`（旧协议）、Tauri `__TAURI_INVOKE__('extract_signals')`；WebView 端不直接发请求，SSRF 由 Electron 主进程 / Tauri Rust 后端双重校验。
- 复制脚本增强：复制前清空目标目录，避免 web 改 hash 后旧 JS/CSS 产物残留堆积。
- 跨端一致性核对：web/electron/tauri 三端 `dist` 渲染器 JS 哈希一致（`index-C9wRmIyv.js`）；取色面板按 `platform.explorer` 条件显隐（web 隐藏、桌面端显示）。
- 三端冒烟复验：core 单测 7/7、web 构建 0 错误、electron `tsc` 0 + SSRF 8/8、tauri 前端 `tsc` 0 + SSRF 6/6。

### 网址取色能力（P0–P4，同周期连续交付）

- **P0 Core 修复与 V2 契约**：修复 `rank()` 去重累计 bug（按规范化色建立唯一候选，每候选只计一次聚合分）；新增 `types-v2.ts` V2 契约（`ColorEvidence`/`WebsiteColorSignalsV2`/`WebsiteThemeAnalysisV2`，`schemaVersion:2`）+ `v1-compat.ts` 转换；core 回归测试 14/14 通过。
- **P1 共享 extractor**：新建 `@hia/theme-url-extractor`，scanner 覆盖 meta/manifest/CSS 变量/computed/四边 border/伪元素/SVG/渐变/open shadow/祖先语义/iframe；确定性 median-cut 量化；纯逻辑 Node 单测 14/14、12 fixture + `EXPECTATIONS.md`；esbuild 打包为 `dist/browser-scanner.bundle.js`（IIFE，Electron/Tauri 两端共用同源）。
- **P2 Electron 真实渲染**：隐藏隔离 BrowserWindow + 页面稳定化 + 注入同源 scanner bundle + 截图量化 + SSRF 防护 + degraded-static 降级 + finally 销毁；12 fixture 逐一真实渲染 `mode=render` 全通过。
- **P3 Core V2 评分与 UI**：`analyze-v2.ts` 实现 OKLab 近似聚类 + role-aware 评分（unused-token 强降权 / 中性品牌例外 / 状态色惩罚 / 互证加分）+ 主副色选择（显式 token→高置信→区分→derived harmony-fallback）+ 置信度合成 + degraded-static 封顶 0.45；core 单测 8/8；Electron 端到端冒烟（fixture 01/03/09）验证；Web 新增"网址取色探索"面板（阶段状态/主副色/置信度/reasons/warnings/候选/应用，derived 标注，高置信不静默覆盖）。
- **P4 Tauri 真实渲染**：`chromiumoxide` 0.5.7 + CDP 无头渲染 + `include_str!` 嵌入同源 scanner bundle + 截图 PNG base64 回传前端 `analyzeThemeV2` 量化评分；`render.rs` 抽离 `render_collect` 与集成测试（真实渲染 `example.com` 1 passed）；采用 connect 优先模式（`HIA_CHROME_WS` 复用已运行 Chrome CDP，避开 chromiumoxide launch 与新版 Chrome 的 CDP 兼容问题），launch 作离线/CI 回退。
- **跨端同源约束**：Electron 注入与 Tauri `include_str!` 必须复用同一份 `extractor/dist/browser-scanner.bundle.js`；提供 `HIA/extractor/scripts/verify-bundle-consistency.mjs` 校验两端引用为同一文件（hash 一致），保证算法一致与评分可复现。

## [P4] 工程化、合规与文档化收尾（2026-08-05）

- CI 矩阵增强：`.github/workflows/pages.yml` 在部署前对 `core`/`web`/`electron`/`tauri` 四端做构建与测试校验（electron/tauri 以 `--ignore-scripts` 跳过重型二进制下载，仅编译 + SSRF 单测）。
- 三端冒烟证据齐备：core 单测 7/7、web 构建 0 错误、electron `tsc` 0 + SSRF 单测 8/8、tauri 前端 `tsc` 0 + SSRF 单测 6/6（Rust 端到端启动待工具链，符合 P3 限制）。
- 许可证复核：补齐 `HIA/tauri/LICENSE`（MIT），新增 `work-zone/dev/audits/license-audit-tauri-2026-08-05.md`；混合许可证策略（根 MIT / electron Apache-2.0 / tauri MIT）证据齐备。
- ROP 文档化：为 `core` 与 `web` 全部源码补全中英双语注释（commit `c43e49c`）。

## [P3] 三端具象：web 发布 + electron/tauri 骨架与网址取色（2026-08-05）

- web 在线主题构建 + GitHub Pages 发布；操作台/PC/小程序预览/8 渐变角色/Token 导出可交互。
- electron/tauri 桌面骨架 + 从指定网址获取颜色集（SSRF 校验 + `core.analyze` 多信号加权）。
- core 抽离为公共核心（`HIA/core`），被各端以 `file:` 链接复用。

## [P2] 公共核心 core（基线）

- 建立 `HIA/core` 公共主题模型、颜色算法、Token 导出，供各端复用。

## [P1] 项目初始化（基线）

- 建立 mono-repo 容器结构与双仓库边界（公开主库 + 私有 WorkZone）。
- 落地 `README.md`、`AGENTS.md`、`LICENSE`、`work-zone/` 私有工作区基线。
- 引入 HIA-Documentation-Sys 通知读取状态登记机制。
- 建立首份周期规划、里程碑与任务状态账本样板。

> 更多阶段条目随实现推进在公开发布时补充；过程性规划与 closeout 保存在私有 `work-zone/`。
