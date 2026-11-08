/**
 * @lang zh-CN `W-tb-P9` 新增界面词条：预览区三类型 Tab、经典支持场景预览、TDON 自定义支持、
 *   字体/间距令牌操作台（ADR-006）与导出三 Tab / 文件树 / ZIP 下载（ADR-005）。
 * @lang en `W-tb-P9` UI strings: preview three-type tabs, classic-support scenario previews, TDON
 *   custom support, typography/spacing console (ADR-006) and export three-tab / file tree / ZIP download (ADR-005).
 */
import { registerStrings } from './i18n.js';

registerStrings({
  // 预览区三类型 Tab。
  // <lang zh-CN>切换默认（PC/小程序）、经典支持、自定义支持三种预览类型。</lang>
  // <lang en>Switch preview types: default (PC/Mini-Program), classic support, custom support (TDON).</lang>
  'p9.preview.title': { zh: '预览区', en: 'Preview Area' },
  'p9.preview.desc': { zh: '三种预览类型：默认（PC 后台 + 小程序）、经典支持（WordPress / Tailwind 目标场景令牌注入）、自定义支持（TDON 声明式，运行时延后接入）。', en: 'Three preview types: default (PC console + mini program), classic support (WordPress / Tailwind target-scenario token injection), custom support (TDON declarative; runtime lands later).' },
  'p9.preview.mode.default': { zh: '默认预览', en: 'Default' },
  'p9.preview.mode.classic': { zh: '经典支持', en: 'Classic' },
  'p9.preview.mode.tdon': { zh: '自定义支持', en: 'Custom (TDON)' },
  'p9.preview.hint.default': { zh: '当前：默认预览——PC 版企业后台与小程序示例两块预览区。', en: 'Current: default preview — the PC console and mini-program preview panels.' },
  'p9.preview.hint.classic': { zh: '当前：经典支持——选择目标栈，以当前主题令牌注入其真实场景 mock。', en: 'Current: classic support — pick a target stack; its real-scenario mock is injected with the current theme tokens.' },
  'p9.preview.hint.tdon': { zh: '当前：自定义支持——TDON 运行时延后接入（见自定义支持面板说明）。', en: 'Current: custom support — TDON runtime lands later (see the custom-support panel notes).' },
  // 经典支持。
  // <lang zh-CN>WP / Tailwind 场景 mock 的面板标题与说明、目标下拉。</lang>
  // <lang en>Panel title/notes for WP / Tailwind scenario mocks and the target dropdown.</lang>
  'p9.classic.title': { zh: '经典支持场景预览', en: 'Classic-Support Scenario Preview' },
  'p9.classic.desc': { zh: '以真实目标场景（WordPress 前台/后台、Tailwind 落地页）注入当前主题令牌，验证主题在经典栈上的落地效果。', en: 'Injects the current theme tokens into real target scenarios (WordPress front/admin, Tailwind landing) to verify how the theme lands on classic stacks.' },
  'p9.classic.target.wp': { zh: 'WordPress 子主题场景', en: 'WordPress child-theme scenario' },
  'p9.classic.target.tw': { zh: 'Tailwind 落地页场景', en: 'Tailwind landing scenario' },
  'p9.classic.wp.note': { zh: 'WordPress 子主题场景：前台页头/主视觉/卡片与后台（管理栏 + 侧边菜单）均消费 --hia-* 令牌；theme.json 面板与渐变预设见「导出与集成」。', en: 'WordPress child-theme scenario: front-end header/hero/cards and the admin side (admin bar + menu) all consume --hia-* tokens; the theme.json palette and gradient presets live in Export & Integration.' },
  'p9.classic.tw.note': { zh: 'Tailwind 场景：导航/主视觉/特性卡/页脚映射 tailwind.config.js 的 colors 与 fontFamily（bg-primary-700、font-heading 等类名直接可用）。', en: 'Tailwind scenario: nav/hero/feature cards/footer map to tailwind.config.js colors and fontFamily (bg-primary-700, font-heading, etc. work out of the box).' },
  // TDON 自定义支持。
  // <lang zh-CN>源子 Tab（URL/本地）、连接按钮与占位说明（运行时延后）。</lang>
  // <lang en>Source sub-tab (URL/local), connect button and placeholder notes (runtime deferred).</lang>
  'p9.tdon.title': { zh: '自定义支持（TDON）', en: 'Custom Support (TDON)' },
  'p9.tdon.desc': { zh: '连接 TDON 声明式适配文件（tdon-1.0-draft）后，Theme Builder 按其声明生成本目标的预览区与导出文件树。', en: 'Once a TDON declarative adapter file (tdon-1.0-draft) is connected, Theme Builder renders this target\'s preview and export tree from its declaration.' },
  'p9.tdon.source.url': { zh: 'URL 源', en: 'URL source' },
  'p9.tdon.source.local': { zh: '本地文件', en: 'Local file' },
  'p9.tdon.connect': { zh: '连接 TDON', en: 'Connect TDON' },
  'p9.tdon.status.pending': { zh: '运行时未接入', en: 'Runtime not connected' },
  'p9.tdon.placeholder.title': { zh: 'TDON 运行时按 `W-tb-P9` 方案 A 延后接入', en: 'TDON runtime is deferred per the `W-tb-P9` plan A' },
  'p9.tdon.placeholder.desc': { zh: '连接器（URL 走 SSRF 管线 / 本地文件）→ JSON 解析 → specVersion 路由 → Schema 校验 → 注册为自定义目标，将在后续工作项实现；本面板与导出区「自定义支持」Tab 为界面占位，不含可执行逻辑。规范见 TDON 规范 v0。', en: 'Connector (URL via the SSRF pipeline / local file) → JSON parse → specVersion routing → Schema validation → register as a custom target, lands in a later work item; this panel and the Export "Custom (TDON)" tab are UI placeholders with no executable logic. See TDON spec v0.' },
  // 字体/间距令牌操作台（ADR-006）。
  // <lang zh-CN>三族字体、模数字号、行高、间距序列的操作台文案。</lang>
  // <lang en>Console copy for the three font families, modular scale, line height and spacing sequence.</lang>
  'p9.typo.title': { zh: '设计令牌操作台：字体与间距', en: 'Design-Token Console: Typography & Spacing' },
  'p9.typo.desc': { zh: '字体三族（正文/标题/等宽）与模数字号比例尺、正文行高、间距基数网格实时编辑；所有修改即时注入预览区与导出产物（CSS 变量 --hia-font-* / --hia-fs-* / --hia-space-*，ADR-006）。', en: 'Live editing for the three font families (body/heading/mono), the modular font-size scale, body line height and the spacing base grid; every change injects instantly into previews and exports (CSS vars --hia-font-* / --hia-fs-* / --hia-space-*, ADR-006).' },
  'p9.typo.reset': { zh: '恢复默认', en: 'Reset to defaults' },
  'p9.typo.family.body': { zh: '正文字体族', en: 'Body font family' },
  'p9.typo.family.heading': { zh: '标题字体族', en: 'Heading font family' },
  'p9.typo.family.mono': { zh: '等宽字体族', en: 'Monospace font family' },
  'p9.typo.family.heading.inherit': { zh: '填 inherit 表示沿用正文字体族', en: 'Use inherit to follow the body family' },
  'p9.typo.fs.base': { zh: '字号基数（px）', en: 'Font-size base (px)' },
  'p9.typo.fs.ratio': { zh: '比例尺', en: 'Scale ratio' },
  'p9.typo.lineHeight': { zh: '正文行高', en: 'Body line height' },
  'p9.typo.space.base': { zh: '间距基数（px）', en: 'Spacing base (px)' },
  'p9.typo.space.step': { zh: '步进策略', en: 'Step strategy' },
  'p9.typo.space.levels': { zh: '级数', en: 'Levels' },
  'p9.typo.step.linear4': { zh: '线性 +4', en: 'Linear +4' },
  'p9.typo.step.x2': { zh: '倍增 ×2', en: 'Doubling ×2' },
  'p9.typo.step.x15': { zh: '步进 ×1.5', en: 'Stepped ×1.5' },
  'p9.typo.preview.title': { zh: '实时样张', en: 'Live specimen' },
  'p9.typo.preview.spaceTitle': { zh: '间距序列', en: 'Spacing sequence' },
  'p9.typo.preview.lineHeightTitle': { zh: '行高与正文样张', en: 'Line-height & body specimen' },
  'p9.typo.preview.lineHeightBody': { zh: 'HIA 主题构建器把字体与间距作为主题的一等维度：此处正文样张随行高与字号基数实时变化，并同步进入全部预览与导出产物。', en: 'HIA Theme Builder treats typography and spacing as first-class theme dimensions: this body specimen follows line height and base size live and feeds every preview and export artifact.' },
  // 导出与集成三 Tab（ADR-005）。
  // <lang zh-CN>与预览三类型同构联动；经典支持含目标下拉/文件树/ZIP 下载。</lang>
  // <lang en>Isomorphic with the three preview types; classic support carries target dropdown / file tree / ZIP download.</lang>
  'p9.export.mode.default': { zh: '默认', en: 'Default' },
  'p9.export.mode.classic': { zh: '经典支持', en: 'Classic' },
  'p9.export.mode.tdon': { zh: '自定义支持', en: 'Custom (TDON)' },
  'p9.export.target.label': { zh: '导出目标', en: 'Export target' },
  'p9.target.wp': { zh: 'WordPress 子主题（ZIP）', en: 'WordPress child theme (ZIP)' },
  'p9.target.tw': { zh: 'Tailwind 配置（ZIP）', en: 'Tailwind config (ZIP)' },
  'p9.target.inject': { zh: '通用注入模板（ZIP）', en: 'Generic inject template (ZIP)' },
  'p9.export.tree.label': { zh: '文件清单（点击预览内容）', en: 'File tree (click to preview content)' },
  'p9.export.zip': { zh: '下载 ZIP', en: 'Download ZIP' },
  'p9.export.zip.done': { zh: '已生成 {name}（{count} 个文件）', en: 'Generated {name} ({count} files)' },
  'p9.export.zip.fail': { zh: 'ZIP 打包失败，请重试。', en: 'ZIP packaging failed; please retry.' },
  'p9.export.tdon.title': { zh: '自定义支持（TDON）', en: 'Custom Support (TDON)' },
  'p9.export.tdon.desc': { zh: '连接 TDON 声明式适配文件后，此处将列出该目标声明的导出文件树。TDON 运行时（加载/校验/注册）按 W-tb-P9 规划为延后项，本期提供界面占位。', en: 'After connecting a TDON declarative adapter file, the target-declared export tree will be listed here. The TDON runtime (load/validate/register) is deferred per the W-tb-P9 plan; this cycle ships a UI placeholder.' },
  // 场景 mock 演示文案（中文原文键，随语言切换翻译）。
  // <lang zh-CN>WP/Tailwind mock 内的演示文本，走演示内容翻译通道。</lang>
  // <lang en>Demo copy inside the WP/Tailwind mocks, routed through demo-content translation.</lang>
  '站点名称示例': { zh: '站点名称示例', en: 'Sample Site' },
  '后台管理': { zh: '后台管理', en: 'WP Admin' },
  '前台首页': { zh: '前台首页', en: 'Front Page' },
  'WordPress 块主题场景': { zh: 'WordPress 块主题场景', en: 'WordPress block-theme scenario' },
  '主题面板与渐变来自生成的 theme.json，色板含 10 档与自定义色阶。': { zh: '主题面板与渐变来自生成的 theme.json，色板含 10 档与自定义色阶。', en: 'The palette and gradients come from the generated theme.json; the palette carries 10 steps plus custom shades.' },
  '欢迎来到企业门户': { zh: '欢迎来到企业门户', en: 'Welcome to the enterprise portal' },
  '主视觉使用 HIA 渐变令牌（--hia-gradient-carousel），字号与间距随操作台实时变化。': { zh: '主视觉使用 HIA 渐变令牌（--hia-gradient-carousel），字号与间距随操作台实时变化。', en: 'The hero uses the HIA gradient token (--hia-gradient-carousel); type sizes and spacing follow the console live.' },
  '产品服务': { zh: '产品服务', en: 'Products' },
  '解决方案': { zh: '解决方案', en: 'Solutions' },
  '新闻动态': { zh: '新闻动态', en: 'News' },
  '关于我们': { zh: '关于我们', en: 'About' },
  '板块标题示例': { zh: '板块标题示例', en: 'Section Heading' },
  '正文示例：字号取 --hia-fs-body，行高取 --hia-line-height-body，颜色取 --hia-primary-700。': { zh: '正文示例：字号取 --hia-fs-body，行高取 --hia-line-height-body，颜色取 --hia-primary-700。', en: 'Body sample: font-size from --hia-fs-body, line-height from --hia-line-height-body, color from --hia-primary-700.' },
  '仪表盘': { zh: '仪表盘', en: 'Dashboard' },
  '媒体': { zh: '媒体', en: 'Media' },
  '页面': { zh: '页面', en: 'Pages' },
  '外观': { zh: '外观', en: 'Appearance' },
  '插件': { zh: '插件', en: 'Plugins' },
  '用户': { zh: '用户', en: 'Users' },
  '设置': { zh: '设置', en: 'Settings' },
  '站点公告': { zh: '站点公告', en: 'Site notice' },
  '副色用于提醒与强调，符合 HIA 副色语义。': { zh: '副色用于提醒与强调，符合 HIA 副色语义。', en: 'Secondary color carries notices and emphasis, matching HIA secondary semantics.' },
  '快速编辑': { zh: '快速编辑', en: 'Quick Edit' },
  '站点健康': { zh: '站点健康', en: 'Site Health' },
  'Tailwind 落地页场景': { zh: 'Tailwind 落地页场景', en: 'Tailwind landing scenario' },
  'colors.primary / colors.secondary 全档映射，含 ADR-004 自定义色阶。': { zh: 'colors.primary / colors.secondary 全档映射，含 ADR-004 自定义色阶。', en: 'colors.primary / colors.secondary map every step, including ADR-004 custom shades.' },
  '构建一致的设计系统': { zh: '构建一致的设计系统', en: 'Build a consistent design system' },
  '字体族经 fontFamily 透传（body / heading / mono），色阶类名即时可用。': { zh: '字体族经 fontFamily 透传（body / heading / mono），色阶类名即时可用。', en: 'Font families pass through fontFamily (body / heading / mono); shade class names work instantly.' },
  '开始使用': { zh: '开始使用', en: 'Get Started' },
  '查看文档': { zh: '查看文档', en: 'Docs' },
  '功能卡片一': { zh: '功能卡片一', en: 'Feature One' },
  '功能卡片二': { zh: '功能卡片二', en: 'Feature Two' },
  '功能卡片三': { zh: '功能卡片三', en: 'Feature Three' },
  '色阶令牌直接映射为 Tailwind 类名。': { zh: '色阶令牌直接映射为 Tailwind 类名。', en: 'Shade tokens map directly to Tailwind class names.' },
  '由 HIA Theme Builder 生成': { zh: '由 HIA Theme Builder 生成', en: 'Generated by HIA Theme Builder' }
});
