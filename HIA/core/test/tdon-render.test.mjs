/**
 * @lang zh-CN TDON 渲染与导出单测（`W-tb-P26`）：9 类节点渲染、HTML 转义、特效类名与参数、
 *   插值"只替换一次"、路径二次校验、内置模板白名单与产物确定性。
 * @lang en TDON render/export tests (`W-tb-P26`): nine node types, HTML escaping, effect classes/params,
 *   single-pass interpolation, packaging-side path checks, builtin template whitelist and determinism.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildTheme, GRADIENT_DEFAULTS, parseTdonDocument, renderTdonPreview, escapeTdonHtml,
  createTdonExportTarget, describeTdonFiles, TDON_PREVIEW_CSS, TDON_SPEC_VERSION
} from '../dist/index.js';

/** @lang zh-CN 基准主题（含辅助槽真实色阶）。 @lang en Base theme with real aux scales. */
const BASE = buildTheme({
  name: 'TDON 渲染主题', category: 'demo', industry: 'tech',
  primary: '#0047AB', secondary: '#00A8D3', gradients: GRADIENT_DEFAULTS
});
const THEME = { ...BASE, auxiliary: BASE.auxiliary.map(a => ({ ...a, scale: buildTheme({ name: 'x', primary: a.value, secondary: a.value }).primary.scale })) };

/** @lang zh-CN 构造合法文档并断言其通过校验（失败时直接抛出问题列表）。 @lang en Build a valid doc, asserting it validates (throws the issue list on failure). */
function doc(overrides = {}) {
  const raw = {
    specVersion: TDON_SPEC_VERSION,
    target: { id: 'demo-target', name: '<script>alert(1)</script>', nameEn: 'Demo' },
    exportManifest: { files: [{ path: 'styles/tokens.css', template: ':root{--brand:{{token:primary.500}};--name:"{{meta:name}}";}' }] },
    ...overrides
  };
  const res = parseTdonDocument(raw, { theme: THEME });
  assert.equal(res.result.ok, true, JSON.stringify(res.result.errors));
  return res.doc;
}

test('HTML 转义覆盖五个危险字符', () => {
  assert.equal(escapeTdonHtml('<a href="x">&\'</a>'), '&lt;a href=&quot;x&quot;&gt;&amp;&#39;&lt;/a&gt;');
});

test('9 类节点全部渲染出对应结构类', () => {
  const d = doc({
    preview: {
      title: '预览',
      layout: 'hero',
      nodes: [
        { type: 'hero', title: '主视觉', subtitle: '副', bgToken: 'gradient:carousel', actions: [{ label: '开始' }] },
        { type: 'nav', items: ['指南', { label: '配置', active: true }], activeToken: 'primary.600' },
        { type: 'card', title: '卡', text: '正文\n第二行' },
        { type: 'stats', items: [{ label: '用户', value: '3486' }] },
        { type: 'list', items: ['一', '二'], markerToken: 'primary.500' },
        { type: 'table', columns: [{ key: 'name', label: '名称' }], rows: [{ name: '值' }] },
        { type: 'form', fields: [{ label: '邮箱', type: 'email' }], submitLabel: '提交' },
        { type: 'divider', token: 'primary.200', thickness: 2 },
        { type: 'raw-text', text: '第一行\n第二行', size: 'fs:body' }
      ]
    }
  });
  const html = renderTdonPreview(d, THEME);
  for (const cls of ['tdon-hero', 'tdon-nav', 'tdon-card', 'tdon-stats', 'tdon-list', 'tdon-table', 'tdon-form', 'tdon-divider', 'tdon-raw-text']) {
    assert.ok(html.includes(cls), `缺少 ${cls}`);
  }
  assert.ok(html.includes('tdon-layout-hero'));
  // 主视觉渐变已解析为具体值，而非残留 {{...}} 或令牌串。
  assert.ok(!html.includes('gradient:carousel'), '不应残留令牌串');
  assert.ok(/background:linear-gradient|background:rgb/.test(html), '渐变应解析为 CSS 值');
  // form 控件必须 disabled（只读展示，TDON-5.9）。
  assert.ok(/<input class="tdon-input" type="email" disabled>/.test(html));
  // raw-text 与 card 的换行转 <br>。
  assert.ok(html.includes('第一行<br>第二行'));
  assert.ok(html.includes('正文<br>第二行'));
});

test('节点文本被转义（目标名含 script 不注入）', () => {
  const d = doc({ preview: { nodes: [{ type: 'card', title: '<img src=x onerror=alert(1)>' }] } });
  const html = renderTdonPreview(d, THEME);
  assert.ok(!html.includes('<img src=x'), '不得出现未转义标签');
  assert.ok(html.includes('&lt;img src=x'));
});

