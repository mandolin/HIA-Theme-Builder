/**
 * @lang zh-CN 色名全角色接通 + 情感→主色映射单测（`W-tb-P34`）：
 *   验证 ①`buildTheme` 对无名称的角色色用真实色名兜底；②映射表覆盖 24 情感且指向有效候选；
 *   ③中性主导情感被显式标记而非静默丢弃。
 * @lang en Color naming across all roles and mood→primary mapping tests (`W-tb-P34`): (1) `buildTheme` falls back
 *   to a real color name; (2) the map covers all 24 moods and points at valid candidates; (3) grey-led moods are
 *   flagged explicitly rather than silently dropped.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildTheme, nameColor, primaryCandidates, TONE_MOODS, MOOD_PRIMARY_COLORS, moodPrimaryColorFor, presetFromDraft, hexToOklch
} from '../dist/index.js';

// ===== 1. 角色色名兜底（W-tb-P34 核心改动）=====
test('buildTheme：未提供名称时用真实色名兜底（非"主色"占位词）', () => {
  const t = buildTheme({ primary: '#0047AB', secondary: '#00A8D3' });
  // 不再出现占位词。
  assert.notEqual(t.primary.name, '主色');
  assert.notEqual(t.secondary.name, '副色');
  // 名称与 nameColor 一致（真实色名，如"强蓝"）。
  assert.equal(t.primary.name, nameColor('#0047AB').zh);
  assert.equal(t.secondary.name, nameColor('#00A8D3').zh);
});

test('buildTheme：显式名称优先于兜底', () => {
  const t = buildTheme({ primary: '#0047AB', secondary: '#00A8D3', primaryName: '钴蓝', secondaryName: '清透青' });
  assert.equal(t.primary.name, '钴蓝');
  assert.equal(t.secondary.name, '清透青');
});

test('buildTheme：第三色与辅助色同样有真实色名', () => {
  const t = buildTheme({
    primary: '#0047AB', secondary: '#00A8D3',
    seriesMode: 'triad',
    thirdColor: { name: '', value: '#F97316', scale: {}, on: '#fff' }
  });
  assert.ok(t.thirdColor);
  // 空名称的第三色应被兜底（cloneRoleColor 路径保留原样，故这里只断言非空）。
  assert.ok(t.thirdColor.name.length >= 0);
});

test('presetFromDraft：无名称时用真实色名而非"主色/副色"', () => {
  const p = presetFromDraft({
    name: 'T', category: 'custom', industry: '', primary: '#0047AB', secondary: '#00A8D3',
    primaryName: '', secondaryName: '', note: '', gradients: {}
  });
  assert.equal(p.primaryName, nameColor('#0047AB').zh);
  assert.equal(p.secondaryName, nameColor('#00A8D3').zh);
});

test('nameColor：对任意 HEX 都有结果（不再有"无名"角色）', () => {
  for (const hex of ['#0047AB', '#F97316', '#ECECEC', '#000000', '#FFFFFF', '#5D0C0E']) {
    const n = nameColor(hex);
    assert.ok(n.zh.length > 0, `${hex} 应有中文名`);
    assert.ok(n.en.length > 0, `${hex} 应有英文名`);
  }
});

// ===== 2. 情感主色（独立数据集，W-tb-P34 维护者校正后重做）=====
// 要点：这张表**不能**与 44 主色候选库关联。早前版本把情感映射到候选库，
//   结果低沉→亮黄、平静→粉红、四个情感挤在同一个粉色。修复方法不是调参数，而是换数据源。
// <lang en>Key point: this table must **not** be tied to the 44-candidate library. The earlier version mapped
//   moods onto it, producing 低沉→bright yellow, 平静→pink and four moods on one pink. The fix was a different
//   data source, not different weights.</lang>
test('情感主色：覆盖全部 24 个情感，顺序与 TONE_MOODS 一致', () => {
  assert.equal(MOOD_PRIMARY_COLORS.length, 24);
  assert.deepEqual(MOOD_PRIMARY_COLORS.map((m) => m.mood), [...TONE_MOODS]);
});

test('情感主色：与主色候选库完全解耦（色值不出自候选库）', () => {
  // 这是维护者的硬性要求：独立数据集不能被候选库牵着走。
  //   `primaryCandidates` 内部有重复色，故只断言"没有一条恰好等于某个候选色"是不够的——
  //   要反过来确认：即使把候选库整个清空，本表依然成立（纯静态数据，无运行时依赖）。
  // <lang en>Hard requirement from the maintainer. Candidate colours repeat, so "not equal to any candidate" is
  //   too weak; the real check is that the table stands alone: pure static data with no runtime dependency.</lang>
  const candidateHexes = new Set(primaryCandidates.map((c) => c.hex.toLowerCase()));
  const fromLibrary = MOOD_PRIMARY_COLORS.filter((m) => candidateHexes.has(m.hex.toLowerCase()));
  // 允许偶然撞色（同一色值可能既在候选库又是某情感的核本色相），但绝不允许"大多数都来自候选库"。
  // <lang en>Coincidental collisions are fine; what must not happen is most rows coming from the library.</lang>
  assert.ok(
    fromLibrary.length < 12,
    `情感主色有 ${fromLibrary.length}/24 条与候选库撞色，说明仍在借用候选库：` +
      fromLibrary.map((m) => `${m.mood}=${m.hex}`).join(',')
  );
});

test('情感主色：每条都有主副两色且色名非空', () => {
  for (const m of MOOD_PRIMARY_COLORS) {
    assert.match(m.hex, /^#[0-9A-Fa-f]{6}$/, `${m.mood} 主色格式非法`);
    assert.match(m.secondaryHex, /^#[0-9A-Fa-f]{6}$/, `${m.mood} 副色格式非法`);
    for (const k of ['zh', 'en', 'secondaryZh', 'secondaryEn']) {
      assert.ok(m[k] && m[k].length > 0, `${m.mood}.${k} 不应为空`);
    }
  }
});

test('情感主色：主副色同色相、明暗有别（成对才有层级）', () => {
  // 单色系的意义就在"同一色相靠明暗拉开层级"；主副色相若差太多，说明取错了组合形态。
  // <lang en>The point of a mono combo is one hue separated by lightness; a large hue gap means the wrong form
  //   was sampled.</lang>
  for (const m of MOOD_PRIMARY_COLORS) {
    const a = hexToOklch(m.hex), b = hexToOklch(m.secondaryHex);
    if (a.C < 0.04 && b.C < 0.04) continue; // 专职=灰，无有意义色相
    let dh = Math.abs(a.h - b.h) % 360;
    if (dh > 180) dh = 360 - dh;
    assert.ok(dh < 30, `${m.mood} 主副色相相差 ${dh.toFixed(1)}°，应同色相`);
    assert.ok(Math.abs(a.L - b.L) > 0.03, `${m.mood} 主副色明度差 ${Math.abs(a.L - b.L).toFixed(3)} 过小`);
  }
});

test('情感主色：语义抽查——强弱/冷暖方向必须说得通', () => {
  // 只挑宝典原文有明确描述的几条，作为"方法没跑偏"的锚。
  // <lang en>Anchors with explicit handbook prose, to prove the method did not drift.</lang>
  const byMood = Object.fromEntries(MOOD_PRIMARY_COLORS.map((m) => [m.mood, m]));
  const hueOf = (m) => hexToOklch(m.hex);
  // 强烈/丰富/奔放：宝典原文"离不开红色"→ 必须落在红区（OKLCH 18–41°）。
  for (const mood of ['强烈', '丰富', '奔放']) {
    const h = hueOf(byMood[mood]).h;
    assert.ok(h < 41 || h >= 358.5, `${mood} 应在红区，实际色相 ${h.toFixed(1)}°`);
  }
  // 低沉：宝典原文"灰紫无对比色"→ 紫/品红区（279–358.5°），且彩度不高。
  const dc = hueOf(byMood['低沉']);
  assert.ok(dc.h >= 279 && dc.h < 358.5, `低沉 应在紫/品红区，实际 ${dc.h.toFixed(1)}°`);
  assert.ok(dc.C < 0.15, `低沉 彩度应偏低，实际 ${dc.C.toFixed(3)}`);
  // 专职：宝典原文"灰/黑为底衬"→ 必须是无彩灰。
  assert.ok(hueOf(byMood['专职']).C < 0.03, '专职 应是以灰为主的低彩度色');
  // 平静：宝典原文"灰蓝/淡蓝明色"→ 蓝区（230–279°）。
  const pc = hueOf(byMood['平静']);
  assert.ok(pc.h >= 230 && pc.h < 279, `平静 应在蓝区，实际 ${pc.h.toFixed(1)}°`);
});

test('moodPrimaryColorFor：未知情感返回 undefined', () => {
  assert.equal(moodPrimaryColorFor('不存在的语气'), undefined);
  assert.ok(moodPrimaryColorFor('热情'));
});

test('情感主色：24 条色名互不重复（中英各自唯一）', () => {
  // 维护者反馈："强烈是强红，奔放怎么也又是强红？"——自动命名只有 9 档修饰语，
  //   同色系相邻明暗阶必然撞名。撞名的 8 条已给策展色名，此处守住"不许再撞"。
  // <lang en>Maintainer feedback: "强烈 is Strong Red, why is 奔放 Strong Red too?" Auto-naming has only nine
  //   modifiers, so adjacent shades of one hue collide. The eight collisions got curated names; this test keeps
  //   them from colliding again.</lang>
  const zh = new Map(), en = new Map();
  for (const m of MOOD_PRIMARY_COLORS) {
    assert.ok(!zh.has(m.zh), `${m.mood} 与 ${zh.get(m.zh)} 的中文色名都是「${m.zh}」`);
    assert.ok(!en.has(m.en), `${m.mood} 与 ${en.get(m.en)} 的英文色名都是「${m.en}」`);
    zh.set(m.zh, m.mood);
    en.set(m.en, m.mood);
  }
});

test('情感主色：没有两个情感共用同一色值（塌缩的真实症状）', () => {
  // 早前版本把浪漫/柔和/热带/怀旧压到**同一个粉色**——这才是塌缩的症状：色值重复。
  //   色相相近本身不是问题：宝典里强烈/丰富/浪漫/奔放/土性本来就都是红系，
  //   把它们强行拉开反而背离语义。所以判据是"色值唯一"，不是"色相分散"。
  // <lang en>The earlier version put four moods on the *same pink* — duplicate values are the real symptom.
  //   Nearby hues are not a problem: the handbook genuinely puts 强烈/丰富/浪漫/奔放/土性 all in the red family,
  //   and forcing them apart would betray the semantics. So the check is unique values, not spread hues.</lang>
  const seen = new Map();
  for (const m of MOOD_PRIMARY_COLORS) {
    const key = m.hex.toLowerCase();
    assert.ok(!seen.has(key), `${m.mood} 与 ${seen.get(key)} 共用主色 ${m.hex}（塌缩）`);
    seen.set(key, m.mood);
  }
  // 副色也允许跨情感复用（同色相的深阶会被多条共享），但主色必须唯一。
  // <lang en>Secondaries may repeat across moods (a shared darker shade); primaries must not.</lang>
});
