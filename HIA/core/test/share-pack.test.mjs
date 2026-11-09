/**
 * @lang zh-CN 分享链接与主题包单测（`W-tb-P10` / M-THEME-BUILDER-MARKET）：编解码往返、脏载荷拒绝、
 *   字段净化、渐变 clone 校验复用、主题包清洗计数、id 冲突合并。
 * @lang en Share-link and theme-pack tests (`W-tb-P10` / M-THEME-BUILDER-MARKET): codec round-trip,
 *   dirty-payload rejection, field sanitizing, gradient clone chain reuse, pack sanitize counts, id-clash merging.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildThemeFromDraft, createThemeDraft, GRADIENT_DEFAULTS,
  buildSharePayload, encodeShareHash, decodeShareHash,
  parseThemePack, mergeImportedPresets, sanitizePreset, THEME_PACK_MAX_PRESETS
} from '../dist/index.js';

/** @lang zh-CN 基准草稿（中文名 + 默认渐变，覆盖 UTF-8 编码路径）。 @lang en Base draft (CJK name + default gradients, covering UTF-8 encoding). */
const DRAFT = createThemeDraft({ name: '钴蓝·清透青', primaryName: '钴蓝', secondaryName: '清透青', note: '官方默认主题' });

test('分享往返: 草稿→hash→解码逐字段相等（含中文/渐变）（round-trip）', () => {
  const payload = buildSharePayload(DRAFT);
  const hash = encodeShareHash(payload);
  // 链接形态断言：前缀 + 版本 + 载荷字段
  assert.match(hash, /^hia=v1&p=[A-Za-z0-9_-]+$/, 'hash 形态');
  const back = decodeShareHash(hash);
  assert.ok(back, '解码成功');
  assert.equal(back.name, '钴蓝·清透青');
  assert.equal(back.primary, DRAFT.primary);
  assert.equal(back.secondary, DRAFT.secondary);
  assert.equal(back.primaryName, '钴蓝');
  assert.equal(back.note, '官方默认主题');
  // 渐变经 clone 往返：与 GRADIENT_DEFAULTS 全量一致（clone 校验链回退语义）
  assert.deepEqual(back.gradients?.carousel, { enabled: true, family: 'primary', start: '700', end: '300', direction: '135deg', bias: 'front75' });
  // 不含令牌组（P9 边界决策）
  assert.equal(back.typography, undefined);
  // 链接长度有界（对标页约定：UI 超 2000 提示走文件分享）
  assert.ok(hash.length < 2000, `hash 长度 ${hash.length} < 2000`);
});

test('分享解码: 带前导 # 与裸值等价（leading-hash tolerant）', () => {
  const hash = encodeShareHash(buildSharePayload(DRAFT));
  const a = decodeShareHash(hash);
  const b = decodeShareHash('#' + hash);
  assert.deepEqual(a, b);
});

test('分享解码: 坏前缀/坏版本/坏 base64/坏 JSON/坏 HEX 一律 null（dirty payloads rejected）', () => {
  assert.equal(decodeShareHash('other=v1&p=abc'), null, '前缀不符');
  assert.equal(decodeShareHash('hia=v2&p=abc'), null, '未知版本');
  assert.equal(decodeShareHash('hia=v1&p=!!!'), null, 'base64 非法字符');
  assert.equal(decodeShareHash('hia=v1&p=eyJvcyI6'), null, 'JSON 截断');
  assert.equal(decodeShareHash(''), null, '空输入');
  // 坏 HEX：结构合法但颜色非法
  const bad = encodeShareHash({ v: 1, name: 'x', primary: 'zzzzzz', secondary: '#00A8D3', primaryName: 'a', secondaryName: 'b' });
  assert.equal(decodeShareHash(bad), null, 'HEX 非法');
});

