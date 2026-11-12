/**
 * @lang zh-CN TDON 校验器单测（`W-tb-P26` / 规范 `tdon-0.1`）：覆盖合法文档端到端、各类错误码、
 *   路径穿越、原型污染、规模上限与"无主题只做结构校验"的降级路径。
 *   断言以**错误码**为准（规范把码定为稳定契约），不比对文案，避免文案微调导致测试噪音。
 * @lang en TDON validator tests (`W-tb-P26` / spec `tdon-0.1`): cover a valid end-to-end document, each error
 *   code, path traversal, prototype pollution, size caps, and the theme-less structure-only path.
 *   Assertions key on **codes** (the spec makes them a stable contract), not copy, to avoid churn.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { buildTheme, GRADIENT_DEFAULTS } from '@hia/theme-core';
import { parseTdonDocument, checkTdonPath, isDangerousKey, isTdonTokenSyntax, resolveTdonToken, listTdonColorRoles, TDON_SPEC_VERSION, TDON_MAX_NESTING } from '../dist/index.js';

/** @lang zh-CN 基准主题：双色 + 两个辅助槽（无第三色，用于验证 third 引用失败）。 @lang en Base theme: dual mode with two aux slots (no third, to verify third refs fail). */
const THEME = buildTheme({
  name: 'TDON 测试主题', category: 'demo', industry: 'tech',
  primary: '#0047AB', secondary: '#00A8D3',
  gradients: GRADIENT_DEFAULTS,
  auxiliary: [
    { name: '中性灰', value: '#6B7280', scale: {}, on: '#ffffff' },
    { name: '暖砂', value: '#C2A07A', scale: {}, on: '#1f2937' }
  ]
});
// 辅助槽需要真实色阶才能被引用：用 core 的 buildTheme 已生成的 scale 覆盖。
// <lang zh-CN>直接构造 RoleColor 会缺 scale，导致 aux0.500 解析失败，故从主题自身取。</lang>
// <lang en>Hand-built RoleColors lack scales and would break aux0.500; reuse the theme's own entries.</lang>
const THEME_WITH_AUX = { ...THEME, auxiliary: THEME.auxiliary.map(a => ({ ...a, scale: buildTheme({ name: 'x', primary: a.value, secondary: a.value }).primary.scale })) };

/** @lang zh-CN 构造一份最小合法文档（可覆写任意字段）。 @lang en Build a minimal valid document (any field overridable). */
function makeDoc(overrides = {}) {
  return {
    specVersion: TDON_SPEC_VERSION,
    target: { id: 'demo-target', name: '演示目标', nameEn: 'Demo Target' },
    exportManifest: { files: [{ path: 'styles/tokens.css', template: ':root{--brand:{{token:primary.500}};}' }] },
    ...overrides
  };
}
/** @lang zh-CN 提取首条问题码（断言失败时便于定位）。 @lang en Extract the first issue code (aids diagnosis on failure). */
function firstCode(res) { return res.result.errors[0]?.code; }
/** @lang zh-CN 断言错误码集合包含指定码。 @lang en Assert the error code set contains a given code. */
function hasCode(res, code) {
  return res.result.errors.some(e => e.code === code);
}

test('合法最小文档通过校验并返回重建文档', () => {
  const res = parseTdonDocument(makeDoc());
  assert.equal(res.result.ok, true, JSON.stringify(res.result.errors));
  assert.equal(res.result.errors.length, 0);
  assert.ok(res.doc);
  assert.equal(res.doc.target.id, 'demo-target');
  // nameEn 缺省回退 name（TDON-3.2）。
  const noEn = parseTdonDocument(makeDoc({ target: { id: 'x-y', name: '仅中文名' } }));
  assert.equal(noEn.doc.target.nameEn, '仅中文名');
});

test('顶层不是对象 → E_NOT_OBJECT', () => {
  assert.equal(firstCode(parseTdonDocument([])), 'E_NOT_OBJECT');
  assert.equal(firstCode(parseTdonDocument(null)), 'E_NOT_OBJECT');
  assert.equal(firstCode(parseTdonDocument('x')), 'E_NOT_OBJECT');
});

test('未知顶层键 → E_UNKNOWN_KEY（不静默忽略）', () => {
  const res = parseTdonDocument(makeDoc({ extras: 1 }));
  assert.ok(hasCode(res, 'E_UNKNOWN_KEY'));
});

