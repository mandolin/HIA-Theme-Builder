/**
 * @lang zh-CN 图片提色单测（`W-tb-P39` / ADR-014）：①确定性（同图同参同结果）；②降采样护栏；
 * ③聚类与近色合并；④模式加权差异；⑤主/副/渐变推导；⑥退化图（单色/全透明）。
 * 全部使用合成像素（不依赖 canvas/文件），纯函数路径。
 * @lang en Image extraction tests (`W-tb-P39` / ADR-014): (1) determinism; (2) downsample cap; (3) clustering and
 *   near-colour merge; (4) mode weighting differences; (5) primary/secondary/gradient derivation; (6) degenerate
 *   inputs (single colour / fully transparent). All synthetic pixels — pure-function paths, no canvas/files.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { extractImagePalette, downsamplePixels, suggestGradientDirection, IMAGE_EXTRACT_MAX_DIM } from '../dist/index.js';

/** @lang zh-CN 造图助手：fill(x,y)→hex 的合成像素。 @lang en Image helper: fill(x,y)→hex synthetic pixels. */
function makeImage(w, h, fill) {
  const data = new Uint8ClampedArray(w * h * 4);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const hex = fill(x, y);
    const i = (y * w + x) * 4;
    data[i] = parseInt(hex.slice(1, 3), 16); data[i + 1] = parseInt(hex.slice(3, 5), 16);
    data[i + 2] = parseInt(hex.slice(5, 7), 16); data[i + 3] = 255;
  }
  return { data, width: w, height: h };
}

test('提取：确定性——同图同参两次调用逐位一致', () => {
  const img = makeImage(64, 64, (x, y) => (x < 32 ? '#0047AB' : '#00A8D3'));
  const a = extractImagePalette(img, 'balanced');
  const b = extractImagePalette(img, 'balanced');
  assert.deepEqual(a, b, '两次调用结果必须逐位一致（ADR-014 决策 2）');
});

test('提取：蓝/青/橙三分图聚类正确（代表色命中原色）', () => {
  const img = makeImage(64, 64, (x, y) => (y < 8 ? '#F97316' : x < 32 ? '#0047AB' : '#00A8D3'));
  const r = extractImagePalette(img, 'balanced');
  const hexes = r.candidates.map(c => c.hex);
  for (const expected of ['#0047AB', '#00A8D3', '#F97316']) {
    assert.ok(hexes.includes(expected), `应命中 ${expected}，实为 ${hexes.join(',')}`);
  }
  assert.equal(r.primary, '#0047AB', '计票最高（1792）的主色应为蓝');
  assert.equal(r.secondary, '#00A8D3', '副色应为色相差最大的青');
  // 计票排序：蓝/青各 1792，橙 512。
  assert.ok(r.candidates[0].population > r.candidates[2].population);
});

test('提取：降采样护栏——2000px 长边压到 ≤512 且保持宽高比', () => {
  const big = makeImage(2000, 1000, () => '#0047AB');
  const ds = downsamplePixels(big);
  assert.ok(Math.max(ds.width, ds.height) <= IMAGE_EXTRACT_MAX_DIM, `降采样后最长边 ${Math.max(ds.width, ds.height)} 超 512`);
  // 原图 2000×1000 步长 4 → 500×250（整数步长，确定性）。
  assert.equal(ds.width, 500); assert.equal(ds.height, 250);
  // 小图原样返回（同一引用，零拷贝）。
  const small = makeImage(64, 64, () => '#0047AB');
  assert.equal(downsamplePixels(small), small);
});

test('提取：模式加权——低彩底色图中的鲜色区在 vivid 下升至首位', () => {
  // 88% 低彩深藏青（C≈0.03）+ 12% 鲜黄（C≈0.2）：balanced 按计票藏青居首；
  //   vivid=彩度平方优先 → 鲜黄应升至首位（彩度比 ~6.7² ≈ 44× 补得开 7:1 计票差）。
  // <lang en>88% muted navy (C≈0.03) + 12% vivid yellow (C≈0.2): balanced keeps navy first; vivid's chroma-
  //   squared weighting lifts yellow to first (ratio ~44× closes the 7:1 population gap).</lang>
  const img = makeImage(64, 64, (x, y) => (x < 22 && y < 20 ? '#FFD400' : '#223344'));
  const balanced = extractImagePalette(img, 'balanced');
  const vivid = extractImagePalette(img, 'vivid');
  assert.equal(balanced.candidates[0].hex, '#223344', 'balanced 按计票应藏青居首');
  assert.equal(vivid.candidates[0].hex, '#FFD400', 'vivid 应鲜黄居首');
});

test('提取：主/副色推导——副色与主色色相差 ≥30° 且对比可用', () => {
  const img = makeImage(64, 64, (x, y) => (x < 32 ? '#0047AB' : '#00A8D3'));
  const r = extractImagePalette(img, 'balanced');
  assert.equal(r.secondary, '#00A8D3');
  // 单色图：副色回退最佳前景（白）。
  const mono = extractImagePalette(makeImage(16, 16, () => '#0047AB'), 'balanced');
  assert.equal(mono.secondary, '#FFFFFF');
});

test('提取：渐变方向——暗→亮 135deg，亮→暗 315deg', () => {
  const r = extractImagePalette(makeImage(64, 64, (x, y) => (x < 32 ? '#103667' : '#FFFAB3')), 'balanced');
  assert.ok(r.gradient, '双色图应有渐变候选');
  assert.equal(suggestGradientDirection(r.gradient.start, r.gradient.end), '135deg');
  assert.equal(suggestGradientDirection(r.gradient.end, r.gradient.start), '315deg');
});

test('提取：退化输入——全透明像素返回空候选（不造假卡）', () => {
  const data = new Uint8ClampedArray(16 * 16 * 4); // alpha 全 0
  const r = extractImagePalette({ data, width: 16, height: 16 }, 'balanced');
  assert.deepEqual(r.candidates, []);
  assert.equal(r.primary, '');
  assert.equal(r.gradient, null);
});

test('提取：近色合并——同色系渐变图不得产出重复候选卡', () => {
  // 深蓝→浅蓝对角渐变：聚类 8 桶但近色合并后应显著少于 8。
  // <lang en>A navy→light-blue diagonal gradient: 8 clusters must merge to far fewer cards.</lang>
  const img = makeImage(64, 64, (x, y) => {
    const t = (x + y) / 126;
    const r = Math.round(0x00 + t * (0xF0 - 0x00));
    const g = Math.round(0x47 + t * (0xF6 - 0x47));
    const b = Math.round(0xAB + t * (0xFF - 0xAB));
    return '#' + [r, g, b].map(v => v.toString(16).padStart(2, '0')).join('').toUpperCase();
  });
  const r = extractImagePalette(img, 'balanced');
  assert.ok(r.candidates.length <= 4, `近色合并后应 ≤4 张候选卡，实为 ${r.candidates.length}`);
  // 权重和归一。
  const sum = r.candidates.reduce((s, c) => s + c.weight, 0);
  assert.ok(Math.abs(sum - 1) < 0.01, `权重和 ${sum.toFixed(3)} 应 ≈1`);
});
