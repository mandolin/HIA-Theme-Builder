/**
 * @lang zh-CN 语气预设数据与工厂（`W-tb-P15`，`C-tb-P4` 首周期）：从配色宝典组合表（FORM_PACKS）
 *   派生"成套可套用"的内置语气预设——每情感按理论主推形态优先级精选 2~4 个组合，封装为
 *   正式 `Preset` 对象（模式 + 关系规则显式 + 主体色成员 + 关系规则生成的辅助色），
 *   与主题库同体制（可应用/可分享/可导出），id 以 `tone-` 前缀纳入内置写保护。
 *   精选规则（确定性、可复现，理由见 work-zone `dev/research/tone-curation.md`）：
 *   ①默认形态优先级 = 补色 → 单色 → 类比（覆盖 双色/三色 成员数）；
 *   ②理论特例覆盖：平静/低沉/专职以中性为首选（柔和/无对比/底衬艳色），古典以分裂补色为首选；
 *   ③单色补位：若精选后缺 single 模式，从单色形态补一个 1 色组合；
 *   ④每情感上限 3 个（成员数 1..3 各至多一个），下限 2。
 * @lang en Tone preset data & factory (`W-tb-P15`): derives built-in full-suite tone presets from the
 *   baodian combo table — per mood 2~4 curated combos (priority forms with theory overrides, single-mode
 *   backfill), wrapped as first-class `Preset` objects (mode + explicit relation + members + rule-generated
 *   auxiliaries); ids carry the `tone-` prefix for built-in write protection.
 */
import{FORM_PACKS,BAODIAN_PALETTE,BAODIAN_FORM_NAMES}from'./palette-packs.js';
import{tonalScale}from'../color/scale.js';
import{bestOnColor}from'../color/contrast.js';
import{generateAuxiliaryCandidates}from'../color/harmony.js';
import type{Preset,RoleColor,SeriesMode,SeriesRelationId}from'../types.js';

/**
 * @lang zh-CN 24 情感的规范顺序（配色宝典 CHM 目录序）——工厂输出与 id 编号都依赖此序，保证稳定。
 * @lang en Canonical order of the 24 moods (CHM TOC order) — keeps factory output and id numbering stable.
 */
export const TONE_MOODS:readonly string[]=['强烈','丰富','浪漫','奔放','土性','友善','柔和','热情','动感','高雅','流行','清新','传统','清爽','热带','古典','可靠','平静','堂皇','神奇','怀旧','活力','低沉','专职'];

/**
 * @lang zh-CN 各情感的形态优先级（键=情感，值=形态中文名数组，按优先级排序）；
 *   未列出的情感使用 TONE_DEFAULT_PRIORITY。特例依据配色宝典理论（见 C-tb-CANDIDATES §三）：
 *   平静（补色明暗度须与主色类似→中性柔和）、低沉（灰紫无对比色→中性）、
 *   专职（灰/黑底衬艳色→中性收敛）、古典（宝蓝中间色+分裂补色）。
 * @lang en Per-mood form priority (theory overrides from the baodian book); unlisted moods fall back
 *   to TONE_DEFAULT_PRIORITY.
 */
export const TONE_FORM_PRIORITY:Record<string, readonly string[]>={
  '平静':['中性色彩组合','单色色彩组合','类比色彩组合'],
  '低沉':['中性色彩组合','单色色彩组合','类比色彩组合'],
  '专职':['中性色彩组合','单色色彩组合','分裂补色色彩组合'],
  '古典':['分裂补色色彩组合','补色色彩组合','类比色彩组合'],
};
/** @lang zh-CN 默认形态优先级：补色（理论主推）→ 单色（同相变体）→ 类比（三色和谐）。
    @lang en Default priority: complement → pure → analogous. */
export const TONE_DEFAULT_PRIORITY:readonly string[]=['补色色彩组合','单色色彩组合','类比色彩组合'];

