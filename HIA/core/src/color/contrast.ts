import{hexToRgb,srgbToLinear,hexToOklch,oklchToRgb,gamutMapOklch,rgbToHex}from'./convert.js';
import{apcaLc}from'./apca.js';

// 计算相对亮度（WCAG 定义的线性光加权和，范围约 0..1）。
// <lang zh-CN>用于对比度计算；权重对应人眼对 RGB 的敏感度。</lang>
// <lang en>Used by contrast; weights reflect human eye sensitivity to RGB channels.</lang>
export function luminance(hex:string):number{
  const[r,g,b]=hexToRgb(hex).map(srgbToLinear)as[number,number,number];
  // 线性光按 Rec.709 系数加权，得到感知亮度。
  // <lang zh-CN>0.2126/0.7152/0.0722 为 sRGB 亮度标准权重。</lang>
  // <lang en>0.2126/0.7152/0.0722 are the standard sRGB luminance weights.</lang>
  return.2126*r+.7152*g+.0722*b;
}

// 计算两色 WCAG 对比度（亮者比暗者，含 0.05 补偿）。
// <lang zh-CN>结果越大越易读；排序后取高/低，符合 WCAG 公式。</lang>
// <lang en>Larger means more legible; sorts then divides high/low per the WCAG formula.</lang>
export function contrast(a:string,b:string):number{
  const values=[luminance(a),luminance(b)].sort((x,y)=>y-x);
  return(values[0]!+.05)/(values[1]!+.05);
}

// 自动选取在某色上可读的前景色（白或深色），返回色值、标签与对比度。
// <lang zh-CN>比较白色与深蓝(#0F172A)的对比度，取较大者；用于角色色上的文字。</lang>
// <lang en>Compares white vs dark navy (#0F172A) contrast and picks the larger; used for text on a role color.</lang>
export function bestOnColor(hex:string):{hex:string;label:string;ratio:number}{
  const white=contrast(hex,'#FFFFFF'),
    dark=contrast(hex,'#0F172A');
  // 白色对比更高则用白字，否则用深色字，并记录对应比例。
  // <lang zh-CN>ratio 供 UI 展示可达性指标。</lang>
  // <lang en>ratio is exposed so the UI can show accessibility metrics.</lang>
  return white>=dark?{hex:'#FFFFFF',label:'白色文字',ratio:white}:{hex:'#0F172A',label:'深色文字',ratio:dark};
}

// ===== 对比度矩阵（`W-tb-P36`）=====
/** @lang zh-CN 矩阵输入项：key 为显示键名（角色名/token 名），hex 为色值。 @lang en Matrix input: key is the display label, hex the colour. */
export interface MatrixEntry{key:string;hex:string}
export interface ContrastMatrixResult{
  /** @lang zh-CN 行/列顺序与传入顺序一致。 @lang en Row/column order matches the input order. */
  keys:string[];
  /** @lang zh-CN WCAG 2.x 比值矩阵（对称，对角线为 1）。 @lang en WCAG 2.x ratio matrix (symmetric, unit diagonal). */
  wcag:number[][];
  /** @lang zh-CN APCA Lc 带符号矩阵：行=文字色、列=背景色（APCA 极性有方向性，**不对称**）。 @lang en Signed APCA Lc matrix: row=text colour, column=background (polarity is directional, so **not symmetric**). */
  apca:number[][];
}

/**
 * @lang zh-CN 全调色板两两对比度矩阵（`W-tb-P36`）：WCAG 2.x 逐对 + APCA Lc 逐对（行=文字/列=背景）。
 *   用途：一眼看出哪些角色对在哪个阈值下不可读——把"逐对断言"升级为"全局可见"。
 *   对角线恒为 1（WCAG）/0（APCA），调用方可直接渲染。
 * @lang en Palette-wide pairwise contrast matrix (`W-tb-P36`): WCAG 2.x per pair plus signed APCA Lc per pair
 *   (row=text, column=background). Purpose: make unreadable role pairs visible at a glance instead of relying
 *   on scattered assertions. The diagonal is 1 (WCAG) / 0 (APCA), ready to render.
 */
