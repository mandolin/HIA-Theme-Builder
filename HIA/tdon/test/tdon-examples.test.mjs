/**
 * @lang zh-CN TDON 示例文件集成测试（`W-tb-P26`）：直接消费 `tdon-examples/` 下的真实 JSON，
 *   验证三个合法示例端到端可用（校验 → 渲染 → 导出），并按文件名断言每个反例的目标错误码。
 *   该测试的价值在于：示例文件即文档，测试保证"文档里写的用法真的能跑"。
 * @lang en TDON example integration tests (`W-tb-P26`): consume the real JSON under `tdon-examples/`,
 *   verifying the three valid examples work end to end (validate → render → export) and asserting each
 *   counterexample's target code by filename. The point: examples are documentation, and tests prove the
 *   documented usage actually runs.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { buildTheme, GRADIENT_DEFAULTS, generateAuxiliaryCandidates, tonalScale, bestOnColor, deriveSemanticTokens } from '@hia/theme-core';
import { parseTdonDocument, renderTdonPreview, createTdonExportTarget, TDON_SPEC_VERSION } from '../dist/index.js';

/** @lang zh-CN 示例目录绝对路径。 @lang en Absolute path of the examples directory. */
const EX_DIR = join(dirname(fileURLToPath(import.meta.url)), '..', 'tdon-examples');
/** @lang zh-CN 读取并解析示例 JSON。 @lang en Read and parse an example JSON file. */
function load(name) {
  return JSON.parse(readFileSync(join(EX_DIR, name), 'utf8'));
}
/**
 * @lang zh-CN 基准主题：双色基底 + 由 core 候选生成的两个辅助槽（含真实色阶）+ 派生语义状态组，
 *   使示例中的 `aux0` 与语义角色（`success.*` 等，ADR-019）引用可解析——示例本身按真实主题能力编写
 *   （应用内主题自 `W-tb-P37` 起默认派生语义组）。
 * @lang en Base theme: dual-mode base plus two aux slots from core candidates (real scales) and the derived
 *   semantic group, so `aux0` and semantic references (`success.*`, ADR-019) resolve — examples are written
 *   against real theme capability (in-app themes have derived semantics by default since `W-tb-P37`).
 */
const BASE = buildTheme({ name: '示例主题', category: 'demo', industry: 'tech', primary: '#0047AB', secondary: '#00A8D3', gradients: GRADIENT_DEFAULTS });
const AUX = generateAuxiliaryCandidates(BASE, 'dual').slice(0, 2).map(c => ({
  name: c.name, value: c.hex, scale: tonalScale(c.hex), on: bestOnColor(c.hex).hex
}));
const THEME = { ...BASE, auxiliary: AUX, semantic: deriveSemanticTokens(BASE.primary.value) };

test('三个合法示例全部通过校验并产出非空文件树', () => {
  // wordpress-child（T-tb-TDON-P1 第二目标端）同样纳入"开箱即用"口径。
  // <lang en>wordpress-child (T-tb-TDON-P1 second target) joins the out-of-the-box contract.</lang>
  for (const name of ['minimal.tdon.json', 'vitepress-docs.tdon.json', 'admin-dashboard.tdon.json', 'vscode-workbench.tdon.json', 'wordpress-child.tdon.json']) {
    const raw = load(name);
    assert.equal(raw.specVersion, TDON_SPEC_VERSION, `${name} 版本串应为当前规范版本`);
    const res = parseTdonDocument(raw, { theme: THEME });
    assert.equal(res.result.ok, true, `${name}: ${JSON.stringify(res.result.errors)}`);
    // 有预览则渲染非空；所有示例都必须能导出。
    if (res.doc.preview) {
      const html = renderTdonPreview(res.doc, THEME);
      assert.ok(html.length > 0, `${name} 预览为空`);
      assert.ok(!html.includes('{{'), `${name} 预览残留未解析插值`);
    }
    const files = createTdonExportTarget(res.doc).files(THEME);
    assert.ok(files.length >= 1, `${name} 导出为空`);
    for (const f of files) {
      assert.ok(f.content.length > 0, `${name}/${f.path} 内容为空`);
      assert.ok(!f.content.includes('{{token:'), `${name}/${f.path} 残留未解析令牌`);
    }
  }
});

