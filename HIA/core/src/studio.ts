/**
 * @lang zh-CN 主题操作台状态层：草稿创建、预设转换、库读写与渐变持久化。
 *   仅依赖 core 内的纯函数与数据，不触碰任何运行时存储。
 * @lang en Theme-studio state layer: draft creation, preset conversion, library IO and gradient persistence.
 *   Depends only on core pure functions/data and never touches runtime storage.
 */
import type{GradientSettings,Preset,PrimaryCandidate,Theme,ThemeDraft,ThemeLibraryDocument}from'./types.js';
import{normalizeHex}from'./color/convert.js';
import{nameColor}from'./color/color-name.js';
import{generateSecondarySet,type SecondaryCandidate}from'./color/harmony.js';
import{cloneGradientSettings,GRADIENT_DEFAULTS}from'./data/gradients.js';
import{DEFAULT_SPACING,DEFAULT_TYPOGRAPHY}from'./token/typography.js';
import{buildTheme,cloneSpacing,cloneTypography}from'./theme.js';

// 默认草稿：首次进入操作台时的初始主题（HIA 官方默认）。
// <lang zh-CN>作为所有新建草稿的基础模板，渐变取自全局默认配置的深拷贝。</lang>
// <lang en>Base template for every new draft; gradients are a deep clone of the global defaults.</lang>
export const DEFAULT_THEME_DRAFT:ThemeDraft={id:'preset-default',name:'HIA 默认',category:'default',industry:'通用平台',primary:'#0047AB',secondary:'#00A8D3',primaryName:'钴蓝',secondaryName:'清透青',note:'HIA 官方默认主题。',gradients:cloneGradientSettings(GRADIENT_DEFAULTS)};

// 依据主副色中文名自动拼出主题名，缺省提供可读回退。
// <lang zh-CN>用于用户未手动命名时给出“主色·副色”式默认标题。</lang>
// <lang en>Yields a "primary·secondary" default title when the user has not named the theme.</lang>
export function autoThemeName(primaryName:string,secondaryName:string):string{
  const p=primaryName||'主题',s=secondaryName||'副色';
  // 主副同名时不要拼出"鲜橙·鲜橙"这种废话标题。
  //   色名是"修饰语+色相"两档粒度，同色系的深浅两阶会落到同一个名字上（`#F1AF00`/`#D59B00` 都是"鲜橙"）——
  //   这不是命名错误，但把两个相同词拼成标题就是明显的敷衍。
  // <lang en>Never emit a "Vivid Orange · Vivid Orange" title. Colour names have modifier+hue granularity, so two
  //   shades of one hue can land on the same name (`#F1AF00`/`#D59B00` are both "Vivid Orange") — that is not a
  //   naming error, but joining two identical words into a title is plainly careless.</lang>
  return p===s?p:`${p}·${s}`;
}

