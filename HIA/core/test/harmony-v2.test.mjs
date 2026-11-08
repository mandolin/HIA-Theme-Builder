/**
 * @lang zh-CN 主色系关系规则与辅助色单测（ADR-007 v2 / `W-tb-P11`）：规则表模式映射、dual/triad 推导、
 *   装配语义（single 变体 / third 缺省推导 / auxiliary 独立）、下游传导（CSS/JSON/WP/Tailwind/分享）。
 * @lang en Series relation & auxiliary tests (ADR-007 v2 / `W-tb-P11`): rule table mapping, dual/triad
 *   derivation, assembly semantics (single variant / third default derivation / auxiliary independence),
 *   downstream passthrough (CSS/JSON/WP/Tailwind/share).
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildTheme, createThemeDraft, buildThemeFromDraft,
  getSeriesRelationDef, deriveSecondaryByRelation, deriveThirdByRelation,
  generateAuxiliaryCandidates, hexToOklch,
  exportThemeCss, exportThemeJson,
  wordpressChildTarget, tailwindConfigTarget,
  buildSharePayload, encodeShareHash, decodeShareHash
} from '../dist/index.js';

const PRIMARY = '#0047AB';

test('规则表: 十种设计全映射 + 模式匹配校验（rule table sanity）', () => {
  // single 无规则（回退 manual）；dual 四规则；triad 六规则
  assert.equal(getSeriesRelationDef('complement', 'single').id, 'manual', 'single 下 complement 回退 manual');
  assert.equal(getSeriesRelationDef('complement', 'dual').id, 'complement');
  assert.equal(getSeriesRelationDef('analogous', 'dual').id, 'manual', 'triad 专属规则在 dual 回退');
  assert.equal(getSeriesRelationDef('analogous', 'triad').id, 'analogous');
  assert.equal(getSeriesRelationDef('nope', 'triad').id, 'manual', '未知 id 回退');
});

test('dual 推导: 互补 180° / 冲突 150° / 中性低彩 / manual null（dual derivation）', () => {
  const comp = deriveSecondaryByRelation(PRIMARY, 'complement');
  assert.ok(comp, 'complement 有推导值');
  const dP = hexToOklch(PRIMARY).h;
  const dC = ((hexToOklch(comp).h - dP) % 360 + 360) % 360;
  assert.ok(Math.abs(dC - 180) < 8, `互补角差 ≈180（实测 ${dC}）`);
  const clash = deriveSecondaryByRelation(PRIMARY, 'clash');
  const dCl = ((hexToOklch(clash).h - dP) % 360 + 360) % 360;
  assert.ok(Math.abs(dCl - 150) < 8, `冲突角差 ≈150（实测 ${dCl}）`);
  const neutral = deriveSecondaryByRelation(PRIMARY, 'neutral');
  assert.ok(hexToOklch(neutral).C < hexToOklch(comp).C * 0.6, '中性彩度显著更低');
  assert.equal(deriveSecondaryByRelation(PRIMARY, 'manual'), null, 'manual 无推导');
});

test('triad 推导: 第三色取副色未占用侧 / 组合剩余位（triad third derivation）', () => {
  // analogous：主相 ±30 两侧，副色占一侧 → 第三色取另一侧
  const third = deriveThirdByRelation(PRIMARY, '#00A8D3', 'analogous');
  assert.ok(third, 'analogous 有推导');
  // tertiary：等距 120/240，副色占一侧 → 第三色取剩余
  const t120 = deriveThirdByRelation(PRIMARY, '#00A8D3', 'tertiary');
  assert.ok(t120);
  // 组合型（primary）：组合 [25,100,250]，主位=蓝（最近钴蓝 264°）→ 副色占某位 → 第三色=最后剩余
  const combo = deriveThirdByRelation(PRIMARY, '#C00000', 'primary-combo');
  assert.ok(combo, '组合型有推导');
  // manual/pure 无推导
  assert.equal(deriveThirdByRelation(PRIMARY, '#00A8D3', 'manual'), null);
  assert.equal(deriveThirdByRelation(PRIMARY, '#00A8D3', 'pure'), null);
});

test('装配: single 模式 secondary 取主色系变体（single variant assembly）', () => {
  const t = buildTheme({ name: 's', category: 'demo', primary: PRIMARY, secondary: '#FF0000', seriesMode: 'single' });
  assert.equal(t.seriesMode, 'single');
  // 变体 = primary 700 档（hue 与主色一致）
  assert.equal(t.secondary.value, t.primary.scale['700'], 'secondary=primary 700 档');
  const dP = hexToOklch(PRIMARY).h, dS = hexToOklch(t.secondary.value).h;
  const dist = Math.min(Math.abs(dS - dP) % 360, 360 - Math.abs(dS - dP) % 360);
  assert.ok(dist < 8, '变体色相与主色一致');
  assert.equal(t.thirdColor, undefined, 'single 无第三色');
});

test('装配: triad 第三色缺省推导 + 显式覆写（triad third assembly）', () => {
  // 缺省 → 按 relation 推导
  const derived = buildTheme({ name: 't', category: 'demo', primary: PRIMARY, secondary: '#00A8D3', seriesMode: 'triad', seriesRelation: 'analogous' });
  assert.equal(derived.seriesMode, 'triad');
  assert.ok(derived.thirdColor, '第三色自动推导');
  assert.ok(derived.thirdColor.scale['500'], '第三色含完整色阶');
  // 显式覆写 → 用户第三色保留
  const overridden = buildTheme({ name: 'o', category: 'demo', primary: PRIMARY, secondary: '#00A8D3', seriesMode: 'triad', seriesRelation: 'analogous', thirdColor: { name: '手动第三色', value: '#123456', scale: {}, on: '#fff' } });
  assert.equal(overridden.thirdColor.value, '#123456', '显式第三色保留');
});

test('装配: auxiliary 独立于主色系模式（auxiliary independence）', () => {
  const t = buildTheme({
    name: 'a', category: 'demo', primary: PRIMARY, secondary: '#00A8D3',
    seriesMode: 'single',
    auxiliary: [{ name: '强调橙', value: '#C2410C', scale: {}, on: '#fff' }]
  });
  assert.equal(t.auxiliary.length, 1, 'single 模式下辅助槽位仍可用（独立维度）');
  assert.equal(t.auxiliary[0].value, '#C2410C');
  // 缺省空
  assert.deepEqual(buildTheme({ name: 'b', category: 'demo', primary: PRIMARY, secondary: '#00A8D3' }).auxiliary, []);
});

test('草稿: seriesMode/seriesRelation/thirdColor/auxiliary 透传（draft passthrough）', () => {
  const draft = createThemeDraft({ seriesMode: 'triad', seriesRelation: 'tertiary' });
  assert.equal(draft.seriesMode, 'triad');
  assert.equal(draft.seriesRelation, 'tertiary');
  assert.equal(draft.thirdColor, undefined, '第三色缺省不写键（装配时推导）');
  assert.deepEqual(draft.auxiliary, [], 'auxiliary 缺省空数组（独立维度默认值）');
  const theme = buildThemeFromDraft(draft);
  assert.equal(theme.seriesMode, 'triad');
  assert.ok(theme.thirdColor, '装配时第三色推导');
});

test('规则生成: 辅助候选三个（generate candidates）', () => {
  const cands = generateAuxiliaryCandidates(PRIMARY);
  assert.equal(cands.length, 3);
  cands.forEach(c => assert.match(c.hex, /^#[0-9A-F]{6}$/i));
});

test('传导: CSS/JSON/WP/Tailwind 携带第三色与辅助槽位（downstream passthrough）', () => {
  const theme = buildTheme({
    name: 'Demo Theme', category: 'demo', primary: PRIMARY, secondary: '#00A8D3',
    seriesMode: 'triad', seriesRelation: 'analogous',
    auxiliary: [{ name: '强调橙', value: '#C2410C', scale: {}, on: '#fff' }]
  });
  // CSS：第三色与辅助变量（第三色 token 命名 --hia-third-*）
  const css = exportThemeCss(theme);
  assert.match(css, /--hia-third-500:/, 'CSS 含第三色中档变量');
  assert.match(css, /--hia-aux0-500:/, 'CSS 含辅助槽位变量');
  // JSON
  const json = JSON.parse(exportThemeJson(theme));
  assert.equal(json.seriesMode, 'triad');
  assert.ok(json.thirdColor, 'JSON 含第三色');
  assert.equal(json.auxiliary.length, 1);
  // WP palette
  const wpJson = JSON.parse(wordpressChildTarget.files(theme).find(f => f.path === 'theme.json').content);
  const slugs = wpJson.settings.color.palette.map(e => e.slug);
  assert.ok(slugs.includes('hia-third-500'), 'WP 面板含第三色 slug');
  assert.ok(slugs.includes('hia-aux0-500'), 'WP 面板含辅助 slug');
  // Tailwind
  const files = tailwindConfigTarget.files(theme);
  const config = files.find(f => f.path === 'tailwind.config.js').content;
  const mod = { exports: {} };
  const fn = new Function('module', 'exports', config + '\n;return module.exports;');
  const parsed = fn(mod, mod.exports);
  assert.ok(parsed.theme.extend.colors.third, 'Tailwind 含 third 族');
  assert.ok(parsed.theme.extend.colors.aux0, 'Tailwind 含 aux0 族');
});

test('传导: 分享载荷往返携带模式/规则/第三色/辅助（share passthrough）', () => {
  const draft = createThemeDraft({ seriesMode: 'triad', seriesRelation: 'tertiary', name: '三色往返' });
  const hash = encodeShareHash(buildSharePayload(draft));
  const back = decodeShareHash(hash);
  assert.ok(back);
  assert.equal(back.seriesMode, 'triad');
  assert.equal(back.seriesRelation, 'tertiary');
  assert.equal(back.thirdColor.length, 1, '第三色入载荷（推导值）');
  // dual 现行主题不写配色尾段（长度节省）
  const dualHash = encodeShareHash(buildSharePayload(createThemeDraft({ name: 'dual' })));
  const dualBack = decodeShareHash(dualHash);
  assert.equal(dualBack.seriesMode, undefined);
  assert.equal(dualBack.seriesRelation, undefined);
});