test('vitepress-docs：三页全貌（home/docs/config）+ 页引用 + 导出覆盖真实 VP 目录', () => {
  const raw = load('vitepress-docs.tdon.json');
  const res = parseTdonDocument(raw, { theme: THEME });
  assert.equal(res.result.ok, true, JSON.stringify(res.result.errors));
  const doc = res.doc;
  // 多页结构（ADR-020）：三页 + 页序（home 落地）+ 文档级 layout。
  assert.equal(doc.preview.layout, 'sidebar-left');
  assert.deepEqual(doc.preview.pages.map(p => p.id), ['home', 'docs', 'config']);
  // docs 页（pages[1]）含三类签名节点；页引用挂在 tree/nav/hero。
  const types = doc.preview.pages[1].nodes.map(n => n.type);
  for (const t of ['tree', 'code-block', 'callout', 'nav']) {
    assert.ok(types.includes(t), `docs 页应含 ${t} 节点（VitePress 文档页签名元素）`);
  }
  // 落地页缺省渲染（hero + page 引用）；docs 页两栏结构。
  const landing = renderTdonPreview(doc, THEME);
  assert.ok(landing.includes('tdon-hero'), '落地页应渲染 hero');
  assert.ok(landing.includes('data-tdon-page="docs"'), '落地页 action 应挂页引用');
  const docsHtml = renderTdonPreview(doc, THEME, { page: 'docs' });
  assert.ok(docsHtml.includes('tdon-aside') && docsHtml.includes('tdon-main'), 'docs 页应输出两栏结构');
  assert.ok(docsHtml.includes('data-tdon-page="home"'), '侧栏/导航应挂页引用');
  // 导出：覆盖真实 VitePress 主题扩展目录（npm create vitepress 默认 srcDir=docs）。
  const files = createTdonExportTarget(doc).files(THEME);
  const paths = files.map(f => f.path);
  for (const p of ['docs/.vitepress/theme/index.ts', 'docs/.vitepress/theme/custom.css', 'docs/HIA-THEME-INSTALL.md']) {
    assert.ok(paths.includes(p), `导出应含 ${p}`);
  }
  // 核心交付物 custom.css：亮/暗两段 + 品牌/语义容器/按钮/Hero/侧栏功能组全覆盖。
  const css = files.find(f => f.path === 'docs/.vitepress/theme/custom.css')?.content ?? '';
  assert.ok(css.includes('html.dark'), 'custom.css 应含暗色段（html.dark）');
  for (const group of ['--vp-c-brand-1', '--vp-custom-block-tip-bg', '--vp-button-brand-bg', '--vp-home-hero-name-background', '--vp-sidebar-bg-color', '--vp-font-family-base']) {
    assert.ok(css.includes(group), `custom.css 应覆盖 ${group}`);
  }
  // 插值完成：不残留未解析占位。
  assert.ok(!css.includes('{{token:'), 'custom.css 不应残留未解析令牌');
  assert.ok(!css.includes('{{meta:'), '导出文件不应残留未解析 meta');
});

test('反例文件按文件名命中目标错误码', () => {
  // 文件名 → 期望码（单一主因，避免多错误互相掩盖）。
  const expectations = {
    'bad-version.tdon.json': 'E_VERSION',
    'bad-unknown-key.tdon.json': 'E_UNKNOWN_KEY',
    'bad-path-traversal.tdon.json': 'E_BAD_PATH',
    'bad-template-conflict.tdon.json': 'E_CONFLICT',
    'bad-template-ref.tdon.json': 'E_TEMPLATE_REF',
    'bad-interp.tdon.json': 'E_INTERP',
    'bad-node-type.tdon.json': 'E_ENUM',
    'bad-token-syntax.tdon.json': 'E_TOKEN_SYNTAX',
    'bad-effect-range.tdon.json': 'E_EFFECT_RANGE',
    'bad-proto-pollution.tdon.json': 'E_BAD_KEY'
  };
  const files = readdirSync(join(EX_DIR, 'invalid'));
  assert.deepEqual([...files].sort(), Object.keys(expectations).sort(), '反例清单与断言表须一一对应');
  for (const [name, code] of Object.entries(expectations)) {
    const res = parseTdonDocument(load(join('invalid', name)), { theme: THEME });
    assert.equal(res.result.ok, false, `${name} 应校验失败`);
    assert.ok(res.result.errors.some(e => e.code === code), `${name} 期望 ${code}，实际 ${JSON.stringify(res.result.errors.map(e => e.code))}`);
  }
});