// 由部分字段创建完整草稿，基色规范化、渐变深拷贝，保证可预测初值。
// <lang zh-CN>覆盖式合并到默认模板，避免未传字段出现 undefined；纯函数无副作用。</lang>
// <lang en>Override-merges onto the default template to avoid undefined fields; pure and side-effect-free.</lang>
export function createThemeDraft(value:Partial<ThemeDraft>={}):ThemeDraft{
  return{
    ...DEFAULT_THEME_DRAFT,
    ...value,
    // 基色若缺失则回退默认值，并统一归一化为大写 HEX。
    // <lang zh-CN>normalizeHex 让用户随意输入 "#abc" 或 "ABC" 都能稳定存储。</lang>
    // <lang en>normalizeHex stabilizes arbitrary input like "#abc" or "ABC" into a canonical HEX.</lang>
    primary:normalizeHex(value.primary||DEFAULT_THEME_DRAFT.primary),
    secondary:normalizeHex(value.secondary||DEFAULT_THEME_DRAFT.secondary),
    // 渐变深拷贝，隔离外部对象引用。
    // <lang zh-CN>防止调用方持有引用后意外修改默认/已存配置。</lang>
    // <lang en>Prevents accidental external mutation of default/stored configs via retained references.</lang>
    gradients:cloneGradientSettings(value.gradients||DEFAULT_THEME_DRAFT.gradients),
    // 字体/间距令牌（ADR-006 / `W-tb-P9`）：缺省补默认并深拷贝隔离引用。
    // <lang zh-CN>旧数据/旧调用点不携带令牌组时自动获得出厂默认，保证 buildThemeFromDraft 全量可用。</lang>
    // <lang en>Legacy data/call sites without token groups get factory defaults; deep-cloned to isolate references.</lang>
    typography:cloneTypography(value.typography||DEFAULT_TYPOGRAPHY),
    spacing:cloneSpacing(value.spacing||DEFAULT_SPACING),
    // 配色关系扩展（ADR-007 v2 / `W-tb-P11`）：seriesMode 缺省 dual、seriesRelation 缺省 manual（现行行为）；
    //   auxiliary 为独立维度缺省空数组（无自动推导，手动/规则生成由 UI 写入）；thirdColor 仅 triad 存在（缺省不写键）。
    // <lang zh-CN>第三色缺省由 buildTheme 装配时按关系规则推导；辅助缺省 []。</lang>
    // <lang en>thirdColor defaults to buildTheme derivation; auxiliary defaults to [].</lang>
    seriesMode:value.seriesMode??'dual',
    seriesRelation:value.seriesRelation??'manual',
    ...(value.thirdColor?{thirdColor:{...value.thirdColor,scale:{...value.thirdColor.scale}}}:{}),
    auxiliary:value.auxiliary?[...value.auxiliary]:[],
    ...(value.auxiliaryModifiers?{auxiliaryModifiers:[...value.auxiliaryModifiers]}:{})
  };
}

// 由预设反解为可编辑草稿（保留预设 id 以便回写识别）。
// <lang zh-CN>载入操作台时使用，gradients 缺失则回落默认。</lang>
// <lang en>Used when loading into the studio; falls back to defaults when gradients are absent.</lang>
export function draftFromPreset(preset:Preset):ThemeDraft{
  return createThemeDraft({id:preset.id,name:preset.name,category:preset.category,industry:preset.industry,primary:preset.primary,secondary:preset.secondary,primaryName:preset.primaryName,secondaryName:preset.secondaryName,note:preset.note,gradients:preset.gradients,seriesMode:preset.seriesMode,seriesRelation:preset.seriesRelation,thirdColor:preset.thirdColor,auxiliary:preset.auxiliary});
}

// 将草稿构建为完整主题，名称缺省时按主副色名自动生成。
// <lang zh-CN>草稿到渲染/导出的桥梁，所有色阶在此计算；typography/spacing 随草稿透传（ADR-006）。</lang>
// <lang en>Bridge from draft to render/export; all scales are computed here; typography/spacing pass through (ADR-006).</lang>
export function buildThemeFromDraft(draft:ThemeDraft):Theme{
  return buildTheme({name:draft.name||autoThemeName(draft.primaryName,draft.secondaryName),category:draft.category,industry:draft.industry,primary:draft.primary,secondary:draft.secondary,primaryName:draft.primaryName,secondaryName:draft.secondaryName,note:draft.note,gradients:draft.gradients,typography:draft.typography,spacing:draft.spacing,seriesMode:draft.seriesMode,seriesRelation:draft.seriesRelation,thirdColor:draft.thirdColor,auxiliary:draft.auxiliary,auxiliaryModifiers:draft.auxiliaryModifiers});
}

