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
import { buildTheme, GRADIENT_DEFAULTS, generateAuxiliaryCandidates, tonalScale, bestOnColor } from '@hia/theme-core';
import { parseTdonDocument, renderTdonPreview, createTdonExportTarget, TDON_SPEC_VERSION } from '../dist/index.js';

/** @lang zh-CN 示例目录绝对路径。 @lang en Absolute path of the examples directory. */
const EX_DIR = join(dirname(fileURLToPath(import.meta.url)), '..', 'tdon-examples');
/** @lang zh-CN 读取并解析示例 JSON。 @lang en Read and parse an example JSON file. */
function load(name) {
  return JSON.parse(readFileSync(join(EX_DIR, name), 'utf8'));
}
/**
 * @lang zh-CN 基准主题：双色基底 + 由 core 候选生成的两个辅助槽（含真实色阶），
 *   使示例中的 `aux0` 引用可解析——示例本身按真实主题能力编写。
 * @lang en Base theme: dual-mode base plus two aux slots generated from core candidates (real scales),
 *   so the `aux0` reference in the examples resolves — examples are written against real theme capability.
 */
const BASE = buildTheme({ name: '示例主题', category: 'demo', industry: 'tech', primary: '#0047AB', secondary: '#00A8D3', gradients: GRADIENT_DEFAULTS });
const AUX = generateAuxiliaryCandidates(BASE, 'dual').slice(0, 2).map(c => ({
  name: c.name, value: c.hex, scale: tonalScale(c.hex), on: bestOnColor(c.hex).hex
}));
const THEME = { ...BASE, auxiliary: AUX };

test('三个合法示例全部通过校验并产出非空文件树', () => {
  for (const name of ['minimal.tdon.json', 'vitepress-docs.tdon.json', 'admin-dashboard.tdon.json']) {
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
  // alias 仅影响导出：导出的品牌变量应含真实色值。
  const files = createTdonExportTarget(res.doc).files(THEME);
  const css = files.find(f => f.path === '.vitepress/theme/hia-brand.css');
  assert.ok(css, '应产出品牌 CSS');
  assert.match(css.content, /--vp-c-brand: #[0-9a-f]{6}/i);
});

test('示例在无主题时也能通过结构校验（TDON-8.3 降级）', () => {
  for (const name of ['minimal.tdon.json', 'vitepress-docs.tdon.json', 'admin-dashboard.tdon.json']) {
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
  for (const name of ['minimal.tdon.json', 'vitepress-docs.tdon.json', 'admin-dashboard.tdon.json']) {
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