test('规范版本不符 → E_VERSION', () => {
  const res = parseTdonDocument(makeDoc({ specVersion: 'tdon-1.0' }));
  assert.ok(hasCode(res, 'E_VERSION'));
});

test('缺少 exportManifest → E_REQUIRED', () => {
  const doc = makeDoc();
  delete doc.exportManifest;
  assert.ok(hasCode(parseTdonDocument(doc), 'E_REQUIRED'));
});

test('target.id 形状非法 → E_PATTERN', () => {
  assert.ok(hasCode(parseTdonDocument(makeDoc({ target: { id: 'Bad_ID', name: 'x' } })), 'E_PATTERN'));
  assert.ok(hasCode(parseTdonDocument(makeDoc({ target: { id: 'a', name: 'x' } })), 'E_PATTERN'));
});

test('target.homepage 非 http(s) → E_PATTERN', () => {
  const res = parseTdonDocument(makeDoc({ target: { id: 'a-b', name: 'x', homepage: 'javascript:alert(1)' } }));
  assert.ok(hasCode(res, 'E_PATTERN'));
});

test('原型污染键 → E_BAD_KEY（顶层与嵌套）', () => {
  const doc = makeDoc();
  // 用 JSON.parse 构造真实的自有属性 __proto__（对象字面量会改变原型而非建键）。
  const polluted = JSON.parse(JSON.stringify(doc).replace('"specVersion"', '"__proto__":{"x":1},"specVersion"'));
  assert.ok(hasCode(parseTdonDocument(polluted), 'E_BAD_KEY'));
  // 嵌套位置同样拦截。
  const nested = makeDoc({ target: { id: 'a-b', name: 'x', constructor: { prototype: {} } } });
  assert.ok(hasCode(parseTdonDocument(nested), 'E_BAD_KEY'));
  assert.equal(isDangerousKey('__proto__'), true);
  assert.equal(isDangerousKey('__PROTO__'), false);
});

test('路径穿越与绝对路径 → E_BAD_PATH', () => {
  const bad = ['../etc/passwd', 'a/../../b', '/abs/path.css', 'C:/win.css', '~/home.css', 'a//b.css', 'a\\b.css', '%2e%2e/evil.css'];
  for (const path of bad) {
    const res = parseTdonDocument(makeDoc({ exportManifest: { files: [{ path, template: 'x' }] } }));
    assert.ok(hasCode(res, 'E_BAD_PATH'), `路径应被拒绝: ${path}`);
  }
  // 合法相对路径通过。
  assert.equal(checkTdonPath('styles/tokens.css').ok, true);
  assert.equal(checkTdonPath('a/b/c-d_e.css').ok, true);
});

test('template 与 templateRef 互斥且必填 → E_CONFLICT / E_REQUIRED', () => {
  const both = parseTdonDocument(makeDoc({ exportManifest: { files: [{ path: 'a.css', template: 'x', templateRef: 'builtin:hia-tokens-css' }] } }));
  assert.ok(hasCode(both, 'E_CONFLICT'));
  const neither = parseTdonDocument(makeDoc({ exportManifest: { files: [{ path: 'a.css' }] } }));
  assert.ok(hasCode(neither, 'E_REQUIRED'));
});

test('templateRef 白名单外 → E_TEMPLATE_REF', () => {
  const res = parseTdonDocument(makeDoc({ exportManifest: { files: [{ path: 'a.css', templateRef: 'builtin:anything' }] } }));
  assert.ok(hasCode(res, 'E_TEMPLATE_REF'));
  // 白名单内通过。
  const ok = parseTdonDocument(makeDoc({ exportManifest: { files: [{ path: 'a.css', templateRef: 'builtin:hia-tokens-css' }] } }));
  assert.equal(ok.result.ok, true, JSON.stringify(ok.result.errors));
});

test('非法插值命名空间 → E_INTERP', () => {
  const res = parseTdonDocument(makeDoc({ exportManifest: { files: [{ path: 'a.css', template: '{{env:HOME}}' }] } }));
  assert.ok(hasCode(res, 'E_INTERP'));
});

test('预览节点未知类型 → E_UNKNOWN_NODE 经 E_ENUM 表达', () => {
  const res = parseTdonDocument(makeDoc({ preview: { nodes: [{ type: 'chart' }] } }));
  assert.ok(hasCode(res, 'E_ENUM'));
});

