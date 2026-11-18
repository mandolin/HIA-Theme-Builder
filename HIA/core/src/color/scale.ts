import type{ColorScale}from'../types.js';
import{clamp,gamutMapOklch,hexToOklch,normalizeHex}from'./convert.js';

/**
 * @lang zh-CN 色阶生成模式（`W-tb-P47`，内联联合类型——不新增导出，`ADR-016` 面保持 142）：
 *   'classic' = 设计锚点表（1.0.0 起的历史形态，默认，逐位兼容）；'grid' = OKLab 亮度等差栅格
 *   （基色两侧等 ΔL，步距感知均匀）；'curve' = 栅格基础上按 smoothstep 缓动分布（强度可调，
 *   t=0 退化为栅格、t=1 全缓动）。三模式共享契约：500 恒为基色本色、L 自 50→900 单调递减。
 * @lang en Scale generation modes (`W-tb-P47`; inline union — no new exports, the `ADR-016` surface stays
 *   at 142): 'classic' = the designed anchor table (historical shape since 1.0.0, default, bit-compatible);
 *   'grid' = uniform ΔL OKLab-lightness grid on both sides of the base (perceptually uniform steps);
 *   'curve' = grid distribution eased by smoothstep with an adjustable strength (t=0 degenerates to grid,
 *   t=1 full ease). Shared contract: 500 is always the base color; L decreases monotonically 50→900.
 */
type ScaleMode='classic'|'grid'|'curve';

/** @lang zh-CN 浅端亮度上限与深端亮度下限（与 classic 端点一致，三模式共用范围）。
    @lang en Light-end L ceiling and dark-end L floor (same endpoints as classic, shared across modes). */
const L_TOP=.97,L_C_MULT=.12,D_C_MULT=.46;

/** @lang zh-CN smoothstep 缓动基函数（S 形，f∈[0,1]）。 @lang en smoothstep easing base (S-curve, f∈[0,1]). */
function smoothstep(f:number):number{return f*f*(3-2*f);}

/**
 * @lang zh-CN 解析基色的色阶锚点表：每个锚点 = {位置, 目标亮度 L, 实际彩度 C}。
 *   'classic'：历史锚点表（浅阶高 L 低 C、深阶低 L 收敛 C；600–900 相对基色下移并 clamp）。
 *   'grid'：基色两侧等 ΔL——浅侧 400→50 自基色 L 线性升至 L_TOP（4 等分）、深侧 600→900
 *   自基色 L 线性降至深端下限（4 等分）；C 乘数两侧各自线性（浅侧 1→.12、深侧 1→.46）。
 *   'curve'：栅格的分布比例 f 经 mix(f, smoothstep(f), t) 缓动（t=curveStrength，clamp [0,1]），
 *   端点与栅格一致、t=0 逐位等于栅格。
 *   三模式均保证：L 自 50→900 单调递减、500 = 基色本色（tonalScale 层强制）。
 * @lang en Resolve the tonal anchor table for a base color: each anchor = {position, target L, actual C}.
 *   'classic': the historical table (light steps high-L/low-C, dark steps converged; 600–900 descend from
 *   base L with clamping). 'grid': uniform ΔL on both sides — light 400→50 rises linearly from base L to
 *   L_TOP in 4 equal gaps, dark 600→900 descends to the floor likewise; C multipliers interpolate linearly
 *   per side (1→.12 light, 1→.46 dark). 'curve': the grid fraction f is eased by mix(f, smoothstep(f), t)
 *   (t = curveStrength clamped to [0,1]); endpoints match grid and t=0 is bit-identical to grid.
 *   All modes guarantee L decreasing 50→900 and 500 = base colour (enforced in tonalScale).
 */
