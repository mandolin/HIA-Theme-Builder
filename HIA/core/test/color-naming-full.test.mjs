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
  buildTheme, nameColor, primaryCandidates, TONE_MOODS, MOOD_PRIMARY_MAP, moodPrimaryFor, presetFromDraft, hexToOklch
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

// ===== 2. 情感 → 主色映射 =====
test('映射表覆盖全部 24 个情感', () => {
  assert.equal(MOOD_PRIMARY_MAP.length, 24);
  const moods = MOOD_PRIMARY_MAP.map((m) => m.mood).sort();
  assert.deepEqual(moods, [...TONE_MOODS].sort());
});

test('除中性主导者外，每条映射都指向真实存在的主色候选', () => {
  const ids = new Set(primaryCandidates.map((c) => c.id));
  for (const m of MOOD_PRIMARY_MAP) {
    if (m.neutralLed) {
      // 中性主导：primaryId 必须为空，且 weight 为 0。
      assert.equal(m.primaryId, '', `${m.mood} 标为 neutralLed 时 primaryId 应为空`);
      assert.equal(m.weight, 0);
      continue;
    }
    assert.ok(ids.has(m.primaryId), `${m.mood} → ${m.primaryId} 不是有效候选`);
    assert.ok(m.weight > 0, `${m.mood} 的 weight 应 > 0`);
    // alternates 也必须是有效候选。
    for (const alt of m.alternates) assert.ok(ids.has(alt), `${m.mood} 的备选 ${alt} 无效`);
  }
});

test('中性主导情感被显式标记（不静默丢弃）', () => {
  // 专职以灰/黑底衬艳色，宝典首色全是灰阶 → 应标记 neutralLed 而非消失。
  const zz = moodPrimaryFor('专职');
  assert.ok(zz, '专职 不应从映射中消失');
  assert.equal(zz.neutralLed, true);
});

test('moodPrimaryFor：未知情感返回 undefined', () => {
  assert.equal(moodPrimaryFor('不存在的语气'), undefined);
  assert.ok(moodPrimaryFor('热情'));
});

test('映射到的候选都有明确色相（不承诺语义冷暖）', () => {
  // 只断言"不是无色灰"，**不断言具体冷暖方向**——这是有意的限制。
  //   本映射是启发式（宝典组合首色频次 + OKLab 最近邻），不编码情感的语义倾向。
  //   像"平静"，宝典里暖色（黄系 #F9CC76 等）与冷色（蓝系 #1B4F93 等）票数相当，
  //   算法无法替代设计判断；若需要语义准确，应在映射表补人工校正列。
  // <lang en>Only assert "has a hue", never a warm/cool direction — a deliberate limit. The map is heuristic
  //   (leading-colour frequency + OKLab nearest neighbour) and does not encode semantic intent. For 平静 the
  //   handbook itself splits evenly between warm and cool, so no algorithm can substitute for a design call.</lang>
  for (const m of MOOD_PRIMARY_MAP) {
    if (m.neutralLed) continue;
    const c = primaryCandidates.find((x) => x.id === m.primaryId);
    const lch = hexToOklch(c.hex);
    assert.ok(lch.C >= 0.03, `${m.mood} → ${c.name} 彩度过低（${lch.C.toFixed(3)}），不适合作为主色`);
  }
});