test('节点属性不属于该类型 → E_UNKNOWN_KEY', () => {
  const res = parseTdonDocument(makeDoc({ preview: { nodes: [{ type: 'card', title: 'ok', nonexistent: 1 }] } }));
  assert.ok(hasCode(res, 'E_UNKNOWN_KEY'));
});

test('9 类节点全部可校验通过', () => {
  const nodes = [
    { type: 'hero', title: '主视觉', subtitle: '副标题', bgToken: 'gradient:carousel', actions: [{ label: '开始' }] },
    { type: 'nav', items: ['指南', { label: '配置', active: true }] },
    { type: 'card', title: '卡片', text: '正文', bgToken: 'primary.50', titleToken: 'primary.900' },
    { type: 'stats', items: [{ label: '用户', value: '3,486' }] },
    { type: 'list', items: ['一', '二'] },
    { type: 'table', columns: [{ key: 'name', label: '名称' }], rows: [{ name: '值' }, { name: '值2', extra: '忽略' }] },
    { type: 'form', fields: [{ label: '邮箱', type: 'email' }], submitLabel: '提交' },
    { type: 'divider', token: 'primary.200', thickness: 2 },
    { type: 'raw-text', text: '第一行\n第二行', size: 'fs:body' }
  ];
  const res = parseTdonDocument(makeDoc({ preview: { layout: 'hero', nodes } }));
  assert.equal(res.result.ok, true, JSON.stringify(res.result.errors));
  assert.equal(res.doc.preview.nodes.length, 9);
});

test('表格行多余键被忽略、列键形状受限', () => {
  const res = parseTdonDocument(makeDoc({
    preview: { nodes: [{ type: 'table', columns: [{ key: 'Bad-Key', label: 'X' }], rows: [{ Bad: '1' }] }] }
  }));
  assert.ok(hasCode(res, 'E_PATTERN'));
});

test('节点数量：软阈值只警告，硬阈值才报错（TDON-5.2 放宽）', () => {
  // 150 个顶层节点：越过软阈值 100，但低于硬上限 300 → 只警告，不阻断。
  const soft = Array.from({ length: 150 }, () => ({ type: 'divider' }));
  const softRes = parseTdonDocument(makeDoc({ preview: { nodes: soft } }));
  assert.equal(softRes.result.ok, true, JSON.stringify(softRes.result.errors));
  assert.ok(softRes.result.warnings.some(w => w.code === 'W_NODE_LIMIT'));
  // 301 个：越过硬上限 → E_LIMIT。
  const hard = Array.from({ length: 301 }, () => ({ type: 'divider' }));
  assert.ok(hasCode(parseTdonDocument(makeDoc({ preview: { nodes: hard } })), 'E_LIMIT'));
});

test('children 深度：允许 TDON_MAX_NESTING 层，再多一层 → E_UNKNOWN_KEY（TDON-5.2 放宽）', () => {
  // 深度语义：depth 从 0 起算，children 在 depth 0..MAX-1 合法，故 MAX 个节点层级（含根）可通过。
  // <lang en>Depth starts at 0 and children are legal for depth 0..MAX-1, so MAX levels (incl. root) pass.</lang>
  const allowed = { type: 'card', title: 'L1', children: [{ type: 'card', title: 'L2', children: [{ type: 'card', title: 'L3', children: [{ type: 'card', title: 'L4' }] }] }] };
  assert.equal(TDON_MAX_NESTING, 4, '本用例按 4 层编写，常量变更时须同步改写');
  const okRes = parseTdonDocument(makeDoc({ preview: { nodes: [allowed] } }));
  assert.equal(okRes.result.ok, true, JSON.stringify(okRes.result.errors));
  // 再多一层：depth 3 上的 children 不再是合法键 → E_UNKNOWN_KEY。
  const tooDeep = { type: 'card', title: 'L1', children: [{ type: 'card', title: 'L2', children: [{ type: 'card', title: 'L3', children: [{ type: 'card', title: 'L4', children: [{ type: 'card', title: 'L5' }] }] }] }] };
  assert.ok(hasCode(parseTdonDocument(makeDoc({ preview: { nodes: [tooDeep] } })), 'E_UNKNOWN_KEY'));
});

