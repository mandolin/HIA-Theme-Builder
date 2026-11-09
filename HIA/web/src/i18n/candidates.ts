/**
 * @lang zh-CN 候选数据字典（`W-tb-P12` i18n 全面清查修复）：主色候选库/副色候选/分组标签的中文数据值英文映射。
 *   ①主色名 44 条与和谐名 9 条——core 数据自带 en 字段，循环注册（零维护漂移）；
 *   ②副色名 42 条/tag/group/scheme/note——本表人工翻译（数据无 en 字段）。
 * @lang en Candidates dictionary (`W-tb-P12` i18n audit fix): English mapping for Chinese data values.
 *   (1) 44 primary names + 9 harmony names carry `en` in core data — registered in a loop (no drift);
 *   (2) 42 secondary names, tags, groups, schemes, notes — hand-translated here (no en field in data).
 */
import { registerStrings } from './i18n.js';
import { primaryCandidates, HARMONY_DEFS } from '@hia/theme-core';

// ① 循环注册：数据自带的英文名（主色候选 + 和谐方案）。
// <lang zh-CN>key=中文原名 value=en 字段；数据新增候选时自动生效。
// <lang en>key is the Chinese source name; auto-covers new candidates.</lang>
const auto: Record<string, { zh: string; en: string }> = {};
for (const c of primaryCandidates) {
  if (c.en && c.en !== c.name) auto[c.name] = { zh: c.name, en: c.en };
}
for (const h of HARMONY_DEFS) {
  if (h.en && h.en !== h.name) auto[h.name] = { zh: h.name, en: h.en };
}
registerStrings(auto);