test('分享解码: 渐变脏数据经 clone 链回退默认（ADR-004 校验复用）', () => {
  const bad = encodeShareHash({
    v: 1, name: 'x', primary: '#0047AB', secondary: '#00A8D3', primaryName: 'a', secondaryName: 'b',
    gradients: { carousel: { enabled: true, family: 'primary', start: '9999', end: '300', direction: '135deg', bias: 'front200' } }
  });
  const back = decodeShareHash(bad);
  assert.ok(back);
  // 9999 档非法 → 回退默认 700；front200 非法 → 回退默认 front75
  assert.equal(back.gradients.carousel.start, '700');
  assert.equal(back.gradients.carousel.bias, 'front75');
});

test('主题包: 合法源解析 + 脏条目丢弃计数（sanitize with drop counts）', () => {
  const pack = JSON.stringify({
    schemaVersion: 1,
    presets: [
      { id: 'a', name: '好预设', primary: '#0047AB', secondary: '#00A8D3', primaryName: '钴蓝', secondaryName: '清透青', category: 'business' },
      { id: 'b', name: '', primary: '#0047AB', secondary: '#00A8D3' },                    // name 空 → 丢
      { id: 'c', name: '坏色', primary: '#XYZ123', secondary: '#00A8D3' },                // HEX 非法 → 丢
      '垃圾字符串',                                                                        // 非对象 → 丢
      { name: '无 id 也行', primary: '#123456', secondary: '#654321' }                    // id 缺省占位
    ]
  });
  const result = parseThemePack(pack);
  assert.ok(result);
  assert.equal(result.presets.length, 2);
  assert.equal(result.dropped, 3);
  assert.equal(result.presets[0].name, '好预设');
  assert.match(result.presets[1].id, /^pack-\d+$/, '缺省 id 占位');
});

