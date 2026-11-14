/**
 * @lang zh-CN 图片提色（`W-tb-P39`，ADR-014）：从像素数据提取主/副色候选与渐变配置。
 *   **确定性算法**：降采样（最长边 ≤512px，最近邻）→ sRGB→OKLab → 中位切分（按 L/a/b 最宽轴
 *   递归，k=8）→ 代表色 + 计数 → 近色合并（OKLab 距离阈值）→ 模式加权排序。
 *   同图同参必得同结果（可单测复现）；**纯计算无 IO**——解码与像素获取由宿主完成（隐私边界：
 *   零网络请求由宿主侧断言）。
 *
 * @lang en Image colour extraction (`W-tb-P39`, ADR-014): derives primary/secondary candidates and a gradient
 *   config from pixel data. **Deterministic**: downsample (longest edge ≤512px, nearest neighbour) → sRGB→OKLab
 *   → median cut (split on the widest L/a/b axis, k=8) → representative colours + counts → near-colour merge
 *   (OKLab distance threshold) → mode-weighted ordering. Same input always yields the same output (unit-testable
 *   reproduction); **pure computation, no IO** — decoding/pixels are the host's job (privacy: zero network
 *   requests asserted host-side).
 */
import{hexToRgb,rgbToHex,rgbToOklab,oklabToRgb,normalizeHex}from'./convert.js';
import{nameColor}from'./color-name.js';
import{bestOnColor}from'./contrast.js';

/** @lang zh-CN 降采样上限（最长边，ADR-014 决策 6）。 @lang en Downsample cap (longest edge, ADR-014 decision 6). */
export const IMAGE_EXTRACT_MAX_DIM = 512;
/** @lang zh-CN 聚类数（中位切分叶子数）。 @lang en Cluster count (median-cut leaves). */
export const IMAGE_EXTRACT_CLUSTERS = 8;
/** @lang zh-CN 近色合并阈值（OKLab 距离）。 @lang en Near-colour merge threshold (OKLab distance). */
export const IMAGE_EXTRACT_MERGE_DIST = 0.09;
/** @lang zh-CN 提取模式。 @lang en Extraction modes. */
export type ImageExtractMode = 'balanced' | 'vivid' | 'bright' | 'dark';

/** @lang zh-CN 降采样后的像素输入（宿主经 OffscreenCanvas 提供）。 @lang en Downsampled pixel input (host provides via OffscreenCanvas). */
export interface ImagePixels { data: Uint8ClampedArray; width: number; height: number; }

export interface ImageCandidate {
  /** @lang zh-CN 候选 HEX。 @lang en Candidate HEX. */
  hex: string;
  /** @lang zh-CN 中文色名（ISCC-NBS 管线）。 @lang en Chinese colour name (ISCC-NBS pipeline). */
  name: string;
  /** @lang zh-CN 英文色名。 @lang en English colour name. */
  nameEn: string;
  /** @lang zh-CN 象素占比（0–1，模式加权后）。 @lang en Pixel share (0–1, after mode weighting). */
  weight: number;
  /** @lang zh-CN 原始计票（未加权，供 UI 显示可信度）。 @lang en Raw vote count (unweighted, for confidence display). */
  population: number;
}

export interface ImageExtractResult {
  /** @lang zh-CN 加权排序后的候选（近色已合并；最多 6 条）。 @lang en Candidates sorted by mode weighting (merged; ≤6). */
  candidates: ImageCandidate[];
  /** @lang zh-CN 推荐主色（加权首位）。 @lang en Suggested primary (weighted first). */
  primary: string;
  /** @lang zh-CN 推荐副色（与主色色相差最大且对比达标的候选；无则回退主色的最佳前景）。 @lang en Suggested secondary (largest hue gap with adequate contrast; falls back to the primary's best foreground). */
  secondary: string;
  /** @lang zh-CN 渐变提取：最暗/最亮候选（HEX）；不足两条候选时为 null。 @lang en Gradient extraction: darkest/brightest candidates (HEX); null when fewer than two candidates. */
  gradient: { start: string; end: string } | null;
}

/** @lang zh-CN 最近邻降采样：最长边超过 maxDim 时按整数步长抽点（不插值，确定性）。 @lang en Nearest-neighbour downsample: integer stride sampling when the longest edge exceeds maxDim (no interpolation, deterministic). */
export function downsamplePixels(input: ImagePixels, maxDim = IMAGE_EXTRACT_MAX_DIM): ImagePixels {
  const longest = Math.max(input.width, input.height);
  if (longest <= maxDim) return input;
  const step = Math.ceil(longest / maxDim);
  const w = Math.floor(input.width / step), h = Math.floor(input.height / step);
  const out = new Uint8ClampedArray(w * h * 4);
  let o = 0;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const si = (y * step * input.width + x * step) * 4;
      out[o++] = input.data[si]!; out[o++] = input.data[si + 1]!; out[o++] = input.data[si + 2]!; out[o++] = 255;
    }
  }
  return { data: out, width: w, height: h };
}

