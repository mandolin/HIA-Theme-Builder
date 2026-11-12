// 自然/社会场景两源单测（W-tb-P19）。
import{test}from'node:test';
import assert from'node:assert/strict';
import{NATURE_COLORS,SOCIAL_COLORS}from'../dist/index.js';

test('自然源：40+ 场景、六类齐全、色组与说明合法', () => {
  assert.ok(NATURE_COLORS.length>=40,'数量='+NATURE_COLORS.length);
  const cats=new Set(NATURE_COLORS.map(n=>n.category));
  for(const c of ['sky','ocean','land','plant','weather','mineral'])assert.ok(cats.has(c),'缺类:'+c);
  for(const n of NATURE_COLORS){
    assert.ok(n.colors.length>=2,'至少 2 色：'+n.name);
    for(const c of n.colors)assert.match(c,/^#[0-9A-F]{6}$/);
    assert.ok(n.note.length>=6,'说明充实：'+n.name);
  }
});

test('社会场景源：30+ 场景、七类齐全、说明合法', () => {
  assert.ok(SOCIAL_COLORS.length>=30,'数量='+SOCIAL_COLORS.length);
  const cats=new Set(SOCIAL_COLORS.map(n=>n.category));
  for(const c of ['emergency','medical','postal','transport','safety','industry','cultural'])assert.ok(cats.has(c),'缺类:'+c);
  for(const n of SOCIAL_COLORS){
    assert.ok(n.colors.length>=2);
    for(const c of n.colors)assert.match(c,/^#[0-9A-F]{6}$/);
    assert.ok(n.note.length>=6);
  }
});

test('两源代表性条目存在（晚霞/极光/森林 与 消防红/医疗绿/交通信号）', () => {
  assert.ok(NATURE_COLORS.some(n=>n.name==='晚霞'));
  assert.ok(NATURE_COLORS.some(n=>n.name==='极光'));
  assert.ok(NATURE_COLORS.some(n=>n.name==='森林'));
  assert.ok(SOCIAL_COLORS.some(n=>n.name==='消防'));
  assert.ok(SOCIAL_COLORS.some(n=>n.name==='医疗'));
  assert.ok(SOCIAL_COLORS.some(n=>n.name==='交通信号'));
});
