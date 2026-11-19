/**
 * @lang zh-CN TDON 目标保真单测（`T-tb-TDON-P1` / ADR-019）：覆盖语义状态角色引用（TDON-5.19）、
 *   tree/code-block/callout 三类新节点（TDON-5.15/5.16/5.17）与两栏布局（TDON-5.18）的
 *   校验、解析与渲染行为。断言以错误码与 DOM 结构特征为准，不比对文案。
 * @lang en TDON target-fidelity tests (`T-tb-TDON-P1` / ADR-019): semantic status role references
 *   (TDON-5.19), the tree/code-block/callout nodes (TDON-5.15/5.16/5.17) and the two-column layout
 *   (TDON-5.18) across validation, resolution and rendering. Assertions key on codes and DOM structure.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { buildTheme, GRADIENT_DEFAULTS, deriveSemanticTokens } from '@hia/theme-core';
import { parseTdonDocument, renderTdonPreview, resolveTdonToken, listTdonColorRoles, TDON_PREVIEW_CSS, TDON_SPEC_VERSION } from '../dist/index.js';

/** @lang zh-CN 基准主题：双色基底 + 派生语义状态组（ADR-019 语义角色按真实主题能力编写）。 @lang en Base theme: dual mode + derived semantic group (ADR-019 roles written against real theme capability). */
const BASE = buildTheme({ name: 'ADR-019 主题', category: 'demo', industry: 'tech', primary: '#0047AB', secondary: '#00A8D3', gradients: GRADIENT_DEFAULTS });
const THEME = { ...BASE, semantic: deriveSemanticTokens(BASE.primary.value) };
/** @lang zh-CN 无语义组的主题（验证语义角色不可解析的降级路径）。 @lang en Theme without a semantic group (for the unresolved-role fallback path). */
const PLAIN_THEME = BASE;

/** @lang zh-CN 构造最小合法文档（可覆写任意字段）。 @lang en Build a minimal valid document (any field overridable). */
function makeDoc(overrides = {}) {
  return {
    specVersion: TDON_SPEC_VERSION,
    target: { id: 'demo-target', name: '演示目标', nameEn: 'Demo Target' },
    exportManifest: { files: [{ path: 'styles/tokens.css', template: ':root{--brand:{{token:primary.500}};}' }] },
    ...overrides
  };
}
/** @lang zh-CN 以给定主题解析并返回结果。 @lang en Parse with the given theme and return the result. */
function parse(raw, theme = THEME) { return parseTdonDocument(raw, { theme }); }
/** @lang zh-CN 提取首条问题码。 @lang en Extract the first issue code. */
function firstCode(res) { return res.result.errors[0]?.code; }

// ===== 1. tree（TDON-5.15）=====

test('tree：合法分组树通过校验并归一化 active', () => {
  const preview = { layout: 'sidebar-left', nodes: [{ type: 'tree', sections: [
    { label: '指南', items: [{ label: '介绍' }, { label: '快速上手', active: true }] },
    { label: '配置', items: [{ label: '主题配置' }] }
  ] }] };
  const res = parse(makeDoc({ preview }));
  assert.equal(res.result.ok, true, JSON.stringify(res.result.errors));
  const sections = res.doc.preview.nodes[0].attrs.sections;
  assert.equal(sections.length, 2);
  assert.deepEqual(sections[0].items[1], { label: '快速上手', active: true });
  // 未声明 active 的项归一化为 false（渲染层无需判空）。
  assert.deepEqual(sections[0].items[0], { label: '介绍', active: false });
});