test('令牌语法非法 → E_TOKEN_SYNTAX', () => {
  const res = parseTdonDocument(makeDoc({ preview: { nodes: [{ type: 'card', title: 't', bgToken: 'brand-main' }] } }));
  assert.ok(hasCode(res, 'E_TOKEN_SYNTAX'));
  assert.equal(isTdonTokenSyntax('primary.500'), true);
  assert.equal(isTdonTokenSyntax('gradient:carousel'), true);
  assert.equal(isTdonTokenSyntax('fs:h1'), true);
  assert.equal(isTdonTokenSyntax('space:2'), true);
  assert.equal(isTdonTokenSyntax('on:primary'), true);
  assert.equal(isTdonTokenSyntax('primary'), false);
});

test('令牌不可解析（角色不存在）→ E_TOKEN_UNRESOLVED', () => {
  // 双色主题引用 third（需三色模式）。
  const res = parseTdonDocument(makeDoc({ preview: { nodes: [{ type: 'card', title: 't', bgToken: 'third.500' }] } }), { theme: THEME_WITH_AUX });
  assert.ok(hasCode(res, 'E_TOKEN_UNRESOLVED'));
  // 辅助槽越界。
  const res2 = parseTdonDocument(makeDoc({ preview: { nodes: [{ type: 'card', title: 't', bgToken: 'aux9.500' }] } }), { theme: THEME_WITH_AUX });
  assert.ok(hasCode(res2, 'E_TOKEN_UNRESOLVED'));
});

test('无主题时只做结构校验（不报不可解析）', () => {
  const res = parseTdonDocument(makeDoc({ preview: { nodes: [{ type: 'card', title: 't', bgToken: 'aux9.500' }] } }));
  assert.equal(res.result.ok, true, JSON.stringify(res.result.errors));
});

test('色阶越界 → E_SHADE_RANGE', () => {
  const res = parseTdonDocument(makeDoc({ tokens: { include: { color: ['primary'], colorShades: [2000] } } }));
  assert.ok(hasCode(res, 'E_SHADE_RANGE'));
  const res2 = parseTdonDocument(makeDoc({ tokens: { include: { color: ['primary'], colorShades: ['550'] } } }));
  assert.ok(hasCode(res2, 'E_SHADE_RANGE'));
});

test('alias 变量名与值形状受限', () => {
  const bad = parseTdonDocument(makeDoc({ tokens: { alias: { 'brand-color': 'primary.500' } } }));
  assert.ok(hasCode(bad, 'E_PATTERN'));
  const badRef = parseTdonDocument(makeDoc({ tokens: { alias: { '--x': 'gradient:carousel' } } }));
  assert.ok(hasCode(badRef, 'E_TOKEN_SYNTAX'));
  const ok = parseTdonDocument(makeDoc({ tokens: { alias: { '--vp-c-brand': 'primary.500' } } }), { theme: THEME_WITH_AUX });
  assert.equal(ok.result.ok, true, JSON.stringify(ok.result.errors));
});

test('特效：未知类型、参数越界、缺参、多余参数', () => {
  const unknown = parseTdonDocument(makeDoc({ effects: { a: { type: 'spin' } } }));
  assert.ok(hasCode(unknown, 'E_ENUM'));
  const range = parseTdonDocument(makeDoc({ effects: { a: { type: 'fade-in', duration: 260 } } }));
  assert.ok(hasCode(range, 'E_EFFECT_RANGE'));
  const missing = parseTdonDocument(makeDoc({ effects: { a: { type: 'hover-lift' } } }));
  assert.ok(hasCode(missing, 'E_REQUIRED'));
  const extra = parseTdonDocument(makeDoc({ effects: { a: { type: 'gradient-shift', speed: 3 } } }));
  assert.ok(hasCode(extra, 'E_UNKNOWN_KEY'));
  const ok = parseTdonDocument(makeDoc({ effects: { g: { type: 'gradient-shift' }, f: { type: 'fade-in', duration: 400 }, l: { type: 'hover-lift', distance: 2 } } }));
  assert.equal(ok.result.ok, true, JSON.stringify(ok.result.errors));
});

test('节点引用未声明的特效 → E_EFFECT_UNKNOWN', () => {
  const res = parseTdonDocument(makeDoc({
    effects: { g: { type: 'gradient-shift' } },
    preview: { nodes: [{ type: 'hero', title: 't', effect: 'nope' }] }
  }));
  assert.ok(hasCode(res, 'E_EFFECT_UNKNOWN'));
});

