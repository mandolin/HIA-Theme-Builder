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

test('企业：全量 715（691 全量+P46 扩充 24）、440+ 多色、行业分组合法', () => {
  assert.equal(BRAND_COLORS.length,715);
  assert.ok(BRAND_COLORS.filter(b=>b.colors.length>1).length>=440);
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

// `W-tb-P46` country 维度（维护者截图指示：企业视图按行业/国家切换）：
//   ①country 枚举合法（ISO alpha-2 小写 + multi）；②首批覆盖≥340 条且非 other 行业全有标注；
//   ③国家分组非空可渲染（国家视图不会出现空组——UI 取交集保证，此处锁数据面）；
//   ④抽样核对（Adobe=us / Canon=jp / Adidas=de / Skype=multi）。
// <lang en>`W-tb-P46` country dimension (maintainer's screenshot request): (1) enum legality
//   (ISO alpha-2 lowercase + multi); (2) first batch covers ≥340 entries and ALL non-other industries;
//   (3) country groups render non-empty (UI intersects with data; this locks the data side);
//   (4) spot checks (Adobe=us / Canon=jp / Adidas=de / Skype=multi).</lang>
test('企业：country 枚举合法且首批覆盖≥340', () => {
  const LEGAL=new Set(['us','ca','mx','br','gb','ie','fr','de','nl','be','ch','at','es','it','se','no','fi','dk','cz','ru','pl','il','ir','pk','jp','kr','cn','sg','in','au','nz','multi']);
  const withCountry=BRAND_COLORS.filter(b=>b.country);
  assert.ok(withCountry.length>=340,'首批覆盖不足：'+withCountry.length);
  for(const b of withCountry)assert.ok(LEGAL.has(b.country),'非法 country：'+b.name+'='+b.country);
  const nonOther=BRAND_COLORS.filter(b=>b.industry!=='other');
  const nonOtherWith=nonOther.filter(b=>b.country);
  assert.equal(nonOther.length,nonOtherWith.length,'非 other 行业条目必须全部有 country（缺口 '+ (nonOther.length-nonOtherWith.length) +' 条）');
});

test('企业：country 抽样（Adobe=us / Canon=jp / Adidas=de / Skype=multi）', () => {
  const by=(n)=>BRAND_COLORS.find(b=>b.name===n);
  assert.equal(by('Adobe')?.country,'us');
  assert.equal(by('Canon')?.country,'jp');
  assert.equal(by('Adidas')?.country,'de');
  assert.equal(by('Skype')?.country,'multi');
});

// `W-tb-P46` 扩充批（24 品牌）：id 连续、元数据完整（country/industry/slug）、颜色合法、抽样核对。
// <lang en>`W-tb-P46` expansion batch (24 brands): contiguous ids, complete metadata, legal colours,
//   spot checks.</lang>
test('企业：P46 扩充批 24 条——id 连续、元数据完整、抽样（TikTok=us / Grab=sg / Hermès=fr）', () => {
  const batch=BRAND_COLORS.filter(b=>/^brand-(69[2-9]|7[01][0-9])$/.test(b.id));
  assert.equal(batch.length,24);
  const ids=batch.map(b=>Number(b.id.slice(6)));
  assert.deepEqual(ids,[...Array(24).keys()].map(i=>i+692),'id 须连续 692-715');
  for(const b of batch){
    assert.ok(b.country,'缺 country：'+b.name);
    assert.ok(b.industry!=='other','扩充批不得归 other：'+b.name);
    assert.ok(b.slug);
    assert.match(b.colors[0],/^#[0-9A-F]{6}$/);
  }
  const by=(n)=>BRAND_COLORS.find(b=>b.name===n);
  assert.equal(by('TikTok')?.country,'us');
  assert.equal(by('Grab')?.country,'sg');
  assert.equal(by('Hermès')?.country,'fr');
  assert.deepEqual(by('Figma')?.colors,['#F24E1E','#FF7262','#A259FF','#1ABCFE','#0ACF83']);
});

// `W-tb-P50` 后修：country 映射**语义正确性**防回归（此前只断言"枚举合法+覆盖数"，
//   无法发现"Alphabet 被标成中国"这类语义错标——三次跨条目正则事故的根因）。
//   本测试锁定每个国家分组的**成员白名单**：任何新增/错标都会失败，迫使人复核。
// <lang en>`W-tb-P50` follow-up: semantic correctness guard for country mapping. Earlier assertions only
//   checked enum legality and coverage counts, so semantic mislabels (Alphabet→China) slipped through — the
//   root of three cross-entry regex incidents. This locks the membership whitelist per country group: any
//   addition or mislabel fails, forcing a human review.</lang>
test('企业：country 分组成员白名单（语义正确性防回归）', () => {
  const group = (c) => BRAND_COLORS.filter(b => b.country === c).map(b => b.nameEn).sort();
  // 中国组：只允许这些（Alphabet/Node.js/Bandcamp 等历史错标一旦复现即失败）。
  // <lang en>China group: exactly these — a regression of the Alphabet/Node.js/Bandcamp mislabels fails.</lang>
  assert.deepEqual(group('cn'), ['AliExpress','Alibaba','Baidu','Huawei','JD.com','Lenovo','Meituan','OnePlus','WeChat','Xiaomi'],
    '中国组须为这 10 条：' + group('cn').join(','));
  // 日本组：11 条（Node.js/Onshape/Plex 等不得出现）。
  assert.deepEqual(group('jp'), ['7-Eleven','Canon','LINE','Muji','Nintendo','Olympus','Panasonic','PlayStation','Rakuten','Sony','Toyota'],
    '日本组须为这 11 条：' + group('jp').join(','));
  // 抽验若干易错条目：必须无 country（它们此前被错标）。
  for (const n of ['Alphabet','Node.js','Bandcamp','Plex','Onshape','WhatsBroadcast','SlideShare','Hangouts','kik','Vue.js']) {
    const e = BRAND_COLORS.find(b => b.nameEn === n);
    assert.ok(e, '条目应存在：' + n);
    assert.equal(e.country, undefined, n + ' 不应有 country（历史错标项）');
  }
  // 抽验正确归属。
  assert.equal(BRAND_COLORS.find(b=>b.nameEn==='Adobe')?.country,'us');
  assert.equal(BRAND_COLORS.find(b=>b.nameEn==='Adyen')?.country,'nl');
  assert.equal(BRAND_COLORS.find(b=>b.nameEn==='Aer Lingus')?.country,'ie');
  assert.equal(BRAND_COLORS.find(b=>b.nameEn==='Aparat')?.country,'ir');
});

test('企业：每题条目 country 不得与行业映射矛盾（other 行业标注率上限）', () => {
  // 非 other 行业必须全部标注；other 行业允许标注（历史批量补录），但不得 100%（那意味着误伤）。
  // <lang en>Non-other industries must all be labelled; other may be labelled historically but never 100%
  //   (that would signal collateral mislabelling).</lang>
  const nonOther = BRAND_COLORS.filter(b => b.industry !== 'other');
  assert.equal(nonOther.filter(b => b.country).length, nonOther.length, '非 other 行业须全部标注 country');
  const other = BRAND_COLORS.filter(b => b.industry === 'other');
  const otherLabelled = other.filter(b => b.country).length;
  assert.ok(otherLabelled < other.length, 'other 行业不应 100% 标注（疑似跨条目误伤）');
  assert.ok(otherLabelled <= 460, 'other 行业标注数应在历史合理区间内：' + otherLabelled);
});
