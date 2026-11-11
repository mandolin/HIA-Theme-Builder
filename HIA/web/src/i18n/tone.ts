/**
 * @lang zh-CN 语气预设 i18n 注册（`W-tb-P15`）：72 个内置语气预设名的英文合成注册——
 *   情感名与形态短名各自有英文映射，预设名按 "Tone · {情感} ({形态})" 合成；
 *   1 色组合的"·极简"后缀映射为 "· Minimal"。零手工逐条维护（数据驱动，随工厂输出自动覆盖）。
 * @lang en Tone preset i18n registration (`W-tb-P15`): synthesizes English names for all built-in
 *   tone presets from mood/form EN maps, including the "· Minimal" variant suffix.
 */
import{registerStrings}from'./i18n.js';
import{tonePresets}from'@hia/theme-core';

/** @lang zh-CN 情感中英映射（24；与候选字典中的演示词条同源语义，此处供预设名合成专用）。
    @lang en Mood zh→EN map (24) for preset-name synthesis. */
const MOOD_EN:Record<string,string>={
  '强烈':'Intense','丰富':'Rich','浪漫':'Romantic','奔放':'Unrestrained','土性':'Earthy','友善':'Friendly',
  '柔和':'Soft','热情':'Passionate','动感':'Dynamic','高雅':'Elegant','流行':'Trendy','清新':'Fresh',
  '传统':'Traditional','清爽':'Crisp','热带':'Tropical','古典':'Classical','可靠':'Reliable','平静':'Calm',
  '堂皇':'Grand','神奇':'Magical','怀旧':'Nostalgic','活力':'Vivacious','低沉':'Subdued','专职':'Professional'
};

/** @lang zh-CN 形态短名中英映射（10；键=中文名去掉"色彩组合"后缀）。
    @lang en Form short-title zh→EN map (10). */
const FORM_SHORT_EN:Record<string,string>={
  '补色':'Complement','原色':'Primary','单色':'Pure','分裂补色':'Split Complement','类比':'Analogous',
  '中性':'Neutral','冲突':'Clash','分裂':'Split','三次色':'Tertiary Triad','二次色':'Secondary'
};

// 逐预设合成英文名并注册（zh 键=工厂产出的中文名，含"·极简"变体）。
// <lang en>Register each preset name; the ·Minimal suffix maps through as well.</lang>
const auto:Record<string,{zh:string;en:string}>={};
for(const p of tonePresets){
  const m=p.name.match(/^语气·(.+?)（(.+?)）$/);
  if(!m)continue;
  const mood=m[1]!,short=m[2]!;
  const moodEn=MOOD_EN[mood]||mood;
  // 极简变体：短名形如 "单色·极简" → "Pure · Minimal"。
  const parts=short.split('·');
  const formEn=parts.length===2&&parts[1]==='极简'
    ?`${FORM_SHORT_EN[parts[0]!]||parts[0]} · Minimal`
    :(FORM_SHORT_EN[short]||short);
  auto[p.name]={zh:p.name,en:`Tone · ${moodEn} (${formEn})`};
}
registerStrings(auto);