/** @lang zh-CN 跳过全透明像素。 @lang en Fully transparent pixels are skipped. */
function isOpaque(data: Uint8ClampedArray, i: number): boolean { return data[i + 3]! > 0; }

/** @lang zh-CN 中位切分：像素按 OKLab 坐标递归二分（最宽轴取中位），直至 k 个叶子或不可再分。 @lang en Median cut: pixels split recursively on OKLab (median of the widest axis) until k leaves or unsplittable. */
function medianCut(pixels: Array<[number, number, number]>, k: number): Array<Array<[number, number, number]>> {
  let buckets: Array<Array<[number, number, number]>> = [pixels];
  while (buckets.length < k) {
    // 选含像素最多且极差最大的桶与轴（并列取轴序 L→a→b，确定性）。
    // <lang en>Pick the bucket with the most pixels and the widest range (ties break L→a→b, deterministic).</lang>
    let bestIdx = -1, bestAxis = -1, bestRange = 0;
    buckets.forEach((bucket, idx) => {
      if (bucket.length < 2) return;
      for (const axis of [0, 1, 2] as const) {
        let lo = Infinity, hi = -Infinity;
        for (const p of bucket) { lo = Math.min(lo, p[axis]); hi = Math.max(hi, p[axis]); }
        const range = hi - lo;
        if (range > bestRange) { bestRange = range; bestIdx = idx; bestAxis = axis; }
      }
    });
    if (bestIdx < 0 || bestRange <= 0) break;
    const bucket = buckets[bestIdx]!;
    // 中位切分：按轴排序取中位（奇数取上中位，确定性）。
    // <lang en>Median split: sort along the axis and cut at the upper median (deterministic).</lang>
    const axis = bestAxis as 0 | 1 | 2;
    const sorted = [...bucket].sort((a, b) => a[axis] - b[axis]);
    const mid = Math.floor(sorted.length / 2);
    buckets = buckets.filter((_, i) => i !== bestIdx).concat([sorted.slice(0, mid), sorted.slice(mid)]);
  }
  return buckets;
}

/** @lang zh-CN OKLab 距离（欧氏）。 @lang en OKLab distance (Euclidean). */
function labDist(a: [number, number, number], b: [number, number, number]): number {
  return Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
}

/**
 * @lang zh-CN 图片提色主入口：降采样 → 不透明像素 → OKLab 中位切分 → 代表色（桶均值）→
 *   近色合并 → 模式加权排序 → 主/副/渐变推导。纯函数、确定性。
 * @lang en The main extraction entry: downsample → opaque pixels → OKLab median cut → representative colours
 *   (bucket means) → near-colour merge → mode-weighted ordering → primary/secondary/gradient. Pure and
 *   deterministic.
 */
