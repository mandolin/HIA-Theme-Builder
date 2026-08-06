# Fixture 站点期望清单（指令第十四节）

本目录为跨端契约测试的本地金标页面，**不依赖互联网**（除 fixture 04/08/12 中占位 URL 仅作标记，真实渲染测试时由适配器拦截或忽略外部资源）。

每个 fixture 明确记录期望，供 P3 Core 评分与 P2/P4 渲染适配器核对。

| # | 文件 | 场景 | 期望 primary | 期望 secondary / derived | 不应获胜 | 最低置信度 | 关键 reasons |
|---|------|------|--------------|--------------------------|----------|------------|--------------|
| 01 | 01-explicit-brand-primary.html | 显式 --brand-primary | `#6D28D9` | 无显式 → derived fallback | 表面 `#F5F3FF` | 0.82 | 命中 --brand-primary 且在 .header/.cta 实际使用；meta theme-color 呼应 |
| 02 | 02-repeat-cta-no-token.html | 无 token 仅重复 CTA | `#0EA5E9` | derived fallback | 背景 `#F9FAFB` | 0.70 | 4 个重复 CTA 背景；无 token/logo 互证 |
| 03 | 03-mono-black-white.html | 黑白单色品牌 | `#111111` | derived fallback | 无（单色合法） | 0.82 | 显式 --brand；不应被硬过滤为"无主色" |
| 04 | 04-photo-hero-clear-ui.html | 照片 hero + 明确 UI 品牌 | `#E11D48` | derived fallback | 照片中性色 `#222` | 0.82 | 照片色无 token/CTA 呼应须降权；UI brand 在 nav/cta |
| 05 | 05-multicolor-gradient.html | 多色 gradient | 取最显著渐变段之一 | derived fallback | 深色 footer `#0F172A` 不应主导 | 0.65 | 渐变色标作为 gradient-stop 证据；需 OKLab 聚类合并 |
| 06 | 06-svg-logo.html | SVG logo | `#059669` | derived fallback | 白 `#FFFFFF` 仅 surface | 0.82 | SVG fill + nav 背景互证；logo 角色 |
| 07 | 07-open-shadow-root.html | open shadow root | `#1E3A8A` | derived fallback | 无 | 0.80 | scanner 须递归进入 shadow；badge/cta 同色 |
| 08 | 08-iframe-same-third.html | same/third-party iframe | `#7C3AED` | derived fallback | third-party 帧色降权 | 0.78 | 主帧 brand；third-party 标记 frameKind 低权重 |
| 09 | 09-status-dashboard.html | status dashboard | `#2563EB` | derived fallback | `#16A34A`/`#CA8A04`/`#DC2626` 状态色 | 0.82 | 状态红绿不误判品牌；topbar brand 主色 |
| 10 | 10-dark-theme.html | dark theme | `#0EA5E9` | derived fallback | 深色 bg `#0B1120` 仅 surface | 0.82 | dark 下品牌仍识别；meta color-scheme=dark |
| 11 | 11-modern-color-funcs.html | OKLCH/LAB/color-mix | 解析后品牌 OKLCH 对应 sRGB | derived fallback | 无 | 0.80 | 须注入浏览器解析器解析 oklch/lab/color-mix |
| 12 | 12-slow-spa-lazy.html | 慢 SPA + lazy | `#D97706` | derived fallback | 无 | 0.78 | 稳定化需等待 2s 懒加载后扫描；顶部 brand 稳定 |

## 通用要求

- 主色候选来自 brand/primary/CTA/accent，不让 surface/text/border/status 同池竞争。
- 无显式 secondary 时 `derived:true, origin:'harmony-fallback'`。
- 返回 8~12 个 alternatives。
- SSRF/降级：无浏览器时 `mode:'degraded-static'`，confidenceCap 0.45。
- 跨端：Electron 与 Tauri 对同一 fixture 输出同一 V2 schema，主副色语义一致（像素允许小范围感知色差）。