// ② 人工翻译：副色名（候选数据无 en 字段，42 个唯一值）与方案/标签/分组/说明。
// <lang zh-CN>译名风格对齐 core 现有 en（复合色名用 "X Cyan/Blue/Gold" 构词）。
// <lang en>Style aligned with core's existing en naming (compound "X Cyan/Blue/Gold").</lang>
registerStrings({
  // 形态分区标题（宝典弹层右侧，10 形态）
  "补色色彩组合": { zh: "补色色彩组合", en: "Complement Combos" },
  "原色色彩组合": { zh: "原色色彩组合", en: "Primary Combos" },
  "单色色彩组合": { zh: "单色色彩组合", en: "Pure Combos" },
  "分裂补色色彩组合": { zh: "分裂补色色彩组合", en: "Split Complement Combos" },
  "类比色彩组合": { zh: "类比色彩组合", en: "Analogous Combos" },
  "中性色彩组合": { zh: "中性色彩组合", en: "Neutral Combos" },
  "冲突色彩组合": { zh: "冲突色彩组合", en: "Clash Combos" },
  "分裂色彩组合": { zh: "分裂色彩组合", en: "Split Combos" },
  "三次色色彩组合": { zh: "三次色色彩组合", en: "Tertiary Triads" },
  "二次色色彩组合": { zh: "二次色色彩组合", en: "Secondary Combos" },
  // 情感分类名（宝典弹层菜单，24 类）
  "强烈": { zh: "强烈", en: "Intense" },
  "丰富": { zh: "丰富", en: "Rich" },
  "浪漫": { zh: "浪漫", en: "Romantic" },
  "奔放": { zh: "奔放", en: "Unrestrained" },
  "土性": { zh: "土性", en: "Earthy" },
  "友善": { zh: "友善", en: "Friendly" },
  "柔和": { zh: "柔和", en: "Soft" },
  "热情": { zh: "热情", en: "Passionate" },
  "动感": { zh: "动感", en: "Dynamic" },
  "高雅": { zh: "高雅", en: "Elegant" },
  "流行": { zh: "流行", en: "Trendy" },
  "清新": { zh: "清新", en: "Fresh" },
  "传统": { zh: "传统", en: "Traditional" },
  "清爽": { zh: "清爽", en: "Crisp" },
  "热带": { zh: "热带", en: "Tropical" },
  "古典": { zh: "古典", en: "Classical" },
  "可靠": { zh: "可靠", en: "Reliable" },
  "平静": { zh: "平静", en: "Calm" },
  "堂皇": { zh: "堂皇", en: "Grand" },
  "神奇": { zh: "神奇", en: "Magical" },
  "怀旧": { zh: "怀旧", en: "Nostalgic" },
  "活力": { zh: "活力", en: "Vivacious" },
  "低沉": { zh: "低沉", en: "Subdued" },
  "专职": { zh: "专职", en: "Professional" },
  // 定稿/官方/新建 与远程 rail 单字（PC 侧栏图标字符）
  '定稿': { zh: '定稿', en: 'Final' },
  'HIA 官方': { zh: 'HIA 官方', en: 'HIA Official' },
  '新建': { zh: '新建', en: 'New' },
  '项': { zh: '项', en: 'P' },
  '流': { zh: '流', en: 'F' },
  '表': { zh: '表', en: 'T' },
  '设': { zh: '设', en: 'S' },
  // 官方示例源 theme-pack.json（HIA 自有内容，逐条入典）
  '钴蓝·清透青（官方默认）': { zh: '钴蓝·清透青（官方默认）', en: 'Cobalt · Clear Cyan (HIA Default)' },
  'HIA 官方默认主题：钴蓝基准主色 + 清透青副色，适用于通用企业平台。': { zh: 'HIA 官方默认主题：钴蓝基准主色 + 清透青副色，适用于通用企业平台。', en: 'HIA default theme: cobalt baseline primary with clear-cyan secondary; suits general enterprise platforms.' },
  '松林墨绿': { zh: '松林墨绿', en: 'Pine Forest Green' },
  '苔原青灰': { zh: '苔原青灰', en: 'Tundra Grey-Cyan' },
  '深墨绿主色适合政务与财务场景，副色取苔原青灰过渡，整体稳重不沉闷。': { zh: '深墨绿主色适合政务与财务场景，副色取苔原青灰过渡，整体稳重不沉闷。', en: 'Deep pine green suits civic/finance scenes; tundra grey-cyan bridges it — steady without gloom.' },
  '炉火赭橙': { zh: '炉火赭橙', en: 'Ember Ochre Orange' },
  '琥珀黄': { zh: '琥珀黄', en: 'Amber Yellow' },
  '高饱和暖色对，适合创意展示、活动 Banner 与需要能量感的界面。': { zh: '高饱和暖色对，适合创意展示、活动 Banner 与需要能量感的界面。', en: 'High-saturation warm pair for creative showcases, event banners and energetic UIs.' },
  '薰衣草紫': { zh: '薰衣草紫', en: 'Lavender Purple' },
  '浅青蓝': { zh: '浅青蓝', en: 'Light Teal-Blue' },
  '紫色主色搭配青蓝副色，常见于数据平台与开发者工具的科技感表达。': { zh: '紫色主色搭配青蓝副色，常见于数据平台与开发者工具的科技感表达。', en: 'Purple primary with teal-blue secondary — the tech look of data platforms and dev tools.' },
  '石墨深空': { zh: '石墨深空', en: 'Graphite Deep Space' },
  '晴空蓝': { zh: '晴空蓝', en: 'Clear-Sky Blue' },
  '开发者工具': { zh: '开发者工具', en: 'Developer Tools' },
  '深灰主色降低视觉疲劳，晴空蓝副色负责关键操作与数据强调。': { zh: '深灰主色降低视觉疲劳，晴空蓝副色负责关键操作与数据强调。', en: 'Dark grey reduces eye strain; clear-sky blue drives key actions and data emphasis.' },
  // 副色名（42）
  '清透青': { zh: '清透青', en: 'Clear Cyan' },
  '晨雾青': { zh: '晨雾青', en: 'Morning Mist Cyan' },
  '海沫青': { zh: '海沫青', en: 'Sea Foam Cyan' },
  '清风青': { zh: '清风青', en: 'Breeze Cyan' },
  '电光青': { zh: '电光青', en: 'Electric Cyan' },
  '薄荷青': { zh: '薄荷青', en: 'Mint Cyan' },
  '孔雀青': { zh: '孔雀青', en: 'Peacock Cyan' },
  '柔紫青': { zh: '柔紫青', en: 'Soft Violet Cyan' },
  '活力青': { zh: '活力青', en: 'Vivid Cyan' },
  '霓虹青': { zh: '霓虹青', en: 'Neon Cyan' },
  '亮湖青': { zh: '亮湖青', en: 'Bright Lake Cyan' },
  '远海青': { zh: '远海青', en: 'Far Sea Cyan' },
  '深碳蓝': { zh: '深碳蓝', en: 'Deep Charcoal Blue' },
  '雾海军蓝': { zh: '雾海军蓝', en: 'Naval Haze Blue' },
  '冰川青': { zh: '冰川青', en: 'Glacier Cyan' },
  '粉雾蓝': { zh: '粉雾蓝', en: 'Powder Mist Blue' },
  '墨蓝黑': { zh: '墨蓝黑', en: 'Ink Navy Black' },
  '冰电青': { zh: '冰电青', en: 'Ice Bolt Cyan' },
  '雾靛蓝': { zh: '雾靛蓝', en: 'Fog Indigo' },
  '柠檬黄': { zh: '柠檬黄', en: 'Lemon Yellow' },
  '工业天青': { zh: '工业天青', en: 'Industrial Sky Cyan' },
  '鼠尾草绿': { zh: '鼠尾草绿', en: 'Sage Green' },
  '流光青': { zh: '流光青', en: 'Flowing Light Cyan' },
  '暖沙米': { zh: '暖沙米', en: 'Warm Sand Beige' },
  '海湾青': { zh: '海湾青', en: 'Bay Cyan' },
  '近黑灰': { zh: '近黑灰', en: 'Near-Black Gray' },
  '砂金': { zh: '砂金', en: 'Sand Gold' },
  '陈年金': { zh: '陈年金', en: 'Aged Gold' },
  '赛博青': { zh: '赛博青', en: 'Cyber Cyan' },
  '薄荷水绿': { zh: '薄荷水绿', en: 'Mint Aqua' },
  '蜂蜜黄': { zh: '蜂蜜黄', en: 'Honey Yellow' },
  '琥珀金': { zh: '琥珀金', en: 'Amber Gold' },
  '亮青': { zh: '亮青', en: 'Bright Azure' },
  '亮靛蓝': { zh: '亮靛蓝', en: 'Bright Indigo' },
  '海盐青': { zh: '海盐青', en: 'Sea Salt Cyan' },
  '湖蓝': { zh: '湖蓝', en: 'Lake Blue' },
  '玉青': { zh: '玉青', en: 'Jade Cyan' },
  '珊瑚粉': { zh: '珊瑚粉', en: 'Coral Pink' },
  '亮天青': { zh: '亮天青', en: 'Bright Sky Cyan' },
  '皇金': { zh: '皇金', en: 'Royal Gold' },
  '深海青': { zh: '深海青', en: 'Deep Sea Cyan' },
  '汽油蓝': { zh: '汽油蓝', en: 'Gasoline Blue' },
  // 标签（tag）
  '默认主题': { zh: '默认主题', en: 'Default' },
  '蓝色基准': { zh: '蓝色基准', en: 'Blue Baseline' },
  '获奖蓝': { zh: '获奖蓝', en: 'Award Blue' },
  '获奖网站': { zh: '获奖网站', en: 'Award Site' },
  '流行色': { zh: '流行色', en: 'Trending' },
  // 分组标题（group）
  'HIA 默认与蓝色基准': { zh: 'HIA 默认与蓝色基准', en: 'HIA Default & Blue Baseline' },
  '获奖网站主色': { zh: '获奖网站主色', en: 'Award-Site Primary Colors' },
  '通用流行主题色': { zh: '通用流行主题色', en: 'General Trending Theme Colors' },
  // 和谐方案名（scheme）
  '类比青': { zh: '类比青', en: 'Analogous Cyan' },
  '类比色': { zh: '类比色', en: 'Analogous' },
  '互补暖金': { zh: '互补暖金', en: 'Complementary Warm Gold' },
  '分裂互补': { zh: '分裂互补', en: 'Split Complement' },
  '三角色': { zh: '三角色', en: 'Triadic' },
  '单色扩展': { zh: '单色扩展', en: 'Monochrome Extension' },
  '互补低彩': { zh: '互补低彩', en: 'Muted Complementary' },
  '主题配对': { zh: '主题配对', en: 'Theme Pairing' },
  '预设': { zh: '预设', en: 'Preset' },
  // 和谐方案说明（note，卡片 title 用）
  '协调统一、科技感强；适合作为默认副色思路。': { zh: '协调统一、科技感强；适合作为默认副色思路。', en: 'Coordinated and tech-forward; a solid default-secondary idea.' },
  '更偏创意与前沿。': { zh: '更偏创意与前沿。', en: 'Leans creative and cutting-edge.' },
  '冷暖对比清晰。': { zh: '冷暖对比清晰。', en: 'Clear warm/cool contrast.' },
  '活跃、适合营销入口。': { zh: '活跃、适合营销入口。', en: 'Energetic; suits marketing entries.' },
  '更克制、自然。': { zh: '更克制、自然。', en: 'More restrained and natural.' },
  '暖色强调明显。': { zh: '暖色强调明显。', en: 'Pronounced warm accent.' },
  '自然、正向。': { zh: '自然、正向。', en: 'Natural and positive.' },
  '稳妥但区分度较弱。': { zh: '稳妥但区分度较弱。', en: 'Safe but weakly differentiated.' },
  '成熟、耐看。': { zh: '成熟、耐看。', en: 'Mature and easy on the eyes.' },
  '该主色对应的预设副色，用于形成完整主题色系。': { zh: '该主色对应的预设副色，用于形成完整主题色系。', en: 'Preset secondary paired with this primary, completing the theme.' },
});