test('tree：上限与类型——sections 7 / items 13 / label 超长 / active 非布尔 → 报错', () => {
  const node = (sections) => ({ type: 'tree', sections });
  const r1 = parse(makeDoc({ preview: { layout: 'stack', nodes: [node([{ label: 'a', items: [{ label: 'x' }] }, { label: 'b', items: [{ label: 'x' }] }, { label: 'c', items: [{ label: 'x' }] }, { label: 'd', items: [{ label: 'x' }] }, { label: 'e', items: [{ label: 'x' }] }, { label: 'f', items: [{ label: 'x' }] }, { label: 'g', items: [{ label: 'x' }] }])] } }));
  assert.ok(r1.result.errors.some(e => e.code === 'E_LIMIT'), 'sections 超过 6 应 E_LIMIT');
  const r2 = parse(makeDoc({ preview: { layout: 'stack', nodes: [node([{ label: 'a', items: Array.from({ length: 13 }, (_, i) => ({ label: `项${i}` })) }])] } }));
  assert.ok(r2.result.errors.some(e => e.code === 'E_LIMIT'), 'items 超过 12 应 E_LIMIT');
  const r3 = parse(makeDoc({ preview: { layout: 'stack', nodes: [node([{ label: 'x'.repeat(41), items: [{ label: 'x' }] }])] } }));
  assert.ok(r3.result.errors.some(e => e.code === 'E_LIMIT'), '组标题超 40 应 E_LIMIT');
  const r4 = parse(makeDoc({ preview: { layout: 'stack', nodes: [node([{ label: 'a', items: [{ label: 'x', active: 'yes' }] }])] } }));
  assert.equal(firstCode(r4), 'E_TYPE', 'active 非布尔应 E_TYPE');
});

test('tree：多激活项 → W_TREE_ACTIVE 警告但文档可用', () => {
  const preview = { layout: 'stack', nodes: [{ type: 'tree', sections: [
    { label: 'a', items: [{ label: 'x', active: true }] },
    { label: 'b', items: [{ label: 'y', active: true }] }
  ] }] };
  const res = parse(makeDoc({ preview }));
  assert.equal(res.result.ok, true);
  assert.ok(res.result.warnings.some(w => w.code === 'W_TREE_ACTIVE'), JSON.stringify(res.result.warnings));
});

// ===== 2. code-block（TDON-5.16）=====

test('code-block：code 必填；lang/title 上限', () => {
  const r1 = parse(makeDoc({ preview: { layout: 'stack', nodes: [{ type: 'code-block' }] } }));
  assert.equal(firstCode(r1), 'E_REQUIRED', '缺 code 应 E_REQUIRED');
  const r2 = parse(makeDoc({ preview: { layout: 'stack', nodes: [{ type: 'code-block', code: 'x=1', lang: 'l'.repeat(17) }] } }));
  assert.ok(r2.result.errors.some(e => e.code === 'E_LIMIT'), 'lang 超 16 应 E_LIMIT');
  const r3 = parse(makeDoc({ preview: { layout: 'stack', nodes: [{ type: 'code-block', code: 'x=1', title: 't'.repeat(81) }] } }));
  assert.ok(r3.result.errors.some(e => e.code === 'E_LIMIT'), 'title 超 80 应 E_LIMIT');
  const r4 = parse(makeDoc({ preview: { layout: 'stack', nodes: [{ type: 'code-block', code: 'const x = 1', lang: 'ts' }] } }));
  assert.equal(r4.result.ok, true, JSON.stringify(r4.result.errors));
});

// ===== 3. callout（TDON-5.17）=====

test('callout：kind 必填且为枚举；text 必填；title 上限', () => {
  const r1 = parse(makeDoc({ preview: { layout: 'stack', nodes: [{ type: 'callout', text: 'x' }] } }));
  assert.equal(firstCode(r1), 'E_REQUIRED', '缺 kind 应 E_REQUIRED');
  const r2 = parse(makeDoc({ preview: { layout: 'stack', nodes: [{ type: 'callout', kind: 'danger-zone', text: 'x' }] } }));
  assert.equal(firstCode(r2), 'E_ENUM', 'kind 非法应 E_ENUM');
  const r3 = parse(makeDoc({ preview: { layout: 'stack', nodes: [{ type: 'callout', kind: 'tip' }] } }));
  assert.ok(r3.result.errors.some(e => e.code === 'E_REQUIRED'), '缺 text 应 E_REQUIRED');
  const r4 = parse(makeDoc({ preview: { layout: 'stack', nodes: [{ type: 'callout', kind: 'tip', text: 'x', title: 't'.repeat(81) }] } }));
  assert.ok(r4.result.errors.some(e => e.code === 'E_LIMIT'), 'title 超 80 应 E_LIMIT');
});

// ===== 4. 语义状态角色（TDON-5.19）=====

