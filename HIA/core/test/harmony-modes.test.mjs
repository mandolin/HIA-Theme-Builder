/**
 * @lang zh-CN 配色关系模式与辅助色单测（ADR-007 / `W-tb-P11`）：10 模式槽位数与生成角度、
 *   修饰语调整、组合型主位选择、契约向后兼容（缺字段补默认）、buildTheme 自动推导语义。
 * @lang en Harmony-mode and auxiliary tests (ADR-007 / `W-tb-P11`): slot counts and angles, modifier
 *   adjustments, combo primary-slot selection, contract backward compatibility, buildTheme derive semantics.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildTheme, createThemeDraft, buildThemeFromDraft,
  generateAuxiliarySet, getHarmonyModeDef, HARMONY_MODE_DEFS, hexToOklch
} from '../dist/index.js';

/** @lang zh-CN 主色相锚点（钴蓝 OKLCH hue ≈ 264°）。 @lang en Primary anchor (cobalt, OKLCH hue ≈ 264°). */
const PRIMARY = '#0047AB';

test('模式表: 11 项定义（auto + 10 设计）且槽位数与理论一致（defs sanity）', () => {
  assert.equal(HARMONY_MODE_DEFS.length, 11);
  const slotOf = id => getHarmonyModeDef(id).slots;
  assert.equal(slotOf('auto'), 0);
  assert.equal(slotOf('achromatic'), 0);
  assert.equal(slotOf('monochromatic'), 0);
  assert.equal(slotOf('clash'), 1);
  assert.equal(slotOf('complement'), 1);
  assert.equal(slotOf('neutral'), 1);
  assert.equal(slotOf('analogous'), 2);
  assert.equal(slotOf('primary-combo'), 2);
  assert.equal(slotOf('secondary-combo'), 2);
  assert.equal(slotOf('tertiary'), 2);
  assert.equal(slotOf('split-complement'), 2);
});

test('生成: 互补模式单槽角度 = 主相 +180°（hue delta check）', () => {
  const aux = generateAuxiliarySet(PRIMARY, 'complement');
  assert.equal(aux.length, 1);
  // 角差验证：辅助色 OKLCH hue 与主相之差（环形）应 ≈180°
  const dPrimary = hexToOklch(PRIMARY).h;
  const dAux = hexToOklch(aux[0].hex).h;
  const delta = ((dAux - dPrimary) % 360 + 360) % 360;
  assert.ok(Math.abs(delta - 180) < 8, `互补角差实测 ${delta}`);
});

test('生成: 类比模式双槽 = 主相 ∓30°（analogous ±30°）', () => {
  const aux = generateAuxiliarySet(PRIMARY, 'analogous');
  assert.equal(aux.length, 2);
  const dP = hexToOklch(PRIMARY).h;
  const d1 = hexToOklch(aux[0].hex).h, d2 = hexToOklch(aux[1].hex).h;
  const near = (a, b) => Math.abs(((a - b) % 360 + 360) % 360 - 30) < 8 || Math.abs(((a - b) % 360 + 360) % 360 - 330) < 8;
  assert.ok(near(d1, dP), `槽 1 角差 ≈30°（实测 ${Math.abs((d1 - dP) % 360)}）`);
  assert.ok(near(d2, dP), `槽 2 角差 ≈30°（实测 ${Math.abs((d2 - dP) % 360)}）`);
});

test('生成: 三元模式 120°/240° 等距（tertiary equidistant）', () => {
  const aux = generateAuxiliarySet(PRIMARY, 'tertiary');
  assert.equal(aux.length, 2);
  const dP = hexToOklch(PRIMARY).h;
  const d1 = ((hexToOklch(aux[0].hex).h - dP) % 360 + 360) % 360;
  const d2 = ((hexToOklch(aux[1].hex).h - dP) % 360 + 360) % 360;
  assert.ok(Math.abs(d1 - 120) < 8, `槽 1 ≈120°（实测 ${d1}）`);
  assert.ok(Math.abs(d2 - 240) < 8, `槽 2 ≈240°（实测 ${d2}）`);
});

