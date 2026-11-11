/**
 * 主色锚推导单测（`W-tb-P16`）：色相关系保持、锚成员恒等、明暗保留、gamut 合法。
 * Anchor-derivation tests: hue-relation preservation, anchor identity, L/C retention, gamut validity.
 */
import{test}from'node:test';
import assert from'node:assert/strict';
import{shiftHueTo,anchorComboMembers,hexToOklch}from'../dist/index.js';

// 色相差（0..360，环形最短向不重要——工厂按有向偏移）。
const hueOf=h=>hexToOklch(h).h;

test('锚推导：锚成员恒等于用户当前主色', () => {
  const out=anchorComboMembers(['#00A06B','#DF0029'],'#0047AB');
  assert.equal(out[0],'#0047AB');
});

test('锚推导：其余成员保持与锚的色相偏移（关系不变）', () => {
  // 组合 [绿 #00A06B, 红 #DF0029]：红相对绿的偏移 Δ。锚定到钴蓝后，新第二色相对钴蓝的偏移应≈Δ。
  const combo=['#00A06B','#DF0029'];
  const delta0=(hueOf(combo[1])-hueOf(combo[0])+360)%360;
  const out=anchorComboMembers(combo,'#0047AB');
  const delta1=(hueOf(out[1])-hueOf('#0047AB')+360)%360;
  assert.ok(Math.abs(delta0-delta1)<1,'偏移保持（<1°，HEX 量化噪声容差）：'+delta0+' vs '+delta1);
  // 明暗保留（物理可实现语义）：明度保留（gamut 折衷仅微调）；彩度在 sRGB gamut 内保留、
  //   越界时由 gamutMapOklch 降彩度保色相（如高彩度红平移到绿 hue 区）——组合的明度结构与相对关系不受损。
  // <lang en>Lightness preserved (gamut may nudge); chroma kept in-gamut and reduced only when out of sRGB.</lang>
  const srcL=hexToOklch(combo[1]).L,srcC=hexToOklch(combo[1]).C;
  const newL=hexToOklch(out[1]).L,newC=hexToOklch(out[1]).C;
  assert.ok(Math.abs(srcL-newL)<0.01,'明度保留：'+srcL+' vs '+newL);
  assert.ok(newC<=srcC+1e-6,'彩度不增（gamut 只降不升）：'+srcC+' vs '+newC);
});

test('锚推导：三色组合（主/副/第三）成员数与锚定不变式', () => {
  const combo=['#00A06B','#F9F400','#DF0029'];
  const out=anchorComboMembers(combo,'#0047AB');
  assert.equal(out.length,3);
  assert.equal(out[0],'#0047AB');
  for(const h of out)assert.match(h,/^#[0-9A-Fa-f]{6}$/,'gamut 合法');
  // 三个成员色相互不相同（组合关系未被坍缩）。
  const hues=new Set(out.map(hueOf));
  assert.equal(hues.size,3);
});

test('锚推导：单色组合恒等（主色本身）', () => {
  assert.deepEqual(anchorComboMembers(['#0047AB'],'#0047AB'),['#0047AB']);
});

test('锚推导：shiftHueTo 越界色相回绕且输出合法', () => {
  // 偏移超 360 的环形回绕。
  const a=shiftHueTo('#DF0029','#00A06B','#0047AB');
  assert.match(a,/^#[0-9A-Fa-f]{6}$/);
});
