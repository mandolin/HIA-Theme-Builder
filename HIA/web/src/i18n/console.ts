/**
 * @lang zh-CN 控制台 UI 字典（`W-tb-P7`）：语义键 → 中英双语文本。
 *   覆盖 hero、网址取色探索面板、主题操作台、候选库、Token 导出、主题库管理、渐变设置等
 *   用户实际交互的控制台区域（演示预览内容见 preview-pc/preview-wx，用中文原文键）。
 * @lang en Console UI dictionary (`W-tb-P7`): semantic keys → bilingual text.
 *   Covers hero, URL color exploration panel, theme console, candidate libraries, token export,
 *   theme library management, gradient settings — the interactive console area (demo preview
 *   content lives in preview-pc/preview-wx, keyed by Chinese source text).
 */

import { registerStrings } from './i18n.js';
import type { StringEntry } from './i18n.js';

/**
 * @lang zh-CN 控制台字典条目。键名按 `区域.元素` 命名（HIA《命名规范》语义化原则）。
 * @lang en Console dictionary entries. Keys follow `area.element` naming (HIA naming spec).
 */
const CONSOLE: Record<string, StringEntry> = {
  // ---- Hero 区域 ----
  'hero.title': { zh: 'HIA 主题库管理页', en: 'HIA Theme Library Manager' },
  'hero.desc': {
    zh: '这是一个可用于默认主题、多业务项目、多示例项目和主题皮肤管理的工作台。你可以从主副色操作台选择或生成主题预设，导入主题库，并一键切换到 <b>PC 版企业后台完整预览</b> 与 <b>小程序示例预览</b>。支持多结构模式、深色/浅色预览、主题预设管理、CSS/JSON Token 导出。',
    en: 'A workbench for default themes, multi-project themes, sample themes and skin management. Pick or generate theme presets from the primary/secondary console, import them into the library, and switch to the <b>PC enterprise preview</b> or the <b>Mini-Program sample preview</b>. Supports multiple layout modes, dark/light previews, preset management, and CSS/JSON token export.'
  },
  'hero.chip.default': { zh: '默认主题：钴蓝 #0047AB + 清透青 #00A8D3', en: 'Default theme: Cobalt #0047AB + Clear Cyan #00A8D3' },
  'hero.chip.candidates': { zh: '主色候选：44', en: 'Primary candidates: 44' },
  'hero.chip.presets': { zh: '内置主题预设：6', en: 'Built-in presets: 6' },
  'hero.chip.custom': { zh: '可保存自定义主题到本地主题库', en: 'Save custom themes to your local library' },

  // ---- 网址取色探索面板 ----
  'explore.title': { zh: '网址取色探索', en: 'URL Color Exploration' },
  'explore.desc': {
    zh: '输入网址，由桌面端真实渲染并分析出推荐主副色、置信度、理由与候选（指令十五节）。',
    en: 'Enter a URL; the desktop end renders it for real and analyzes recommended primary/secondary colors, confidence, reasons and candidates.'
  },
  'explore.url.label': { zh: '目标网址', en: 'Target URL' },
  'explore.action': { zh: '探索并分析', en: 'Explore & Analyze' },
  'explore.stage.idle': { zh: '等待输入网址', en: 'Waiting for a URL' },
  // 应用范围复选框与提示（W-tb-P14）：取色结果按勾选范围落到操作台。
  // <lang en>Apply-scope checkboxes for the explore result (base pair / auxiliary slots).</lang>
  'explore.apply.scopeAria': { zh: '取色应用范围', en: 'Apply scope' },
  'explore.apply.base': { zh: '应用主副色', en: 'Apply primary & secondary' },
  'explore.apply.aux': { zh: '应用其它色到辅助色', en: 'Apply other colors to auxiliary' },
  'explore.apply.none': { zh: '未选择任何应用范围——请至少勾选一项。', en: 'No apply scope selected — check at least one.' },
  'explore.auxName': { zh: '取色辅助', en: 'Explore aux' },
  // 顶部站点链接（W-tb-P14）：GitHub 仓库与文档子站。
  // <lang en>Top-right site links (repo / docs subsite).</lang>
  'top.docs': { zh: '文档', en: 'Docs' },

  // ---- 主题操作台 ----
  'console.title': { zh: '当前主题操作台', en: 'Theme Console' },
  'console.desc': { zh: '选择主色、自动生成副色，设置主题名称与分类，然后生成导入到主题库。', en: 'Pick a primary, auto-generate secondaries, set theme name and category, then import into the library.' },
  'console.name.label': { zh: '主题名称', en: 'Theme Name' },
  'console.name.placeholder': { zh: '输入主题名称，留空可自动命名', en: 'Theme name; leave blank to auto-name' },
  'console.category.label': { zh: '主题分类', en: 'Category' },
  'console.primary.label': { zh: '主色 / HEX', en: 'Primary / HEX' },
  'console.secondary.label': { zh: '副色 / HEX', en: 'Secondary / HEX' },
  'console.primaryName.label': { zh: '主色名称', en: 'Primary Name' },
  'console.secondaryName.label': { zh: '副色名称', en: 'Secondary Name' },
  'console.generate.title': { zh: '副色自动适配生成', en: 'Secondary Auto-Generation' },
  'console.generate.desc': { zh: '将基于当前主色生成一组副色候选；若当前主色在候选库中，则优先给出其预设副色。', en: 'Generates secondary candidates from the current primary; if the primary exists in the candidate library, its preset secondary comes first.' },
  'console.generate.action': { zh: '生成副色系', en: 'Generate Secondaries' },
  'console.apply': { zh: '应用当前主题', en: 'Apply Theme' },
  'console.savePreset': { zh: '生成并导入主题库', en: 'Generate & Import' },
  'console.updatePreset': { zh: '更新当前选中预设', en: 'Update Selected Preset' },
  'console.autoName': { zh: '自动命名', en: 'Auto Name' },

  // ---- 主色候选库 / 副色候选区 ----
  'primary.lib.title': { zh: '主色候选库', en: 'Primary Candidates' },
  'primary.lib.desc': {
    zh: '包含默认主题、20 个获奖网站颜色候选，以及一批适合业务项目与示例项目的流行主题色。每个主色都附带一个预设副色系。',
    en: 'Includes the default theme, 20 award-winning site colors, and popular theme colors for business and sample projects. Each primary ships with a preset secondary.'
  },
  'secondary.lib.title': { zh: '副色候选区', en: 'Secondary Candidates' },
  'secondary.lib.desc': { zh: '点击“生成副色系”后，可在此挑选更合适的副色。当前主题库预设副色会优先置顶。', en: 'After "Generate Secondaries", pick a better fit here. Preset secondaries from the library are pinned first.' },

  // ---- Token 导出 ----
  'token.title': { zh: '主题 Token 导出', en: 'Theme Token Export' },
  'token.desc': { zh: '生成当前主题对应的 CSS 变量与 JSON 结构，便于导入示例项目、业务项目和组件库。', en: 'Generates CSS variables and JSON for the current theme, ready for sample projects, business projects and component libraries.' },
  'token.copyCss': { zh: '复制 CSS Token', en: 'Copy CSS Tokens' },
  'token.copyJson': { zh: '复制 JSON Token', en: 'Copy JSON Tokens' },
  'token.css.label': { zh: 'CSS Token', en: 'CSS Tokens' },
  'token.json.label': { zh: 'JSON Token', en: 'JSON Tokens' },

  // ---- 主题库管理 ----
  'library.title': { zh: '主题库管理', en: 'Theme Library' },
  'library.desc': { zh: '支持预设搜索、分类筛选、主题应用、删除自定义预设，以及按行业快速挑选。', en: 'Preset search, category filters, theme application, custom preset deletion, and quick picks by industry.' },
  'library.search.placeholder': { zh: '搜索主题名称 / 主色 / 副色', en: 'Search by name / primary / secondary' },
  'library.filter.all': { zh: '全部分类', en: 'All Categories' },
  'library.stat.selected': { zh: '当前选中预设', en: 'Selected Preset' },
  'library.stat.colors': { zh: '主色 / 副色', en: 'Primary / Secondary' },
  'library.stat.count': { zh: '主题库数量', en: 'Library Size' },
  'library.stat.count.note': { zh: '内置 + 本地保存', en: 'Built-in + locally saved' },
  'library.stat.colors.note': { zh: '会同步作用于两个预览区', en: 'Applies to both preview areas' },
  'library.stat.layout': { zh: '结构 / 外观', en: 'Layout / Appearance' },

  // ---- 渐变设置 ----
  'gradient.title': { zh: 'PC／小程序共用渐变设置', en: 'Shared Gradient Settings (PC / Mini-Program)' },
  'gradient.desc': {
    zh: '这是独立于两个预览区的全局渐变操作台，同时作用于 PC 版企业后台和小程序示例。除细长进度条外，所有渐变统一使用主色自身色阶或副色自身色阶；可分别设置色系、起止色阶、方向以及哪一端占大头。配置会随主题预设保存，并进入 CSS／JSON Token 导出。',
    en: 'A global gradient console independent of both preview areas, applying to the PC enterprise preview and Mini-Program sample alike. Except thin progress bars, all gradients use primary-own or secondary-own tonal scales; set color family, start/end shades, direction and dominant end per gradient. Configuration is saved with theme presets and exported via CSS/JSON tokens.'
  },
  'gradient.resetAll': { zh: '全部恢复默认', en: 'Reset All to Default' },
  'gradient.collapse': { zh: '收起设置', en: 'Collapse Settings' },
  'gradient.expand': { zh: '展开设置', en: 'Expand Settings' },

  // ---- PC 预览外壳（chrome，非演示内容） ----
  'pc.title': { zh: 'PC 版企业后台完整预览', en: 'PC Enterprise Console Preview' },
  'pc.desc': { zh: '包含仪表盘、列表页、表单页、详情页、分析页、设置页；并可切换左右结构、上下结构与工作台混合结构。', en: 'Dashboard, list, form, detail, analytics and settings pages; switch between sidebar, top-nav and mixed workbench layouts.' },
  'pc.layout.sidebar': { zh: '左右结构', en: 'Sidebar Layout' },
  'pc.layout.top': { zh: '上下结构', en: 'Top-Nav Layout' },
  'pc.layout.mixed': { zh: '混合工作台', en: 'Mixed Workbench' },
  'pc.appearance.light': { zh: '浅色', en: 'Light' },
  'pc.appearance.dark': { zh: '深色', en: 'Dark' },

  // ---- 小程序预览外壳 ----
  'wx.title': { zh: '小程序示例预览', en: 'Mini-Program Sample Preview' },
  'wx.desc': { zh: '包含首页、列表页、详情页、我的信息、表单页等常见小程序页面。当前主题会一键同步到所有页面。', en: 'Common Mini-Program pages: home, list, detail, profile and form. The current theme syncs to all pages in one click.' },
  'wx.tab.home': { zh: '首页', en: 'Home' },
  'wx.tab.list': { zh: '列表页', en: 'List' },
  'wx.tab.detail': { zh: '详情页', en: 'Detail' },
  'wx.tab.profile': { zh: '我的', en: 'Profile' },
  'wx.tab.form': { zh: '表单页', en: 'Form' },

  // ---- 分类选项（两处 select 共用） ----
  'category.default': { zh: '默认主题', en: 'Default Theme' },
  'category.business': { zh: '业务系统', en: 'Business System' },
  'category.industry': { zh: '行业主题', en: 'Industry Theme' },
  'category.award': { zh: '获奖参考', en: 'Award Reference' },
  'category.creative': { zh: '创意展示', en: 'Creative Showcase' },
  'category.dark': { zh: '深色主题', en: 'Dark Theme' },
  'category.custom': { zh: '自定义', en: 'Custom' },

  // ---- 语言切换 ----
  'lang.switch': { zh: 'EN', en: '中文' },

  // ---- ARIA 标签（无障碍，不显示但读屏可见） ----
  'aria.primaryPicker': { zh: '主色颜色选择器', en: 'Primary color picker' },
  'aria.secondaryPicker': { zh: '副色颜色选择器', en: 'Secondary color picker' },
  'aria.primaryHex': { zh: '主色十六进制值', en: 'Primary hex value' },
  'aria.secondaryHex': { zh: '副色十六进制值', en: 'Secondary hex value' },
  'aria.exploreUrl': { zh: '取色目标网址', en: 'URL to extract colors from' },
  'aria.presetSearch': { zh: '搜索主题预设', en: 'Search theme presets' },
  'aria.presetFilter': { zh: '按分类筛选预设', en: 'Filter presets by category' },
  'aria.cssOutput': { zh: 'CSS Token 输出（只读）', en: 'CSS token output (read-only)' },
  'aria.jsonOutput': { zh: 'JSON Token 输出（只读）', en: 'JSON token output (read-only)' },
  'aria.themeName': { zh: '主题名称输入', en: 'Theme name input' },
  'aria.themeCategory': { zh: '主题分类选择', en: 'Theme category select' },
  'aria.exploreStatus': { zh: '取色分析状态', en: 'Color extraction status' },
  'aria.generateStatus': { zh: '副色生成状态', en: 'Secondary generation status' }
};

registerStrings(CONSOLE);
