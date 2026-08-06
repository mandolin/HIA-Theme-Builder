/**
 * @lang zh-CN 实验性量化基准：复刻 Material Color Utilities 的 QuantizerCelebi 思想（在感知一致的
 *   Lab 空间做加权 k-means 聚类，使用确定性的 k-means++ 种子与固定迭代），仅作为与现有 median-cut
 *   的对比基准。文档明确要求：不得直接采用其主题 seed Score 作为网页品牌色评分，因此它不接入
 *   analyzeThemeV2 的主评分路径，只用于偏离度对比与算法审计。
 * @lang en Experimental quantizer baseline: reproduces the QuantizerCelebi idea (perceptually-uniform Lab-space
 *   weighted k-means with deterministic k-means++ seeding and fixed iterations) purely as a comparison baseline
 *   against median-cut. Per spec it must NOT feed the brand-color scoring; it only measures divergence for audit.
 */

import type { RgbaPixel, QuantizedColor } from './median-cut.js';

// RGB(0..255) → 线性 sRGB（gamma 解码）。
// <lang zh-CN>sRGB 编码需先解码为线性光，Lab 距离才感知一致。</lang>
// <lang en>Decode sRGB gamma to linear light so Lab distance is perceptually uniform.</lang>
function srgbToLinear(c:number):number{
  const v=c/255;
  return v<=0.04045? v/12.92 : Math.pow((v+0.055)/1.055,2.4);
}

// 线性 RGB → CIE Lab（D65 白点）。
// <lang zh-CN>标准 sRGB→XYZ→Lab 转换，供 Lab 空间聚类。</lang>
// <lang en>Standard sRGB→XYZ→Lab; clusters in Lab space.</lang>
function rgbToLab(r:number,g:number,b:number):[number,number,number]{
  const R=srgbToLinear(r), G=srgbToLinear(g), B=srgbToLinear(b);
  const x=(R*0.4124+G*0.3576+B*0.1805)/0.95047;
  const y=(R*0.2126+G*0.7152+B*0.0722)/1.0;
  const z=(R*0.0193+G*0.1192+B*0.9505)/1.08883;
  const f=(t:number)=> t>0.008856? Math.cbrt(t) : (7.787*t)+16/116;
  const fx=f(x), fy=f(y), fz=f(z);
  return [ (116*fy)-16, 500*(fx-fy), 200*(fy-fz) ];
}

// 把像素集合转为 Lab 点（含权重 alpha 归一化后由调用方筛选，这里直接忽略低 alpha）。
// <lang zh-CN>低 alpha 像素在入口处已筛除；此处仅做色彩空间变换。</lang>
// <lang en>Low-alpha pixels filtered at entry; here only the color-space transform.</lang>
function toLabPoints(pixels:RgbaPixel[]):{ lab:[number,number,number]; p:RgbaPixel }[]{
  return pixels.filter(p=>p.a>=16).map(p=>({ lab:rgbToLab(p.r,p.g,p.b), p }));
}

// 确定性 k-means++ 种子：用像素索引的哈希作为伪随机源，保证同输入同种子（可复现）。
// <lang zh-CN>不使用 Math.random，避免非确定性；种子顺序固定。</lang>
// <lang en>No Math.random; fixed seeding order keeps it reproducible.</lang>
function seededPick(points:{ lab:[number,number,number] }[], k:number):[number,number,number][]{
  if(points.length===0)return [];
  const centroids:[number,number,number][]=[];
  centroids.push(points[0]!.lab);
  while(centroids.length<k && centroids.length<points.length){
    // 距离平方最小和（与各现有质心），用作加权选择。
    // <lang zh-CN>取当前最远点作为下一质心，确定性近似 k-means++。</lang>
    // <lang en>Pick the farthest current point as next centroid (deterministic k-means++ approx).</lang>
    let bestIdx=0,bestD=-1;
    for(let i=0;i<points.length;i++){
      let dMin=Infinity;
      for(const c of centroids){ const dl=points[i]!.lab[0]-c[0], da=points[i]!.lab[1]-c[1], db=points[i]!.lab[2]-c[2]; const d=dl*dl+da*da+db*db; if(d<dMin)dMin=d; }
      if(dMin>bestD){ bestD=dMin; bestIdx=i; }
    }
    centroids.push(points[bestIdx]!.lab);
  }
  return centroids;
}

// Lab 距离平方。
// <lang zh-CN>感知一致空间内的欧氏距离平方。</lang>
// <lang en>Squared Euclidean distance in Lab.</lang>
function labDist2(a:[number,number,number], b:[number,number,number]):number{
  const dl=a[0]-b[0], da=a[1]-b[1], db=a[2]-b[2];
  return dl*dl+da*da+db*db;
}

