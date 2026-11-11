/**
 * @lang zh-CN `W-tb-P11` 新增界面词条：主色系配色关系区（模式/规则/宝典预设/成员卡）与辅助色区（手动/规则生成/槽位）。
 * @lang en `W-tb-P11` UI strings: series harmony block (mode/rules/baodian presets/member cards) and the auxiliary block.
 */
import { registerStrings } from './i18n.js';

registerStrings({
  // 操作台第三色一等位（ADR-007 v2 定案 1：三组拾色器并列）。
  // <lang zh-CN>三色模式显示，随模式显隐。</lang>
  // <lang en>Shown in triad mode, toggled with the mode.</lang>
  'p11.console.third.label': { zh: '第三色 / HEX（三色模式）', en: 'Third / HEX (triad)' },
  'p11.console.thirdName.label': { zh: '第三色名称', en: 'Third color name' },
  // 渐变色系与辅助交互词条（机制扩充轮）。
  // <lang zh-CN>渐变下拉选项、辅助槽位行内编辑与拖拽提示。</lang>
  // <lang en>Gradient dropdown options, auxiliary inline editors and drag hints.</lang>
  'p11.family.third': { zh: '第三色系', en: 'Third role' },
  'p11.family.thirdShort': { zh: '第三色', en: 'Third' },
  'p11.family.aux': { zh: '辅助色', en: 'Auxiliary' },
  'p11.family.auxShort': { zh: '辅助', en: 'Aux' },
  'p11.aux.colorAria': { zh: '辅助色 {i} 颜色编辑', en: 'Auxiliary {i} color editor' },
  'p11.aux.nameAria': { zh: '辅助色 {i} 名称', en: 'Auxiliary {i} name' },
  'p11.aux.dragHint': { zh: '拖动排序', en: 'Drag to reorder' },
  'p11.card.auxGroup': { zh: '辅助色组', en: 'Auxiliary group' },
  'p11.console.dragHint': { zh: '拖动互换位置', en: 'Drag to swap positions' },
  'p12.drag.hint': { zh: '拖到另一格=互换', en: 'Drag onto another slot to swap' },
  'p12.aux.swapP': { zh: '↔主', en: '↔Pri' },
  'p12.aux.swapS': { zh: '↔副', en: '↔Sec' },
  'p12.aux.swapT': { zh: '↔三', en: '↔3rd' },
  // 面板标题。
  // <lang zh-CN>操作台内配色关系面板。</lang>
  // <lang en>Harmony panel inside the console.</lang>
  'p11.panel.title': { zh: '按配色关系模式生成', en: 'Generate by Relation Mode' },
  'p11.panel.desc': { zh: '主体色支持单色/双色/三色三种模式，十种基本配色设计映射为关系规则（规则右边可选配色宝典预设）', en: 'The body color supports single/dual/triad modes; the ten classic designs map to relation rules (Baodian presets on the right).' },
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
  'p11.aux.title': { zh: '辅助色（主体色之外）', en: 'Auxiliary colors (outside the body color)' },
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
  '纯色 pure': { zh: '纯色 pure', en: 'Pure' },

  // ===== W-tb-P12 新增/重构词条 =====
  'p12.anchor.secondary': { zh: '查看候选 ↓', en: 'View candidates ↓' },
  'p12.third.title': { zh: '第三色自动匹配', en: 'Third color auto-match' },
  'p12.third.desc': { zh: '按规则以当前主色为基准生成第三色（三色模式）；三色系规则均可用。', en: 'Generate the third color from the current primary by rule (triad); all triad rules available.' },
  'p12.third.rule': { zh: '匹配规则', en: 'Match rule' },
  'p12.third.apply': { zh: '自动适配', en: 'Auto fit' },
  'p12.third.remove': { zh: '删除第三色', en: 'Remove third color' },
  'p12.baodian.open': { zh: '宝典选色', en: 'Pick from Baodian' },
  'p12.baodian.title': { zh: '配色宝典 · 情感分类与组合', en: 'Color Baodian · mood categories & combos' },
  'p12.baodian.empty': { zh: '该情感暂无组合。', en: 'No combos for this mood yet.' },
  'p12.baodian.applied': { zh: '已加载宝典组合 {combo} 到主体色（可"还原用户色"回退）。', en: 'Loaded Baodian combo {combo} into the body color ("Restore my colors" to undo).' },
  'p12.rule.pick': { zh: '规则补色', en: 'Rule fill' },
  'p12.rule.completeSecondary': { zh: '补副色', en: 'Fill secondary' },
  'p12.rule.completeThird': { zh: '补第三色', en: 'Fill third' },
  'p12.rule.noSecondary': { zh: '该规则不适用于补副色（仅互补/冲突/中性/纯色可用）。', en: 'Rule not applicable for filling secondary (only complement/clash/neutral/pure).' },
  'p12.rule.noThird': { zh: '该规则不适用于补第三色（需三色系或纯色规则）。', en: 'Rule not applicable for filling third (needs a triad or pure rule).' },
  'p12.mode.single': { zh: '当前：单色主体色（副色取主色系变体）。', en: 'Current: single body color (secondary is a primary-series variant).' },
  'p12.mode.dual': { zh: '当前：双色主体色。点宝典选色/补第三色可切三色。', en: 'Current: dual body color. Use Baodian / fill third to go triad.' },
  'p12.mode.triad': { zh: '当前：三色主体色。删除成员可回到双色/单色。', en: 'Current: triad body color. Remove a member to go back.' },
  'p12.member.recolorAria': { zh: '点击重新选择该主体色成员的颜色', en: 'Re-pick this member color' },
  'p12.member.delAria': { zh: '删除该主体色成员', en: 'Remove this member' },
  'p12.status.appliedDual': { zh: '主色已切换为 {name} {hex}，已自动套用预设副色 {sec} {secHex}。', en: 'Primary switched to {name} {hex}; preset secondary {sec} {secHex} applied.' },
  'p12.status.appliedTriad': { zh: '已按三色组合套用「{name}」（含类比第三色）。', en: 'Triad combo "{name}" applied (with analogous third color).' },
  'p12.status.appliedFull': { zh: '已按全色组合套用「{name}」（三色+两条规则辅助色）。', en: 'Full combo "{name}" applied (triad + two rule-generated aux colors).' },
  'p12.baodian.tag': { zh: '宝典', en: 'Baodian' },
  'p12.source.official': { zh: 'HIA 官方', en: 'HIA Official' },
  'p12.admin.new': { zh: '新建', en: 'New' },
  'p12.rule.derived': { zh: '推导', en: 'derived' },
  'p12.appearance.light': { zh: '浅色', en: 'Light' },
  'p12.appearance.dark': { zh: '深色', en: 'Dark' },
  'p12.family.primary': { zh: '主色', en: 'Primary' },
  'p12.family.secondary': { zh: '副色', en: 'Secondary' },
  'p12.card.modeLabel': { zh: '展示模式', en: 'Display mode' },
  'p12.card.dual': { zh: '双色', en: 'Dual' },
  'p12.card.triad': { zh: '三色', en: 'Triad' },
  'p12.card.full': { zh: '全色', en: 'Full' },
  // 设置页新契约体现（完善批③）：辅助槽位计数与色条无障碍名。
  // <lang en>Settings-page v2 surfacing: aux slot count label and strip aria name.</lang>
  'p12.settings.auxCount': { zh: '{n} 个槽位', en: '{n} slot(s)' },
  'p12.settings.stripAria': { zh: '主体色与辅助色预览', en: 'Body and auxiliary colors preview' },
  // 宝典菜单一键套用（完善批④）：⚡ 快捷钮提示。
  // <lang en>Quick-apply hint on the per-mood lightning button (batch ④).</lang>
  'p12.baodian.quick': { zh: '一键套用该情感首个补色组合', en: 'Quick-apply the first complement combo of this mood' },
  // 语气预设（W-tb-P15）：宝典卡整套套用动作与回执。
  // <lang en>Tone preset entries (W-tb-P15): per-combo full-set action and its status line.</lang>
  'p15.tone.applyFull': { zh: '整套', en: 'Full set' },
  // 锚定模式（W-tb-P16）：弹层开关 + 锚定命名标记 + 回执。
  // <lang en>Anchor mode (W-tb-P16): modal toggle, anchored member name mark, status line.</lang>
  'p16.anchor.label': { zh: '锚定到当前主色', en: 'Anchor to current primary' },
  'p16.anchor.mark': { zh: '（锚）', en: ' (anchored)' },
  'p16.anchor.applied': { zh: '已锚定套用「{name}」（主色保持，其余按组合关系重推导）', en: 'Applied anchored \"{name}\" (primary kept; others re-derived by combo relations)' },
  'p15.tone.applied': { zh: '已套用语气预设「{name}」（模式/关系/成员/辅助色成套）', en: 'Applied tone preset \"{name}\" (mode/relation/members/auxiliaries as a set)' },
});
