/**
 * @lang zh-CN `W-tb-P11` 新增界面词条：主色系配色关系区（模式/规则/宝典预设/成员卡）与辅助色区（手动/规则生成/槽位）。
 * @lang en `W-tb-P11` UI strings: series harmony block (mode/rules/baodian presets/member cards) and the auxiliary block.
 */
import { registerStrings } from './i18n.js';

registerStrings({
  // 面板标题。
  // <lang zh-CN>操作台内配色关系面板。</lang>
  // <lang en>Harmony panel inside the console.</lang>
  'p11.panel.title': { zh: '配色关系模式与辅助色', en: 'Harmony Modes & Auxiliary Colors' },
  'p11.panel.desc': { zh: '主色系支持单色/双色/三色三种模式，十种基本配色设计映射为关系规则（规则右边可选配色宝典预设）；辅助色是主色系之外的独立槽位。', en: 'The primary series supports single/dual/triad modes; the ten classic designs map to relation rules (with Baodian presets); auxiliary colors are independent slots outside the series.' },
  // 主色系区。
  // <lang zh-CN>模式/规则/预设与成员卡。</lang>
  // <lang en>Mode/rules/presets and member cards.</lang>
  'p11.series.mode': { zh: '主色系模式', en: 'Series mode' },
  'p11.series.single': { zh: '单色', en: 'Single' },
  'p11.series.dual': { zh: '双色', en: 'Dual' },
  'p11.series.triad': { zh: '三色', en: 'Triad' },
  'p11.series.relation': { zh: '关系规则', en: 'Relation rule' },
  'p11.series.preset': { zh: '宝典预设', en: 'Baodian preset' },
  'p11.series.apply': { zh: '应用预设', en: 'Apply preset' },
  'p11.series.reset': { zh: '还原用户色', en: 'Restore mine' },
  'p11.series.presetApplied': { zh: '已应用宝典预设 {combo}（{emotion}）——主色系成员为组合色号，可手动覆写。', en: 'Preset {combo} ({emotion}) applied — series members use the combo colors, overridable by hand.' },
  'p11.series.noSnapshot': { zh: '没有可还原的快照（先应用一次预设）。', en: 'No snapshot to restore yet (apply a preset first).' },
  'p11.series.info.single': { zh: '单色模式：主色系 1 个色相，副色取主色系深档变体（系统按钮/进度/标签照常工作）。', en: 'Single mode: one hue in the series; the secondary becomes a deep primary variant (buttons/progress/tags keep working).' },
  // 成员卡。
  // <lang zh-CN>主色系成员角色标注。</lang>
  // <lang en>Series member role labels.</lang>
  'p11.member.primary': { zh: '主色', en: 'Primary' },
  'p11.member.secondary': { zh: '副色（用户根基）', en: 'Secondary (user root)' },
  'p11.member.variant': { zh: '副色（主色系变体）', en: 'Secondary (series variant)' },
  'p11.member.third': { zh: '第三色（规则推导，可覆写）', en: 'Third (derived, overridable)' },
  // 辅助色区。
  // <lang zh-CN>独立槽位的添加/生成/删除。</lang>
  // <lang en>Add/generate/delete for the independent slots.</lang>
  'p11.aux.title': { zh: '辅助色（主色系之外）', en: 'Auxiliary colors (outside the series)' },
  'p11.aux.tag': { zh: '独立槽位 0..n · 与主色系模式无关', en: 'Independent slots 0..n · unrelated to the series mode' },
  'p11.aux.name.placeholder': { zh: '名称（如 强调橙）', en: 'Name (e.g. Accent Orange)' },
  'p11.aux.add': { zh: '手动添加', en: 'Add manually' },
  'p11.aux.gen': { zh: '按规则生成', en: 'Generate by rule' },
  'p11.aux.clear': { zh: '清空', en: 'Clear' },
  'p11.aux.delete': { zh: '删除', en: 'Delete' },
  'p11.aux.empty': { zh: '尚无辅助色——手动添加，或点"按规则生成"。', en: 'No auxiliary colors yet — add one manually or generate by rule.' },
  'p11.aux.slotMeta': { zh: '色阶 aux{i}-50…900 · 前景 on-aux{i}', en: 'shades aux{i}-50…900 · foreground on-aux{i}' },
  // 关系规则名（下拉选项，数据侧 name 为中文——此处提供英文映射）。
  // <lang zh-CN>规则下拉直接用 core 的中文 name；en 语言下由 t() 映射英文名。</lang>
  // <lang en>The dropdown uses core's zh names; en maps via t().</lang>
  '手动（现行）': { zh: '手动（现行）', en: 'Manual (current)' },
  '互补 complement': { zh: '互补 complement', en: 'Complement' },
  '冲突 clash': { zh: '冲突 clash', en: 'Clash' },
  '中性 neutral': { zh: '中性 neutral', en: 'Neutral' },
  '类比 analogous': { zh: '类比 analogous', en: 'Analogous' },
  '分裂补色 split-complement': { zh: '分裂补色 split-complement', en: 'Split complement' },
  '三次色三色 tertiary': { zh: '三次色三色 tertiary', en: 'Tertiary triad' },
  '原色组合 primary': { zh: '原色组合 primary', en: 'Primary combo' },
  '二次色组合 secondary': { zh: '二次色组合 secondary', en: 'Secondary combo' },
  '纯色 pure': { zh: '纯色 pure', en: 'Pure' }
});