test('对比度断言：strict 决定错误或警告', () => {
  const doc = (strict) => makeDoc({
    constraints: { strict, requireContrast: [{ fg: 'primary.50', bg: 'primary.900', min: 7 }] }
  });
  // primary.50 与 primary.900 对比度高，应通过。
  assert.equal(parseTdonDocument(doc(false), { theme: THEME_WITH_AUX }).result.ok, true);
  // 同色对比 = 1，必然违反。
  const warn = parseTdonDocument(makeDoc({
    constraints: { strict: false, requireContrast: [{ fg: 'primary.500', bg: 'primary.500', min: 4.5 }] }
  }), { theme: THEME_WITH_AUX });
  assert.equal(warn.result.ok, true);
  assert.ok(warn.result.warnings.some(w => w.code === 'W_CONTRAST'));
  const err = parseTdonDocument(makeDoc({
    constraints: { strict: true, requireContrast: [{ fg: 'primary.500', bg: 'primary.500', min: 4.5 }] }
  }), { theme: THEME_WITH_AUX });
  assert.ok(hasCode(err, 'E_CONTRAST'));
});

test('requiredTokens 不可解析即错误（不受 strict 影响）', () => {
  const res = parseTdonDocument(makeDoc({
    constraints: { strict: false, requiredTokens: ['third.500'] }
  }), { theme: THEME_WITH_AUX });
  assert.ok(hasCode(res, 'E_TOKEN_UNRESOLVED'));
});

test('规模：软阈值只警告、硬阈值才报错（TDON-6.3 放宽）', () => {
  // 300KB 单模板：越过软阈值 256KB，低于硬上限 512KB → 警告且可用。
  const soft = parseTdonDocument(makeDoc({ exportManifest: { files: [{ path: 'a.css', template: 'x'.repeat(300 * 1024) }] } }));
  assert.equal(soft.result.ok, true, JSON.stringify(soft.result.errors));
  assert.ok(soft.result.warnings.some(w => w.code === 'W_TEMPLATE_SIZE'));
  // 单文件超 512KB 硬上限：必须是 E_TOO_LARGE，而不是被误报成 E_REQUIRED。
  const single = parseTdonDocument(makeDoc({ exportManifest: { files: [{ path: 'a.css', template: 'x'.repeat(600 * 1024) }] } }));
  assert.ok(hasCode(single, 'E_TOO_LARGE'));
  assert.equal(single.result.errors.length, 1, '超长模板不应再触发"未提供"的次生错误');
  // 合计超 2MB 硬上限：4 × 600KB = 2.4MB，单文件均已超硬上限故用 4 × 520KB。
  const chunk = 'x'.repeat(520 * 1024);
  const files = Array.from({ length: 4 }, (_, i) => ({ path: `f${i}.css`, template: chunk }));
  assert.ok(hasCode(parseTdonDocument(makeDoc({ exportManifest: { files } })), 'E_TOO_LARGE'));
});

test('错误条数上限 20 并置 truncated', () => {
  // 构造 >20 个未知键。
  const extras = Object.fromEntries(Array.from({ length: 30 }, (_, i) => [`k${i}`, i]));
  const res = parseTdonDocument(makeDoc(extras));
  assert.equal(res.result.errors.length, 20);
  assert.equal(res.result.truncated, true);
});

