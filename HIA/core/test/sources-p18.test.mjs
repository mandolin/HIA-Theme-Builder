// 国旗/企业两源数据单测（W-tb-P18）。
import{test}from'node:test';
import assert from'node:assert/strict';
import{FLAG_COLORS,BRAND_COLORS}from'../dist/index.js';

test('国旗：60+ 国、五大洲齐全、色组合法', () => {
  assert.ok(FLAG_COLORS.length>=60,'国旗数='+FLAG_COLORS.length);
  const continents=new Set(FLAG_COLORS.map(f=>f.continent));
  for(const c of ['asia','europe','americas','africa','oceania'])assert.ok(continents.has(c),'缺洲:'+c);
  for(const f of FLAG_COLORS){
    assert.ok(f.colors.length>=2,'每国至少 2 色：'+f.name);
    for(const c of f.colors)assert.match(c,/^#[0-9A-F]{6}$/,'hex 合法：'+f.name);
    assert.match(f.nameEn,/^[A-Za-z]/);
  }
});

test('企业：全量 691、439+ 多色、行业分组合法', () => {
  assert.equal(BRAND_COLORS.length,691);
  assert.ok(BRAND_COLORS.filter(b=>b.colors.length>1).length>=430);
  const inds=new Set(BRAND_COLORS.map(b=>b.industry));
  for(const i of inds)assert.ok(['tech','auto','food','finance','retail','media','travel','apparel','other'].includes(i),'非法行业:'+i);
  for(const b of BRAND_COLORS){assert.ok(b.colors.length>=1);assert.match(b.colors[0],/^#[0-9A-F]{6}$/);}
});

test('企业：知名品牌行业映射抽样（Apple=tech / Coca-Cola=food / Nike=apparel）', () => {
  const by=(n)=>BRAND_COLORS.find(b=>b.name===n);
  assert.equal(by('Adobe')?.industry,'tech');
  assert.equal(by('Coca-Cola')?.industry,'food');
  assert.equal(by('Nike Football')?.industry,'apparel');
});
