// @lang zh-CN 语义状态色与圆角/阴影（`W-tb-P37`）：面板文案、控件标签与状态行。
// <lang en>Semantic statuses & radius/shadow (`W-tb-P37`): panel copy, control labels and status lines.</lang>
import{registerStrings}from'./i18n.js';

registerStrings({
  'p37.semantic.title': { zh: '语义状态色', en: 'Semantic status colours' },
  'p37.semantic.desc': { zh: 'success / info / warning / danger 四组随主题派生（色相按语义固定，明暗随主色收敛，ADR-012）；可逐组覆盖，或一键写入辅助槽位。', en: 'success / info / warning / danger derive with the theme (fixed semantic hues, lightness converging from the primary, ADR-012); override per group or copy into aux slots.' },
  'p37.semantic.derive': { zh: '从主色派生', en: 'Derive from primary' },
  'p37.semantic.toaux': { zh: '写入辅助槽位', en: 'Copy to aux slots' },
  'p37.semantic.notset': { zh: '未派生', en: 'Not derived' },
  'p37.semantic.notset.desc': { zh: '点击"从主色派生"生成该组；旧主题保持原样不被静默修改（ADR-012 决策 6）。', en: 'Click "Derive from primary" to generate; legacy themes stay untouched (ADR-012 decision 6).' },
  'p37.semantic.light': { zh: '浅色用途', en: 'Light usage' },
  'p37.semantic.dark': { zh: '深色用途', en: 'Dark usage' },
  'p37.semantic.follow': { zh: '跟随主色', en: 'Follow primary' },
  'p37.semantic.status': { zh: '已派生 {d}/{n} 组（跟随主色）；被覆盖的组停随主色。', en: '{d}/{n} groups derived (following the primary); overridden groups stop following.' },
  'p37.semantic.status.none': { zh: '当前主题未携带语义色组——派生后随导出物一起输出。', en: 'This theme carries no semantic group yet — derive once and it exports with the theme.' },
  'p37.semantic.copied': { zh: '已把 {n} 组语义色写入辅助槽位（可在操作台继续微调）。', en: 'Copied {n} semantic groups into the auxiliary slots (tweakable in the console).' },
  'p37.radius.label': { zh: '圆角基准（px）', en: 'Base radius (px)' },
  'p37.radius.aria': { zh: '圆角基准像素滑杆', en: 'Base radius slider' },
  'p37.shadow.label': { zh: '阴影强度', en: 'Shadow strength' },
  'p37.shadow.aria': { zh: '阴影强度选择', en: 'Shadow strength select' },
  'p37.shadow.none': { zh: '无阴影', en: 'None' },
  'p37.shadow.soft': { zh: '柔和（soft）', en: 'Soft' },
  'p37.shadow.medium': { zh: '中等（medium）', en: 'Medium' },
  'p37.shadow.strong': { zh: '强烈（strong）', en: 'Strong' },
  'p37.shadow.tint': { zh: '阴影混入主色（品牌化）', en: 'Tint shadows with the primary' }
});