/**
 * @lang zh-CN Celebi 风格量化（实验性基准）：Lab 空间确定性 k-means（k-means++ 种子，固定 10 次迭代）。
 *   返回与 median-cut 同结构的代表色（按 count 降序）。不接入主评分路径。
 * @lang en Celebi-style quantizer (experimental baseline): deterministic Lab-space k-means (k-means++ seeds, fixed 10 iters).
 *   Returns same-shape reps as median-cut; not on the main scoring path.
 */
export function quantizeCelebi(pixels:RgbaPixel[], targetCount:number):QuantizedColor[]{
  const pts=toLabPoints(pixels);
  if(pts.length===0)return [];
  const k=Math.max(1,Math.min(targetCount,pts.length));
  let centroids=seededPick(pts,k);
  const ITER=10;
  for(let it=0;it<ITER;it++){
    // 分配：每点归最近质心。
    // <lang zh-CN>逐点分配，O(nk) 固定开销。</lang>
    // <lang en>Assign each point to nearest centroid; O(nk).</lang>
    const assign:number[]=new Array(pts.length).fill(0);
    const sums:[number,number,number,number][]=centroids.map(()=>[0,0,0,0]); // labL,labA,labB,count
    for(let i=0;i<pts.length;i++){
      let best=0,bestD=Infinity;
      for(let c=0;c<centroids.length;c++){ const d=labDist2(pts[i]!.lab,centroids[c]!); if(d<bestD){bestD=d;best=c;} }
      assign[i]=best;
      sums[best]![0]+=pts[i]!.lab[0]; sums[best]![1]+=pts[i]!.lab[1]; sums[best]![2]+=pts[i]!.lab[2]; sums[best]![3]++;
    }
    // 更新质心为簇均值（Lab 空间）。
    // <lang zh-CN>均值更新；空簇保持原质心避免坍缩。</lang>
    // <lang en>Mean update; empty clusters keep prior centroid.</lang>
    centroids=sums.map((s,idx)=> s[3]>0? [s[0]/s[3],s[1]/s[3],s[2]/s[3]] : centroids[idx]!);
  }
  // 统计每簇像素数与代表色（取该簇首个像素的 sRGB 均值近似；此处用簇内 sRGB 平均更稳）。
  // <lang zh-CN>代表色用簇内 sRGB 平均，降低抗锯齿噪声。</lang>
  // <lang en>Representative is in-cluster sRGB mean to damp AA noise.</lang>
  const acc=centroids.map(()=>({ r:0,g:0,b:0,n:0 }));
  for(let i=0;i<pts.length;i++){
    // 最终簇分配：重新计算到最近质心（避免依赖迭代循环内的局部 assign 变量）。
    // <lang zh-CN>迭代结束后的质心已固定，按最近质心归类统计。</lang>
    // <lang en>Final assignment by nearest centroid after iterations settle.</lang>
    let best=0,bestD=Infinity;
    for(let c=0;c<centroids.length;c++){ const d=labDist2(pts[i]!.lab,centroids[c]!); if(d<bestD){bestD=d;best=c;} }
    acc[best]!.r+=pts[i]!.p.r; acc[best]!.g+=pts[i]!.p.g; acc[best]!.b+=pts[i]!.p.b; acc[best]!.n++;
  }
  const total=pts.length;
  const toHex=(r:number,g:number,b:number)=>{ const h=(n:number)=>Math.round(n).toString(16).padStart(2,'0'); return '#'+h(r)+h(g)+h(b); };
  return acc
    .map((a,idx)=>({ hex:toHex(a.r/a.n,a.g/a.n,a.b/a.n), count:a.n, ratio:a.n/total }))
    .filter(q=>q.count>0)
    .sort((a,b)=>b.count-a.count);
}

// 两量化结果主导色（前 n 个）的偏差：以 hex 集合 Jaccard + 占比差衡量。
// <lang zh-CN>仅用于基准报告，不用于评分；返回 0..1，越低越一致。</lang>
// <lang en>Baseline report only, not scoring; 0..1, lower = more consistent.</lang>
export function quantizerDivergence(a:QuantizedColor[], b:QuantizedColor[], topN=5):number{
  const take=(arr:QuantizedColor[])=>arr.slice(0,topN);
  const sa=new Set(take(a).map(q=>q.hex)), sb=new Set(take(b).map(q=>q.hex));
  const inter=[...sa].filter(h=>sb.has(h)).length;
  const union=new Set([...sa,...sb]).size;
  const jaccard=union>0? inter/union : 0;
  // 占比差：前 topN 各自占比序列的 L1 距离。
  // <lang zh-CN>占比序列按 hex 对齐求差。</lang>
  // <lang en>Align ratio sequences by hex then L1.</lang>
  const ra=new Map(take(a).map(q=>[q.hex,q.ratio])); const rb=new Map(take(b).map(q=>[q.hex,q.ratio]));
  let ratioDiff=0;
  for(const h of new Set([...ra.keys(),...rb.keys()])){ ratioDiff+=Math.abs((ra.get(h)??0)-(rb.get(h)??0)); }
  return 1 - (0.6*jaccard + 0.4*(1-Math.min(1,ratioDiff/2)));
}
