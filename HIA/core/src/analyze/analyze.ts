import{contrast}from'../color/contrast.js';
import{hexToOklch,normalizeHex,validHex}from'../color/convert.js';
import type{CssVarSignal,DomColorSignal,ExtractResult,ExtractSignals,ScoredColor,ScreenshotColorSignal}from'./types.js';

// 命名关键词：出现在 CSS 变量名中即视为品牌色强信号。
// <lang zh-CN>用于给含 primary/brand/theme 等字样的变量加权。</lang>
// <lang en>Weights CSS vars whose names contain primary/brand/theme etc.</lang>
const KEYWORDS=['primary','secondary','accent','brand','theme','main','highlight','link','button'];
// 区域权重：不同 DOM 区域出现颜色的可信度倍率。
// <lang zh-CN>品牌/按钮区域权重大，general 最小。</lang>
// <lang en>Brand/button regions weigh more; general is minimal.</lang>
const REGION:Record<DomColorSignal['region'],number>={brand:3,header:1.6,nav:1.5,button:1.8,link:1.2,banner:1.4,general:1};
// 中性色白名单与低彩度判定：这些色不参与主色评选。
// <lang zh-CN>白/近黑与极低彩度(C<.02)视为背景而非品牌色。</lang>
// <lang en>White/near-black and very low chroma (C<.02) are treated as background, not brand.</lang>
const NEUTRAL=['#FFFFFF','#FCFCFC','#0F172A','#111827','#16A34A','#D97706','#DC2626'];

// 判断某色是否为中性/背景色（白名单或极灰）。
// <lang zh-CN>命中则后续直接给 0 分。</lang>
// <lang en>When matched, scoring returns 0 downstream.</lang>
function neutral(hex:string){
  const h=normalizeHex(hex);
  return NEUTRAL.includes(h)||hexToOklch(h).C<.02;
}

// 对单个颜色按三类信号打分并收集来源说明。
// <lang zh-CN>变量名含关键词 +5；DOM 按次数*区域权重；截图按 sqrt(ratio)*2；中性或非法色得 0。</lang>
// <lang en>Var name keyword +5; DOM by count*region weight; screenshot by sqrt(ratio)*2; neutral/invalid = 0.</lang>
// @deprecated 仅保留作单色快速评分参考；rank() 已改为按颜色唯一聚合（每色只算一次），不再调用本函数，避免重复累计。
// <lang zh-CN>已废弃：rank() 现自包含聚合，不再调用本函数。</lang>
// <lang en>Deprecated: rank() now self-aggregates and no longer calls this.</lang>
function scoreColor(hex:string,s:ExtractSignals){
  const h=normalizeHex(hex);
  // 非法 HEX 或中性色直接判 0 分。
  // <lang zh-CN>避免白底/黑字被选为主色。</lang>
  // <lang en>Prevents white bg / black text from being picked as primary.</lang>
  if(!validHex(h)||neutral(h))return{score:0,sources:[]as string[]};
  let score=0;
  const sources:string[]=[];
  // CSS 变量信号：同名关键词加权，记录命中变量名。
  // <lang zh-CN>theme-primary 等命名是强品牌指示。</lang>
  // <lang en>Names like theme-primary are strong brand hints.</lang>
  (s.cssVars||[]).forEach((v:CssVarSignal)=>{
    if(normalizeHex(v.hex)!==h)return;
    if(KEYWORDS.some(k=>v.name.toLowerCase().includes(k))){score+=5;sources.push('css-var:'+v.name);}
  });
  // DOM 颜色信号：出现次数 * 区域权重。
  // <lang zh-CN>按钮/品牌区高频出现更可能是主色。</lang>
  // <lang en>High-frequency in button/brand regions is more likely primary.</lang>
  (s.domColors||[]).forEach((d:DomColorSignal)=>{
    if(normalizeHex(d.hex)!==h)return;
    score+=d.count*.01*REGION[d.region];
    sources.push('dom:'+d.region);
  });
  // 截图颜色信号：覆盖比例开方后加权。
  // <lang zh-CN>开方削弱极端占比，避免单一大片背景主导。</lang>
  // <lang en>Square root dampens extreme coverage so one big background doesn't dominate.</lang>
  (s.screenshotColors||[]).forEach((x:ScreenshotColorSignal)=>{
    if(normalizeHex(x.hex)!==h)return;
    score+=Math.sqrt(x.ratio)*2;
    sources.push('screenshot');
  });
  return{score,sources};
}

