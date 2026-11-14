// @lang zh-CN 对比度矩阵与色觉模拟（`W-tb-P36`）：矩阵面板、目标生成、APCA 说明与 CVD 滤镜文案。
// <lang en>Contrast matrix & CVD (`W-tb-P36`): matrix panel, target synthesis, APCA note and CVD filter copy.</lang>
import{registerStrings}from'./i18n.js';

registerStrings({
  'p36.matrix.title': { zh: '对比度矩阵与目标生成', en: 'Contrast matrix & target synthesis' },
  'p36.matrix.desc': { zh: '全调色板两两对比度一目了然：哪些角色对在哪个阈值下不可读。可按目标（AA/AAA/UI）反推可读文字色（Leonardo 式）。', en: 'Every palette pair at a glance: which role pairs fail at which threshold. Synthesize readable text colours for a target (AA/AAA/UI), Leonardo-style.' },
  'p36.metric.wcag': { zh: 'WCAG 2.x', en: 'WCAG 2.x' },
  'p36.metric.apca': { zh: 'APCA（参考）', en: 'APCA (reference)' },
  'p36.target.aria': { zh: '对比度目标', en: 'Contrast target' },
  'p36.target.ui': { zh: '3.0 · UI 组件/大字', en: '3.0 · UI components/large text' },
  'p36.target.aa': { zh: '4.5 · 正文 AA', en: '4.5 · body text AA' },
  'p36.target.aaa': { zh: '7.0 · 正文 AAA', en: '7.0 · body text AAA' },
  'p36.apca.note': { zh: 'APCA（Lc）为参考值：WCAG 3.0 尚未定案对比度算法，合规判定仍以 WCAG 2.x 为准。Lc 正值=深字浅底，负值=浅字深底。', en: 'APCA (Lc) is a reference value: WCAG 3.0 has not settled its contrast algorithm; compliance stays with WCAG 2.x. Positive Lc = dark text on light bg; negative = light on dark.' },
  'p36.synth.action': { zh: '按目标反推文字色', en: 'Synthesize text colours for target' },
  'p36.synth.title': { zh: '目标反推结果（白字色相、按亮度二分至目标比值）', en: 'Synthesis results (white hue, bisected along lightness to the target ratio)' },
  'p36.role.primary': { zh: '主色', en: 'Primary' },
  'p36.role.secondary': { zh: '副色', en: 'Secondary' },
  'p36.role.third': { zh: '第三色', en: 'Third' },
  'p36.role.aux': { zh: '辅助色', en: 'Aux' },
  'p36.role.white': { zh: '白（浅底/文字）', en: 'White (light bg/text)' },
  'p36.role.ink': { zh: '深墨（深底/文字）', en: 'Ink (dark bg/text)' },
  'p36.role.onPrimary': { zh: '主色文字（on）', en: 'On-primary text' },
  'p36.role.onSecondary': { zh: '副色文字（on）', en: 'On-secondary text' },
  'p21.filter.cvdProt': { zh: '红色弱模拟（CVD）', en: 'Protanopia preview (CVD)' },
  'p21.filter.cvdDeutan': { zh: '绿色弱模拟（CVD）', en: 'Deuteranopia preview (CVD)' },
  'p21.filter.cvdTritan': { zh: '蓝黄色弱模拟（CVD）', en: 'Tritanopia preview (CVD)' }
});
