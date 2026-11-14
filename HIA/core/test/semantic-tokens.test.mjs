/**
 * @lang zh-CN 语义状态色与令牌补全单测（`W-tb-P37` / ADR-012 / ADR-006 契约位落地）：
 *   ①派生四组状态色的语义色相与主色特征继承；②覆盖/序列化往返；③圆角/阴影档位；
 *   ④Tailwind v4 `@theme` 与 v3 导出消费；⑤导出降级链（渐变垫底层 + 注入双声明）。
 * @lang en Semantic status & token tests (`W-tb-P37` / ADR-012 / ADR-006 slots): (1) derived semantic hues and
 *   primary-inherited character; (2) overrides and serialization round-trip; (3) radius/shadow steps;
 *   (4) Tailwind v4 `@theme` and v3 export consumption; (5) export degradation chain.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildTheme, deriveSemanticTokens, cloneSemanticTokens, isSemanticDerived, contrast,
  radiusSequence, shadowCss, RADIUS_DEFAULTS,
  exportThemeCss, exportThemeJson, createRuntimeCssVariables,
  listExportTargets, getExportTarget, presetFromDraft, draftFromPreset, hexToOklch
} from '../dist/index.js';

const PRIMARY = '#0047AB';
const STATUS_KEYS = ['success', 'info', 'warning', 'danger'];

// ===== 1. 派生 =====
test('派生：四组齐全，色相落在语义锚点附近（±12°，色域收敛允许偏移）', () => {
  const HUES = { success: 145, info: 250, warning: 70, danger: 25 };
  const sem = deriveSemanticTokens(PRIMARY);
  for (const key of STATUS_KEYS) {
    const lch = hexToOklch(sem[key].value);
    let dh = Math.abs(lch.h - HUES[key]); if (dh > 180) dh = 360 - dh;
    assert.ok(dh <= 12, `${key} 色相 ${lch.h.toFixed(1)}° 偏离锚点 ${HUES[key]}° 达 ${dh.toFixed(1)}°`);
  }
});

test('派生：明度随主色收敛（暗主色 → 状态色不至于过暗；亮主色 → 不荧光）', () => {
  const pL = hexToOklch(PRIMARY).L;
  const sem = deriveSemanticTokens(PRIMARY);
  const sL = hexToOklch(sem.success.value).L;
  // 收敛公式 40%：派生 L 应落在主色 L 与 0.55 之间。
  // <lang en>40% convergence: derived L must sit between the primary L and 0.55.</lang>
  assert.ok(Math.abs(sL - (pL + (0.55 - pL) * 0.4)) < 0.02, `success L ${sL.toFixed(3)} 不符合收敛公式`);
  const bright = deriveSemanticTokens('#FFFAB3');
  const bL = hexToOklch(bright.info.value).L;
  assert.ok(bL < 0.75, `亮主色下状态色 L ${bL.toFixed(2)} 过亮（荧光风险）`);
});

test('派生：每组带 10 阶色阶与 on 色，且 on 可读（≥4.5:1）', () => {
  const sem = deriveSemanticTokens(PRIMARY);
  for (const key of STATUS_KEYS) {
    const role = sem[key];
    assert.equal(Object.keys(role.scale).length, 10, `${key} 色阶应为 10 档`);
    assert.equal(role.scale['500'], role.value, '500 档应等于基色');
    assert.ok(contrast(role.value, role.on) >= 4.5, `${key} 的 on 色 contrast ${contrast(role.value, role.on).toFixed(2)} 不足`);
  }
});

test('派生：不同主色 → 不同状态色（特征继承生效）', () => {
  const a = deriveSemanticTokens('#0047AB');
  const b = deriveSemanticTokens('#B6292B');
  assert.notEqual(a.info.value, b.info.value, 'info 色应随主色明暗特征变化');
});

// ===== 2. 覆盖与往返 =====
test('cloneSemanticTokens：深拷贝隔离（改副本不影响原组）', () => {
  const sem = deriveSemanticTokens(PRIMARY);
  const copy = cloneSemanticTokens(sem);
  copy.success.value = '#FF0000';
  assert.notEqual(sem.success.value, '#FF0000');
});

test('buildTheme：semantic 可选——不传不派生（旧主题不变观）', () => {
  const t = buildTheme({ primary: PRIMARY, secondary: '#00A8D3' });
  assert.equal(t.semantic, undefined, '未显式提供时不得静默派生（ADR-012 决策 6）');
  const css = exportThemeCss(t);
  assert.ok(!css.includes('--hia-success'), 'CSS 不得出现语义变量段');
});

test('buildTheme：显式 semantic 深拷贝透传，导出携带', () => {
  const sem = deriveSemanticTokens(PRIMARY);
  const t = buildTheme({ primary: PRIMARY, secondary: '#00A8D3', semantic: sem });
  assert.ok(t.semantic);
  const css = exportThemeCss(t);
  assert.ok(css.includes('--hia-success:'), 'CSS 应携带语义组');
  assert.ok(css.includes('--hia-on-success:'), 'CSS 应携带语义 on 色');
  const json = JSON.parse(exportThemeJson(t));
  assert.ok(json.semantic.success.scale);
});

test('preset 往返：presetFromDraft → draftFromPreset 保留语义与派生标记', () => {
  const sem = deriveSemanticTokens(PRIMARY);
  const draft = {
    name: 'T', category: 'custom', industry: '', primary: PRIMARY, secondary: '#00A8D3',
    primaryName: '', secondaryName: '', note: '', semantic: sem, semanticDerived: { success: true }
  };
  const preset = presetFromDraft(draft, 'p1');
  const back = draftFromPreset(preset);
  assert.ok(back.semantic);
  assert.deepEqual(back.semanticDerived, { success: true });
  assert.equal(back.semantic.success.value, sem.success.value);
});

// ===== 3. 圆角/阴影 =====
test('radius：五档派生公式与覆写', () => {
  const seq = radiusSequence({ base: 10 });
  assert.deepEqual(seq, { sm: 5, md: 10, lg: 15, xl: 20, pill: 999 });
  const ov = radiusSequence({ base: 10, overrides: { 'radius-md': 4 } });
  assert.equal(ov.md, 4);
  assert.equal(ov.lg, 15, '未覆写档不受影响');
  // 缺省回退（ADR-006 兼容）。
  assert.equal(radiusSequence(null).md, RADIUS_DEFAULTS.base);
});

test('shadow：强度档位单调、none 全 none、覆写生效', () => {
  const soft = shadowCss({ strength: 'soft' }, PRIMARY);
  const strong = shadowCss({ strength: 'strong' }, PRIMARY);
  assert.ok(!soft.md.includes('none'));
  assert.ok(soft.md.length > 0 && strong.md.length > 0);
  assert.ok(shadowCss({ strength: 'none' }, PRIMARY).md === 'none');
  // 强度递增 → 模糊半径递增（提取 blur 数值比较）。
  const blur = (s) => parseFloat(s.split('px')[1] ?? '0');
  assert.ok(blur(strong.md) > blur(soft.md), 'strong 的模糊应大于 soft');
  const ov = shadowCss({ strength: 'soft', overrides: { 'shadow-md': '0 0 0 red' } }, PRIMARY);
  assert.equal(ov.md, '0 0 0 red');
});

test('shadow：tintFromPrimary 阴影色随主色变化', () => {
  const a = shadowCss({ strength: 'medium', tintFromPrimary: true }, '#0047AB');
  const b = shadowCss({ strength: 'medium', tintFromPrimary: true }, '#B6292B');
  assert.notEqual(a.md, b.md, '染色阴影应随主色变化');
  const neutral = shadowCss({ strength: 'medium' }, '#0047AB');
  assert.ok(neutral.md.includes('15 23 42'), '默认阴影应为中性深色');
});

// ===== 4. 导出消费 =====
test('Tailwind v3：语义色 + borderRadius + boxShadow 进入 config', () => {
  const sem = deriveSemanticTokens(PRIMARY);
  const t = buildTheme({ primary: PRIMARY, secondary: '#00A8D3', semantic: sem, radius: { base: 12 }, shadow: { strength: 'medium' } });
  const cfg = getExportTarget('tailwind-config').files(t)[0].content;
  assert.ok(cfg.includes('success: {'));
  assert.ok(cfg.includes('warning: {'));
  assert.ok(cfg.includes('borderRadius: {'));
  assert.ok(cfg.includes("'xl': '24px'"), 'lg=18/xl=24 应随 base=12 派生');
  assert.ok(cfg.includes('boxShadow: {'));
});

test('Tailwind v4：@theme 目标注册并输出 --color-*/--radius-*/--shadow-*', () => {
  const ids = listExportTargets().map(t => t.id);
  assert.ok(ids.includes('tailwind-v4'), 'v4 目标应注册');
  const sem = deriveSemanticTokens(PRIMARY);
  const t = buildTheme({ primary: PRIMARY, secondary: '#00A8D3', semantic: sem });
  const f = getExportTarget('tailwind-v4').files(t)[0];
  assert.equal(f.path, 'app.css');
  assert.ok(f.content.includes('@theme {'));
  assert.ok(f.content.includes('--color-success-500:'));
  assert.ok(f.content.includes('--radius-md: 8px;'));
  assert.ok(f.content.includes('--shadow-md:'));
  assert.ok(f.content.includes('--gradient-carousel: var(--hia-gradient-carousel)'), '渐变经 var 动态引用');
  // 未携带语义色的主题不输出 --color-success。
  const legacy = getExportTarget('tailwind-v4').files(buildTheme({ primary: PRIMARY, secondary: '#00A8D3' }))[0].content;
  assert.ok(!legacy.includes('--color-success'), '旧主题 v4 导出不得出现语义色');
});

