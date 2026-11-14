/**
 * @lang zh-CN DTCG 互操作单测（`W-tb-P38` / ADR-013）：①2025.10 导出形状逐条对照官方 schema
 *   （color 必填 colorSpace+components、dimension {value,unit}、gradient stops 0–1、shadow 数组、
 *   fontFamily 数组）；②往返一致；③第三方形态导入（Tokens Studio 风格 hex 字符串 + $ref）；
 *   ④错误码与警告（不静默丢弃）。
 * @lang en DTCG interop tests (`W-tb-P38` / ADR-013): (1) export shapes checked clause-by-clause against the
 *   official 2025.10 schemas (color requires colorSpace+components; dimension {value,unit}; gradient stops 0–1;
 *   shadow arrays; fontFamily arrays); (2) round-trip equality; (3) third-party import shapes (Tokens
 *   Studio-style hex strings + $ref); (4) error codes and warnings (nothing silently dropped).
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildTheme, deriveSemanticTokens, exportDtcgTokens, parseDtcgTokens,
  radiusSequence, shadowCss, getExportTarget, listExportTargets, nameColor
} from '../dist/index.js';

const PRIMARY = '#0047AB', SECONDARY = '#00A8D3';

test('导出：根结构含 $description/$extensions 与六大组；生成器信息在 $extensions', () => {
  const d = JSON.parse(exportDtcgTokens(buildTheme({ name: 'HIA 默认', primary: PRIMARY, secondary: SECONDARY })));
  for (const key of ['$description', '$extensions', 'color', 'radius', 'shadow', 'typography', 'spacing', 'gradients']) {
    assert.ok(key in d, `缺根级 ${key}`);
  }
  assert.equal(d.$extensions['com.hia-theme-builder'].generator, 'HIA Theme Builder');
  assert.equal(d.$extensions['com.hia-theme-builder'].themeName, 'HIA 默认');
});

test('导出：color token 符合 2025.10（colorSpace+components 必填，hex 兜底，components 归一化 0–1）', () => {
  const d = JSON.parse(exportDtcgTokens(buildTheme({ name: 'HIA 默认', primary: PRIMARY, secondary: SECONDARY })));
  const token = d.color.primary.base;
  assert.equal(token.$type, 'color');
  assert.equal(token.$value.colorSpace, 'srgb');
  assert.ok(Array.isArray(token.$value.components) && token.$value.components.length === 3);
  for (const c of token.$value.components) assert.ok(c >= 0 && c <= 1, 'components 应归一化 0–1');
  assert.equal(token.$value.hex, PRIMARY);
  // 归一化值与 hex 一致（无损兜底）。
  // <lang en>Normalised components agree with the hex fallback (lossless).</lang>
  const [r, g, b] = token.$value.components;
  assert.ok(Math.abs(r - 0x00 / 255) < 0.005 && Math.abs(g - 0x47 / 255) < 0.005 && Math.abs(b - 0xAB / 255) < 0.005);
});

test('导出：主副/第三/辅助/语义组齐全且条件式（不带语义的旧主题无 semantic 组）', () => {
  const legacy = JSON.parse(exportDtcgTokens(buildTheme({ name: 'HIA 默认', primary: PRIMARY, secondary: SECONDARY })));
  assert.ok(legacy.color.primary.base && legacy.color.secondary.base && legacy.color.primary['500']);
  assert.ok(!('semantic' in legacy.color), '旧主题不得出现 semantic 组');
  assert.ok(!('third' in legacy.color), '双色模式无 third 组');
  const full = JSON.parse(exportDtcgTokens(buildTheme({
    primary: PRIMARY, secondary: SECONDARY, semantic: deriveSemanticTokens(PRIMARY),
    seriesMode: 'triad', thirdColor: { name: '三', value: '#F97316', scale: {}, on: '#fff' },
    auxiliary: [{ name: '辅', value: '#6B7280', scale: {}, on: '#fff' }]
  })));
  assert.ok(full.color.third.base, '三色模式有 third 组');
  assert.equal(full.color.semantic.success.base.$value.hex, deriveSemanticTokens(PRIMARY).success.value);
  assert.equal(full.color.aux0.base.$type, 'color', '默认辅助槽进入 aux0 组');
});

test('导出：dimension/shadow/fontFamily 形状符合 2025.10', () => {
  const t = buildTheme({
    primary: PRIMARY, secondary: SECONDARY, radius: { base: 12 },
    shadow: { strength: 'medium', tintFromPrimary: true }
  });
  const d = JSON.parse(exportDtcgTokens(t));
  // dimension：{value, unit:'px'}
  assert.deepEqual(d.radius.md.$value, { value: 12, unit: 'px' });
  assert.equal(d.radius.md.$type, 'dimension');
  // shadow：数组，元素含 color/offsetX/offsetY/blur/spread/inset（必填五项）。
  assert.equal(d.shadow.md.$type, 'shadow');
  for (const layer of d.shadow.md.$value) {
    for (const key of ['color', 'offsetX', 'offsetY', 'blur', 'spread']) assert.ok(key in layer, `shadow 层缺 ${key}`);
    assert.equal(layer.offsetX.unit, 'px');
    assert.equal(layer.inset, false);
  }
  // 我们的双层阴影必须逐层展开（两层都在数组里）。
  assert.equal(d.shadow.md.$value.length, 2);
  // fontFamily：字符串数组。
  assert.ok(Array.isArray(d.typography.fontFamily.body.$value));
  assert.ok(d.typography.fontFamily.body.$value.every(s => typeof s === 'string' && s.length > 0));
});

test('导出：gradient stops（0–1）+ 方向进 $extensions', () => {
  const d = JSON.parse(exportDtcgTokens(buildTheme({ primary: PRIMARY, secondary: SECONDARY, gradients: { carousel: { enabled: true, family: 'primary', start: '700', end: '300', direction: '135deg', bias: 'front75' } } })));
  const g = d.gradients.carousel;
  assert.equal(g.$type, 'gradient');
  assert.equal(g.$value.length, 3);
  const positions = g.$value.map(s => s.position);
  assert.deepEqual(positions, [0, 0.75, 1]);
  for (const stop of g.$value) assert.equal(stop.color.colorSpace, 'srgb');
  assert.equal(g.$extensions['com.hia-theme-builder'].direction, '135deg');
  // 禁用的渐变不输出。
  const d2 = JSON.parse(exportDtcgTokens(buildTheme({ primary: PRIMARY, secondary: SECONDARY, gradients: { carousel: { enabled: false, family: 'primary', start: '700', end: '300', direction: '135deg', bias: 'front75' } } })));
  assert.ok(!('carousel' in d2.gradients), '禁用渐变不得输出');
});

test('导出目标：dtcg 注册且产物为单文件 .tokens.json', () => {
  const ids = listExportTargets().map(t => t.id);
  assert.ok(ids.includes('dtcg'), 'dtcg 目标应注册');
  const t = buildTheme({ primary: PRIMARY, secondary: SECONDARY });
  const files = getExportTarget('dtcg').files(t);
  assert.equal(files.length, 1);
  assert.ok(files[0].path.endsWith('.tokens.json'));
  assert.ok(files[0].content.includes('"colorSpace"'));
});

// ===== 导入 =====
test('导入：自有导出往返一致（主/副/语义/圆角）', () => {
  const sem = deriveSemanticTokens(PRIMARY);
  const t = buildTheme({ primary: PRIMARY, secondary: SECONDARY, semantic: sem, radius: { base: 14 } });
  const back = parseDtcgTokens(exportDtcgTokens(t));
  assert.ok(back.ok, JSON.stringify(back.errors));
  assert.equal(back.draft.primary, PRIMARY);
  assert.equal(back.draft.secondary, SECONDARY);
  assert.equal(back.draft.radius.base, 14);
  assert.equal(back.draft.semantic.success.value, sem.success.value);
  assert.equal(back.draft.semantic.warning.value, sem.warning.value);
  // 语义组重建了完整色阶与 on 色（导出物完整）。
  assert.equal(Object.keys(back.draft.semantic.success.scale).length, 10);
  assert.ok(back.draft.semantic.success.on);
});

test('导入：semanticDerived 全 false（导入值不随主色刷新，ADR-012 决策 3 的导入侧）', () => {
  const back = parseDtcgTokens(exportDtcgTokens(buildTheme({ primary: PRIMARY, secondary: SECONDARY, semantic: deriveSemanticTokens(PRIMARY) })));
  assert.deepEqual(back.draft.semanticDerived, { success: false, info: false, warning: false, danger: false });
});

test('导入：Tokens Studio 风格（hex 字符串 + $ref）', () => {
  const file = {
    $description: 'Third-party theme',
    color: {
      primary: { base: { $value: '#123ABC' }, '500': { $ref: '#/color/primary/base' }, on: { $value: '#FFFFFF' } },
      secondary: { base: { $value: 'rgb(0, 168, 211)' } }
    },
    radius: { md: { $type: 'dimension', $value: { value: 10, unit: 'px' } } }
  };
  const back = parseDtcgTokens(file);
  assert.ok(back.ok, JSON.stringify(back.errors));
  assert.equal(back.draft.primary, '#123ABC');
  assert.equal(back.draft.secondary, '#00A8D3', 'rgb() 文本色也应解析');
  assert.equal(back.draft.radius.base, 10);
  // 未识别的根级组逐条警告（不静默）。
  const withExtra = parseDtcgTokens({ ...file, shadow: { md: { $value: [] } }, typography: { fontFamily: {} } });
  assert.ok(withExtra.warnings.some(w => w.code === 'W_DTCG_SKIPPED' && w.path === 'shadow'));
  assert.ok(withExtra.warnings.some(w => w.code === 'W_DTCG_SKIPPED' && w.path === 'typography'));
});

test('导入：纯 hex 字符串 token（最简形态）', () => {
  const back = parseDtcgTokens({ color: { primary: { base: '#0047AB' }, secondary: { base: '#00A8D3' } } });
  assert.ok(back.ok);
  assert.equal(back.draft.primary, '#0047AB');
  assert.equal(back.draft.semantic, undefined, '无语义组则不派生');
});

test('导入：错误码——顶层非对象 / token 缺 $value / 颜色不可解析 / JSON 语法错', () => {
  assert.equal(parseDtcgTokens([]).errors[0].code, 'E_DTCG_ROOT');
  assert.equal(parseDtcgTokens(null).errors[0].code, 'E_DTCG_ROOT');
  const badToken = parseDtcgTokens({ color: { primary: { base: { $type: 'color' } }, secondary: { base: '#00A8D3' } } });
  assert.ok(badToken.errors.some(e => e.code === 'E_DTCG_TOKEN'));
  const badColor = parseDtcgTokens({ color: { primary: { base: { colorSpace: 'oklch', components: [0.2, 0.4, 0.6] } }, secondary: { base: '#00A8D3' } } });
  assert.ok(badColor.warnings.some(w => w.code === 'W_DTCG_SKIPPED'), 'oklch 无 hex 记警告');
  assert.equal(badColor.ok, false, '主色缺失仍失败');
  assert.equal(parseDtcgTokens('{"color":').errors[0].code, 'E_JSON');
  assert.equal(parseDtcgTokens({ color: { primary: {} }, secondary: {} }).errors.some(e => e.code === 'E_DTCG_COLOR'), true, '缺主/副色 → E_DTCG_COLOR');
});

test('导入：nameColor 提供中英名（草稿名与色名非空）', () => {
  const back = parseDtcgTokens({ color: { primary: { base: '#0047AB' }, secondary: { base: '#00A8D3' } } });
  assert.equal(back.draft.primaryName, nameColor('#0047AB').zh);
  assert.ok(back.draft.name.length > 0);
  void radiusSequence; void shadowCss; void getExportTarget; // 顶部导入统一消费
});
