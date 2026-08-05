import type{ColorScale}from'../types.js';
import{clamp,gamutMapOklch,hexToOklch,normalizeHex}from'./convert.js';

// 由基色生成 10 级色阶（OKLCH 亮度递减、彩度按比例缩放），500 级固定为基色。
// <lang zh-CN>浅色阶提高亮度降低彩度，深色阶略压低亮度；所有输出经色域映射保证可显示。</lang>
// <lang en>Light steps raise L and lower C; dark steps slightly lower L; all output is gamut-mapped for displayability.</lang>
export function tonalScale(hex:string):ColorScale{
  // 基色转入 OKLCH，作为色阶的色相与彩度锚点。
  // <lang zh-CN>色相 h 与彩度 C 在所有阶共用，仅 L 与 C 乘数随阶变化。</lang>
  // <lang en>Hue h and chroma C are shared across steps; only L and the C multiplier vary per step.</lang>
  const color=hexToOklch(hex);
  // 每级定义：[色阶键, 目标亮度 L, 彩度乘数]。500 级用基色原始亮度且乘数 1。
  // <lang zh-CN>越浅越亮、彩度越低；越深越暗、彩度收敛，避免深阶过艳。</lang>
  // <lang en>Lighter = brighter & less chroma; darker = dimmer with收敛 chroma to avoid neon darks.</lang>
  const defs:[keyof ColorScale,number,number][]=[['50',.97,.12],['100',.92,.24],['200',.84,.46],['300',.74,.68],['400',.62,.88],['500',color.L,1],['600',clamp(color.L-.08,.30,.62),.95],['700',clamp(color.L-.15,.23,.54),.84],['800',clamp(color.L-.23,.16,.45),.66],['900',clamp(color.L-.31,.10,.36),.46]];
  const scale={}as ColorScale;
  // 逐阶以 (L, C*乘数, h) 生成并做色域映射，写回 HEX。
  // <lang zh-CN>clamp 限制深色阶亮度下限，避免过黑不可辨。</lang>
  // <lang en>clamp keeps dark-step lightness above a floor so they stay distinguishable.</lang>
  for(const[key,L,multiplier]of defs)scale[key]=gamutMapOklch(L,color.C*multiplier,color.h).hex;
  // 500 级强制回到用户输入的基色（忽略色域映射可能的细微偏移），保证主色准确。
  // <lang zh-CN>用户选取的主色应原样出现在 500 阶。</lang>
  // <lang en>The user's picked base color must appear exactly at step 500.</lang>
  scale['500']=normalizeHex(hex);
  return scale;
}