test('运行时变量：semantic 条件式、radius/shadow 随主题', () => {
  const legacy = createRuntimeCssVariables(buildTheme({ primary: PRIMARY, secondary: '#00A8D3' }));
  assert.ok(!('--success' in legacy), '旧主题不得出现语义变量');
  assert.ok(legacy['--radius-md'] === '8px', 'radius 默认档应存在（ADR-006 补齐）');
  const t = buildTheme({ primary: PRIMARY, secondary: '#00A8D3', semantic: deriveSemanticTokens(PRIMARY), radius: { base: 16 } });
  const v = createRuntimeCssVariables(t);
  assert.ok(v['--success'] === t.semantic.success.value);
  assert.ok(v['--on-warning'] === t.semantic.warning.on);
  assert.ok(v['--radius-md'] === '16px');
});

// ===== 5. 导出降级链 =====
test('降级链：渐变变量携带起始色垫底层（多层背景）', () => {
  const css = exportThemeCss(buildTheme({ primary: PRIMARY, secondary: '#00A8D3' }));
  const line = css.split('\n').find(l => l.includes('--hia-gradient-carousel:')) ?? '';
  // 值形如 linear-gradient(...), var(--hia-primary-700)——末段为纯色垫底。
  // <lang en>Value ends with a solid underlay (var(--hia-primary-700)) after the gradient layer.</lang>
  assert.ok(/,\s*var\(--hia-primary-\d+\);?\s*$/.test(line), `渐变变量应带垫底层，实为 ${line.trim().slice(-60)}`);
});

