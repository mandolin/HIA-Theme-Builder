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

### P5 增强项（5 项，完整交付 ChatGPT 原始规格 P5 节）

- **① logo 检测与裁剪**：`scanner.detectLogos` 识别 favicon / brand-image / 内联 SVG 包围盒；命中证据标记 `ColorEvidence.isLogo`，报告层新增 `logoHexes`（去重）。Electron `captureAndQuantize` 对 logo 包围盒 `capturePage(rect)` 裁剪并量化，web/electron 候选标注 logo 标签。
- **② dark 双模式**：`ColorEvidence.colorScheme` 维度贯穿 scanner/aggregate（`colorScheme` 进入聚合五元组键）；Electron `setEmulatedMedia({prefersColorScheme:'dark'})` + reload 复采，Tauri 经 CDP `Emulation.setEmulatedMedia(prefers-color-scheme:dark)` + reload 复采（复采后恢复 light），两端产出 `darkMode.evidence`（`colorScheme:'dark'`）；core `analyzeThemeV2` 复用 `analyzeColors` 产出 `darkPrimary` / `darkSecondary`；web 色板区新增"深色模式主色"卡片。
- **③ 受限多页面**：`scanDocument` 递归扫描同源 iframe（标记 `frameKind:'same-origin'`），第三方 iframe 跳过并记 `frame-skip` warning；扫描受 `MAX_ELEMENTS`/`MAX_EVIDENCE` 封顶，超限写 warning 不阻断。
- **④ QuantizerCelebi 对比基准**：新增 `extractor/src/quantize/celebi.ts`（RGB→linear→XYZ→Lab 确定性 k-means++ 种子 + 固定 10 迭代）；`quantizeCelebi` / `quantizerDivergence`（0..1 偏离度）**仅作对比基准**，写入 `diagnostics.notes`，**不替换**主 median-cut 评分（符合原始规格"实验性基准，不直接采用其主题 seed Score"）。单测 5/5 覆盖确定性/主导色识别/偏离度区间/空输入/低 alpha 忽略。
- **⑤ precision 模式（可选骨架，非首版默认）**：原始规格明确 precision 不属于首版默认方案。保留为可选开关骨架，并在 README/ADR 说明其安全约束（externalBin / 受限 shell scope），不打包 sidecar、默认关闭、与标准模式对称。
- **验证**：extractor 单测 19/19（含 5 celebi）、core 22/22、electron `tsc` 0 错误、web `tsc` 0 错误、tauri `cargo check` 0 错误；两端 scanner bundle 同源（Electron `node_modules` 为 Junction 直连 `extractor`，Tauri `include_str!` 直读 `extractor/dist`）。Electron 真实渲染 fixture 运行时验证因本环境无显示上下文 `app.ready` 无法完成被阻断（非代码缺陷），dark/logo/多页面逻辑由 scanner/aggregate/core 单测与类型检查覆盖。

### SSRF 升级：DNS rebinding 二次校验（补齐十三节要求）

- **背景**：原规格十三节要求"防止 DNS rebinding、公开域名跳私网、混合公共/私有解析"，并对每次 redirect 与子资源重校验。基础关卡（协议/端口/字面量私网/元数据/回环）此前已完成，本次补齐运行时解析二次校验。
- **Electron**：`ssrf.ts` 新增 `isPrivateIpv6`（ULA/回环/链路本地/未指定/IPv4 映射私网/映射元数据）、`isPrivateIp`（统一入口）、`resolveHostSafe`（DNS 解析全部 A/AAAA，解析失败 fail-closed）、`guardUrlDeep`（导航前同步+异步解析）、`guardRequestUrl`（请求级关卡）；`render-adapter.ts` 在 `loadURL` 前调用 `guardUrlDeep`，并注册 `webRequest.onBeforeRequest` 对每次新请求（含重定向链每 hop 与子资源）重校验，阻断字面量私网/IP 变体与 `file:`/`data:`/`javascript:` 注入面。
- **Tauri**：`render.rs` 新增 `is_private_ipv6`/`is_private_ip`/`resolve_host_safe`（spawn_blocking + `ToSocketAddrs` 解析全部 A/AAAA，fail-closed），在 `render_collect_impl` 导航前对 host 解析二次校验，命中私网/元数据即阻断（main.rs 已做字面量关卡，纵深防御）。
- **限制**：Electron `onBeforeRedirect` 仅观察不可取消，重定向链各 hop 经 `onBeforeRequest` 重校验覆盖；Tauri 的 redirect/子请求级 CDP Fetch 拦截因 chromiumoxide 集成成本较高未做，域名型 host 的 rebinding 由导航前解析兜底（同源页内 DNS 通常已缓存，二次解析一致），列为后续增强。
- **验证**：electron `ssrf` 单测 15/15（含 IPv6 私网、解析 fail-closed、guardUrlDeep SSRF 前缀）；tauri `is_private_ip` 单测 1 passed。

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