test('令牌解析结果与主题一致', () => {
  // primary.500 必须等于基色（ADR-004 锚点一致性）。
  const r = resolveTdonToken(THEME_WITH_AUX, 'primary.500');
  assert.equal(r.ok, true);
  assert.equal(r.value.toLowerCase(), '#0047ab');
  // 自定义档走插值，且在 0–1000 域内可得。
  const custom = resolveTdonToken(THEME_WITH_AUX, 'primary.650');
  assert.equal(custom.ok, true);
  assert.match(custom.value, /^#[0-9a-f]{6}$/i);
  // 渐变未启用时不可解析。
  const disabledTheme = { ...THEME_WITH_AUX, gradients: { ...THEME_WITH_AUX.gradients, carousel: { ...THEME_WITH_AUX.gradients.carousel, enabled: false } } };
  assert.equal(resolveTdonToken(disabledTheme, 'gradient:carousel').ok, false);
  // 角色清单顺序固定。
  assert.deepEqual(listTdonColorRoles(THEME_WITH_AUX), ['primary', 'secondary', 'aux0', 'aux1']);
});

test('渐变令牌内联真实色值（不得残留 var(--hia-*)）', () => {
  // 预览宿主注入的是 --p/--s 简写变量，导出模式的 --hia-* 在预览里全部落空——
  //   曾导致 hero 背景渲染为 none。这里锁死"内联色值"这一约定。
  // <lang en>The preview host injects --p/--s shorthand vars, so export-mode --hia-* resolves to nothing and
  //   once left the hero background as "none". This pins the "inline real colors" contract.</lang>
  const r = resolveTdonToken(THEME_WITH_AUX, 'gradient:carousel');
  assert.equal(r.ok, true);
  assert.ok(r.value.startsWith('linear-gradient('), `应为渐变函数，实际 ${r.value.slice(0, 40)}`);
  assert.ok(!r.value.includes('var('), '渐变值不得包含 var() 引用');
  assert.match(r.value, /#[0-9a-f]{6}/i, '渐变值应含真实十六进制色值');
});

// ===== v0.2 放宽与新增能力（2026-11-12 维护者审核意见） =====

test('imageUrl：仅 https，其他协议 E_MEDIA_URL', () => {
  const ok = parseTdonDocument(makeDoc({ preview: { nodes: [{ type: 'hero', title: 't', imageUrl: 'https://cdn.example.com/a.png' }] } }));
  assert.equal(ok.result.ok, true, JSON.stringify(ok.result.errors));
  for (const bad of ['http://a.com/x.png', 'javascript:alert(1)', 'data:image/png;base64,AAA', '/local/a.png']) {
    const res = parseTdonDocument(makeDoc({ preview: { nodes: [{ type: 'card', title: 't', imageUrl: bad }] } }));
    assert.ok(hasCode(res, 'E_MEDIA_URL'), `应拒绝 ${bad}`);
  }
  // 超长地址被长度上限拦下（E_LIMIT），而不是进入渲染。
  const long = 'https://a.com/' + 'x'.repeat(3000);
  assert.ok(hasCode(parseTdonDocument(makeDoc({ preview: { nodes: [{ type: 'card', title: 't', imageUrl: long }] } })), 'E_LIMIT'));
});

test('template 段（TDOT 预留）：接受 + 警告，原样保留，不解释', () => {
  const res = parseTdonDocument(makeDoc({
    template: { specVersion: 'tdot-0.1', data: { features: [{ name: 'x', on: true }] }, blocks: [{ when: 'x.on' }] }
  }));
  assert.equal(res.result.ok, true, JSON.stringify(res.result.errors));
  assert.ok(res.result.warnings.some(w => w.code === 'W_TDOT_RESERVED'));
  // 内容原样保留，供未来 TDOT 运行时接管。
  assert.equal(res.doc.template.specVersion, 'tdot-0.1');
  assert.deepEqual(res.doc.template.data, { features: [{ name: 'x', on: true }] });
  // 非对象 → E_TYPE；危险键仍被拦截。
  assert.ok(hasCode(parseTdonDocument(makeDoc({ template: 'nope' })), 'E_TYPE'));
});

test('tokens.fontUrl（远程字体预留）：https 接受并警告，http 报错', () => {
  const ok = parseTdonDocument(makeDoc({ tokens: { fontUrl: 'https://fonts.example.com/x.woff2' } }));
  assert.equal(ok.result.ok, true, JSON.stringify(ok.result.errors));
  assert.ok(ok.result.warnings.some(w => w.code === 'W_FONT_RESERVED'));
  const bad = parseTdonDocument(makeDoc({ tokens: { fontUrl: 'http://fonts.example.com/x.woff2' } }));
  assert.ok(hasCode(bad, 'E_MEDIA_URL'));
});

test('文件软阈值只警告（超过 512KB 提示但可用，超过 4MB 才拒绝）', () => {
  // 用 template 段撑大体积：它合法、被原样保留，且不参与导出模板合计口径。
  // <lang en>Padding lives in the template block: legal, preserved verbatim, and excluded from the export-total cap.</lang>
  const soft = parseTdonDocument(makeDoc({ template: { pad: 'x'.repeat(600 * 1024) } }));
  assert.equal(soft.result.ok, true, JSON.stringify(soft.result.errors));
  assert.ok(soft.result.warnings.some(w => w.code === 'W_TOO_LARGE'), JSON.stringify(soft.result.warnings.map(w => w.code)));
  // 超过 4MB 硬上限 → E_TOO_LARGE。
  const hard = parseTdonDocument(makeDoc({ template: { pad: 'x'.repeat(5 * 1024 * 1024) } }));
  assert.ok(hasCode(hard, 'E_TOO_LARGE'));
});