export function contrastMatrix(colors:readonly MatrixEntry[]):ContrastMatrixResult{
  const keys=colors.map(c=>c.key);
  const wcag=colors.map(()=>colors.map(()=>1));
  const apca=colors.map(()=>colors.map(()=>0));
  // 对称矩阵只算上三角；APCA 具方向性（行=文字色），两个方向都要算。
  // <lang en>The WCAG matrix is symmetric (upper triangle only); APCA is directional (row = text colour),
  //   so both directions are computed.</lang>
  for(let i=0;i<colors.length;i++){
    wcag[i]![i]=1;
    for(let j=i+1;j<colors.length;j++){
      const ratio=contrast(colors[i]!.hex,colors[j]!.hex);
      wcag[i]![j]=ratio;wcag[j]![i]=ratio;
    }
    for(let j=0;j<colors.length;j++){
      apca[i]![j]=i===j?0:apcaLc(colors[i]!.hex,colors[j]!.hex);
    }
  }
  return{keys,wcag,apca};
}

// ===== 以对比度为目标生成（`W-tb-P36`，Leonardo 式反推）=====
export interface StepForContrastResult{
  /** @lang zh-CN 生成色（保色相/彩度形态，仅调 L，经色域映射）。 @lang en Generated colour (hue/chroma shape kept, only L moved, gamut-mapped). */
  hex:string;
  /** @lang zh-CN 实测 WCAG 比值（与目标的接近程度即 ok 的依据）。 @lang en Measured WCAG ratio (closeness to target drives ok). */
  ratio:number;
  /** @lang zh-CN 移动方向：lighter=比背景亮（深底浅字）/ darker=比背景暗（浅底深字）。 @lang en Direction moved: lighter = brighter than bg (dark bg), darker = dimmer than bg (light bg). */
  direction:'lighter'|'darker';
  /** @lang zh-CN 生成色的 OKLCH L。 @lang en OKLCH L of the generated colour. */
  L:number;
  /** @lang zh-CN 是否达到目标（±0.1）；false 表示色域/亮度边界限制了可达性。 @lang en Whether the target (±0.1) was met; false means gamut/L bounds limited reachability. */
  ok:boolean;
}

/**
 * @lang zh-CN 以对比度为目标反推色值（`W-tb-P36`）：保持基色的色相与彩度形态，沿 OKLCH 亮度轴
 *   二分搜索，使 WCAG 比值 ≈ target。与"锚定推导"（`W-tb-P16`）互补：锚定保关系、本函数保目标。
 *   背景较亮 → 向深搜（darker）；背景较暗 → 向浅搜（lighter）；两侧都试并取更接近目标的一侧。
 *   色域边界（彩度映射后 L 可用范围）可能限制可达性——此时返回可达的最接近值并置 ok:false。
 * @lang en Target-driven colour synthesis (`W-tb-P36`, Leonardo-style inverse): keeps the base hue/chroma shape
 *   and bisects along OKLCH lightness until the WCAG ratio ≈ target. Complements anchored derivation
 *   (`W-tb-P16`): anchoring preserves relations, this preserves targets. Light bg → search darker; dark bg →
 *   search lighter; both halves are probed and the closer match wins. Gamut limits may cap reachability —
 *   the nearest reachable value is returned with ok:false.
 */
