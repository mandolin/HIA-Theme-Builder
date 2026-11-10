# Changelog

本项目遵循阶段化发布。以下记录公开可验证的发布与里程碑节点。

## v0.3.0（2026-11-10）· 文档化与对外可发现性

### 文档子站（双语）

- 全新文档站部署于 [mandolin.github.io/HIA-Theme-Builder/docs/](https://mandolin.github.io/HIA-Theme-Builder/docs/)：**入门教程**（5 分钟闭环）、**使用手册**（全功能讲解）、**参考及开发文档**（契约/API/Token/适配器/桌面端架构）。
- 中英双语 + 头部语言切换按钮；语言判定三级联动：URL `?lang=` 参数 > 站内上次选择 > 主应用界面语言（`hia-locale`）回退；主应用"文档"链接随界面语言实时携带参数。

### 品牌与站点标识

- **松树主题站点图标**：SVG 矢量 + 多尺寸 ICO（16/32/48/256，纯算法生成器可复现），全端生效——浏览器标签页、Electron/Tauri 窗口标题栏与任务栏、桌面安装器（NSIS/MSI）与 exe 资源图标。
- 主应用 hero 品牌区块加 logo；全站底部版权页脚（HIA Studio @2026-）。

### 交互与修复

- **网址取色应用范围复选框**：应用主副色 / 应用其它色到辅助色（候选剔除推荐对后按上限填充，可撤销）。
- **Tauri 残留窗口双修复**：release 不再附带命令行窗口（`windows_subsystem`）；取色 Chrome 显式无头 + 关闭/事件循环超时护栏，函数返回经 Drop/kill_on_drop 强杀子进程——错误路径不再残留独立 Chromium 窗口。
- 辅助色槽位上限 8 → **12**（与取色候选满额对齐，文档与宣传材料同步）。
- 顶部右侧新增 GitHub 仓库与文档子站链接；GitHub 仓库主页 About 区新增官网链接；README 中英双版本（英文默认，可切换）。
- 修复：宝典弹层被 sticky 侧栏层叠上下文困住遭自定义 combo 遮挡（弹层挂 body 层）；热情页 TR 级色条抽取遗漏（v8 抽取器统一 (TR|TD) 条正则 + 页级独立对账，1440 组合零缺失）；预设载入后关系区刷新链缺失；i18n 占位符仅替换首个。

### 质量

- core 80/80、electron 15/15 单测；三端渲染器 SHA256 逐位一致；四包封版 0.3.0。

## v0.2.0（2026-11-09）· 配色体系与生态发布

### 配色关系模式与辅助色（核心能力重构）

- **主体色三模式**：单色/双色/三色（成员数派生，不再手动切换）；第三色成为一等位（独立拾色器 + X 删除 + 拖拽互换）。
- **十种配色设计规则**：互补/冲突/中性（双色）+ 类比/分裂补色/三次色/原色组合/二次色组合/纯色（三色，纯色跨 1-3 色）；规则补副色/补第三色（不适用置灰）。
- **辅助色独立维度**：0..8 槽位，手动添加/按规则生成/与主副第三互换（↔主/↔副/↔三）/上下移/拖拽排序；全部下游传导（CSS 变量、WordPress palette、Tailwind 色族、渐变色源、分享链接、主题包）。
- **配色宝典选色**：弹层左 24 情感菜单、右 CHM 色卡版式（10 形态 1440 组合/3739 色条，逐页对账零缺失）；点击组合套用主体色（快照可还原）；情感行 ⚡ 一键套用（补色首组，回退任一形态首组）。

### 配色 UX 完善（维护者复核反馈两轮）

- 操作台：640px 窄视口零横向滚动条、副色区锚点+生成副色系自动加载首位候选、第三色自动匹配区、渐变色系自定义下拉带色块预览。
- 成员卡行内重选色/X 删除；候选卡双/三/全色三态展示；主题包/远程源完整携带新契约字段（seriesMode/seriesRelation/thirdColor/auxiliary，清洗白名单+色阶重建）。
- 修复：弹层被 sticky 侧栏层叠上下文困住遭 combo 遮挡（挂 body 层）；热情页 TR 级色条全漏（v8 抽取器统一 (TR|TD) 条正则+页级独立对账）；预设载入后关系区刷新链缺失；i18n 占位符仅替换首个。

### 主题市场与生态

- 分享链接（URL hash 承载完整主题，含新契约字段）；主题包导入导出（id 冲突重命名合并）；远程预设源管理（内置官方示例源，含三色+辅助演示预设）。
- CMS/框架适配产出：WordPress theme.json + 子主题骨架、Tailwind 配置导出、CSS 变量注入模板；TDON 声明式适配规范 v0（草稿）。

### 国际化与无障碍

- 中/英双语界面全域清查（TreeWalker+option 扫描，确定性语言态审计）：0 中文残留；演示内容翻译往返无损。

### 质量与发布

- core 80/80、electron 15/15 单测；三端渲染器 SHA256 逐位一致；scanner bundle 三端同源（sha256 校验脚本）。
- 四包封版 0.2.0（core/web/electron/tauri + Cargo）；GitHub Release 四件桌面产物（Electron 便携+NSIS、Tauri 便携+MSI）附 SHA-256 校验和。
- 中英双语代码注释（ROP）全覆盖新增语义节点；ADR-007 记录契约演进（v1→v2 两轮修订）。

## 遗留问题清理与安装器（2026-11-06）

- **安全修复**：Electron 生产包不再无条件打开 DevTools（改为 `HIA_OPEN_DEVTOOLS=1` 显式开启）；静态降级取色路径补齐 SSRF DNS 深度校验（与真实渲染路径同口径，消除 DNS rebinding 残留风险）；Tauri 报告的 `finalUrl` 改为真实 `location.href`（重定向/协议升级后不再是回填的请求 URL，如 `http://example.com` 现如实报告 `https://example.com/`）。
- **Tauri 请求级 SSRF 拦截**：经 CDP Fetch 域实现逐请求拦截——所有请求过协议白名单 + 私网/保留 IP 字面量关卡，主文档请求（含重定向每跳）追加 DNS 深度校验，命中即以 `BlockedByClient` 阻断；采集完成后自动解除拦截并停止裁决任务。
- **manifest 颜色采集**：scanner 新增 `fetchManifest`（页面端预取站点 web app manifest）与 `manifestColorsFromJson`（纯函数）；`theme_color`/`background_color` 以 `manifest-theme` 来源进入证据聚合，Electron/Tauri 同一份 bundle 同步支持。
- **质量项**：Tauri WebView 启用 CSP（`default-src 'self'` 等，含 `ipc:` 与 `data:` 抓取放行）；Electron 弹窗拦截改用现行 `setWindowOpenHandler`；`fix-preload-cjs` 不再硬编码 IPC 通道名（从编译产物提取，漂移即构建失败）；移除 Tauri 过期 `dist-front` 产物与 core 遗留 vitest 旧测试；CI 新增 `tauri-rust-check` job（windows `cargo check --locked`），Rust 侧编译纳入部署门禁。
- **安装器**：Electron 新增 NSIS 安装器（`...-setup.exe`，可选择安装目录）与便携版并存；Tauri 开启 MSI bundle（`HIA Theme Builder_0.1.0_x64_en-US.msi`，WiX 自动下载）。全部未签名（证书待采购），哈希与产物清单随发布登记。
- **验证**：extractor 23/23（新增 4 个 manifest 用例）、core 22/22、electron `tsc` 0 错 + SSRF 15/15、tauri `cargo check` 0 错 + 单测 2/2 + 真实渲染集成测试 1/1（无头 Chrome connect 模式、拦截激活状态）、web 构建 0 错、三端 scanner bundle 哈希一致。

## 桌面端三端发布（2026-08-06）

- **Web 版 → GitHub Pages**：`pages.yml` 工作流在 `main` 推送时自动构建四端并部署 `web/dist`；修复了 CI 失败根因——`web` 依赖 `@hia/theme-url-extractor` 但工作流此前未先构建 extractor，导致 `tsc` 报 `TS2307`；并在 `web/src/platform.ts` 显式标注 `quantizeMedianCut` 回调参数类型以消除隐式 any。
- **桌面端打包与发布（便携版、未签名）**：
  - Electron：新增 `electron-builder` 开发依赖与 `dist` 脚本，产出便携 `.exe`（`HIA-Theme-Builder-Electron-<ver>-portable.exe`，内置 Electron 运行时，双击即用）。
  - Tauri：新增 `@tauri-apps/cli` 与 `tauri`/`build` 脚本；修复 release 构建所需的 `custom-protocol` feature 缺失；关闭 bundle（本机未装 WiX），release 产出独立便携 `exe`（`HIA-Theme-Builder-Tauri-<ver>-portable.exe`，需系统 WebView2 Runtime）。
  - 三端版本号各自独立演进（当前均为 `0.1.0`）。
- **GitHub Release**：`v0.1.0-desktop` 已创建并上传两个桌面便携版产物；Web 版经 Pages 分发。
- **chromiumoxide 0.5 → 0.9 升级（关键修复）**：`tauri/src-tauri` 的 `chromiumoxide` 由 `0.5.7` 升级到 `0.9.1`，修复 Chrome 148 下的 CDP 兼容问题（`new_page` 的 `oneshot canceled`、导航后 `receiver is gone` 连接断开），使 baidu 等含跨域重定向的站点能正常取色；`render.rs` 同步改用 Rust 侧独立短 `evaluate` 轮询 `readyState`（接受 `interactive`/`complete`，5 秒上限）替代会随导航销毁的长 Promise，并为关键错误路径补 `rlog` 日志。

## [`W-tb-P5`] 桌面端跑通与跨端一致性（2026-08-06）

- 桌面端复用 web 共享渲染器（ADR-001）：`HIA/electron/scripts/copy-renderer.js` 与 `HIA/tauri/scripts/copy-front.js` 改为复制 `HIA/web/dist`（`index.html` + `assets`），使 Electron/Tauri 启动即为与 web 版相同的主题操作台 + PC/小程序预览 + 8 渐变角色 + Token 导出，呈现与操作三端一致。
- 删除桌面端旧独立简化 UI（`electron/src/renderer/*`、`tauri/src/front/*`、`tauri/src/fetch-signals.ts`）；仅保留桌面端专属桥与 SSRF 参考（`electron/src/{main,preload,fetch-signals,ssrf}`、`tauri/src/ssrf.ts`）。
- 三端取色桥按 `createAdaptivePlatform` 回退链自动接入：Electron `preload` 暴露 `window.hia.extractFromUrl`（旧协议）、Tauri `__TAURI_INVOKE__('extract_signals')`；WebView 端不直接发请求，SSRF 由 Electron 主进程 / Tauri Rust 后端双重校验。
- 复制脚本增强：复制前清空目标目录，避免 web 改 hash 后旧 JS/CSS 产物残留堆积。
- 跨端一致性核对：web/electron/tauri 三端 `dist` 渲染器 JS 哈希一致（`index-C9wRmIyv.js`）；取色面板按 `platform.explorer` 条件显隐（web 隐藏、桌面端显示）。
- 三端冒烟复验：core 单测 7/7、web 构建 0 错误、electron `tsc` 0 + SSRF 8/8、tauri 前端 `tsc` 0 + SSRF 6/6。

### 网址取色能力（原始规格 P0–P4 节，同周期连续交付）

- **原始规格节 P0：Core 修复与 V2 契约**：修复 `rank()` 去重累计 bug（按规范化色建立唯一候选，每候选只计一次聚合分）；新增 `types-v2.ts` V2 契约（`ColorEvidence`/`WebsiteColorSignalsV2`/`WebsiteThemeAnalysisV2`，`schemaVersion:2`）+ `v1-compat.ts` 转换；core 回归测试 14/14 通过。
- **原始规格节 P1：共享 extractor**：新建 `@hia/theme-url-extractor`，scanner 覆盖 meta/manifest/CSS 变量/computed/四边 border/伪元素/SVG/渐变/open shadow/祖先语义/iframe；确定性 median-cut 量化；纯逻辑 Node 单测 14/14、12 fixture + `EXPECTATIONS.md`；esbuild 打包为 `dist/browser-scanner.bundle.js`（IIFE，Electron/Tauri 两端共用同源）。
- **原始规格节 P2：Electron 真实渲染**：隐藏隔离 BrowserWindow + 页面稳定化 + 注入同源 scanner bundle + 截图量化 + SSRF 防护 + degraded-static 降级 + finally 销毁；12 fixture 逐一真实渲染 `mode=render` 全通过。
- **原始规格节 P3：Core V2 评分与 UI**：`analyze-v2.ts` 实现 OKLab 近似聚类 + role-aware 评分（unused-token 强降权 / 中性品牌例外 / 状态色惩罚 / 互证加分）+ 主副色选择（显式 token→高置信→区分→derived harmony-fallback）+ 置信度合成 + degraded-static 封顶 0.45；core 单测 8/8；Electron 端到端冒烟（fixture 01/03/09）验证；Web 新增"网址取色探索"面板（阶段状态/主副色/置信度/reasons/warnings/候选/应用，derived 标注，高置信不静默覆盖）。
- **原始规格节 P4：Tauri 真实渲染**：`chromiumoxide` 0.5.7 + CDP 无头渲染 + `include_str!` 嵌入同源 scanner bundle + 截图 PNG base64 回传前端 `analyzeThemeV2` 量化评分；`render.rs` 抽离 `render_collect` 与集成测试（真实渲染 `example.com` 1 passed）；采用 connect 优先模式（`HIA_CHROME_WS` 复用已运行 Chrome CDP，避开 chromiumoxide launch 与新版 Chrome 的 CDP 兼容问题），launch 作离线/CI 回退。
- **跨端同源约束**：Electron 注入与 Tauri `include_str!` 必须复用同一份 `extractor/dist/browser-scanner.bundle.js`；提供 `HIA/extractor/scripts/verify-bundle-consistency.mjs` 校验两端引用为同一文件（hash 一致），保证算法一致与评分可复现。

### P5 增强项（5 项，完整交付原始规格 P5 节）

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

## [`W-tb-P4`] 工程化、合规与文档化收尾（2026-08-05）

- CI 矩阵增强：`.github/workflows/pages.yml` 在部署前对 `core`/`web`/`electron`/`tauri` 四端做构建与测试校验（electron/tauri 以 `--ignore-scripts` 跳过重型二进制下载，仅编译 + SSRF 单测）。
- 三端冒烟证据齐备：core 单测 7/7、web 构建 0 错误、electron `tsc` 0 + SSRF 单测 8/8、tauri 前端 `tsc` 0 + SSRF 单测 6/6（Rust 端到端启动待工具链，符合 `W-tb-P3` 限制）。
- 许可证复核：补齐 `HIA/tauri/LICENSE`（MIT），新增 `work-zone/dev/audits/license-audit-tauri-2026-08-05.md`；混合许可证策略（根 MIT / electron Apache-2.0 / tauri MIT）证据齐备。
- ROP 文档化：为 `core` 与 `web` 全部源码补全中英双语注释（commit `c43e49c`）。

## [`W-tb-P3`] 三端具象：web 发布 + electron/tauri 骨架与网址取色（2026-08-05）

- web 在线主题构建 + GitHub Pages 发布；操作台/PC/小程序预览/8 渐变角色/Token 导出可交互。
- electron/tauri 桌面骨架 + 从指定网址获取颜色集（SSRF 校验 + `core.analyze` 多信号加权）。
- core 抽离为公共核心（`HIA/core`），被各端以 `file:` 链接复用。

## [`W-tb-P2`] 公共核心 core（基线）

- 建立 `HIA/core` 公共主题模型、颜色算法、Token 导出，供各端复用。

## [`W-tb-P1`] 项目初始化（基线）

- 建立 mono-repo 容器结构与双仓库边界（公开主库 + 私有 WorkZone）。
- 落地 `README.md`、`AGENTS.md`、`LICENSE`、`work-zone/` 私有工作区基线。
- 引入 HIA-Documentation-Sys 通知读取状态登记机制。
- 建立首份周期规划、里程碑与任务状态账本样板。

> 更多阶段条目随实现推进在公开发布时补充；过程性规划与 closeout 保存在私有 `work-zone/`。