// 由草稿导出为可保存预设，id 缺失时以时间戳生成自定义 id。
// <lang zh-CN>保存/导出时使用，基色再次规范化确保持久化一致。</lang>
// <lang en>Used for save/export; base colors are re-normalized for consistent persistence.</lang>
export function presetFromDraft(draft:ThemeDraft,id=`custom-${Date.now()}`):Preset{
  return{id,name:draft.name||autoThemeName(draft.primaryName,draft.secondaryName),category:draft.category||'custom',industry:draft.industry||'',primary:normalizeHex(draft.primary),secondary:normalizeHex(draft.secondary),primaryName:draft.primaryName||nameColor(draft.primary).zh,secondaryName:draft.secondaryName||nameColor(draft.secondary).zh,note:draft.note||'由主副色操作台生成导入。',gradients:cloneGradientSettings(draft.gradients),...(draft.seriesMode&&draft.seriesMode!=='dual'?{seriesMode:draft.seriesMode}:{}),...(draft.seriesRelation&&draft.seriesRelation!=='manual'?{seriesRelation:draft.seriesRelation}:{}),...(draft.thirdColor?{thirdColor:{...draft.thirdColor,scale:{...draft.thirdColor.scale}}}:{}),...(draft.auxiliary?.length?{auxiliary:draft.auxiliary.map(a=>({...a,scale:{...a.scale}}))}:{})};
}

// 在候选库中按主副色同时匹配出对应候选（用于回显“当前主色”来源）。
// <lang zh-CN>仅当主色与推荐副色都一致才命中，避免近似色误判。</lang>
// <lang en>Matches only when both primary and recommended secondary align, avoiding near-color false hits.</lang>
export function findMatchingPrimaryCandidate(draft:Pick<ThemeDraft,'primary'|'secondary'>,candidates:readonly PrimaryCandidate[]):PrimaryCandidate|undefined{
  return candidates.find(c=>normalizeHex(c.hex)===normalizeHex(draft.primary)&&normalizeHex(c.secondaryHex)===normalizeHex(draft.secondary));
}

// 为草稿生成副色候选集；若传入已匹配主色候选则优先置顶其推荐副色。
// <lang zh-CN>preferred 命中时把预设副色排到首位并标记“推荐”，其余按和谐方案生成。</lang>
// <lang en>When a matched candidate is given, its recommended secondary is pinned first and flagged; others come from harmony schemes.</lang>
export function secondarySetForDraft(draft:ThemeDraft,candidate?:PrimaryCandidate|null):SecondaryCandidate[]{
  // 仅当候选主色与草稿主色一致时，才采用其推荐副色作为置顶项。
  // <lang zh-CN>不一致则说明草稿已手动改色，不应强套候选的副色。</lang>
  // <lang en>If inconsistent, the draft was manually recolored and the candidate's secondary must not be forced.</lang>
  const preferred=candidate&&normalizeHex(candidate.hex)===normalizeHex(draft.primary)?{hex:candidate.secondaryHex,name:candidate.secondaryName,scheme:candidate.secondaryScheme}:{hex:draft.secondary,name:draft.secondaryName,scheme:'主题预设'};
  return generateSecondarySet(draft.primary,preferred);
}

// 合并内置与自定义预设，内置在前（列表展示顺序约定）。
// <lang zh-CN>纯拼接，不改变两者内容；自定义可覆盖展示于后置位。</lang>
// <lang en>Pure concatenation preserving both lists; custom presets appear after built-ins.</lang>
export function mergePresets(builtin:readonly Preset[],custom:readonly Preset[]):Preset[]{return[...builtin,...custom];}

// 按关键词与分类过滤预设；query 在多个字段中做不区分大小写包含匹配。
// <lang zh-CN>category 为 'all' 时忽略分类；空 query 返回全量，便于搜索框即时筛选。</lang>
// <lang en>Ignores category when 'all'; empty query returns all, enabling instant search-box filtering.</lang>
export function filterPresets(presets:readonly Preset[],query:string,category:string):Preset[]{
  const q=query.trim().toLowerCase();
  return presets.filter(p=>(category==='all'||p.category===category)&&(!q||[p.name,p.primary,p.secondary,p.primaryName,p.secondaryName,p.industry,p.note].join(' ').toLowerCase().includes(q)));
}