test('语义角色：success.500 / on:warning 可解析；semantic.* 双点号形状仍非法', () => {
  const s = resolveTdonToken(THEME, 'success.500');
  assert.ok(s.ok, `success.500 应解析：${'message' in s ? s.reasonZh : ''}`);
  const ow = resolveTdonToken(THEME, 'on:warning');
  assert.ok(ow.ok, 'on:warning 应解析');
  // 旧渲染器的死引用形状必须继续失败——六形式契约不因角色扩充而放宽。
  const dead = resolveTdonToken(THEME, 'semantic.success.300');
  assert.equal(dead.ok, false, 'semantic.* 形状应保持非法');
});

test('语义角色：无语义组主题 → E_TOKEN_UNRESOLVED；listTdonColorRoles 按派生与否列出', () => {
  const res = parse(makeDoc({ preview: { layout: 'stack', nodes: [{ type: 'callout', kind: 'tip', text: 'x', token: 'success.600' }] } }), PLAIN_THEME);
  assert.ok(res.result.errors.some(e => e.code === 'E_TOKEN_UNRESOLVED'), '无语义组时 success.600 应不可解析');
  assert.ok(listTdonColorRoles(THEME).includes('success'), '有语义组应列出语义角色');
  assert.ok(!listTdonColorRoles(PLAIN_THEME).includes('success'), '无语义组不列出语义角色');
});

// ===== 5. 两栏布局（TDON-5.18）=====

/** @lang zh-CN 构造已解析文档（含预览），供渲染断言。 @lang en Build a parsed doc with a preview for render assertions. */
function parsed(preview) {
  const res = parse(makeDoc({ preview }));
  assert.equal(res.result.ok, true, JSON.stringify(res.result.errors));
  return res.doc;
}

test('两栏：sidebar-left 首节点（tree）入 aside；sidebar-right 末节点（tree）入 aside（语义门槛修订后）', () => {
  // 左：tree 打头；右：tree 收尾——语义门槛要求边界节点为 tree（ADR-019 修订 2026-11-20）。
  const leftNodes = [{ type: 'tree', sections: [{ label: 'a', items: [{ label: 'x' }] }] }, { type: 'raw-text', text: '正文一' }, { type: 'raw-text', text: '正文二' }];
  const left = renderTdonPreview(parsed({ layout: 'sidebar-left', nodes: [...leftNodes] }), THEME);
  const asidePos = left.indexOf('tdon-aside'), mainPos = left.indexOf('tdon-main');
  assert.ok(asidePos >= 0 && mainPos >= 0, '应输出 aside/main 结构');
  assert.ok(asidePos < mainPos, 'sidebar-left 的 aside 应在 main 前');
  assert.ok(left.indexOf('tdon-tree') > asidePos && left.indexOf('tdon-tree') < mainPos, '首节点（tree）应在 aside 内');
  const rightNodes = [{ type: 'raw-text', text: '正文一' }, { type: 'raw-text', text: '正文二' }, { type: 'tree', sections: [{ label: 'a', items: [{ label: 'x' }] }] }];
  const right = renderTdonPreview(parsed({ layout: 'sidebar-right', nodes: [...rightNodes] }), THEME);
  assert.ok(right.indexOf('tdon-main') < right.indexOf('tdon-aside'), 'sidebar-right 的 main 应在 aside 前');
  // 末节点（tree）进 aside：aside 内应含树结构。
  const asideChunk = right.slice(right.indexOf('tdon-aside'));
  assert.ok(asideChunk.includes('tdon-tree'), 'sidebar-right 末节点（tree）应入 aside');
});

test('两栏：单节点 sidebar-left 退化为无 aside 的平铺（避免空主列）', () => {
  const html = renderTdonPreview(parsed({ layout: 'sidebar-left', nodes: [{ type: 'raw-text', text: '独行' }] }), THEME);
  assert.ok(!html.includes('tdon-aside'), '单节点不应产出 aside');
  assert.ok(html.includes('tdon-layout-sidebar-left'), '布局类保留');
});

