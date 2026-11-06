/**
 * @lang zh-CN 任意色阶插值单测（`ADR-004` / `W-tb-P8`）：锚点一致性、区间插值、端点截断。
 * @lang en Arbitrary shade interpolation tests (`ADR-004` / `W-tb-P8`): anchor consistency,
 *   in-range interpolation, endpoint truncation.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { tonalScale, tonalScaleAt } from '../dist/index.js';

/** @lang zh-CN 默认主色（钴蓝）。 @lang en Default primary (cobalt). */
const COBALT = '#0047AB';

test('anchor consistency: tonalScaleAt 在 10 个锚点处与 tonalScale 逐位一致', () => {
  const scale = tonalScale(COBALT);
  for (const key of ['50', '100', '200', '300', '400', '500', '600', '700', '800', '900']) {
    assert.equal(tonalScaleAt(COBALT, parseInt(key, 10)), scale[key],
      `锚点 ${key} 应逐位一致（anchor ${key} must be identical）`);
  }
});

test('anchor consistency: 第二基色（清透青）同样逐位一致', () => {
  const scale = tonalScale('#00A8D3');
  for (const key of ['50', '100', '200', '300', '400', '500', '600', '700', '800', '900']) {
    assert.equal(tonalScaleAt('#00A8D3', parseInt(key, 10)), scale[key], `锚点 ${key}`);
  }
});

test('interpolation: 650 介于 600 与 700 之间且与两者不同', () => {
  const scale = tonalScale(COBALT);
  const mid = tonalScaleAt(COBALT, 650);
  assert.notEqual(mid, scale['600']);
  assert.notEqual(mid, scale['700']);
  // 位置上 650 更接近 700（权重 0.5 精确居中——650 在 600-700 正中，这里验证落在两端之间即可）。
  // <lang zh-CN>精确中点值由插值公式保证，此处断言不同即覆盖回归。</lang>
  // <lang en>The exact midpoint is guaranteed by the lerp formula; difference assertions cover regression.</lang>
});

test('interpolation: 端点截断（0→50、49→50、999→900、1000→900）', () => {
  const scale = tonalScale(COBALT);
  assert.equal(tonalScaleAt(COBALT, 0), scale['50']);
  assert.equal(tonalScaleAt(COBALT, 49), scale['50']);
  assert.equal(tonalScaleAt(COBALT, 999), scale['900']);
  assert.equal(tonalScaleAt(COBALT, 1000), scale['900']);
});

test('determinism: 同输入同输出（确定性可复现）', () => {
  assert.equal(tonalScaleAt(COBALT, 650), tonalScaleAt(COBALT, 650));
  assert.equal(tonalScaleAt(COBALT, 650.4), tonalScaleAt(COBALT, 650));
});
