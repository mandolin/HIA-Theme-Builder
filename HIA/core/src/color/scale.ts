import type{ColorScale}from'../types.js';
import{clamp,gamutMapOklch,hexToOklch,normalizeHex}from'./convert.js';

/**
 * @lang zh-CN 解析基色的色阶锚点表：每个锚点 = {位置, 目标亮度 L, 实际彩度 C}。
 *   锚点定义与历史版本一致（浅阶高 L 低 C、深阶低 L 收敛 C、500 = 基色本色）。
 *   600–900 的 L 相对基色 L 下移并 clamp，保证深阶可辨。
 * @lang en Resolve the tonal anchor table for a base color: each anchor = {position, target L, actual C}.
 *   Anchor definitions match the historical version (light steps high-L/low-C, dark steps dimmer with
 *   converged C, 500 = the base color itself). 600–900 L values descend relative to base L with clamping.
 */
function resolveAnchorPoints(hex:string):{pos:number;L:number;C:number}[]{
  // 基色转入 OKLCH，作为色阶的色相与彩度锚点。
  // <lang zh-CN>色相 h 与彩度 C 在所有阶共用，仅 L 与 C 乘数随阶变化。</lang>
  // <lang en>Hue h and chroma C are shared across steps; only L and the C multiplier vary per step.</lang>
  const color=hexToOklch(hex);
  // 每级定义：[色阶键, 目标亮度 L, 彩度乘数]。500 级用基色原始亮度且乘数 1。
  // <lang zh-CN>越浅越亮、彩度越低；越深越暗、彩度收敛，避免深阶过艳。</lang>
  // <lang en>Lighter = brighter & less chroma; darker = dimmer with converged chroma to avoid neon darks.</lang>
  const defs:[keyof ColorScale,number,number][]=[['50',.97,.12],['100',.92,.24],['200',.84,.46],['300',.74,.68],['400',.62,.88],['500',color.L,1],['600',clamp(color.L-.08,.30,.62),.95],['700',clamp(color.L-.15,.23,.54),.84],['800',clamp(color.L-.23,.16,.45),.66],['900',clamp(color.L-.31,.10,.36),.46]];
  // 展开为数值点集（位置/L/实际彩度），供插值与生成共用。
  // <lang zh-CN>同一份点集保证 tonalScale 与 tonalScaleAt 锚点逐位一致。</lang>
  // <lang en>One shared point set keeps tonalScale and tonalScaleAt bit-identical at anchors.</lang>
  return defs.map(([key,L,multiplier])=>({pos:parseInt(key,10),L,C:color.C*multiplier}));
}

// 由基色生成 10 级色阶（OKLCH 亮度递减、彩度按比例缩放），500 级固定为基色。
// <lang zh-CN>浅色阶提高亮度降低彩度，深色阶略压低亮度；所有输出经色域映射保证可显示。</lang>
// <lang en>Light steps raise L and lower C; dark steps slightly lower L; all output is gamut-mapped for displayability.</lang>
export function tonalScale(hex:string):ColorScale{
  const color=hexToOklch(hex);
  const points=resolveAnchorPoints(hex);
  const scale={}as ColorScale;
  // 逐锚点以 (L, C, h) 生成并做色域映射，写回 HEX。
  // <lang zh-CN>与 tonalScaleAt 共用同一锚点解析，锚点处两函数输出逐位一致。</lang>
  // <lang en>Shares anchor resolution with tonalScaleAt; outputs are bit-identical at anchors.</lang>
  for(const p of points)scale[String(p.pos) as keyof ColorScale]=gamutMapOklch(p.L,p.C,color.h).hex;
  // 500 级强制回到用户输入的基色（忽略色域映射可能的细微偏移），保证主色准确。
  // <lang zh-CN>用户选取的主色应原样出现在 500 阶。</lang>
  // <lang en>The user's picked base color must appear exactly at step 500.</lang>
  scale['500']=normalizeHex(hex);
  return scale;
}

/**
 * @lang zh-CN 任意色阶取色（`ADR-004`）：对锚点表做分段线性插值，求位置 shade 处的 OKLCH 色并色域映射。
 *   输入域为整数 0–1000（round 后 clamp 到 [50,900] 锚点域，端点外截断、亮度不外推）；
 *   锚点位置（50/100/…/900）输出与 `tonalScale` 逐位一致；500 恒为基色本色。
 * @lang en Arbitrary shade color (`ADR-004`): piecewise-linear interpolation over the anchor table,
 *   resolving the OKLCH color at position `shade` with gamut mapping. Input domain is integers 0–1000
 *   (rounded then clamped to the [50,900] anchor range; values outside truncate at the anchors, no
 *   extrapolation). Anchor positions (50/100/…/900) are bit-identical to `tonalScale`; 500 is always
 *   the base color itself.
 */
export function tonalScaleAt(hex:string,shade:number):string{
  const color=hexToOklch(hex);
  const points=resolveAnchorPoints(hex);
  // 位置取整并截断到锚点域。
  // <lang zh-CN>0–49 视作 50、901–1000 视作 900；亮度不外推避免脏色。</lang>
  // <lang en>0–49 maps to 50, 901–1000 to 900; no extrapolation to avoid dirty colors.</lang>
  const pos=clamp(Math.round(shade),50,900);
  // 500 恒为基色本色（与 tonalScale 的强制覆盖一致）。
  // <lang zh-CN>锚点一致性：500 必须等于 normalizeHex(hex)。</lang>
  // <lang en>Anchor consistency: 500 must equal normalizeHex(hex).</lang>
  if(pos===500)return normalizeHex(hex);
  // 定位包围 pos 的相邻锚点并线性插值 (L, C)。
  // <lang zh-CN>端点位置（50/900）直接取端点锚点。</lang>
  // <lang en>Endpoint positions (50/900) resolve to the endpoint anchors.</lang>
  let lo=points[0]!,hi=points[points.length-1]!;
  for(let i=0;i<points.length-1;i++){
    const a=points[i]!,b=points[i+1]!;
    if(pos>=a.pos&&pos<=b.pos){lo=a;hi=b;break;}
  }
  const t=hi.pos===lo.pos?0:(pos-lo.pos)/(hi.pos-lo.pos);
  const L=lo.L+(hi.L-lo.L)*t;
  const C=lo.C+(hi.C-lo.C)*t;
  return gamutMapOklch(L,C,color.h).hex;
}