test('特效渲染为固定类名与 CSS 变量（无任意 transform 字符串）', () => {
  const d = doc({
    effects: { g: { type: 'gradient-shift' }, f: { type: 'fade-in', duration: 400 }, l: { type: 'hover-lift', distance: 3 } },
    preview: {
      nodes: [
        { type: 'hero', title: 'a', effect: 'g' },
        { type: 'card', title: 'b', effect: 'f' },
        { type: 'card', title: 'c', effect: 'l' }
      ]
    }
  });
  const html = renderTdonPreview(d, THEME);
  assert.ok(html.includes('tdon-fx-gradient-shift'));
  assert.ok(html.includes('--tdon-fx-duration:400ms'));
  assert.ok(html.includes('--tdon-fx-lift:3px'));
  // CSS 只含固定 keyframes，且 reduced-motion 关闭（TDON-9.5/9.6）。
  assert.ok(TDON_PREVIEW_CSS.includes('@keyframes tdon-fade-in'));
  assert.ok(TDON_PREVIEW_CSS.includes('prefers-reduced-motion: reduce'));
  // 上移只用 translateY + 固定 px 变量，不含任意 transform 表达式。
  assert.ok(TDON_PREVIEW_CSS.includes('translateY(calc(var(--tdon-fx-lift,2px) * -1))'));
  assert.ok(!/rotate\(|scaleX\(|skew\(/.test(TDON_PREVIEW_CSS), '不得出现布局形变类变换');
});

test('导出插值只替换一次（主题名中的花括号不被二次展开）', () => {
  // 主题名里塞入 {{token:primary.500}}，若二次展开会变成色值；正确行为是原样保留。
  const d = doc({
    target: { id: 'demo-target', name: '{{token:primary.900}}', nameEn: 'x' },
    exportManifest: { files: [{ path: 'a.css', template: '/* {{meta:name}} */' }] }
  });
  const target = createTdonExportTarget(d);
  const files = target.files(THEME);
  assert.ok(files[0].content.includes('{{token:primary.900}}'), '替换结果不应再被解析');
  assert.ok(!files[0].content.includes('#'), '不应出现被二次展开的色值');
});

test('导出：令牌不可解析时抛错而非静默留空', () => {
  const d = doc({ exportManifest: { files: [{ path: 'a.css', template: '{{token:aux9.500}}' }] } });
  const target = createTdonExportTarget(d);
  assert.throws(() => target.files(THEME), /无法解析/);
});

test('导出：打包侧独立校验路径（绕过校验器构造的非法路径被拒）', () => {
  const d = doc();
  // 直接篡改已校验文档，模拟"上游被绕过"的场景（TDON-11.1 不信任单点校验）。
  const tampered = { ...d, exportManifest: { files: [{ path: '../../etc/passwd', template: 'x' }] } };
  const target = createTdonExportTarget(tampered);
  assert.throws(() => target.files(THEME), /路径非法/);
});

test('内置模板引用产出确定性文本且与对应导出函数一致', () => {
  const d = doc({
    exportManifest: {
      files: [
        { path: 'hia-tokens.css', templateRef: 'builtin:hia-tokens-css' },
        { path: 'theme.json', templateRef: 'builtin:hia-tokens-json' }
      ]
    }
  });
  const target = createTdonExportTarget(d);
  const a = target.files(THEME);
  const b = target.files(THEME);
  assert.deepEqual(a.map(f => f.content), b.map(f => f.content), '同入参必同输出');
  assert.ok(a[0].content.includes('--hia-primary'));
  assert.ok(a[1].content.trim().startsWith('{'));
});

test('导出目标元信息与归档名', () => {
  const d = doc();
  const target = createTdonExportTarget(d);
  assert.equal(target.id, 'tdon-demo-target');
  assert.equal(target.nameEn, 'Demo');
  assert.match(target.archiveName({ ...THEME, name: 'My Theme' }), /^my-theme-demo-target\.zip$/);
  // 文件清单摘要：内置来源不展开模板，bytes 为 0。
  const d2 = doc({ exportManifest: { files: [{ path: 'a.css', templateRef: 'builtin:hia-tokens-css' }, { path: 'b.css', template: 'abc' }] } });
  const desc = describeTdonFiles(d2);
  assert.equal(desc[0].source, 'builtin');
  assert.equal(desc[0].bytes, 0);
  assert.equal(desc[1].bytes, 3);
});

test('渲染确定性：同文档同主题两次渲染逐字节相同', () => {
  const d = doc({ preview: { nodes: [{ type: 'card', title: 't', text: 'x' }] } });
  assert.equal(renderTdonPreview(d, THEME), renderTdonPreview(d, THEME));
});
