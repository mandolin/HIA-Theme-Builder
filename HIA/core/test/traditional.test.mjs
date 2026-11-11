// 传统色四源数据单测（W-tb-P17 扩充轮）。
import{test}from'node:test';
import assert from'node:assert/strict';
import{TRADITIONAL_COLORS}from'../dist/index.js';

test('传统色：总量 1600+，四文化源齐全且展示序 en→cn→ja→kr', () => {
  assert.ok(TRADITIONAL_COLORS.length>=1600,'总量='+TRADITIONAL_COLORS.length);
  const order=[];const seen=new Set();
  for(const e of TRADITIONAL_COLORS){
    assert.ok(['en','cn','ja','kr'].includes(e.culture),'culture 合法：'+e.culture);
    if(!seen.has(e.culture)){seen.add(e.culture);order.push(e.culture);}
  }
  assert.deepEqual(order,['en','cn','ja','kr'],'展示序 en→cn→ja→kr，实际 '+order.join(','));
});

test('传统色：id 唯一、hex 合法、nameEn 全覆盖（英文起始）', () => {
  const ids=new Set();
  for(const e of TRADITIONAL_COLORS){
    assert.ok(!ids.has(e.id),'id 唯一：'+e.id);ids.add(e.id);
    assert.match(e.hex,/^#[0-9A-F]{6}$/);
    assert.match(e.nameEn,/^[A-Za-z]/,'nameEn 英文起始：'+e.name+'→'+e.nameEn);
    assert.match(e.bucket,/^(红|橙|黄|绿|青|蓝|紫|品红\/桃|白\/中性|灰\/中性|黑\/中性)$/);
  }
});

test('传统色：各源代表色存在（CSS Aliceblue/中国妃色/日本瑠璃色/韩国 Cheong）', () => {
  assert.ok(TRADITIONAL_COLORS.some(e=>e.culture==='en'&&e.nameEn==='Aliceblue'));
  assert.ok(TRADITIONAL_COLORS.some(e=>e.culture==='cn'&&e.name==='妃色'&&e.nameEn==='Imperial Red'));
  assert.ok(TRADITIONAL_COLORS.some(e=>e.culture==='ja'&&e.name==='瑠璃色'&&e.nameEn.startsWith('Ruri')));
  assert.ok(TRADITIONAL_COLORS.some(e=>e.culture==='kr'&&e.nameEn==='Cheong (Blue-Green)'));
});
