/**
 * @lang zh-CN 浏览器端纯逻辑单测：归一化、语义识别、聚合。
 *   不依赖 DOM/Canvas；运行时解析器以命名色兜底验证。
 * @lang en Browser pure-logic tests: normalize, semantic, aggregate.
 *   DOM/Canvas-free; runtime parser fallback covered by named colors.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeBrowserColor, injectParseColor } from '../dist/browser/index.js';
import { resolveSemanticRole } from '../dist/browser/index.js';
import { aggregateEvidence } from '../dist/browser/index.js';

test('normalizeBrowserColor parses hex (3/4/6/8 digit)', ()=>{
  assert.equal(normalizeBrowserColor('#abc'),'#aabbcc');
  assert.equal(normalizeBrowserColor('#aabbcc'),'#aabbcc');
  // 8 位含 alpha：归一化丢弃 alpha 取 rgb。
  assert.equal(normalizeBrowserColor('#ff000080'),'#ff0000');
  assert.equal(normalizeBrowserColor('#f00'),'#ff0000');
});

test('normalizeBrowserColor parses rgb/rgba (int and percent)', ()=>{
  assert.equal(normalizeBrowserColor('rgb(255, 0, 0)'),'#ff0000');
  assert.equal(normalizeBrowserColor('rgba(0,128,0,0.5)'),'#008000');
  assert.equal(normalizeBrowserColor('rgb(100%, 0%, 0%)'),'#ff0000');
});

test('normalizeBrowserColor parses hsl', ()=>{
  assert.equal(normalizeBrowserColor('hsl(0, 100%, 50%)'),'#ff0000');
  assert.equal(normalizeBrowserColor('hsl(120, 100%, 50%)'),'#00ff00');
});

test('normalizeBrowserColor: invalid or transparent returns null', ()=>{
  assert.equal(normalizeBrowserColor('transparent'),null);
  assert.equal(normalizeBrowserColor('not-a-color'),null);
  assert.equal(normalizeBrowserColor('#xyz'),null);
});

test('injectParseColor overrides runtime parser (oklab/color())', ()=>{
  // 模拟页面端注入：把 oklab(...) 解析为不透明 sRGB。
  // <lang zh-CN>真实环境用 canvas/CSS 变量；此处用固定映射验证注入机制。</lang>
  // <lang en>Real env uses canvas/CSS vars; fixed map here proves injection works.</lang>
  injectParseColor((input)=> input.startsWith('oklab') ? '#123456' : null);
  assert.equal(normalizeBrowserColor('oklab(0.5 0.1 -0.1)'),'#123456');
  // 还原默认解析器，避免污染其它测试。
  injectParseColor((input)=>{ const k=input.trim().toLowerCase(); return k==='white'?'#FFFFFF':null; });
});

test('resolveSemanticRole: keyword priority over tag fallback', ()=>{
  assert.equal(resolveSemanticRole('btn-primary', 'div'),'primary');
  assert.equal(resolveSemanticRole('brand-logo', 'div'),'brand');
  assert.equal(resolveSemanticRole('card panel', 'section'),'surface');
  assert.equal(resolveSemanticRole('link external', 'span'),'link');
  // 状态色仅显式词命中。
  assert.equal(resolveSemanticRole('error-banner', 'div'),'status');
  // 无关键词走 tag。
  assert.equal(resolveSemanticRole('', 'a'),'link');
  assert.equal(resolveSemanticRole('', 'button'),'cta');
  assert.equal(resolveSemanticRole('', 'div'),'unknown');
});

test('resolveSemanticRole: status not by hue', ()=>{
  // 红色但无状态词 → 不判 status。
  assert.notEqual(resolveSemanticRole('promo', 'div'),'status');
});

test('aggregateEvidence: merges same color+source+role, sums count, caps tokens', ()=>{
  const raw=[
    { authorValue:'#ff0000', hex:'#ff0000', alpha:1, source:'computed-background', role:'primary', count:2, areaRatio:0.1, tokenName:'--brand', context:'a', selector:'.a' },
    { authorValue:'#ff0000', hex:'#ff0000', alpha:1, source:'computed-background', role:'primary', count:3, areaRatio:0.2, tokenName:'--brand2', context:'b', selector:'.b' },
    { authorValue:'#00ff00', hex:'#00ff00', alpha:1, source:'computed-text', role:'text', count:1 }
  ];
  const ev=aggregateEvidence(raw);
  assert.equal(ev.length,2);
  const red=ev.find(e=>e.hex==='#ff0000');
  assert.equal(red.count,5);                 // 频次求和
  assert.equal(red.areaRatio,0.2);           // 面积取 max
  assert.deepEqual(red.tokenNames,['--brand','--brand2']);
  assert.ok(red.contexts.includes('a')&&red.contexts.includes('b'));
});

test('aggregateEvidence: token cap at MAX_TOKENS (8)', ()=>{
  const raw=Array.from({length:12},(_,i)=>({ authorValue:'#000', hex:'#000000', alpha:1, source:'computed-background', role:'surface', tokenName:`--t${i}` }));
  const ev=aggregateEvidence(raw);
  assert.equal(ev.length,1);
  assert.ok(ev[0].tokenNames.length<=8);
});
