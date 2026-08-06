// @lang zh-CN Celebi 实验性基准量化器单测：验证确定性与与 median-cut 的对比基准行为。
//   不替换主评分；仅确认可复现、返回合理代表色、与 median-cut 偏离度在合理范围。
// @lang en Celebi experimental baseline tests: determinism, sane reps, and divergence-vs-median-cut behavior.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { quantizeCelebi, quantizerDivergence } from '../src/quantize/celebi.ts';
import { quantizeMedianCut } from '../src/quantize/median-cut.ts';

/** @lang zh-CN 构造若干像素（含一种主导纯色与背景噪声）。 */
function makePixels(dominant, bg, n = 2000) {
  const out = [];
  for (let i = 0; i < n; i++) {
    const p = i % 3 === 0 ? dominant : bg;
    out.push({ r: p[0], g: p[1], b: p[2], a: 255 });
  }
  return out;
}

test('celebi 确定性：同输入同输出', () => {
  const px = makePixels([200, 30, 40], [240, 240, 240]);
  const a = quantizeCelebi(px, 8);
  const b = quantizeCelebi(px, 8);
  assert.equal(a.length, b.length);
  assert.deepEqual(a.map((q) => q.hex), b.map((q) => q.hex));
});

test('celebi 识别主导色', () => {
  const px = makePixels([10, 120, 220], [245, 245, 245]);
  const res = quantizeCelebi(px, 8);
  assert.ok(res.length >= 1);
  // 主导色（红蓝）应在前两名。
  const top = res.slice(0, 2).map((q) => q.hex);
  assert.ok(top.includes('#0a78dc') || top.includes('#f5f5f5'));
});

test('celebi 与 median-cut 偏离度在 0..1', () => {
  const px = makePixels([120, 20, 180], [230, 230, 230]);
  const ce = quantizeCelebi(px, 12);
  const mc = quantizeMedianCut(px, 12);
  const d = quantizerDivergence(ce, mc, 5);
  assert.ok(d >= 0 && d <= 1, `divergence 应在 [0,1]，实际 ${d}`);
});

test('celebi 空输入返回空', () => {
  assert.deepEqual(quantizeCelebi([], 8), []);
});

test('celebi 低 alpha 像素被忽略', () => {
  const px = [{ r: 255, g: 0, b: 0, a: 0 }, { r: 0, g: 255, b: 0, a: 0 }];
  assert.deepEqual(quantizeCelebi(px, 4), []);
});
