/**
 * @lang zh-CN 渐变数值化单测（`ADR-004` / `W-tb-P8`）：占比停靠点生成、swap、旧值兼容、自定义色阶解析。
 * @lang en Gradient numeric tests (`ADR-004` / `W-tb-P8`): bias stops, swap, legacy compatibility,
 *   custom shade resolution.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  gradientStops, gradientCss, swapGradientBias, gradientDominantColor,
  createRuntimeCssVariables, collectCustomShades, buildTheme, exportThemeCss, exportThemeJson,
  cloneGradientSettings
} from '../dist/index.js';

/** @lang zh-CN 默认主题（钴蓝/清透青，含默认渐变配置）。 @lang en Default theme (cobalt/cyan, default gradients). */
const THEME = buildTheme({
  name: 'T', category: 'default',
  primary: '#0047AB', secondary: '#00A8D3',
  primaryName: '钴蓝', secondaryName: '清透青'
});

test('bias 数值化: front80 生成 80% 停靠点（numeric bias stops）', () => {
  assert.equal(gradientStops('#A', '#B', 'front80'), '#A 0%, #A 80%, #B 100%');
  assert.equal(gradientStops('#A', '#B', 'end30'), '#A 0%, #B 70%, #B 100%');
});

test('bias 旧值兼容: 4 枚举停靠点与历史实现逐字一致（legacy stops unchanged）', () => {
  assert.equal(gradientStops('#A', '#B', 'front75'), '#A 0%, #A 75%, #B 100%');
  assert.equal(gradientStops('#A', '#B', 'front65'), '#A 0%, #A 65%, #B 100%');
  assert.equal(gradientStops('#A', '#B', 'end65'), '#A 0%, #B 35%, #B 100%');
  assert.equal(gradientStops('#A', '#B', 'end75'), '#A 0%, #B 25%, #B 100%');
});

test('bias 越界钳制与非法回退（clamped & invalid fallback）', () => {
  // front150 → clamp 到 100（前色全占）
  assert.equal(gradientStops('#A', '#B', 'front150'), '#A 0%, #A 100%, #B 100%');
  // 非法格式 → 防御性简单线性
  assert.equal(gradientStops('#A', '#B', 'balanced'), '#A 0%, #B 100%');
});

test('swap: 前缀翻转保留百分比（prefix flip keeps N）', () => {
  assert.equal(swapGradientBias('front80'), 'end80');
  assert.equal(swapGradientBias('end30'), 'front30');
  assert.equal(swapGradientBias('front75'), 'end75');
});

test('解析校验: end 前缀数值 bias 全长合法（end-prefix bias accepted — slice regression）', () => {
  // 回归：end40/end60 曾因 slice(5) 误切被拒（ 修复验证）。
  const parsed = cloneGradientSettings({
    carousel: { enabled: true, family: 'primary', start: '650', end: '300', direction: '135deg', bias: 'end40' },
    banner: { enabled: true, family: 'primary', start: '700', end: '300', direction: '120deg', bias: 'end0' }
  });
  assert.equal(parsed.carousel.bias, 'end40');
  assert.equal(parsed.banner.bias, 'end0');
  // 边界：0 与 100 合法；101/负形态非法回退
  const edge = cloneGradientSettings({
    carousel: { enabled: true, family: 'primary', start: '700', end: '300', direction: '135deg', bias: 'end100' },
    banner: { enabled: true, family: 'primary', start: '700', end: '300', direction: '120deg', bias: 'front101' }
  });
  assert.equal(edge.carousel.bias, 'end100');
  assert.equal(edge.banner.bias, 'front65');
});
test('解析校验: 非法 bias/shade 回退角色默认（invalid falls back to defaults）', () => {
  const parsed = cloneGradientSettings({
    carousel: { enabled: true, family: 'primary', start: '650', end: '999999', direction: '135deg', bias: 'front55' },
    banner: { enabled: true, family: 'primary', start: '700', end: '300', direction: '120deg', bias: 'frontabc' }
  });
  // carousel: bias front55 合法保留；end 999999 非法（>1000）回退默认 '300'
  assert.equal(parsed.carousel.bias, 'front55');
  assert.equal(parsed.carousel.start, '650');
  assert.equal(parsed.carousel.end, '300');
  // banner: bias 非法回退默认 'front65'
  assert.equal(parsed.banner.bias, 'front65');
});

test('自定义色阶: runtime 变量 / dominant / collect 三处一致（custom shade consistency）', () => {
  const theme = buildTheme({
    name: 'T', category: 'default',
    primary: '#0047AB', secondary: '#00A8D3',
    primaryName: '钴蓝', secondaryName: '清透青',
    gradients: {
      carousel: { enabled: true, family: 'primary', start: '650', end: '300', direction: '135deg', bias: 'front80' }
    }
  });
  const vars = createRuntimeCssVariables(theme);
  // runtime 变量包含 --p650，且与 collectCustomShades 一致
  assert.ok(vars['--p650'], '--p650 应存在');
  const custom = collectCustomShades(theme);
  assert.equal(vars['--p650'], custom.primary['650']);
  // 与 600/700 均不同（真实插值）
  assert.notEqual(vars['--p650'], theme.primary.scale['600']);
  assert.notEqual(vars['--p650'], theme.primary.scale['700']);
  // dominant 走 650（front 占比主导取起始色阶）
  assert.ok(gradientDominantColor(theme.gradients.carousel, theme).length > 0);
});

test('导出: CSS 含 --hia-primary-650；JSON scale 并入自定义键（exports include custom shades）', () => {
  const theme = buildTheme({
    name: 'T', category: 'default',
    primary: '#0047AB', secondary: '#00A8D3',
    primaryName: '钴蓝', secondaryName: '清透青',
    gradients: {
      carousel: { enabled: true, family: 'primary', start: '650', end: '300', direction: '135deg', bias: 'front80' }
    }
  });
  const css = exportThemeCss(theme);
  assert.ok(css.includes('--hia-primary-650:'), 'CSS 应含自定义色阶变量');
  assert.ok(css.includes('--hia-gradient-carousel: linear-gradient(135deg'), '渐变导出正常');
  const json = JSON.parse(exportThemeJson(theme));
  assert.ok(json.primary.scale['650'], 'JSON scale 应并入自定义键');
  assert.equal(json.gradients.carousel.bias, 'front80');
});

test('gradientCss runtime: 自定义色阶经 var() 引用（runtime keeps var() form）', () => {
  const theme = buildTheme({
    name: 'T', category: 'default',
    primary: '#0047AB', secondary: '#00A8D3',
    primaryName: '钴蓝', secondaryName: '清透青',
    gradients: {
      carousel: { enabled: true, family: 'primary', start: '650', end: '300', direction: '135deg', bias: 'front80' }
    }
  });
  assert.equal(
    gradientCss(theme.gradients.carousel, 'runtime', theme),
    'linear-gradient(135deg, var(--p650) 0%, var(--p650) 80%, var(--p300) 100%)'
  );
});