test('两栏语义门槛（ADR-019 修订 2026-11-20）：首节点为 nav 时不两栏——顶部导航不被塞进窄列', () => {
  // 后台仪表盘形态（admin-dashboard 同构）：nav（顶部导航）+ stats/table——机械"首节点进侧栏"
  // 会把导航压进 220px 竖条（维护者截图反馈的实际缺陷）。
  const html = renderTdonPreview(parsed({ layout: 'sidebar-left', nodes: [
    { type: 'nav', items: ['仪表盘', '订单', '客户'] },
    { type: 'stats', items: [{ label: '订单', value: '1,284' }] },
    { type: 'raw-text', text: '表格区' }
  ] }), THEME);
  assert.ok(!html.includes('tdon-aside'), '首节点为 nav 不应产出 aside');
  assert.ok(html.includes('tdon-nav'), 'nav 保持单列流式（全宽）');
  // 对照：首节点为 tree 时两栏依旧成立。
  const withTree = renderTdonPreview(parsed({ layout: 'sidebar-left', nodes: [
    { type: 'tree', sections: [{ label: 'a', items: [{ label: 'x' }] }] },
    { type: 'raw-text', text: '内容' }
  ] }), THEME);
  assert.ok(withTree.includes('tdon-aside'), '首节点为 tree 应两栏');
});

// ===== 6. 新节点渲染结构与安全 =====

test('tree 渲染：组标题/激活项/转义齐备', () => {
  const html = renderTdonPreview(parsed({ layout: 'stack', nodes: [{ type: 'tree', accentToken: 'primary.600', sections: [
    { label: '指南<script>', items: [{ label: '介绍' }, { label: '<img src=x onerror=alert(1)>', active: true }] }
  ] }] }), THEME);
  assert.ok(html.includes('tdon-tree-heading'), '应有组标题元素');
  assert.ok(html.includes('is-active'), '应有激活项类');
  assert.ok(html.includes('style="color:'), '激活项应有 accentToken 内联色');
  assert.ok(!html.includes('<script>'), '文本必须转义');
  assert.ok(html.includes('&lt;script&gt;'), '转义后文本可见');
});

test('code-block 渲染：语言标签/标题/代码行齐备，且无编辑器 chrome', () => {
  const html = renderTdonPreview(parsed({ layout: 'stack', nodes: [{ type: 'code-block', code: 'const a = 1;\n// 注释', lang: 'ts', title: 'demo.ts', accentToken: 'primary.600' }] }), THEME);
  assert.ok(html.includes('tdon-code-block'), '应有代码块容器');
  assert.ok(html.includes('>ts<'), '应有语言标签');
  assert.ok(html.includes('demo.ts'), '应含标题');
  assert.ok(html.includes('tdon-codeblock-row'), '应有代码行');
  assert.ok(!html.includes('tdon-code-status'), '不应出现编辑器状态栏 chrome');
});

test('callout 渲染：kind 类名 + 缺省语义色 + 显式 token 覆盖 + details 中性 + 转义', () => {
  const tip = renderTdonPreview(parsed({ layout: 'stack', nodes: [{ type: 'callout', kind: 'tip', title: '提示<script>', text: '正文' }] }), THEME);
  assert.ok(tip.includes('tdon-callout is-tip'), '应有 kind 类名');
  assert.ok(tip.includes('border-left-color:#'), '缺省 accent 应内联左边线色（语义组解析）');
  assert.ok(!tip.includes('<script>'), '标题必须转义');
  const custom = renderTdonPreview(parsed({ layout: 'stack', nodes: [{ type: 'callout', kind: 'tip', text: 'x', token: 'secondary.600' }] }), THEME);
  const sec = resolveTdonToken(THEME, 'secondary.600');
  assert.ok(custom.includes(`border-left-color:${sec.ok ? sec.value : ''}`), '显式 token 应覆盖缺省语义色');
  const details = renderTdonPreview(parsed({ layout: 'stack', nodes: [{ type: 'callout', kind: 'details', text: 'x' }] }), THEME);
  assert.ok(details.includes('is-details'), 'details 应有中性类名');
  assert.ok(!details.includes('border-left-color:#'), 'details 不应有语义 accent 内联色');
});

test('TDON_PREVIEW_CSS：新节点与两栏布局的类名随包分发', () => {
  for (const cls of ['tdon-tree', 'tdon-code-block', 'tdon-callout', 'tdon-aside', 'tdon-main', 'tdon-layout-sidebar-left']) {
    assert.ok(TDON_PREVIEW_CSS.includes(cls), `CSS 应包含 ${cls}`);
  }
});
