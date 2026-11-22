// 传统色四源数据单测（W-tb-P17 扩充轮）。
import{test}from'node:test';
import assert from'node:assert/strict';
import{TRADITIONAL_COLORS}from'../dist/index.js';

test('传统色：总量 1800+，五文化源齐全且展示序 en→nbs→cn→ja→kr（W-tb-P50）', () => {
  assert.ok(TRADITIONAL_COLORS.length>=1800,'总量='+TRADITIONAL_COLORS.length);
  const order=[];const seen=new Set();
  for(const e of TRADITIONAL_COLORS){
    assert.ok(['en','nbs','cn','ja','kr'].includes(e.culture),'culture 合法：'+e.culture);
    if(!seen.has(e.culture)){seen.add(e.culture);order.push(e.culture);}
  }
  assert.deepEqual(order,['en','nbs','cn','ja','kr'],'展示序 en→nbs→cn→ja→kr，实际 '+order.join(','));
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

// `W-tb-P50` ISCC-NBS 267 色名（Centore 2016 Table 3 sRGB 质心）：
//   实测可入库 260 条（论文自述 7 类无 sRGB 点）；缺项白名单锁定，禁止"补全"臆造。
// <lang en>ISCC-NBS 267 names (Centore 2016 Table 3 centroids): 260 ingestible (the paper reports seven
//   categories with no sRGB points); the gap whitelist is locked so nobody "completes" them by invention.</lang>
test('ISCC-NBS：260 条入库、7 个缺失序号白名单锁定', () => {
  const nbs=TRADITIONAL_COLORS.filter(e=>e.culture==='nbs');
  assert.equal(nbs.length,260,'ISCC-NBS 条数='+nbs.length);
  const idx=nbs.map(e=>parseInt(e.id.replace('tc-nbs-',''),10)).sort((a,b)=>a-b);
  const missing=[];
  for(let i=1;i<=267;i++)if(!idx.includes(i))missing.push(i);
  assert.deepEqual(missing,[49,66,124,142,161,167,170],'缺失序号须与论文自述一致，实际 '+missing.join(','));
});

test('ISCC-NBS：抽样核对质心色值与论文（Vivid pink / Black / Dark greenish yellow）', () => {
  const by=n=>TRADITIONAL_COLORS.find(e=>e.culture==='nbs'&&e.nameEn===n);
  assert.equal(by('Vivid pink')?.hex,'#FD7992');
  assert.equal(by('Black')?.hex,'#2B292B');
  assert.equal(by('Dark greenish yellow')?.hex,'#9E953C');
  // 中文译名与英文名并存（不做留空）。
  // <lang en>Chinese renderings coexist with English names (never blanked).</lang>
  for(const e of TRADITIONAL_COLORS.filter(x=>x.culture==='nbs'))assert.ok(e.name.length>0,e.nameEn+' 缺中文名');
});
