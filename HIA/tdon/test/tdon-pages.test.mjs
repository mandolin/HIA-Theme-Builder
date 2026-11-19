/**
 * @lang zh-CN TDON 多页预览单测（`T-tb-TDON-P1` / ADR-020 / TDON-5.20~5.23）：覆盖 pages 声明与互斥、
 *   页 id 唯一性与语法、page 引用存在性（E_PAGE_REF）、渲染页选择（opts.page / 首页缺省 / 页级 layout
 *   覆盖）、data-tdon-page 输出与跨页特效引用检查。断言以错误码与 DOM 结构特征为准。
 * @lang en TDON multi-page tests (`T-tb-TDON-P1` / ADR-020 / TDON-5.20~5.23): pages declaration and
 *   exclusivity, page id uniqueness/grammar, reference existence (E_PAGE_REF), render page selection
 *   (opts.page / landing default / per-page layout), data-tdon-page output and cross-page effect checks.
 *   Assertions key on codes and DOM structure.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { buildTheme, GRADIENT_DEFAULTS, deriveSemanticTokens } from '@hia/theme-core';
import { parseTdonDocument, renderTdonPreview, TDON_SPEC_VERSION } from '../dist/index.js';

const BASE = buildTheme({ name: '多页主题', category: 'demo', industry: 'tech', primary: '#0047AB', secondary: '#00A8D3', gradients: GRADIENT_DEFAULTS });
const THEME = { ...BASE, semantic: deriveSemanticTokens(BASE.primary.value) };

/** @lang zh-CN 最小合法页节点（一个 raw-text）。 @lang en Minimal valid page node (one raw-text). */
const textNode = (t) => ({ type: 'raw-text', text: t });

/** @lang zh-CN 构造带 pages 的最小文档（可覆写 preview）。 @lang en Build a minimal pages doc (preview overridable). */
function makePagesDoc(previewOverride) {
  return {
    specVersion: TDON_SPEC_VERSION,
    target: { id: 'demo-multi', name: '多页演示', nameEn: 'Multi Demo' },
    exportManifest: { files: [{ path: 'tokens.css', template: ':root{--b:{{token:primary.500}};}' }] },
    preview: previewOverride ?? {
      title: '多页演示',
      layout: 'sidebar-left',
      pages: [
        { id: 'home', title: '首页', layout: 'stack', nodes: [{ type: 'hero', title: '主视觉', actions: [{ label: '进入', page: 'docs' }] }] },
        { id: 'docs', title: '文档页', nodes: [
          { type: 'tree', accentToken: 'primary.700', sections: [
            { label: '指南', items: [{ label: '介绍', active: true }, { label: '首页', page: 'home' }] }
          ] },
          { type: 'nav', items: [{ label: 'HIA Docs', page: 'home' }, { label: '文档', active: true }] },
          textNode('正文')
        ] }
      ]
    }
  };
}
function parse(raw, theme = THEME) { return parseTdonDocument(raw, { theme }); }

test('pages：合法多页文档通过校验，页序与归一化正确', () => {
  const res = parse(makePagesDoc());
  assert.equal(res.result.ok, true, JSON.stringify(res.result.errors));
  const pages = res.doc.preview.pages;
  assert.equal(pages.length, 2);
  assert.equal(pages[0].id, 'home');       // 首页 = 数组首位（落地页）
  assert.deepEqual(pages[0].nodes[0].attrs.actions, [{ label: '进入', page: 'docs' }]);
  // 页级 layout 覆盖文档级：home 页 stack，docs 页继承文档级 sidebar-left（未声明时不出键）。
  assert.equal(pages[0].layout, 'stack');
  assert.equal(pages[1].layout, undefined);
});

test('pages：nodes 与 pages 同给 → E_CONFLICT', () => {
  const doc = makePagesDoc();
  doc.preview.nodes = [textNode('多余')];
  const res = parse(doc);
  assert.equal(res.result.ok, false);
  assert.ok(res.result.errors.some(e => e.code === 'E_CONFLICT'));
});

test('pages：重复页 id → E_CONFLICT', () => {
  const doc = makePagesDoc();
  doc.preview.pages[1].id = 'home';
  const res = parse(doc);
  assert.ok(res.result.errors.some(e => e.code === 'E_CONFLICT'), JSON.stringify(res.result.errors));
});