function resolveAnchorPoints(hex:string,mode:ScaleMode='classic',curveStrength=0.5):{pos:number;L:number;C:number}[]{
  // 基色转入 OKLCH，作为色阶的色相与彩度锚点。
  // <lang zh-CN>色相 h 在所有阶共用，仅 L 与 C 乘数随阶变化。</lang>
  // <lang en>Hue h is shared across steps; only L and the C multiplier vary per step.</lang>
  const color=hexToOklch(hex);
  if(mode==='classic'){
    // 每级定义：[色阶键, 目标亮度 L, 彩度乘数]。500 级用基色原始亮度且乘数 1。
    // <lang zh-CN>越浅越亮、彩度越低；越深越暗、彩度收敛，避免深阶过艳。</lang>
    // <lang en>Lighter = brighter & less chroma; darker = dimmer with converged chroma to avoid neon darks.</lang>
    const defs:[keyof ColorScale,number,number][]=[['50',.97,.12],['100',.92,.24],['200',.84,.46],['300',.74,.68],['400',.62,.88],['500',color.L,1],['600',clamp(color.L-.08,.30,.62),.95],['700',clamp(color.L-.15,.23,.54),.84],['800',clamp(color.L-.23,.16,.45),.66],['900',clamp(color.L-.31,.10,.36),.46]];
    return defs.map(([key,L,multiplier])=>({pos:parseInt(key,10),L,C:color.C*multiplier}));
  }
  // grid/curve 共用骨架：浅端/深端范围与 classic 一致；grid 强制 t=0（线性栅格），
  //   curve 的缓动强度 clamp 到 [0,1]（t=0 时逐位等于 grid）。
  // <lang en>grid/curve share the skeleton: endpoints match classic; grid FORCES t=0 (linear grid),
  //   curve eases with strength clamped to [0,1] (t=0 is bit-identical to grid).</lang>
  const t=mode==='grid'?0:clamp(curveStrength,0,1);
  const ease=(f:number)=>f+t*(smoothstep(f)-f);
  // 深端下限与 classic 的 900 级 clamp 规则一致（避免不同模式出现不同深端）。
  // <lang en>The dark floor mirrors classic's 900 clamp so modes share the same dark end.</lang>
  const darkFloor=clamp(color.L-.31,.10,.36);
  // 浅侧 k=1..5 → 锚点 400..50（含 500→400 步距共 5 等分，整条浅坡等 ΔL）；
  //   深侧 k=1..4 → 600..900（500→900 共 4 等分）。f=k/N 为"自基色向端点"的分布比例。
  // <lang en>Light k=1..5 → anchors 400..50 (5 equal gaps incl. 500→400, a uniformly stepped ramp);
  //   dark k=1..4 → 600..900 (4 gaps). f=k/N spreads from the base toward the endpoints.</lang>
  const lightAnchors:[keyof ColorScale,number][]=[['400',1],['300',2],['200',3],['100',4],['50',5]];
  const darkAnchors:[keyof ColorScale,number][]=[['600',1],['700',2],['800',3],['900',4]];
  const pts:{pos:number;L:number;C:number}[]=[];
  // 浅侧：L=base+(TOP−base)·eased(k/5)，f=1（锚点 50）恰达端点；C 乘数 = 1−(1−.12)·eased(f)。
  // <lang en>Light: L = base + (TOP−base)·eased(k/5); C multiplier = 1−(1−.12)·eased(f).</lang>
  for(const[key,k]of lightAnchors){
    const f=ease(k/5);
    const L=color.L+(L_TOP-color.L)*f;
    const mult=1-(1-L_C_MULT)*f;
    pts.push({pos:parseInt(key,10),L,C:color.C*mult});
  }
  // 500 基色锚点（乘数 1），随后深侧对称展开。
  // <lang en>500 base anchor (multiplier 1), then the dark side unfolds symmetrically.</lang>
  pts.push({pos:500,L:color.L,C:color.C});
  for(const[key,k]of darkAnchors){
    const f=ease(k/4);
    const L=color.L-(color.L-darkFloor)*f;
    const mult=1-(1-D_C_MULT)*f;
    pts.push({pos:parseInt(key,10),L,C:color.C*mult});
  }
  // 位置升序排序（浅端在前），与 classic 点集顺序一致供插值共用。
  // <lang en>Sort ascending by position (light first) to match the classic point order for interpolation.</lang>
  return pts.sort((a,b)=>a.pos-b.pos);
}

// 由基色生成 10 级色阶（OKLCH 亮度递减、彩度按比例缩放），500 级固定为基色。
//   mode 缺省 'classic'——历史调用点输出逐位不变（`ADR-004` 兼容）。
// <lang zh-CN>浅色阶提高亮度降低彩度，深色阶略压低亮度；所有输出经色域映射保证可显示。</lang>
// <lang en>Light steps raise L and lower C; dark steps slightly lower L; all output is gamut-mapped.
//   mode defaults to 'classic' — legacy call sites keep bit-identical output (`ADR-004`).</lang>
export function tonalScale(hex:string,mode:ScaleMode='classic',curveStrength=0.5):ColorScale{
  const color=hexToOklch(hex);
  const points=resolveAnchorPoints(hex,mode,curveStrength);
  const scale={}as ColorScale;
  // 逐锚点以 (L, C, h) 生成并做色域映射，写回 HEX。
  // <lang zh-CN>与 tonalScaleAt 共用同一锚点解析，锚点处两函数输出逐位一致。</lang>
  // <lang en>Shares anchor resolution with tonalScaleAt; outputs are bit-identical at anchors.</lang>
  for(const p of points)scale[String(p.pos) as keyof ColorScale]=gamutMapOklch(p.L,p.C,color.h).hex;
  // 500 级强制回到用户输入的基色（忽略色域映射可能的细微偏移），保证主色准确。
  // <lang zh-CN>用户选取的主色应原样出现在 500 阶——三模式统一契约。</lang>
  // <lang en>The user's picked base color must appear exactly at step 500 — contract across all modes.</lang>
  scale['500']=normalizeHex(hex);
  return scale;
}

/**
 * @lang zh-CN 任意色阶取色（`ADR-004`）：对锚点表做分段线性插值，求位置 shade 处的 OKLCH 色并色域映射。
 *   输入域为整数 0–1000（round 后 clamp 到 [50,900] 锚点域，端点外截断、亮度不外推）；
 *   锚点位置（50/100/…/900）输出与 `tonalScale`（同 mode/强度）逐位一致；500 恒为基色本色。
 *   mode/curveStrength 与 `tonalScale` 同参（缺省 'classic'，历史调用点不受影响）。
 * @lang en Arbitrary shade color (`ADR-004`): piecewise-linear interpolation over the anchor table,
 *   resolving the OKLCH color at position `shade` with gamut mapping. Input domain is integers 0–1000
 *   (rounded then clamped to the [50,900] anchor range; values outside truncate at the anchors, no
 *   extrapolation). Anchor positions (50/100/…/900) are bit-identical to `tonalScale` (same mode/strength);
 *   500 is always the base color. mode/curveStrength mirror `tonalScale` (default 'classic' — legacy call
 *   sites unaffected).
 */
export function tonalScaleAt(hex:string,shade:number,mode:ScaleMode='classic',curveStrength=0.5):string{
  const color=hexToOklch(hex);
  const points=resolveAnchorPoints(hex,mode,curveStrength);
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