test('示例中的 alias 与预览令牌都能在当前主题解析', () => {
  const res = parseTdonDocument(load('vitepress-docs.tdon.json'), { theme: THEME });
  assert.equal(res.result.ok, true, JSON.stringify(res.result.errors));
  // alias 仅影响导出：导出的品牌变量应含真实色值（ADR-019 起品牌映射集中在 custom.css）。
  const files = createTdonExportTarget(res.doc).files(THEME);
  const css = files.find(f => f.path === 'docs/.vitepress/theme/custom.css');
  assert.ok(css, '应产出品牌 CSS');
  assert.match(css.content, /--vp-c-brand: #[0-9a-f]{6}/i);
});

test('示例在无主题时也能通过结构校验（TDON-8.3 降级）', () => {
  for (const name of ['minimal.tdon.json', 'vitepress-docs.tdon.json', 'admin-dashboard.tdon.json', 'vscode-workbench.tdon.json', 'wordpress-child.tdon.json']) {
    const res = parseTdonDocument(load(name));
    assert.equal(res.result.ok, true, `${name} 无主题时应只做结构校验: ${JSON.stringify(res.result.errors)}`);
  }
});

test('示例在"默认主题"（无辅助色/无第三色）下必须可直接连接', () => {
  // 官方示例的验收标准是"开箱可用"：用户新建一个最简主题后点开示例就该成功。
  //   plain 主题不带 auxiliary/thirdColor，任何引用它们的示例都会 E_TOKEN_UNRESOLVED——
  //   这正是此前 vitepress 示例声明 aux0 时暴露的问题（只有带辅助槽的测试主题才过得去）。
  // <lang en>Official examples must work out of the box: with a bare theme (no aux/third), connecting
  //   should just succeed. Any example referencing them fails here — exactly the bug the aux0 declaration hid.</lang>
  const plain = buildTheme({ name: '最简主题', primary: '#0047AB', secondary: '#00A8D3', gradients: GRADIENT_DEFAULTS });
  assert.equal(plain.auxiliary.length, 0, '默认主题不应自带辅助槽');
  assert.equal(plain.thirdColor, undefined, '默认主题不应自带第三色');
  // vscode-workbench 不在此清单：ANSI/tokenColors 语义色引用需要主题含语义组（ADR-012，应用内默认派生），
  //   而 VS Code theme JSON 的 colors 为纯色值不吃 var()，无回退手段——前提见示例 README。
  // <lang en>vscode-workbench excluded here: its semantic refs need the derived semantic group (ADR-012,
  //   default in-app), and VS Code theme JSON takes literal colours only (no var() fallback). See README.</lang>
  for (const name of ['minimal.tdon.json', 'vitepress-docs.tdon.json', 'admin-dashboard.tdon.json', 'wordpress-child.tdon.json']) {
    const res = parseTdonDocument(load(name), { theme: plain });
    assert.equal(res.result.ok, true, `${name} 在默认主题下应通过: ${JSON.stringify(res.result.errors)}`);
    // 预览必须真的渲染出内容，而不是"校验通过但一片空白"。
    // <lang zh-CN>同时确认没有残留未解析的插值。</lang>
    // <lang en>Also confirms no unresolved interpolation remains.</lang>
    if (res.doc.preview) {
      const html = renderTdonPreview(res.doc, plain);
      assert.ok(html.length > 500, `${name} 默认主题下预览过短`);
      assert.ok(!html.includes('{{'), `${name} 预览残留插值`);
    }
    const files = createTdonExportTarget(res.doc).files(plain);
    for (const f of files) assert.ok(!f.content.includes('{{token:'), `${name}/${f.path} 残留令牌`);
  }
});