/** @lang zh-CN 辅助色槽位填充数量（关系规则生成的前 N 个候选）。
    @lang en Number of auxiliary slots filled from rule-generated candidates. */
export const TONE_AUX_SLOTS=2;

// 由色号查 HEX（缺表回退中性灰，防脏数据白屏）。
// <lang en>Hex lookup by baodian number with a neutral-grey fallback.</lang>
const hexOf=(num:number):string=>BAODIAN_PALETTE[num]||'#CCCCCC';

// 由 HEX 构造角色色（色阶与前景由 HEX 重建，与 pack 清洗同口径，不信任外部 scale）。
// <lang en>Builds a RoleColor from hex, rebuilding scale/foreground like the pack sanitizer.</lang>
function roleFrom(hex:string,name:string):RoleColor{
  return{name,value:hex,scale:tonalScale(hex),on:bestOnColor(hex).hex};
}

// 预设命名：语气·<情感>（<形态短名>）；形态短名=中文名去掉"色彩组合"后缀。
// <lang en>Preset naming: tone · mood (short form); the suffix is stripped from the CN form title.</lang>
function tonePresetName(emotion:string,formCn:string,memberCount:number):string{
  // 1 色组合加"极简"后缀：与同形态的多色组合区分（如 单色 与 单色·极简）。
  // <lang en>1-color combos get a minimal suffix to distinguish from multi-color ones of the same form.</lang>
  const short=formCn.replace('色彩组合','');
  return memberCount===1?`语气·${emotion}（${short}·极简）`:`语气·${emotion}（${short}）`;
}

/**
 * @lang zh-CN 构造单个语气预设：给定情感、形态中文名与组合序号，产出正式 `Preset`——
 *   模式按成员数派生（1/2/3 → single/dual/triad）、关系规则=形态映射、辅助色=关系规则生成
 *   （`TONE_AUX_SLOTS` 个，命名"辅助色 N"，套用后可改）。输入无法解析时返回 null。
 * @lang en Builds one tone preset; returns null when the mood/form/combo cannot be resolved.
 */
export function buildTonePreset(emotion:string,formCn:string,comboIndex=0):Preset|null{
  // 形态与组合定位：中文形态名经 BAODIAN_FORM_NAMES 解析为包表 id（FORM_PACKS 键=英文形态 id）。
  // <lang en>Resolve the CN form title to the pack id first (FORM_PACKS is keyed by form ids).</lang>
  const formId=BAODIAN_FORM_NAMES[formCn];
  const combos=formId?FORM_PACKS[formId]:undefined;
  if(!combos)return null;
  const mine=combos.filter(c=>c.e===emotion);
  const combo=mine[comboIndex];
  if(!combo)return null;
  const members=combo.n.map(hexOf);
  // 成员数 1..3 之外（脏数据）不产出预设。
  if(members.length<1||members.length>3)return null;
  const relation=BAODIAN_FORM_NAMES[formCn] as SeriesRelationId;
  // 模式派生与 ADR-007 v2 装配语义一致：成员数 1/2/3 → single/dual/triad。
  const mode:SeriesMode=members.length===1?'single':members.length===2?'dual':'triad';
  // 辅助色：按关系规则从主色生成（组合本身不含额外色条），填 TONE_AUX_SLOTS 个槽位。
  const auxiliary:RoleColor[]=generateAuxiliaryCandidates(members[0]!)
    .slice(0,TONE_AUX_SLOTS)
    .map((c,i)=>roleFrom(c.hex,`辅助色 ${i+1}`));
  const moodIdx=TONE_MOODS.indexOf(emotion);
  const preset:Preset={
    id:`tone-${String(moodIdx+1).padStart(2,'0')}-${relation}-${members.length}`,
    name:tonePresetName(emotion,formCn,members.length),
    category:'tone',
    industry:'配色宝典',
    primary:members[0]!,
    secondary:members[1]??members[0]!,
    primaryName:'主色',
    secondaryName:'副色',
    // note 置空：预设名已承载情感与形态语义；避免为 72 条 note 增加双语注册负担（卡片渲染空串天然隐藏）。
    // <lang en>Empty note: the preset name already carries mood/form semantics; avoids i18n overhead.</lang>
    note:'',
    seriesMode:mode,
    seriesRelation:relation,
    ...(members.length===3?{thirdColor:roleFrom(members[2]!,'第三色')}:{})
    ,auxiliary
  };
  return preset;
}