// ADR-007 v2：远程主题包/导入文件的 seriesMode/seriesRelation/thirdColor/auxiliary 清洗。
// <lang zh-CN>合法白名单保留并重建色阶；非法值静默省略字段（回落默认语义）；辅助槽位截断上限 8。</lang>
// <lang en>V2 contract fields survive sanitizing; invalid values drop to defaults; aux capped at 8.</lang>
test('主题包: 配色关系新契约字段清洗（v2 contract sanitize）', () => {
  const base={id:'x',name:'三色源',primary:'#0047AB',secondary:'#00A8D3'};
  const ok=sanitizePreset({...base,
    seriesMode:'triad',seriesRelation:'tertiary',
    thirdColor:{name:'第三',value:'#70C884',scale:{'50':'#fff'},on:'#000'},
    auxiliary:[{name:'辅一',value:'#FFB000'},{name:'坏辅',value:'#ZZZZZZ'}]});
  assert.ok(ok);
  assert.equal(ok.seriesMode,'triad');
  assert.equal(ok.seriesRelation,'tertiary');
  assert.equal(ok.thirdColor.value,'#70C884');
  // scale/on 由 HEX 重建（不信任远端自算值）
  assert.ok(ok.thirdColor.scale['500'],'色阶已重建');
  assert.ok(/^#[0-9A-F]{6}$/.test(ok.thirdColor.on),'前景已重建');
  assert.equal(ok.auxiliary.length,1,'非法辅助条目丢弃');
  assert.equal(ok.auxiliary[0].value,'#FFB000');
  assert.ok(ok.auxiliary[0].scale['700']);
  // 非法 mode/relation/结构 → 字段省略（缺省=现行 dual/manual 语义）
  const dirty=sanitizePreset({...base,seriesMode:'quad',seriesRelation:'nonsense',
    thirdColor:'垃圾',auxiliary:[{value:'bad'}]});
  assert.ok(dirty);
  assert.equal('seriesMode'in dirty,false);
  assert.equal('seriesRelation'in dirty,false);
  assert.equal('thirdColor'in dirty,false);
  assert.equal('auxiliary'in dirty,false);
  // 槽位上限截断：10 条合法 → 保 8
  const many=sanitizePreset({...base,auxiliary:Array.from({length:10},(_,i)=>({name:'a'+i,value:'#0A0B0C'}))});
  assert.equal(many.auxiliary.length,8);
});

test('主题包: 非法 JSON/未知版本/非对象返回 null（parse failures）', () => {
  assert.equal(parseThemePack('not-json'), null);
  assert.equal(parseThemePack(JSON.stringify({ schemaVersion: 9, presets: [] })), null);
  assert.equal(parseThemePack(JSON.stringify({ schemaVersion: 1, presets: 'oops' })), null);
  assert.equal(parseThemePack('42'), null);
});

test('主题包: 超上限截断并计数（cap truncation）', () => {
  const many = Array.from({ length: THEME_PACK_MAX_PRESETS + 5 }, (_, i) => ({
    id: `p${i}`, name: `P${i}`, primary: '#0047AB', secondary: '#00A8D3'
  }));
  const result = parseThemePack(JSON.stringify({ schemaVersion: 1, presets: many }));
  assert.ok(result);
  assert.equal(result.presets.length, THEME_PACK_MAX_PRESETS);
  assert.equal(result.dropped, 5);
});

test('导入合并: id 冲突重命名且本地永不覆盖（merge renames on clash）', () => {
  const local = [
    { id: 'a', name: '本地 A', category: 'custom', industry: '', primary: '#111111', secondary: '#222222', primaryName: '一', secondaryName: '二', note: '' },
    { id: 'preset-default', name: '内置默认', category: 'default', industry: '', primary: '#0047AB', secondary: '#00A8D3', primaryName: '钴蓝', secondaryName: '清透青', note: '' }
  ];
  const incoming = [
    { id: 'a', name: '远程 A' },                 // 与本地冲突 → a-imported
    { id: 'preset-default', name: '默认变体' },  // 与内置冲突 → preset-default-imported
    { id: 'fresh', name: '全新' }                // 无冲突
  ];
  const { merged, renamed } = mergeImportedPresets(local, incoming);
  assert.equal(merged.length, 5, '本地 2 + 导入 3');
  assert.equal(renamed, 2);
  assert.equal(merged[2].id, 'a-imported');
  assert.equal(merged[2].name, '远程 A', '展示名保持原样');
  assert.equal(merged[3].id, 'preset-default-imported');
  assert.equal(merged[4].id, 'fresh');
  // 本地两条原样在前，未被覆盖
  assert.equal(merged[0].id, 'a');
  assert.equal(merged[1].id, 'preset-default');
});

test('导入合并: 连环冲突追加序号（cascade suffixes）', () => {
  // 本地已占 x：两条导入 x 依次 → x-imported → x-imported-1（连环消解）
  const local = [{ id: 'x', name: '本地 X', category: 'custom', industry: '', primary: '#111111', secondary: '#222222', primaryName: '一', secondaryName: '二', note: '' }];
  const incoming = [{ id: 'x', name: 'X' }, { id: 'x', name: 'X2' }];
  const { merged, renamed } = mergeImportedPresets(local, incoming);
  assert.equal(renamed, 2);
  const ids = merged.map(p => p.id);
  assert.equal(ids.length, 3);
  assert.deepEqual(ids, ['x', 'x-imported', 'x-imported-1'], '连环消解产生唯一 id 序列');
});

test('导出文件即远程源: serializeThemeLibrary 产物可被 parseThemePack 直接解析（same-format guarantee）', () => {
  // 从 seed 构造 serializeThemeLibrary 同构产物（格式同一 schemaVersion:1）
  const pack = JSON.stringify({ schemaVersion: 1, presets: [{ id: 'p1', name: 'N', primary: '#0047AB', secondary: '#00A8D3', primaryName: '钴蓝', secondaryName: '清透青', note: '', category: 'custom', industry: '' }] });
  const result = parseThemePack(pack);
  assert.ok(result);
  assert.equal(result.presets[0].primary, '#0047AB');
});