test('生成: 组合型主位选择——主色相最近的组合色不被重复（combo nearest-primary）', () => {
  // 主色钴蓝（hue≈264°）接近原色组合的"蓝位"（250°）→ 辅助 = 红 + 黄 两色
  const aux = generateAuxiliarySet(PRIMARY, 'primary-combo');
  assert.equal(aux.length, 2);
  // 辅助色相应分别接近红（25°）与黄（100°），而非蓝（250°）
  const hues = aux.map(a => hexToOklch(a.hex).h);
  const dist = (a, b) => { const d = Math.abs(a - b) % 360; return Math.min(d, 360 - d); };
  assert.ok(dist(hues[0], 250) > 30, '辅助不得为主位蓝（主色保留）');
  assert.ok(dist(hues[1], 250) > 30, '辅助不得为主位蓝（主色保留）');
});

test('生成: 修饰语调整——pale 提亮 / deep 压暗 / grayish 降彩（modifier adjustments）', () => {
  const base = generateAuxiliarySet(PRIMARY, 'complement', ['strong'])[0];
  const pale = generateAuxiliarySet(PRIMARY, 'complement', ['pale'])[0];
  const deep = generateAuxiliarySet(PRIMARY, 'complement', ['deep'])[0];
  const grayish = generateAuxiliarySet(PRIMARY, 'complement', ['grayish'])[0];
  const L = h => hexToOklch(h).L, C = h => hexToOklch(h).C;
  assert.ok(L(pale.hex) > L(base.hex), 'pale 更亮');
  assert.ok(L(deep.hex) < L(base.hex), 'deep 更暗');
  assert.ok(C(grayish.hex) < C(base.hex), 'grayish 降彩');
  // name 含修饰语
  assert.ok(pale.name.includes('Pale'), 'name 携带修饰语');
});

test('生成: 零槽模式与未知模式回退（zero-slot + defensive fallback）', () => {
  assert.deepEqual(generateAuxiliarySet(PRIMARY, 'achromatic'), []);
  assert.deepEqual(generateAuxiliarySet(PRIMARY, 'monochromatic'), []);
  assert.deepEqual(generateAuxiliarySet(PRIMARY, 'auto'), []);
  // 未知 id → 回退 auto（0 槽）
  assert.deepEqual(generateAuxiliarySet(PRIMARY, 'nope'), []);
  assert.equal(getHarmonyModeDef('nope').id, 'auto');
});

test('契约: buildTheme 缺字段补默认（auto + 空槽）与显式推导（backward compatible）', () => {
  // 旧形态输入（无 harmonyMode/auxiliary）→ auto + []
  const legacy = buildTheme({ name: 'legacy', category: 'demo', primary: '#0047AB', secondary: '#00A8D3' });
  assert.equal(legacy.harmonyMode, 'auto');
  assert.deepEqual(legacy.auxiliary, []);
  // 模式非 auto 且 auxiliary 缺省 → 自动推导
  const derived = buildTheme({ name: 'derived', category: 'demo', primary: '#0047AB', secondary: '#00A8D3', harmonyMode: 'complement' });
  assert.equal(derived.harmonyMode, 'complement');
  assert.equal(derived.auxiliary.length, 1);
  assert.ok(derived.auxiliary[0].scale['500'], '辅助槽位含完整色阶');
  // 显式 [] → 保留空（用户清空语义）
  const emptied = buildTheme({ name: 'e', category: 'demo', primary: '#0047AB', secondary: '#00A8D3', harmonyMode: 'complement', auxiliary: [] });
  assert.deepEqual(emptied.auxiliary, []);
  // 未知模式 → 回退 auto
  assert.equal(buildTheme({ name: 'x', category: 'demo', primary: '#0047AB', secondary: '#00A8D3', harmonyMode: 'nope' }).harmonyMode, 'auto');
});

test('草稿: createThemeDraft/buildThemeFromDraft 透传配色扩展（draft passthrough）', () => {
  const draft = createThemeDraft({ harmonyMode: 'tertiary' });
  assert.equal(draft.harmonyMode, 'tertiary');
  // auxiliary 缺省不写键（undefined）→ buildThemeFromDraft 按模式自动推导（"切模式即出辅助色"主场景）
  assert.equal(draft.auxiliary, undefined);
  assert.equal(draft.auxiliaryModifiers, undefined);
  const theme = buildThemeFromDraft(draft);
  assert.equal(theme.harmonyMode, 'tertiary');
  assert.equal(theme.auxiliary.length, 2, '非 auto 且槽位未显式给值 → 自动推导');
  // 显式 [] 经草稿保留（用户清空语义）
  const cleared = buildThemeFromDraft(createThemeDraft({ harmonyMode: 'tertiary', auxiliary: [] }));
  assert.deepEqual(cleared.auxiliary, []);
});