test('pages：页 id 语法非法 → E_PATTERN；页数上限 16', () => {
  const doc = makePagesDoc();
  doc.preview.pages[0].id = 'Home_Page';
  const r1 = parse(doc);
  assert.ok(r1.result.errors.some(e => e.code === 'E_PATTERN'), JSON.stringify(r1.result.errors));
  const doc2 = makePagesDoc();
  doc2.preview.pages = Array.from({ length: 17 }, (_, i) => ({ id: `p${i}`, nodes: [textNode('x')] }));
  const r2 = parse(doc2);
  assert.ok(r2.result.errors.some(e => e.code === 'E_LIMIT'), JSON.stringify(r2.result.errors));
});

test('page 引用：未声明页 → E_PAGE_REF；单页文档出现引用 → E_PAGE_REF', () => {
  // 直接改原始 JSON 形状（attrs 是校验后产物，不应反向修改）。
  const raw = makePagesDoc();
  raw.preview.pages[1].nodes[0].sections[0].items[1] = { label: '不存在', page: 'ghost' };
  const r1 = parse(raw);
  assert.ok(r1.result.errors.some(e => e.code === 'E_PAGE_REF'), JSON.stringify(r1.result.errors));
  // 单页文档（nodes）中出现 page 引用：pageIds 为空集，同样 E_PAGE_REF。
  const single = {
    specVersion: TDON_SPEC_VERSION,
    target: { id: 'demo-single', name: '单页', nameEn: 'Single' },
    exportManifest: { files: [{ path: 'tokens.css', template: ':root{}' }] },
    preview: { layout: 'stack', nodes: [{ type: 'nav', items: [{ label: '链接', page: 'nowhere' }] }] }
  };
  const r2 = parse(single);
  assert.ok(r2.result.errors.some(e => e.code === 'E_PAGE_REF'), JSON.stringify(r2.result.errors));
});

test('渲染：缺省渲染首页；opts.page 选页；页级 layout 覆盖生效', () => {
  const doc = parse(makePagesDoc()).doc;
  const landing = renderTdonPreview(doc, THEME);
  assert.ok(landing.includes('tdon-layout-stack'), '缺省应渲染首页（stack）');
  assert.ok(landing.includes('主视觉'), '首页应含 hero');
  const docs = renderTdonPreview(doc, THEME, { page: 'docs' });
  assert.ok(docs.includes('tdon-layout-sidebar-left'), 'docs 页继承文档级 sidebar-left');
  assert.ok(docs.includes('正文'), 'docs 页应含正文');
  // data-tdon-page + tdon-link：tree 项与 nav 项输出导航属性。
  assert.ok(docs.includes('data-tdon-page="home"'), '应输出页引用属性');
  assert.ok(docs.includes('tdon-link'), '应输出 tdon-link 类');
  // 未知页回退首页。
  const fallback = renderTdonPreview(doc, THEME, { page: 'ghost' });
  assert.ok(fallback.includes('主视觉'), '未知页应回退首页');
});

test('跨页特效引用：页2 可用文档级 effects；未声明特效在第二页仍报 E_EFFECT_UNKNOWN', () => {
  const raw = makePagesDoc();
  raw.effects = { fade: { type: 'fade-in', duration: 300 } };
  raw.preview.pages[1].nodes.push({ type: 'card', title: '卡', effect: 'fade' });
  const ok = parse(raw);
  assert.equal(ok.result.ok, true, JSON.stringify(ok.result.errors));
  // 特效引用检查仅在 effects 段存在时运行（既有语义）——坏例需带 effects 段。
  const raw2 = makePagesDoc();
  raw2.effects = { fade: { type: 'fade-in', duration: 300 } };
  raw2.preview.pages[1].nodes.push({ type: 'card', title: '卡', effect: 'ghost-fx' });
  const bad = parse(raw2);
  assert.ok(bad.result.errors.some(e => e.code === 'E_EFFECT_UNKNOWN'), JSON.stringify(bad.result.errors));
});

test('结构校验（无主题）：pages 文档可过——页 id 集合与主题无关', () => {
  const res = parseTdonDocument(makePagesDoc());
  assert.equal(res.result.ok, true, JSON.stringify(res.result.errors));
});