test('降级链：underlay=false 关闭垫底（WordPress 渐变预设场景）', () => {
  // WP **theme.json 的 preset 注册**必须是单一 linear-gradient（其渐变解析器不容许多层背景）；
  //   style.css 是普通 CSS，多层背景合法且有益（垫底层保留）——两处语义不同，测试分别锁定。
  // <lang en>WP **theme.json preset registration** must stay a single linear-gradient (its parser rejects
  //   multi-layer); style.css is plain CSS where the underlay is legal and useful — the two consumers differ
  //   and the test locks each.</lang>
  const t = buildTheme({ primary: PRIMARY, secondary: '#00A8D3' });
  const files = getExportTarget('wordpress-child').files(t);
  const themeJson = files.find(f => f.path.endsWith('theme.json'));
  assert.ok(themeJson, 'theme.json 存在');
  const parsed = JSON.parse(themeJson.content);
  const presets = ((parsed.settings?.color ?? {}).gradients) || [];
  assert.ok(presets.length > 0, '渐变预设已注册');
  for (const p of presets) assert.ok(!p.gradient.includes('), var('), `预设 ${p.slug} 不得携带垫底层`);
  // style.css 仍保留垫底层（普通 CSS 场景）。
  const style = files.find(f => f.path.endsWith('style.css'));
  assert.ok(style.content.includes('), var(--hia-primary-'), '普通 CSS 场景垫底层保留');
});

test('降级链：注入模板示例改为双声明（color 先行）', () => {
  const t = buildTheme({ primary: PRIMARY, secondary: '#00A8D3' });
  const all = getExportTarget('css-inject').files(t).map(f => f.content).join('\n');
  assert.ok(all.includes('background-color: var(--hia-primary-500)'), '应有 color 垫底声明');
  assert.ok(all.includes('background-image: var(--hia-gradient-carousel)'), '应有 image 声明');
  assert.ok(all.includes('降级链'), '应有降级链说明');
});