// 按 id 插入或更新预设：已存在则替换，否则置顶新增。
// <lang zh-CN>不可变更新，返回新数组；新预设放最前符合“最近编辑”直觉。</lang>
// <lang en>Immutable update returning a new array; new presets go first matching "most recent" intuition.</lang>
export function upsertPreset(list:readonly Preset[],preset:Preset):Preset[]{
  const index=list.findIndex(x=>x.id===preset.id);
  if(index<0)return[preset,...list];
  const next=[...list];
  next[index]=preset;
  return next;
}

// 按 id 删除预设，返回过滤后的新数组。
// <lang zh-CN>不可变删除；内置预设 id 以 'preset-'/'tone-' 开头，调用方应先用 isBuiltinPresetId 拦截。</lang>
// <lang en>Immutable removal; callers should block built-ins via isBuiltinPresetId first.</lang>
export function removePreset(list:readonly Preset[],id:string):Preset[]{return list.filter(x=>x.id!==id);}

// 判断预设 id 是否为内置（不可删除/覆盖）。
// <lang zh-CN>内置预设 id 以 'preset-'（经典内置）或 'tone-'（语气预设，W-tb-P15）前缀，作为写保护的简单契约。</lang>
// <lang en>Built-in ids carry the 'preset-' (classic) or 'tone-' (tone presets, W-tb-P15) prefix as a write-protection contract.</lang>
export function isBuiltinPresetId(id:string):boolean{return id.startsWith('preset-')||id.startsWith('tone-');}

// 将预设数组序列化为带 schema 版本的库文档字符串。
// <lang zh-CN>使用 satisfies 校验结构同时保留字面量类型，便于未来版本迁移。</lang>
// <lang en>Uses `satisfies` to validate shape while keeping literal types for future migrations.</lang>
export function serializeThemeLibrary(presets:readonly Preset[]):string{return JSON.stringify({schemaVersion:1,presets:[...presets]}satisfies ThemeLibraryDocument);}

// 解析库文档字符串；兼容旧版数组格式，解析失败安全返回空数组。
// <lang zh-CN>容错解析：空/非法输入均回退 []，基色与渐变在载入时统一规范化与深拷贝。</lang>
// <lang en>Fault-tolerant: empty/invalid input falls back to []; base colors and gradients are normalized/cloned on load.</lang>
export function parseThemeLibrary(raw:string|null|undefined):Preset[]{
  if(!raw)return[];
  try{
    const parsed=JSON.parse(raw)as Partial<ThemeLibraryDocument>|Preset[];
    // 兼容两种形态：纯数组（旧）或带 schemaVersion 的文档（新）。
    // <lang zh-CN>旧格式直接当预设数组；新格式取 presets 字段；其余视为空。</lang>
    // <lang en>Legacy: treat as preset array; current: read presets; otherwise empty.</lang>
    const list=Array.isArray(parsed)?parsed:parsed.schemaVersion===1?parsed.presets:[];
    return Array.isArray(list)?list.map(p=>({...p,primary:normalizeHex(p.primary),secondary:normalizeHex(p.secondary),gradients:p.gradients?cloneGradientSettings(p.gradients):undefined})):[];
  }catch{
    return[];
  }
}

// 解析渐变配置字符串；失败或缺失时回退到给定 fallback（默认全局默认）。
// <lang zh-CN>独立持久化渐变时调用；深拷贝避免外部引用污染默认值。</lang>
// <lang en>Called when gradients are persisted separately; deep clone avoids external ref pollution of defaults.</lang>
export function parseGradientSettings(raw:string|null|undefined,fallback:GradientSettings=GRADIENT_DEFAULTS):GradientSettings{
  if(!raw)return cloneGradientSettings(fallback);
  try{
    return cloneGradientSettings(JSON.parse(raw)as GradientSettings);
  }catch{
    return cloneGradientSettings(fallback);
  }
}