export function extractImagePalette(input: ImagePixels, mode: ImageExtractMode = 'balanced'): ImageExtractResult {
  const { data, width, height } = downsamplePixels(input);
  const pixels: Array<[number, number, number]> = [];
  for (let i = 0; i < width * height; i++) {
    const si = i * 4;
    if (!isOpaque(data, si)) continue;
    pixels.push(rgbToOklab([data[si]! / 255, data[si + 1]! / 255, data[si + 2]! / 255]));
  }
  if (!pixels.length) return { candidates: [], primary: '', secondary: '', gradient: null };
  const buckets = medianCut(pixels, IMAGE_EXTRACT_CLUSTERS);
  // 代表色 = 桶内**逐轴中位数**（非均值）——离散色图的代表色不再被邻色拉偏（青条带不会变绿），
  //   且中位数同样是确定性的。
  // <lang en>Representative = per-axis **median** of the bucket (not the mean): on discrete-colour images the
  //   representative stops drifting toward neighbours (a cyan strip stays cyan), and the median is equally
  //   deterministic.</lang>
  let clusters = buckets
    .filter(b => b.length > 0)
    .map(bucket => {
      const median = (axis: 0 | 1 | 2) => {
        const sorted = bucket.map(p => p[axis]).sort((x, y) => x - y);
        return sorted[Math.floor(sorted.length / 2)]!;
      };
      const hex = rgbToHex(oklabToRgb([median(0), median(1), median(2)]));
      return { hex, lab: hexToLab(hex), population: bucket.length };
    });
  // 近色合并：距离 ≤ 阈值的簇并入近邻（计票相加），减少同色多卡。
  // <lang en>Merge near colours: clusters within the threshold fold into their nearest neighbour (votes sum).</lang>
  const merged: typeof clusters = [];
  for (const c of clusters) {
    const near = merged.find(m => labDist(m.lab, c.lab) <= IMAGE_EXTRACT_MERGE_DIST);
    if (near) { near.population += c.population; continue; }
    merged.push({ ...c });
  }
  clusters = merged;
  const total = clusters.reduce((sum, c) => sum + c.population, 0);
  // 模式加权：balanced=计票；vivid=彩度×计票；bright/dark 在计票上乘以明度偏好因子。
  // <lang en>Mode weighting: balanced = votes; vivid = chroma×votes; bright/dark multiply votes by a
  //   lightness-preference factor.</lang>
  const weighted = clusters.map(c => {
    const { L, C } = c.lab;
    let score = c.population;
    // vivid = **彩度平方优先**：小面积高彩点缀能超越大面积低彩底色（线性加权补不开 60:1 的计票差）。
    // <lang en>vivid = **chroma-squared first**: small vivid accents outrank large muted backdrops (a linear
    //   weight cannot close a 60:1 population gap).</lang>
    if (mode === 'vivid') score = c.population * Math.pow(C * 5, 2);
    // bright/dark = 明度线性偏置（幅度小于 vivid——明暗偏好是温和重排）。
    // <lang en>bright/dark apply a linear lightness bias (milder than vivid — lightness preference is a gentle
    //   reordering).</lang>
    if (mode === 'bright') score = c.population * (0.3 + L * 1.2);
    if (mode === 'dark') score = c.population * (0.3 + (1 - L) * 1.2);
    return { ...c, score };
  }).sort((a, b) => b.score - a.score);
  // 候选卡（最多 6）：色名走 ISCC-NBS 管线；weight 为加权占比。
  // <lang en>Candidate cards (≤6): names via the ISCC-NBS pipeline; weight is the weighted share.</lang>
  const top = weighted.slice(0, 6);
  const candidates: ImageCandidate[] = top.map(c => {
    const n = nameColor(c.hex);
    return { hex: normalizeHex(c.hex), name: n.zh, nameEn: n.en, weight: c.score / Math.max(1, weighted.reduce((s, w) => s + w.score, 0)), population: c.population };
  });
  const primary = candidates[0]?.hex ?? '';
  // 副色：与主色色相差最大（≥30°）且对比 ≥3 的候选；无则回退主色最佳前景。
  // <lang en>Secondary: the candidate with the largest hue gap from the primary (≥30°) and contrast ≥3;
  //   fallback is the primary's best foreground.</lang>
  let secondary = '';
  const pLab = hexToLab(primary);
  for (const c of top) {
    if (c.hex === primary) continue;
    // 主判据：色相差 ≥30° 且对比 ≥3（可用下限）；全不满足回退第二候选，再回退最佳前景。
    // <lang en>Primary rule: hue gap ≥30° with contrast ≥3 (usability floor); fall back to the second
    //   candidate, then to the primary's best foreground.</lang>
    let dh = Math.abs(hexToLab(c.hex).h - pLab.h); if (dh > 180) dh = 360 - dh;
    if (dh >= 30 && contrastOk(primary, c.hex)) { secondary = c.hex; break; }
  }
  if (!secondary && candidates.length > 1) secondary = candidates[1]!.hex;
  if (!secondary) secondary = bestOnColor(primary).hex;
  // 渐变：最暗/最亮候选（按 OKLab L）。
  // <lang en>Gradient: darkest/brightest candidates by OKLab L.</lang>
  const byL = [...top].sort((a, b) => hexToLab(a.hex).L - hexToLab(b.hex).L);
  const gradient = byL.length >= 2 && byL[0]!.hex !== byL[byL.length - 1]!.hex
    ? { start: byL[0]!.hex, end: byL[byL.length - 1]!.hex }
    : null;
  return { candidates, primary, secondary, gradient };
}

/** @lang zh-CN HEX → OKLab（内部便捷）。 @lang en HEX → OKLab (internal convenience). */
function hexToLab(hex: string): [number, number, number] & { L: number; C: number; h: number } {
  const lab = rgbToOklab(hexToRgb(hex));
  const L = lab[0], a = lab[1], b = lab[2];
  const C = Math.hypot(a, b), h = (Math.atan2(b, a) * 180 / Math.PI + 360) % 360;
  return Object.assign([L, a, b] as [number, number, number], { L, C, h });
}

/** @lang zh-CN 对比度 ≥3 判定（副色可用性下限）。 @lang en Contrast ≥3 check (secondary usability floor). */
function contrastOk(a: string, b: string): boolean {
  const la = luminanceOf(a), lb = luminanceOf(b);
  const hi = Math.max(la, lb), lo = Math.min(la, lb);
  return (hi + 0.05) / (lo + 0.05) >= 3;
}

function luminanceOf(hex: string): number {
  const [r = 0, g = 0, b = 0] = hexToRgb(hex).map(c => c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/**
 * @lang zh-CN 从提取结果构造渐变方向建议：暗→亮用 135deg（对角），亮→暗用 315deg。
 * @lang en Suggests a gradient direction from the extraction: dark→light uses 135deg (diagonal), the reverse
 *   uses 315deg.
 */
export function suggestGradientDirection(start: string, end: string): string {
  return luminanceOf(start) <= luminanceOf(end) ? '135deg' : '315deg';
}


