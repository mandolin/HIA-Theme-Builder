// 色名体系单测（W-tb-P20）：修饰语/色相判定、双语名、辅助候选命名。
import{test}from'node:test';
import assert from'node:assert/strict';
import{nameColor,modifierFor,hueNameFor,generateAuxiliaryCandidates}from'../dist/index.js';

test('色名：修饰语阈值（浅/鲜/深/暗/灰）', () => {
  assert.equal(modifierFor(0.95,0.02),'brilliant');
  assert.equal(modifierFor(0.75,0.2),'vivid');
  assert.equal(modifierFor(0.6,0.18),'strong');
  assert.equal(modifierFor(0.3,0.16),'deep');
  assert.equal(modifierFor(0.5,0.02),'moderate');
});

test('色名：色相分区（红/蓝/绿/紫/中性）', () => {
  assert.equal(hueNameFor(10,0.5,0.2),'red');
  assert.equal(hueNameFor(258,0.5,0.2),'blue');
  assert.equal(hueNameFor(140,0.5,0.2),'green');
  assert.equal(hueNameFor(285,0.5,0.2),'purple');
  assert.equal(hueNameFor(0,0.95,0.01),'white');
  assert.equal(hueNameFor(0,0.5,0.01),'grey');
  assert.equal(hueNameFor(0,0.1,0.01),'black');
});

// 色相环基准回归：分区必须按 **OKLCH** 色相角，不能按 sRGB。
//   这里拿标准色过 nameColor（而非直接喂角度），因为那才是真实调用路径——
//   早前版本正是"分区按 sRGB、角度按 OKLCH"，整环错位约 30°，纯红被判成橙。
// <lang en>Hue-ring baseline regression: sectors must follow **OKLCH** angles, not sRGB. Canonical colours go
//   through nameColor (the real call path) rather than feeding angles directly — the earlier bug was exactly
//   "sRGB sectors on OKLCH angles", shifting the ring ~30° so pure red read as orange.</lang>
test('色名：标准色的色相名必须对得上（OKLCH 基准，防整环错位）', () => {
  const cases = [
    ['#FF0000', 'red', '红'], ['#FF8000', 'orange', '橙'], ['#FFFF00', 'yellow', '黄'],
    ['#00CC00', 'green', '绿'], ['#00CCCC', 'cyan', '青'], ['#0000FF', 'blue', '蓝'],
    ['#8000FF', 'purple', '紫']
  ];
  for (const [hex, hue, zh] of cases) {
    const n = nameColor(hex);
    assert.equal(n.hue, hue, `${hex} 应为 ${hue}，实为 ${n.hue}（${n.zh}）`);
    assert.ok(n.zh.includes(zh), `${hex} 的中文名应含"${zh}"，实为"${n.zh}"`);
  }
  // 亮黄的修饰语应是"亮/鲜"之类，绝不能落到"绿、青、蓝"色相上。
  // <lang en>A bright yellow must never land on a green/cyan/blue hue.</lang>
  const yellow = nameColor('#F1AF00');
  assert.equal(yellow.hue, 'orange'); // 金黄在金与橙之间，OKLCH 81° 落在橙区
  assert.ok(!['green', 'cyan', 'blue'].includes(yellow.hue));
});

test('色名：代表色双语断言（钴蓝=深蓝/Deep Blue，樱色=浅红/Light Red）', () => {
  const blue=nameColor('#0047AB');
  assert.equal(blue.zh,'深蓝');assert.equal(blue.en,'Deep Blue');
  const pink=nameColor('#F7ACBC');
  assert.equal(pink.zh,'浅红');assert.equal(pink.en,'Light Red');
});

test('辅助候选：名称=修饰语+色相（非序号式）', () => {
  const aux=generateAuxiliaryCandidates('#0047AB');
  assert.equal(aux.length,3);
  for(const c of aux){
    assert.match(c.name,/^(亮|鲜|强|深|浅|中|暗|淡|灰|白|红|橙|棕|黄|绿|青|蓝|紫|品红|粉|黑)/,'结构化名：'+c.name);
    assert.ok(!c.name.includes('规则强调'));
  }
});
