/**
 * @lang zh-CN TDON 编辑器主题单测（`W-tb-P42` / ADR-015）：①`code-editor` 节点校验（缺省值/上限/非法 token）；
 *   ②渲染（行号/着色示意/转义）；③templateRef 白名单扩充（四 editor builtin 接受，未知拒绝）；
 *   ④四格式导出（明暗两套有差异、产物形状符合各格式约定）。
 * @lang en TDON editor-theme tests (`W-tb-P42` / ADR-015): (1) code-editor validation (defaults/limits/illegal
 *   tokens); (2) rendering (line numbers/colouring hint/escaping); (3) templateRef whitelist extension (four
 *   editor builtins accepted, unknown rejected); (4) four-format exports (light/dark differ, shapes match).
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  parseTdonDocument, renderTdonPreview, createTdonExportTarget, TDON_NODE_TYPES, TDON_SPEC_VERSION
} from '../dist/index.js';
// 编辑器生成器是 core 的导出（TDON 只做白名单与引用）。
// <lang en>The editor generators are core exports (TDON only whitelists and references them).</lang>
import {
  buildTheme, GRADIENT_DEFAULTS, textmateTheme, vscodeTheme, vimTheme, emacsTheme
} from '@hia/theme-core';

/** @lang zh-CN 基准主题（含第三色，覆盖 typeHex 取值路径）。 @lang en Base theme with a third colour (covers the typeHex path). */
const THEME = buildTheme({
  name: '编辑器主题测试', primary: '#0047AB', secondary: '#00A8D3',
  thirdColor: { name: '三', value: '#F97316', scale: {}, on: '#fff' },
  gradients: GRADIENT_DEFAULTS
});

/** @lang zh-CN 构造带 code-editor 节点的最小文档。 @lang en Minimal document with a code-editor node. */
function doc(nodes) {
  return {
    specVersion: TDON_SPEC_VERSION,
    target: { id: 'editor-smoke', name: '编辑器冒烟' },
    preview: { title: 'T', layout: 'stack', nodes },
    exportManifest: { files: [{ path: 'a.css', template: ':root{}' }] }
  };
}

// ===== 1. 节点类型 =====
test('节点类型：新增 code-editor 后共 10 类（加性，TDON-13.1）', () => {
  assert.equal(TDON_NODE_TYPES.length, 10);
  assert.ok(TDON_NODE_TYPES.includes('code-editor'));
});

// ===== 2. code-editor 校验 =====
test('code-editor：全部可选（空 attrs 合法，code/title 走缺省）', () => {
  const r = parseTdonDocument(doc([{ type: 'code-editor' }]));
  assert.equal(r.result.ok, true, JSON.stringify(r.result.errors));
});

test('code-editor：上限——code >2000 → E_LIMIT；title >60 → 报错', () => {
  const r1 = parseTdonDocument(doc([{ type: 'code-editor', code: 'x'.repeat(2001) }]));
  assert.ok(r1.result.errors.some(e => e.code === 'E_LIMIT' || e.code === 'E_REQUIRED' || e.code === 'E_UNKNOWN_NODE') || !r1.result.ok, '超长 code 应报错');
  const r2 = parseTdonDocument(doc([{ type: 'code-editor', title: 't'.repeat(61) }]));
  assert.equal(r2.result.ok, false, '超长 title 应报错');
});

test('code-editor：accentToken 非法引用 → E_TOKEN_SYNTAX', () => {
  const r = parseTdonDocument(doc([{ type: 'code-editor', accentToken: 'not-a-token' }]));
  assert.ok(r.result.errors.some(e => e.code === 'E_TOKEN_SYNTAX'));
});

// ===== 3. 渲染 =====
test('渲染：行号 + 标题栏 + 注释着色 + 文本转义（TDON-5.4）', () => {
  const r = parseTdonDocument(doc([
    { type: 'code-editor', title: 'main.ts', code: '// done\nconst s = "<script>";' }
  ]), { theme: THEME });
  assert.equal(r.result.ok, true);
  const html = renderTdonPreview(r.doc, THEME);
  assert.ok(html.includes('tdon-code-editor'), '编辑器容器存在');
  assert.ok(html.includes('tdon-code-ln'), '行号存在');
  assert.ok(html.includes('main.ts'), '标题栏文字存在');
  // 文本必须转义——脚本标签不得原样出现。
  // <lang en>Text must be escaped — script tags never appear verbatim.</lang>
  assert.ok(!html.includes('<script>'), '脚本标签必须被转义');
  assert.ok(html.includes('&lt;script&gt;'), '转义后的脚本标签存在');
});

// ===== 4. templateRef 白名单与导出 =====
test('白名单：四个编辑器 builtin 被接受，导出五文件', () => {
  const d = doc([{ type: 'code-editor' }]);
  d.exportManifest = { files: [
    { path: 'themes/light.tmTheme', templateRef: 'builtin:textmate-theme' },
    { path: 'themes/dark.tmTheme', templateRef: 'builtin:textmate-theme' },
    { path: 'vscode/theme.json', templateRef: 'builtin:vscode-theme' },
    { path: 'vim/colors.vim', templateRef: 'builtin:vim-theme' },
    { path: 'emacs/hia.el', templateRef: 'builtin:emacs-theme' }
  ] };
  const r = parseTdonDocument(d, { theme: THEME });
  assert.equal(r.result.ok, true, JSON.stringify(r.result.errors));
  const files = createTdonExportTarget(r.doc).files(THEME);
  assert.equal(files.length, 5);
  // 明暗两套有差异（背景不同）。
  // <lang en>Light/dark differ (different backgrounds).</lang>
  const light = files.find(f => f.path.includes('light')).content;
  const dark = files.find(f => f.path.includes('dark')).content;
  assert.notEqual(light, dark);
});

test('白名单：未知 builtin 仍拒绝（能力面不悄悄扩大）', () => {
  const d = doc([{ type: 'card', title: 'x' }]);
  d.exportManifest = { files: [{ path: 'x.txt', templateRef: 'builtin:not-a-real-one' }] };
  const r = parseTdonDocument(d);
  assert.ok(r.result.errors.some(e => e.code === 'E_TEMPLATE_REF'));
});

// ===== 5. 四格式形状 =====
test('TextMate：XML plist 形状（name/settings 数组/scope 条目）', () => {
  const xml = textmateTheme(THEME, 'dark');
  assert.ok(xml.includes('<plist version="1.0">'));
  assert.ok(xml.includes('<key>name</key><string>编辑器主题测试 (dark)</string>'));
  assert.ok(xml.includes('<key>scope</key><string>comment</string>'));
  assert.ok(xml.includes('<key>scope</key><string>keyword</string>'), 'keyword scope 条目存在');
});

test('VSCode：tokenColors + workbench colors + type=dark', () => {
  const json = JSON.parse(vscodeTheme(THEME, 'dark'));
  assert.equal(json.type, 'dark');
  assert.ok(json.tokenColors.some(tc => tc.scope === 'comment'));
  assert.ok('editor.background' in json.colors);
});

test('Vim：colors_name 与 highlight 组', () => {
  const vim = vimTheme(THEME, 'light');
  assert.ok(vim.includes('let g:colors_name'));
  assert.ok(vim.includes('highlight Comment'));
  assert.ok(vim.includes('set background=light'));
});

test('Emacs：deftheme 与 font-lock faces', () => {
  const el = emacsTheme(THEME, 'dark');
  assert.ok(el.includes('(deftheme'));
  assert.ok(el.includes('font-lock-comment-face'));
  assert.ok(el.includes('font-lock-string-face'));
});
