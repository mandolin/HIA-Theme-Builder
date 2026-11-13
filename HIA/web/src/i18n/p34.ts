// @lang zh-CN 主色候选库四 tab（`W-tb-P34` UI 整合）：tab 文案复用候选组名与既有键，
//   此处只补情感视图与徽标计数文案。
// <lang en>Primary-library four tabs (`W-tb-P34` UI): tab labels reuse the candidate group names and existing
//   keys, so only the mood view and badge counters are added here.</lang>
import{registerStrings}from'./i18n.js';

registerStrings({
  'picker.tab.mood': { zh: '情感主色', en: 'By mood' },
  'picker.mood.hint': { zh: '按情感的配色倾向推荐主色（映射由配色宝典的组合数据推导）。点击即把该主色与其推荐副色一并套用。', en: 'Suggests primaries by mood (derived from the baodian combo data). Clicking applies the primary together with its suggested secondary.' },
  'picker.mood.neutral': { zh: '以中性色为主', en: 'Grey-led' },
  'picker.mood.neutral.desc': { zh: '该情感以灰/黑为底衬艳色，没有单一代表主色。', en: 'This mood uses grey/black as a backdrop under vivid accents; there is no single representative primary.' },
  'picker.mood.weight': { zh: '票数 {n}', en: '{n} votes' },
  'picker.badge.primary': { zh: '{n} 色', en: '{n} colors' },
  'picker.badge.mood': { zh: '{n} 情感', en: '{n} moods' },
});