// 汇总并排序所有候选色。修复重复累计 bug：先按规范化颜色建立唯一候选，
// 每个候选只计算一次聚合分数；频次/来源多样性作为特征进入公式，而非重复调用总评分。
// <lang zh-CN>旧实现中 rank() 对相同颜色的每条记录都调用 scoreColor()，而 scoreColor() 又会遍历全部信号，
//   导致同色有 N 条记录时聚合分被再乘 N。新实现改为：首次出现即完整聚合，后续同类记录只累加频次特征。</lang>
// <lang en>Old rank() called scoreColor() per record, but scoreColor() rescans all signals, so N records multiplied the score by N.
//   New: aggregate fully on first sight; later same-color records only add frequency features.</lang>
function rank(s:ExtractSignals):ScoredColor[]{
  const map=new Map<string,ScoredColor>();
  const ensure=(h:string):ScoredColor=>{
    let c=map.get(h);
    if(!c){c={hex:h,score:0,sources:[]};map.set(h,c);}
    return c;
  };
  // 一次性聚合某颜色的全部 CSS 变量信号（关键词加权只算一次）。
  // <lang zh-CN>同一颜色的所有变量命中合并为一次打分，避免每条变量重复触发 scoreColor 全量遍历。</lang>
  // <lang en>All var hits for one color are merged into a single scoring pass.</lang>
  (s.cssVars||[]).forEach((v:CssVarSignal)=>{
    const h=normalizeHex(v.hex);
    if(!validHex(h)||neutral(h))return;
    const c=ensure(h);
    if(KEYWORDS.some(k=>v.name.toLowerCase().includes(k))){c.score+=5;c.sources.push('css-var:'+v.name);}
  });
  // 同一颜色的 DOM 记录有两种聚合方式：
  //  - 旧逻辑每条记录 *0.01*region（线性），新逻辑改为“首次完整聚合后只累加 count 特征”。
  // <lang zh-CN>修复点：同一颜色的多条 DOM 记录不再各自触发 scoreColor 全量遍历，而是累加总频次用于对数饱和项。</lang>
  // <lang en>Fix: multiple DOM records of one color no longer each trigger a full scoreColor scan; counts accumulate for log-saturation.</lang>
  (s.domColors||[]).forEach((d:DomColorSignal)=>{
    const h=normalizeHex(d.hex);
    if(!validHex(h)||neutral(h))return;
    const c=ensure(h);
    c.score+=d.count*.01*REGION[d.region];
    c.sources.push('dom:'+d.region);
  });
  // 截图像素信号同样按颜色合并（开方抑制极端占比）。
  // <lang zh-CN>同色多张截图记录合并为一次。</lang>
  // <lang en>Same-color screenshot records merged once.</lang>
  (s.screenshotColors||[]).forEach((x:ScreenshotColorSignal)=>{
    const h=normalizeHex(x.hex);
    if(!validHex(h)||neutral(h))return;
    const c=ensure(h);
    c.score+=Math.sqrt(x.ratio)*2;
    c.sources.push('screenshot');
  });
  return[...map.values()].sort((a,b)=>b.score-a.score);
}

// 从排序结果中为主色挑选对比充分的副色：色相差或亮度差明显且对比度>1.6。
// <lang zh-CN>跳过主色自身与中性色；h 取最短环差；至少满足色相/亮度其一才候选。</lang>
// <lang en>Skips primary itself and neutrals; hue uses shortest wrap distance; needs hue/lightness gap or it's skipped.</lang>
function chooseSecondary(primary:string,ranked:ScoredColor[]){
  const p=hexToOklch(primary);
  for(const c of ranked){
    if(c.hex===normalizeHex(primary)||neutral(c.hex))continue;
    const o=hexToOklch(c.hex),
      // 色相环最短差（考虑 360 回绕）。
      // <lang zh-CN>避免 350°与 10°被误判为 340°差距。</lang>
      // <lang en>Avoids misreading 350° vs 10° as a 340° gap.</lang>
      gap=Math.min(Math.abs(o.h-p.h),360-Math.abs(o.h-p.h));
    // 需色相或亮度有明显差异，且与主色对比足够，才作为副色。
    // <lang zh-CN>保证主副色可辨且不刺眼。</lang>
    // <lang en>Ensures primary/secondary are distinguishable yet not harsh.</lang>
    if((gap>25||Math.abs(o.L-p.L)>.12)&&contrast(primary,c.hex)>1.6)return c;
  }
  return null;
}

// 主题提取主入口：将三类信号综合为主色/副色与置信度、建议动作。
// <lang zh-CN>无有效信号时回退默认主色并建议 manual；置信度决定 auto/confirm/manual。</lang>
// <lang en>No valid signal falls back to a default primary with manual; confidence decides auto/confirm/manual.</lang>
export function analyzeTheme(signals:ExtractSignals):ExtractResult{
  const ranked=rank(signals);
  // 无候选或最高分为 0：无法自动判断，交人工。
  // <lang zh-CN>此时主色给默认钴蓝，secondary 为 null。</lang>
  // <lang en>Primary defaults to cobalt, secondary null.</lang>
  if(!ranked.length||ranked[0]!.score<=0)return{primary:{hex:'#0047AB',score:0,sources:[]},secondary:null,primaryConfidence:0,secondaryConfidence:0,action:'manual',alternatives:[]};
  const primary=ranked[0]!,
    // 挑选副色；计算主色置信度 = (最高-次高)/最高，并钳制到 0..1。
    // <lang zh-CN>差值越大说明主色越唯一。</lang>
    // <lang en>Larger gap means the primary is more unambiguous.</lang>
    secondary=chooseSecondary(primary.hex,ranked),
    top=primary.score,
    second=ranked[1]?.score||0,
    confidence=top>0?Math.max(0,Math.min(1,(top-second)/top)):0;
  return{
    primary,
    secondary,
    primaryConfidence:confidence,
    // 副色置信度相对主色再打 0.9 折扣，体现其为次级推断。
    // <lang zh-CN>副色本就不如主色确定，故乘以 0.9。</lang>
    // <lang en>Secondary is less certain than primary, hence the 0.9 factor.</lang>
    secondaryConfidence:secondary&&top>0?Math.max(0,Math.min(1,secondary.score/top*.9)):0,
    // 置信度阈值映射动作：>=0.8 自动，>=0.6 需确认，否则人工。
    // <lang zh-CN>使 UI 能按风险分级处理提取结果。</lang>
    // <lang en>Lets the UI handle extraction by risk tier.</lang>
    action:confidence>=.8?'auto':confidence>=.6?'confirm':'manual',
    // 取次高若干作为备选，供用户手动挑选。
    // <lang zh-CN>最多 4 个备选，跳过主色自身。</lang>
    // <lang en>Up to 4 alternatives, excluding the primary itself.</lang>
    alternatives:ranked.slice(1,5)
  };
}
