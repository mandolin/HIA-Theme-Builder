/**
 * @lang zh-CN 字体/间距令牌单测（`ADR-006` / `W-tb-P9`）：默认值、模数字号、间距序列、CSS 变量、旧数据兼容。
 * @lang en Typography/spacing token tests (`ADR-006` / `W-tb-P9`): defaults, modular scale, spacing
 *   sequence, CSS vars, legacy-data compatibility.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  fontSizeAt, spacingSequence, typographySpacingVars, buildTheme, createRuntimeCssVariables,
  exportThemeJson, DEFAULT_TYPOGRAPHY, DEFAULT_SPACING
} from '../dist/index.js';

/** @lang zh-CN 默认主题。 @lang en Default theme. */
const THEME = buildTheme({ name: 'T', category: 'default', primary: '#0047AB', secondary: '#00A8D3' });

test('默认令牌: 字体族系统栈、字号基数 16、间距 8pt 网格（defaults）', () => {
  assert.equal(THEME.typography.fontSizeScale.base, 16);
  assert.equal(THEME.typography.fontSizeScale.ratio, 1.25);
  assert.equal(THEME.spacing.base, 8);
  assert.equal(THEME.spacing.step, 'x2');
});

test('字号: body=基数、display 最大、small 最小、单调有序（font size steps）', () => {
  const body = fontSizeAt(THEME.typography, 'body');
  assert.equal(body, 16);
  const display = fontSizeAt(THEME.typography, 'display');
  const h1 = fontSizeAt(THEME.typography, 'h1');
  const small = fontSizeAt(THEME.typography, 'small');
  assert.ok(display > h1, 'display > h1');
  assert.ok(h1 > body, 'h1 > body');
  assert.ok(body > small, 'body > small');
});

test('字号: 单档覆写生效（override per step）', () => {
  const t = { ...DEFAULT_TYPOGRAPHY, fontSizeScale: { base: 16, ratio: 1.25, overrides: { h1: 18 } } };
  assert.equal(fontSizeAt(t, 'h1'), 18);
});

test('间距: x2 倍增序列 8/16/32/64/128/256（doubling sequence）', () => {
  assert.deepEqual(spacingSequence(DEFAULT_SPACING), [8, 16, 32, 64, 128, 256]);
});

test('间距: 线性 +4 与级数截断（linear + levels clamp）', () => {
  const t = { base: 4, step: 'linear4', levels: 3 };
  assert.deepEqual(spacingSequence(t), [4, 8, 12]);
  // 级数钳制 1..12
  assert.equal(spacingSequence({ ...t, levels: 99 }).length, 12);
});

test('CSS 变量: --hia-font-* / --hia-fs-* / --hia-space-* 齐备（vars present）', () => {
  const vars = createRuntimeCssVariables(THEME);
  assert.ok(vars['--hia-font-body'], '--hia-font-body');
  assert.ok(vars['--hia-font-mono'], '--hia-font-mono');
  assert.ok(vars['--hia-fs-body'] === '16px', '--hia-fs-body');
  assert.ok(vars['--hia-space-0'] === '8px', '--hia-space-0');
  assert.ok(vars['--hia-space-1'] === '16px', '--hia-space-1');
});

test('序列化: 主题 JSON 含 typography/spacing；旧数据（缺字段）buildTheme 补默认（serialization + legacy compat）', () => {
  const json = JSON.parse(exportThemeJson(THEME));
  assert.ok(json.typography, 'JSON 应含 typography');
  assert.ok(json.spacing, 'JSON 应含 spacing');
  // 旧形态输入（无令牌组）→ buildTheme 补默认
  const legacy = buildTheme({ name: 'legacy', category: 'default', primary: '#0047AB', secondary: '#00A8D3' });
  assert.deepEqual(legacy.typography, DEFAULT_TYPOGRAPHY);
  assert.deepEqual(legacy.spacing, DEFAULT_SPACING);
});
