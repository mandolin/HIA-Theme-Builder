/**
 * 语气预设工厂单测（`W-tb-P15`）：精选规则、字段正确性、内置保护、分享往返。
 * Tone preset factory tests: curation rules, field correctness, builtin protection, round-trips.
 */
import{test}from'node:test';
import assert from'node:assert/strict';
import{tonePresets,buildTonePreset,TONE_MOODS,isBuiltinPresetId,parseThemePack}from'../dist/index.js';

test('语气预设：总量在 50~100 区间且覆盖全部 24 情感（每情感 2~4 个）', () => {
  assert.ok(tonePresets.length>=50&&tonePresets.length<=100,'总量='+tonePresets.length);
  const byMood=new Map();
  for(const p of tonePresets){
    const m=p.name.match(/语气·(.+?)（/);
    assert.ok(m,'预设名可解析情感：'+p.name);
    byMood.set(m[1],(byMood.get(m[1])||0)+1);
  }
  assert.equal(byMood.size,24,'覆盖 24 情感，实际 '+byMood.size);
  for(const[,n]of byMood)assert.ok(n>=2&&n<=4,'每情感 2~4 个，实际 '+n);
});

test('语气预设：id 唯一、tone- 前缀、受内置写保护', () => {
  const ids=tonePresets.map(p=>p.id);
  assert.equal(new Set(ids).size,ids.length,'id 无重复');
  for(const id of ids)assert.ok(id.startsWith('tone-'),'id 前缀：'+id);
  assert.equal(isBuiltinPresetId(tonePresets[0].id),true,'tone- 纳入内置保护：'+tonePresets[0].id);
  assert.equal(isBuiltinPresetId('preset-default'),true);
  assert.equal(isBuiltinPresetId('custom-1'),false);
});

test('语气预设：模式与关系规则按形态正确映射（强烈·补色=双色/互补）', () => {
  const p=tonePresets.find(x=>x.name.includes('强烈')&&x.seriesRelation==='complement');
  assert.ok(p,'存在强烈·补色预设');
  assert.equal(p.seriesMode,'dual');
  assert.equal(p.category,'tone');
  assert.equal(p.seriesRelation,'complement');
  // 成员色来自宝典色号表（主色为组合首色的 HEX）。
  assert.match(p.primary,/^#[0-9A-F]{6}$/);
});

test('语气预设：单/双/三模式全覆盖且单色补位生效', () => {
  const modes=new Set(tonePresets.map(p=>p.seriesMode));
  for(const m of['single','dual','triad'])assert.ok(modes.has(m),'缺少模式 '+m);
  // 单色预设：relation=pure 且 1 色成员（辅助色仍按规则生成）。
  const single=tonePresets.filter(p=>p.seriesMode==='single');
  assert.ok(single.length>0);
  for(const p of single)assert.equal(p.seriesRelation,'pure');
});

test('语气预设：辅助色按关系规则生成（TONE_AUX_SLOTS=2 槽）', () => {
  for(const p of tonePresets){
    assert.ok(Array.isArray(p.auxiliary)&&p.auxiliary.length===2,'辅助槽=2：'+p.id);
    for(const a of p.auxiliary){
      assert.match(a.value,/^#[0-9A-F]{6}$/);
      assert.ok(a.scale&&a.scale['500'],'色阶已重建');
    }
  }
});

test('语气预设：三色组合携带第三色（triad 预设 thirdColor 存在）', () => {
  const triads=tonePresets.filter(p=>p.seriesMode==='triad');
  assert.ok(triads.length>0);
  for(const p of triads)assert.ok(p.thirdColor&&p.thirdColor.value,'triad 需第三色：'+p.id);
});

test('语气预设：经主题包清洗往返字段保留（v2 契约）', () => {
  const sample=tonePresets[0];
  const pack=JSON.stringify({schemaVersion:1,presets:[sample]});
  const result=parseThemePack(pack);
  assert.ok(result);
  assert.equal(result.dropped,0);
  const back=result.presets[0];
  assert.equal(back.seriesMode,sample.seriesMode);
  assert.equal(back.seriesRelation,sample.seriesRelation);
  assert.equal(back.auxiliary.length,sample.auxiliary.length);
  assert.equal(back.thirdColor?.value,sample.thirdColor?.value);
});

test('语气预设：无效输入返回 null（工厂健壮性）', () => {
  assert.equal(buildTonePreset('不存在的情感','补色色彩组合'),null);
  assert.equal(buildTonePreset('强烈','不存在的形态'),null);
});