/**
 * @lang zh-CN 构建全套内置语气预设：遍历 24 情感，按形态优先级做"成员数去重"贪心精选
 *   （每情感至多 3 个：单/双/三各至多一个），再做单色补位（缺 single 模式时从单色形态
 *   取 1 色组合）。输出顺序=情感规范序 × 精选序，供主题库"语气"分类与内置库注水。
 * @lang en Builds the full built-in tone preset set: per mood a greedy member-count-diverse
 *   selection over priority forms, plus a single-mode backfill from 1-color pure combos.
 */
export function buildTonePresets():Preset[]{
  const out:Preset[]=[];
  for(const emotion of TONE_MOODS){
    const priority=TONE_FORM_PRIORITY[emotion]??TONE_DEFAULT_PRIORITY;
    // seenCounts：已覆盖的成员数（1/2/3），保证单/双/三模式覆盖。
    const seen=new Set<number>();
    // usedFormIds：已产出预设的形态（中文），pass1/2/3 共用，保证同形态不重复产出。
    // <lang en>usedFormIds tracks forms already emitted, shared across all selection passes.</lang>
    const usedFormIds=new Set<string>();
    for(const formCn of priority){
      // 中文形态名→包表 id（同 buildTonePreset 的解析口径）。
      const list=FORM_PACKS[BAODIAN_FORM_NAMES[formCn]||'']||[];
      // 组合序号=该组合在"本情感过滤后数组"中的位置（buildTonePreset 内部按情感过滤，故须传 mine 内下标）。
      const mine=list.filter(c=>c.e===emotion);
      const k=mine.findIndex(c=>!seen.has(c.n.length));
      if(k<0)continue;
      const preset=buildTonePreset(emotion,formCn,k);
      if(preset){out.push(preset);seen.add(mine[k]!.n.length);usedFormIds.add(formCn);}
      if(seen.size>=3)break;
    }
    // 单色补位（扩展）：优先级形态未覆盖 1 色组合时，按优先级顺序跨全部形态找 1 色组合补齐 single 模式。
    // <lang en>Single-mode backfill: scan all forms in priority order for a 1-color combo.</lang>
    if(!seen.has(1)){
      for(const formCn of priority){
        const mine=(FORM_PACKS[BAODIAN_FORM_NAMES[formCn]||'']||[]).filter(c=>c.e===emotion);
        const k=mine.findIndex(c=>c.n.length===1);
        if(k>=0){
          const preset=buildTonePreset(emotion,formCn,k);
          if(preset){out.push(preset);seen.add(1);usedFormIds.add(formCn);break;}
        }
      }
    }
    // 保底凑满 3：仍不足 3 个时，按优先级取"尚未被选用的形态"的首个组合（不计成员数），上限 4。
    // <lang en>Top-up to three: take the first un-used form's lead combo regardless of member count, cap 4.</lang>
    for(const formCn of priority){
      if(out.filter(p=>p.name.startsWith(`语气·${emotion}（`)).length>=3)break;
      if(usedFormIds.has(formCn))continue;
      const mine=(FORM_PACKS[BAODIAN_FORM_NAMES[formCn]||'']||[]).filter(c=>c.e===emotion);
      if(!mine.length)continue;
      const preset=buildTonePreset(emotion,formCn,0);
      if(preset)out.push(preset);
    }
  }
  return out;
}

/** @lang zh-CN 内置语气预设全集（模块级构建一次；确定性输出，随产品分发）。
    @lang en The built-in tone preset set (built once at module load; deterministic). */
export const tonePresets:readonly Preset[]=buildTonePresets();