/**
 * @lang zh-CN 确定性截图量化器：基于 median-cut 将 RGBA 像素聚为少量代表色。
 *   不使用随机种子，相同输入恒得相同输出，满足跨端可复现与 fixture 测试要求。
 *   低 alpha 像素被忽略；目标候选数由调用方在 12~16 之间设定。
 * @lang en Deterministic screenshot quantizer: median-cut clusters RGBA pixels into a few representative colors.
 *   No random seed, so identical input always yields identical output (cross-end reproducible, fixture-testable).
 *   Low-alpha pixels ignored; target candidate count set by caller between 12~16.
 */

// 单个像素的 RGBA 通道（0..255）。
// <lang zh-CN>量化仅在 sRGB 空间做几何划分；最终色由 Core 在 OKLab 二次聚类。</lang>
// <lang en>Quantization only partitions sRGB geometry; Core re-clusters in OKLab.</lang>
export interface RgbaPixel{ r:number; g:number; b:number; a:number; }

// 量化结果：代表色（sRGB）、该色覆盖像素数、占比（0..1）。
// <lang zh-CN>ratio 交给 Core 做 sqrt 饱和加权，不直接当主色。</lang>
// <lang en>ratio flows to Core for sqrt-saturation; not taken as primary directly.</lang>
export interface QuantizedColor{ hex:string; count:number; ratio:number; }

// 把 0..255 通道转为 #rrggbb（小写、无 alpha，量化只保留不透明代表色）。
// <lang zh-CN>量化输出统一为不透明 sRGB，alpha 证据已在抽取阶段按背景合成。</lang>
// <lang en>Quantized output is opaque sRGB; alpha evidence was already composited at extract time.</lang>
function toHex(r:number, g:number, b:number):string{
  const h=(n:number)=>n.toString(16).padStart(2,'0');
  return '#'+h(Math.round(r))+h(Math.round(g))+h(Math.round(b));
}

// 计算一组像素在某通道上的范围，用于选择切分维度。
// <lang zh-CN>median-cut 选范围最大的通道做中位切分，保证每次划分确定。</lang>
// <lang en>median-cut picks the widest channel for a median split, keeping each cut deterministic.</lang>
function channelRange(pixels:RgbaPixel[], ch:0|1|2):[number,number]{
  let min=255, max=0;
  for(const p of pixels){
    const v=ch===0?p.r:ch===1?p.g:p.b;
    if(v<min)min=v;
    if(v>max)max=v;
  }
  return [min,max];
}

// 对一组像素按指定通道排序后取中位数索引切分为左右两半。
// <lang zh-CN>排序稳定，取 Math.floor(len/2) 为切点，保证可复现。</lang>
// <lang en>Stable sort, cut at Math.floor(len/2) for reproducibility.</lang>
function splitPixels(pixels:RgbaPixel[], ch:0|1|2):[RgbaPixel[],RgbaPixel[]]{
  const sorted=[...pixels].sort((a,b)=>(ch===0?a.r-b.r:ch===1?a.g-b.g:a.b-b.b));
  const mid=Math.floor(sorted.length/2);
  return [sorted.slice(0,mid),sorted.slice(mid)];
}

// 计算一组像素的平均色（加权平均，供代表色使用）。
// <lang zh-CN>代表色取均值而非极端点，降低抗锯齿/渲染误差影响。</lang>
// <lang en>Representative takes the mean, damping antialiasing/render noise.</lang>
function averageColor(pixels:RgbaPixel[]):{r:number;g:number;b:number}{
  let r=0,g=0,b=0;
  for(const p of pixels){r+=p.r;g+=p.g;b+=p.b;}
  const n=pixels.length||1;
  return { r:r/n, g:g/n, b:b/n };
}

/**
 * @lang zh-CN 确定性 median-cut 量化主入口。
 *   pixels: 已转成 RGBA 的截图数据（低 alpha 由调用方预筛或由 ignoreAlpha 控制）；
 *   targetCount: 目标代表色数量（建议 12~16）；
 *   返回按 count 降序的代表色列表与占比。
 * @lang en Deterministic median-cut entry. pixels: RGBA screenshot data; targetCount: desired reps (12~16);
 *   returns representatives sorted by count desc with ratios.
 */
export function quantizeMedianCut(pixels:RgbaPixel[], targetCount:number, ignoreAlpha=true):QuantizedColor[]{
  const usable=pixels.filter(p=>!(ignoreAlpha&&p.a<16));
  if(usable.length===0)return [];
  // 初始单桶；按目标数迭代二切，直到达到桶数或无法再分。
  // <lang zh-CN>每轮选像素最多的桶切分，逼近目标桶数。</lang>
  // <lang en>Each round splits the most populous bucket, approaching target bucket count.</lang>
  let buckets:RgbaPixel[][]= [usable];
  while(buckets.length<targetCount){
    // 选当前最大桶做切分；若所有桶都只剩 1 像素则停止。
    // <lang zh-CN>最大桶优先切，保证信息量最高的区域先细化。</lang>
    // <lang en>Split largest bucket first so highest-information regions refine earliest.</lang>
    let idx=-1, best=0;
    for(let i=0;i<buckets.length;i++){
      if(buckets[i]!.length>best){best=buckets[i]!.length;idx=i;}
    }
    if(best<=1)break;
    const bucket=buckets[idx]!;
    // 选范围最大的通道切分。
    // <lang zh-CN>三通道范围比较，固定优先级 r→g→b 打破平局。</lang>
    // <lang en>Compare three channel ranges; fixed priority r→g→b breaks ties.</lang>
    const rR=channelRange(bucket,0), gR=channelRange(bucket,1), bR=channelRange(bucket,2);
    const maxR=Math.max(rR[1]-rR[0],gR[1]-gR[0],bR[1]-bR[0]);
    const ch:0|1|2 = (maxR===(rR[1]-rR[0]))?0:(maxR===(gR[1]-gR[0]))?1:2;
    const [left,right]=splitPixels(bucket,ch);
    if(left.length===0||right.length===0)break;
    buckets=buckets.filter((_,i)=>i!==idx);
    buckets.push(left,right);
  }
  const total=usable.length;
  return buckets
    .map(b=>{ const avg=averageColor(b); return { hex:toHex(avg.r,avg.g,avg.b), count:b.length, ratio:b.length/total }; })
    .sort((a,b)=>b.count-a.count);
}