export function stepForContrast(baseHex:string,bgHex:string,target:number):StepForContrastResult{
  const base=hexToOklch(baseHex);
  // 在指定半区二分：ratioAt(L) 用与 tonalScale 相同的色域映射，保证结果可显示。
  // <lang en>Bisect within one half; ratioAt uses the same gamut mapping as tonalScale so results are displayable.</lang>
  const ratioAt=(L:number)=>{
    const{hex}=gamutMapOklch(L,base.C,base.h);
    return contrast(hex,bgHex);
  };
  const probe=(direction:'lighter'|'darker'):StepForContrastResult=>{
    // 半区端点：背景亮时往深走（0 → 背景L 下方），背景暗时往浅走（背景L 上方 → 1）。
    // <lang en>Half bounds: for a light bg descend toward 0; for a dark bg ascend toward 1.</lang>
    const bgL=hexToOklch(bgHex).L;
    const low=direction==='darker'?0.001:Math.min(bgL+0.002,0.999);
    const high=direction==='darker'?Math.max(bgL-0.002,0.001):0.999;
    // 目标比值换算成可比较的亮度：比值单调于本半区，直接二分。
    // <lang en>The ratio is monotonic within this half, so a plain bisection applies.</lang>
    let lo=low,hi=high;
    const bestHexAt=(L:number)=>gamutMapOklch(L,base.C,base.h).hex;
    // 端点比值：决定可达区间 [min, max]。
    // <lang en>Endpoint ratios: they define the reachable interval [min, max].</lang>
    const rLo=contrast(bestHexAt(lo),bgHex),rHi=contrast(bestHexAt(hi),bgHex);
    // 可达性：单调函数在两端点处取到区间最小/最大比值，目标落在两者之间即可达。
    //   darker 半区：lo 端比值最大、hi 端≈1；lighter 半区：lo 端≈1、hi 端最大。判据两侧通用。
    // <lang en>Reachability: a monotonic function attains its min/max ratio at the two endpoints, so the target
    //   is reachable iff it lies between them — the check is direction-agnostic.</lang>
    const reachable=target>=Math.min(rLo,rHi)&&target<=Math.max(rLo,rHi);
    if(!reachable){
      // 目标不可达：返回更接近目标的端点，并置 ok:false（调用方据此提示"已取最接近值"）。
      // <lang en>Target unreachable: return the nearer endpoint with ok:false so callers can say
      //   "nearest achievable".</lang>
      const pick=Math.abs(rLo-target)<=Math.abs(rHi-target)?lo:hi;
      return{hex:bestHexAt(pick),ratio:contrast(bestHexAt(pick),bgHex),direction,L:pick,ok:false};
    }
    // 32 次二分：亮度域 [0,1] 内精度约 1e-9，远超视觉需求。
    // <lang en>32 bisections: ~1e-9 precision on [0,1], far beyond visual need.</lang>
    for(let i=0;i<32;i++){
      const mid=(lo+hi)/2;
      const r=contrast(bestHexAt(mid),bgHex);
      // 比值随 L 单调（半区内），据此收缩区间。
      // <lang en>Within the half the ratio is monotonic in L, so shrink accordingly.</lang>
      const goLow=r>target?direction==='darker'?false:true:direction==='darker'?true:false;
      if(goLow)hi=mid;else lo=mid;
    }
    // 取收缩后更贴近目标的一端，避免舍入偏差。
    // <lang en>Pick whichever converged end is closer to the target to avoid rounding bias.</lang>
    const cands=[lo,hi];
    let best=cands[0]!;
    for(const c of cands){if(Math.abs(contrast(bestHexAt(c),bgHex)-target)<Math.abs(contrast(bestHexAt(best),bgHex)-target))best=c;}
    const hex=bestHexAt(best),ratio=contrast(hex,bgHex);
    return{hex,ratio,direction,L:best,ok:Math.abs(ratio-target)<=0.1};
  };
  // 先按亮度常识选一侧（背景亮→深字），不可达时再试另一侧，取 ok 或更接近者。
  // <lang en>Try the obvious side first (light bg → dark text); if unreachable, probe the other side and keep
  //   the ok result or the closer one.</lang>
  const bgL=hexToOklch(bgHex).L;
  const primaryDirection:StepForContrastResult['direction']=bgL>=0.5?'darker':'lighter';
  const primary=probe(primaryDirection);
  if(primary.ok)return primary;
  const secondary=probe(primaryDirection==='darker'?'lighter':'darker');
  // 两侧都不可达时，取比值更接近目标的一侧。
  // <lang en>If neither side reaches the target, keep the side whose ratio is nearer the target.</lang>
  if(secondary.ok||Math.abs(secondary.ratio-target)<Math.abs(primary.ratio-target))return secondary;
  return primary;
}
