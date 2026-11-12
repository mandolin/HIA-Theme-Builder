/**
 * @lang zh-CN 仅依赖 DOM 的共享操作台渲染器。主题模型、颜色算法、渐变、预设与令牌导出均来自 @hia/theme-core，
 *   使浏览器 / Electron / Tauri 复用同一套领域实现；本文件只负责把状态映射到界面并绑定交互。
 * @lang en DOM-only shared studio renderer. Theme models, color algorithms, gradients, presets and token export come from @hia/theme-core,
 *   so Browser/Electron/Tauri share one domain implementation; this file only maps state to the UI and binds interactions.
 */
import{
  GRADIENT_DEFAULTS,GRADIENT_DEFS,autoThemeName,buildThemeFromDraft,builtinPresets,
  cloneGradientSettings,cloneSpacing,cloneTypography,createRuntimeCssVariables,createThemeDraft,draftFromPreset,
  decodeShareHash,DEFAULT_SPACING,DEFAULT_TYPOGRAPHY,encodeShareHash,buildSharePayload,
  exportThemeCss,exportThemeJson,filterPresets,findMatchingPrimaryCandidate,
  fontSizeAt,FONT_SIZE_STEPS,generateSecondarySet,getExportTarget,
  gradientCss,isBuiltinPresetId,mergeImportedPresets,mergePresets,normalizeHex,parseGradientSettings,parseThemeLibrary,parseThemePack,
  presetFromDraft,primaryCandidates,removePreset,secondarySetForDraft,serializeThemeLibrary,spacingSequence,
  swapGradientBias,tonalScaleAt,upsertPreset,validHex,tonalScale,bestOnColor,
  BAODIAN_PALETTE,BAODIAN_FORM_NAMES,FORM_PACKS,SERIES_RELATION_DEFS,AUXILIARY_MAX,
  tonePresets,buildTonePreset,shiftHueTo,anchorComboMembers,TONE_AUX_SLOTS,TRADITIONAL_COLORS,FLAG_COLORS,BRAND_COLORS,NATURE_COLORS,SOCIAL_COLORS,
  deriveSecondaryByRelation,deriveThirdByRelation,generateAuxiliaryCandidates,
  type SeriesMode,type SeriesRelationId,type RoleColor,
  type Theme,type ThemeDraft,type Preset,type PrimaryCandidate,type SecondaryCandidate,type GradientBias,type ShadeKey,
  type TypographyTokens,type SpacingTokens,
  type WebsiteThemeAnalysisV2
}from'@hia/theme-core';
import{zipSync,strToU8}from'fflate';
import{all,byId,inputValue,setInputValue,setText}from'./dom.js';
import{t,setLocale,getLocale,applyAll}from'./i18n/index.js';
import type{ThemeManagerPlatform}from'./platform.js';

// 操作台对宿主暴露的控制句柄：读取草稿/主题、应用外部草稿、销毁。
// <lang zh-CN>Electron/Tauri 桥可借此在外部（如原生面板）驱动操作台状态。</lang>
// <lang en>Electron/Tauri bridges can drive the studio state externally (e.g. from a native panel).</lang>
export interface ThemeManagerHandle{getDraft():ThemeDraft;getTheme():Theme;applyDraft(draft:ThemeDraft):void;dispose():void;}

// 自定义预设存储键（版本化，便于未来迁移）。
// <lang zh-CN>与 parseThemeLibrary/serializeThemeLibrary 配对使用。</lang>
// <lang en>Paired with parseThemeLibrary/serializeThemeLibrary.</lang>
const THEME_STORAGE='hia-theme-manager-presets-v1';
  // 渐变设置独立存储键（与预设库分开，便于单独持久化当前渐变）。
  // <lang zh-CN>载入时覆盖草稿的 gradients，使渐变编辑跨会话保留。</lang>
  // <lang en>Overlays the draft's gradients on load so gradient edits persist across sessions.</lang>
  const GRADIENT_STORAGE='hia-gradient-settings-v1';
  // 字体/间距令牌独立存储键（ADR-006 / `W-tb-P9`）：与渐变同一持久化先例。
  // <lang zh-CN>分别存 typoState/spaceState 的 JSON；解析失败回退默认。</lang>
  // <lang en>JSON of typoState/spaceState stored separately; parse failures fall back to defaults.</lang>
  const TYPOGRAPHY_STORAGE='hia-typography-tokens-v1';
  const SPACING_STORAGE='hia-spacing-tokens-v1';
  // 远程源列表与默认官方源（`W-tb-P10` 定案：内置 GitHub Pages/raw 托管示例 JSON）。
  // <lang zh-CN>源列表持久化；默认源始终存在（不可移除），raw.githubusercontent CORS 友好。</lang>
  // <lang en>Source list persisted; the default source is always present and not removable; raw.githubusercontent is CORS-friendly.</lang>
  const REMOTE_SOURCES_STORAGE='hia-remote-sources-v1';
  const DEFAULT_REMOTE_SOURCE='https://raw.githubusercontent.com/mandolin/HIA-Theme-Builder/main/examples/theme-pack.json';
// 色阶下拉选项：由深到浅排列，符合选色直觉。
// <lang zh-CN>与 SHADE_KEYS 同值，仅顺序不同（UI 偏好深→浅）。</lang>
// <lang en>Same values as SHADE_KEYS but ordered dark→light for UI preference.</lang>
const shadeValues:ShadeKey[]=['900','800','700','600','500','400','300','200','100','50'];
// 渐变方向建议项（CSS 角度，组合框 datalist；自由填写合法 CSS 角度/关键字亦接受）。
// <lang zh-CN>覆盖常用对角线与水平/垂直方向（`W-tb-P8` 组合框化）。</lang>
// <lang en>Covers common diagonal and horizontal/vertical directions (`W-tb-P8` combobox).</lang>
const directions=['45deg','90deg','110deg','120deg','135deg','160deg','180deg'] as const;
// 方向建议的箭头标签（datalist 展示用）。
// <lang zh-CN>提升 datalist 可读性，避免纯角度难以理解。</lang>
// <lang en>Improves datalist readability versus bare angles.</lang>
const directionLabels:Record<string,string>={'45deg':'↗ 45°','90deg':'→ 90°','110deg':'↘ 110°','120deg':'↘ 120°','135deg':'↘ 135°','160deg':'↘ 160°','180deg':'↓ 180°'};
// 渐变占比建议项（`W-tb-P8` 组合框 datalist；自由百分比经 parseBiasInput 解析）。
// <lang zh-CN>对应四种常用策略；数值化后任意 0-100 均合法。</lang>
// <lang en>Four common strategies; any 0-100 is valid after numeric generalization.</lang>
const biasValues:GradientBias[]=['front75','front65','end65','end75'];
// 占比 → 可读标签（渲染时经 t() 现算，模板插值支持任意 N）。
// <lang zh-CN>不能在模块加载时固化——那会锁定初始语言。</lang>
// <lang en>Must not be fixed at module load — that would freeze the initial locale.</lang>
function biasLabel(bias:GradientBias):string{
  const m=/^(front|end)(\d{1,3})$/.exec(bias);
  return m?t(m[1]!=='front'?'后色占 {n}%':'前色占 {n}%',{n:m[2]!}):bias;
}
// 占比输入解析（`W-tb-P8`）：接受 front/end 原始值、纯数字/百分比、中文标签三种形态。
// <lang zh-CN>'75'/'75%'/‘前色占 75%’/‘front75’ 均解析为 front75；裸数字默认按前色占比处理；
//   无法解析返回 null，由调用方回退原值。</lang>
// <lang en>'75'/'75%'/‘前色占 75%’/'front75' all parse to front75; a bare number defaults to the
//   start color; unparseable input returns null for the caller to revert.</lang>
function parseBiasInput(raw:string):GradientBias|null{
  const text=raw.trim();
  if(!text)return null;
  // 1) 原始值形态：front75 / end30（0-100）。
  // <lang zh-CN>与 core 的 BIAS_RE 同口径。</lang>
  // <lang en>Same bar as core's BIAS_RE.</lang>
  let m=/^(front|end)(\d{1,3})$/.exec(text);
  if(m){const n=parseInt(m[2]!,10);if(n>=0&&n<=100)return text as GradientBias;}
  // 2) 中文标签形态：前色占 N% / 后色占 N%。
  // <lang zh-CN>组合框预填标签的回显解析。</lang>
  // <lang en>Parses the prefilled label back into a value.</lang>
  m=/^(前|后)色占\s*(\d{1,3})\s*%?$/.exec(text);
  if(m){const n=parseInt(m[2]!,10);if(n>=0&&n<=100)return(m[1]==='前'?`front${n}`:`end${n}`)as GradientBias;}
  // 3) 数字/百分比形态：[front|end ]?N%?（裸数字默认按前色占比）。
  // <lang zh-CN>覆盖 '75'、'75%'、'end 60%'。</lang>
  // <lang en>Covers '75', '75%', 'end 60%'.</lang>
  m=/^(front|end)?\s*(\d{1,3})\s*%?$/.exec(text);
  if(m){const n=parseInt(m[2]!,10);if(n>=0&&n<=100)return((m[1]==='end'?'end':'front')+n)as GradientBias;}
  return null;
}

// 转义 HTML 特殊字符，防止插入用户/候选文本时产生 XSS。
// <lang zh-CN>用于所有动态拼入 innerHTML 的字符串。</lang>
// <lang en>Used for every dynamic string injected into innerHTML.</lang>

// 自研组合框交互（`W-tb-P8` v2）：点开常显全部预设、输入即过滤、键盘可达、外点关闭。
// <lang zh-CN>原生 datalist 按已填值前缀过滤会导致预设消失，故自研；commit 经 change 事件
//   走既有字段校验链；mousedown preventDefault 防止选项点击前触发输入框 blur 丢焦点。</lang>
// <lang en>Native datalist prefix-filters away presets, hence custom dropdown; commits go through
//   the existing field validation via change; mousedown preventDefault keeps input focus.</lang>
function bindCombos(scope:HTMLElement):void{
  all<HTMLElement>('.combo',scope).forEach(combo=>{
    const input=combo.querySelector<HTMLInputElement>('input');
    const list=combo.querySelector<HTMLElement>('.combo-list');
    if(!input||!list)return;
    const options=Array.from(combo.querySelectorAll<HTMLButtonElement>('.combo-option'));
    let idx=-1;
    const open=()=>{ list.hidden=false; idx=-1; options.forEach(o=>o.classList.toggle('active',o.dataset.value===input.value)); };
    const close=()=>{ list.hidden=true; };
    const commit=(v:string)=>{ input.value=v; close(); input.dispatchEvent(new Event('change',{bubbles:true})); };
    const visible=()=>options.filter(o=>!o.hidden);
    // 聚焦/输入：打开并按输入过滤（contains，大小写不敏感）；无匹配则全显。
    // <lang zh-CN>过滤只是辅助定位，预设项永不因已填值而消失。</lang>
    // <lang en>Filtering aids discovery; presets never disappear because of the filled value.</lang>
    input.addEventListener('focus',open);
    input.addEventListener('input',()=>{
      open();
      const q=input.value.trim().toLowerCase();
      const hits=options.filter(o=>q===''||o.dataset.value!.toLowerCase().includes(q)||o.textContent!.toLowerCase().includes(q));
      options.forEach(o=>{ o.hidden=!hits.includes(o); });
      idx=-1;
    });
    combo.querySelector<HTMLButtonElement>('.combo-toggle')?.addEventListener('click',()=>{ if(list.hidden){open();}else{close();} input.focus(); });
    options.forEach(o=>{
      o.addEventListener('mousedown',e=>e.preventDefault());
      o.addEventListener('click',()=>commit(o.dataset.value!));
    });
    input.addEventListener('keydown',e=>{
      if(e.key==='ArrowDown'){ e.preventDefault(); if(list.hidden){open();} else { const vis=visible(); if(vis.length){ const base=idx>=0?vis.indexOf(options[idx]!):-1; const next=vis[(base+1)%vis.length]!; idx=options.indexOf(next); options.forEach((o,j)=>o.classList.toggle('cursor',j===idx)); } } }
      else if(e.key==='ArrowUp'){ e.preventDefault(); const vis=visible(); if(vis.length){ const base=idx>=0?vis.indexOf(options[idx]!):0; const prev=vis[(base+vis.length-1)%vis.length]!; idx=options.indexOf(prev); options.forEach((o,j)=>o.classList.toggle('cursor',j===idx)); } }
      else if(e.key==='Enter'){ const target=idx>=0?options[idx]!:null; if(target&&!target.hidden){ e.preventDefault(); commit(target.dataset.value!); } else { close(); } }
      else if(e.key==='Escape'){ close(); }
    });
  });
}
function escapeHtml(value:unknown):string{return String(value??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]??ch));}

/**
 * @lang zh-CN 挂载主题操作台：初始化状态、渲染各区域、绑定事件并返回控制句柄。
 *   整个交互通过闭包维护可变状态（draft/候选/预设/布局/外观），所有渲染函数共享同一份状态。
 * @lang en Mount the theme studio: init state, render regions, bind events and return a control handle.
 *   Interaction state (draft/candidates/presets/layout/appearance) lives in the closure; all renderers share it.
 */
export function mountThemeManager(platform:ThemeManagerPlatform):ThemeManagerHandle{
  // 当前编辑主题草稿（操作台单一事实来源）。
  // <lang zh-CN>所有输入/预览/导出均源自 draft。</lang>
  // <lang en>All inputs/previews/exports derive from draft.</lang>
  let draft=createThemeDraft();
  // 当前选中的预设 id（用于列表“当前”标记与回写识别）。
  // <lang zh-CN>默认为官方默认预设。</lang>
  // <lang en>Defaults to the official default preset.</lang>
  let selectedPresetId='preset-default';
  // 当前主色对应的候选库条目（用于生成推荐副色）。
  // <lang zh-CN>仅在候选命中时非空，否则按草稿当前副色生成候选集。</lang>
  // <lang en>Non-null only when a library candidate matches; otherwise candidates derive from the draft's secondary.</lang>
  let primaryMeta:PrimaryCandidate|null=primaryCandidates.find(x=>x.id==='cobalt')||null;
  // 副色候选集（随主色变化重算）。
  // <lang zh-CN>驱动“副色候选”面板，首个通常为推荐副色。</lang>
  // <lang en>Drives the "secondary candidates" panel; the first is usually the recommended one.</lang>
  let secondaryCandidates:SecondaryCandidate[]=[];
  // 用户自定义预设列表（与内置合并后展示）。
  // <lang zh-CN>独立于内置预设，可增删改并由存储持久化。</lang>
  // <lang en>Separate from built-ins; CRUD-able and persisted via storage.</lang>
  let customPresets:Preset[]=[];
  // PC 预览布局模式（左右/上下/混合）。
  // <lang zh-CN>影响 pcContent 的 CSS 类与侧栏/顶栏显隐。</lang>
  // <lang en>Affects pcContent CSS class and sidebar/topbar visibility.</lang>
  let layoutMode:'sidebar'|'top'|'mixed'='sidebar';
  // PC 预览外观模式（浅/深）。
  // <lang zh-CN>切换 pcShell/wxFrame 的 dark 类。</lang>
  // <lang en>Toggles the dark class on pcShell/wxFrame.</lang>
  let appearanceMode:'light'|'dark'='light';

  // 网址取色探索状态（指令十五节）：最近一次探索分析、阶段状态与是否正在探索。
  // <lang zh-CN>exploreResult 为 V2 报告；exploreStage 驱动阶段状态徽标；exploring 防重复提交。</lang>
  // <lang en>exploreResult is the V2 report; exploreStage drives the status badge; exploring prevents duplicate submits.</lang>
  let exploreResult:WebsiteThemeAnalysisV2|null=null;
  let exploreStage:'idle'|'exploring'|'done'|'degraded'|'error'='idle';
  let exploring=false;

  // `W-tb-P9` 预览/导出联动状态：预览三类型与导出三 Tab 同构联动（模式级），经典/导出目标独立记忆。
  // <lang zh-CN>previewMode 驱动预览区面板显隐；classicTargetId 为经典预览目标（WP/Tailwind）；
  //   exportTargetId 为导出目标（三选一）；tdonSource 为 TDON 源子 Tab（连接器延后）。</lang>
  // <lang en>`W-tb-P9` preview/export linked state: the three preview types and three export tabs link
  //   isomorphically (mode level); classic/export targets and the TDON source are remembered independently.</lang>
  let previewMode:'default'|'classic'|'tdon'='default';
  let classicTargetId:'wordpress-child'|'tailwind-config'='wordpress-child';
  let exportTargetId='wordpress-child';
  let tdonSource:'url'|'local'='url';
  // 导出文件树当前选中文件（null=未选中，仅展示清单）。
  // <lang zh-CN>点击清单行后显示对应文件内容预览。</lang>
  // <lang en>After clicking a tree row its content shows in the preview pane.</lang>
  let selectedExportFile:string|null=null;

  // `W-tb-P10` 市场状态：子 Tab、远程源列表与已加载的远程预设（内存态，不自动混入本地库）。
  // <lang zh-CN>remoteSources 含默认源（首位，不可移除）；remoteLoading 防重复提交。</lang>
  // <lang en>remoteSources includes the default source (first, not removable); remoteLoading guards duplicates.</lang>
  let marketTab:'local'|'remote'='local';
  let remoteSources:string[]=[DEFAULT_REMOTE_SOURCE];
  let remotePresets:Preset[]=[];
  let remoteDropped=0;
  let remoteLoading=false;

  // 字体/间距令牌状态（ADR-006）：作为操作台全局状态独立于预设（预设仅携带颜色+渐变，既定决策）。
  // <lang zh-CN>typoState/spaceState 与 draft.typography/spacing 共享同一对象引用；换预设/应用草稿后重新挂回，
  //   保证字体/间距编辑跨预设保留（与渐变独立持久化同一先例）。</lang>
  // <lang en>typoState/spaceState share object references with draft.typography/spacing; re-attached after preset
  //   swaps/draft applies so typography/spacing edits survive preset changes (same precedent as gradient persistence).</lang>
  let typoState:TypographyTokens=cloneTypography(DEFAULT_TYPOGRAPHY);
  let spaceState:SpacingTokens=cloneSpacing(DEFAULT_SPACING);

  // 由当前草稿构建完整主题（用于渲染/导出）。
  // <lang zh-CN>每次调用都会重新计算色阶，确保与草稿同步。</lang>
  // <lang en>Recomputes scales each call so it stays in sync with the draft.</lang>
  function theme():Theme{return buildThemeFromDraft(draft);}
  // 合并内置与自定义预设，作为列表与查找的完整来源。
  // <lang zh-CN>内置在前，自定义在后。</lang>
  // <lang en>Built-ins first, custom after.</lang>
  // 锚定模式状态（W-tb-P16）：默认直用；localStorage 键 hia-baodian-anchor 持久化（维护者定案 2）。
  // <lang en>Anchor-mode state: default off (literal), persisted under 'hia-baodian-anchor'.</lang>
  let baodianAnchor=false;
  try{baodianAnchor=localStorage.getItem('hia-baodian-anchor')==='1';}catch{/* 隐私模式忽略 */}
  function saveAnchorMode(v:boolean){baodianAnchor=v;try{localStorage.setItem('hia-baodian-anchor',v?'1':'0');}catch{/* ignore */}}

  // 多源选色（W-tb-P17）：当前源（宝典/传统色）；下拉菜单开关与源切换在 bind() 接线。
  // <lang en>Multi-source picker state (W-tb-P17): current color source for the modal.</lang>
  let colorSource:'baodian'|'traditional'|'flag'|'brand'|'nature'|'social'='baodian';
  // 传统色源内文化分组（日/中）。
  let baodianTcCulture:'en'|'cn'|'ja'|'kr'='en';
  // 国旗源洲别 / 企业源行业（W-tb-P18）。
  let baodianFlagGroup='asia';
  let baodianBrandGroup='tech';
  // 自然源分类 / 社会场景分类（W-tb-P19）。
  let baodianNatureGroup='sky';
  let baodianSocialGroup='emergency';

  function getAllPresets():Preset[]{
    // 内置库合入语气预设（W-tb-P15）：tone- 前缀内置对象随产品分发，与经典内置同权（不可删除）。
    // <lang en>Built-in library merges the tone presets; they ship with the app and are write-protected.</lang>
    return mergePresets([...builtinPresets,...tonePresets],customPresets);
  }
  // 持久化自定义预设到平台存储。
  // <lang zh-CN>序列化前会规范化基色，保证读写一致。</lang>
  // <lang en>Base colors are normalized before serialization for consistent round-trips.</lang>
  function saveCustomPresets(){platform.storage.setItem(THEME_STORAGE,serializeThemeLibrary(customPresets));}
  // 持久化当前渐变设置到平台存储（独立于预设库）。
  // <lang zh-CN>确保渐变编辑不依赖预设保存也能跨会话保留。</lang>
  // <lang en>Ensures gradient edits persist across sessions even without saving a preset.</lang>
  function saveGradients(){platform.storage.setItem(GRADIENT_STORAGE,JSON.stringify(draft.gradients));}
  // 持久化字体/间距令牌到平台存储（ADR-006 / `W-tb-P9`）。
  // <lang zh-CN>与渐变同一先例：独立键、编辑即存、失败不阻断（storage 实现自行容错）。</lang>
  // <lang en>Same precedent as gradients: separate keys, save-on-edit, non-blocking failures.</lang>
  function saveTypography(){platform.storage.setItem(TYPOGRAPHY_STORAGE,JSON.stringify(typoState));platform.storage.setItem(SPACING_STORAGE,JSON.stringify(spaceState));}
  // 从平台存储恢复字体/间距令牌；非法/缺失回退默认。
  // <lang zh-CN>逐字段校验类型与范围，防止脏数据污染渲染（字体串任意、数值钳制）。</lang>
  // <lang en>Per-field type/range validation keeps stale data from polluting rendering (families free-form, numbers clamped).</lang>
  function loadTypography(){
    try{
      const rawTy=platform.storage.getItem(TYPOGRAPHY_STORAGE);
      if(rawTy){
        const p=JSON.parse(rawTy) as Partial<TypographyTokens>;
        if(p&&typeof p==='object'){
          const fam={body:String(p.fontFamily?.body??DEFAULT_TYPOGRAPHY.fontFamily.body),heading:String(p.fontFamily?.heading??DEFAULT_TYPOGRAPHY.fontFamily.heading),mono:String(p.fontFamily?.mono??DEFAULT_TYPOGRAPHY.fontFamily.mono)};
          // 缺失/非对象则空对象，字段级 clampNum 兜底默认。
          // <lang zh-CN>scale 经显式类型断言收窄为 Partial，避免 {} 推导丢失属性。</lang>
          // <lang en>The scale narrows via an explicit Partial assertion, avoiding {} property loss.</lang>
          const scale=(p.fontSizeScale&&typeof p.fontSizeScale==='object'?p.fontSizeScale:{}) as Partial<TypographyTokens['fontSizeScale']>;
          typoState={fontFamily:fam,fontSizeScale:{base:clampNum(scale.base,DEFAULT_TYPOGRAPHY.fontSizeScale.base,9,48),ratio:clampNum(scale.ratio,DEFAULT_TYPOGRAPHY.fontSizeScale.ratio,1,3)},lineHeightBody:clampNum(p.lineHeightBody,DEFAULT_TYPOGRAPHY.lineHeightBody,1,2.4)};
        }
      }
      const rawSp=platform.storage.getItem(SPACING_STORAGE);
      if(rawSp){
        const p=JSON.parse(rawSp) as Partial<SpacingTokens>;
        if(p&&typeof p==='object'){
          const step=p.step==='linear4'||p.step==='x15'?p.step:p.step==='x2'?'x2':DEFAULT_SPACING.step;
          spaceState={base:clampNum(p.base,DEFAULT_SPACING.base,2,32),step,levels:Math.round(clampNum(p.levels,DEFAULT_SPACING.levels,1,12))};
        }
      }
    }catch{
      // <lang zh-CN>解析失败回退默认（与 parseGradientSettings 同策略）。</lang>
      // <lang en>Parse failure falls back to defaults (same policy as parseGradientSettings).</lang>
      typoState=cloneTypography(DEFAULT_TYPOGRAPHY);
      spaceState=cloneSpacing(DEFAULT_SPACING);
    }
  }
  // 数值钳制工具：非数值回退 fallback，否则夹取到 [min,max]。
  // <lang zh-CN>仅用于令牌恢复与输入校验的局部工具。</lang>
  // <lang en>Local helper for token restore and input validation.</lang>
  function clampNum(v:unknown,fallback:number,min:number,max:number):number{
    const n=typeof v==='number'?v:parseFloat(String(v));
    return Number.isFinite(n)?Math.min(max,Math.max(min,n)):fallback;
  }
  // 把当前字体/间距状态挂回草稿（换预设/应用草稿后调用，共享引用）。
  // <lang zh-CN>共享引用保证后续对 typoState 的编辑同步作用于 draft，buildThemeFromDraft 即取最新值。</lang>
  // <lang en>Shared references keep later typoState edits in sync with the draft, so buildThemeFromDraft always sees fresh values.</lang>
  function attachTokensToDraft(){draft.typography=typoState;draft.spacing=spaceState;}

  // 把当前主题应用到运行时：写入 :root CSS 变量，并刷新每个渐变角色的预览与说明文字。
  // <lang zh-CN>是“状态→界面”的核心同步点，任何状态变更后调用。</lang>
  // <lang en>Core state→UI sync point, called after any state change.</lang>
  function applyRuntimeTheme(){
    // 生成变量并注入文档根，驱动所有依赖 var() 的样式。
    // <lang zh-CN>包括角色基色、10 级色阶与渐变变量。</lang>
    // <lang en>Includes role base colors, 10-step scales and gradient vars.</lang>
    const vars=createRuntimeCssVariables(theme());
    Object.entries(vars).forEach(([key,value])=>document.documentElement.style.setProperty(key,value));
    // 逐渐变角色更新预览背景与“色系 起→止”文字说明。
    // <lang zh-CN>预览用 runtime 模式引用当前 var()，文字展示所选用阶。</lang>
    // <lang en>Preview uses runtime mode vars; text shows chosen steps.</lang>
    GRADIENT_DEFS.forEach(def=>{
      const cfg=draft.gradients[def.key];
      const preview=document.querySelector<HTMLElement>(`[data-gradient-preview="${def.key}"]`);
      if(preview)preview.style.background=gradientCss(cfg,'runtime',theme());
      const code=document.querySelector<HTMLElement>(`[data-gradient-code="${def.key}"]`);
      if(code)code.textContent=`${cfg.family==='primary'?'主色':'副色'} ${cfg.start} → ${cfg.end}`;
    });
  }

  // 将草稿写回各表单控件（界面→状态的反向同步，用于载入预设/候选切换后刷新输入）。
  // <lang zh-CN>仅更新值不改变草稿；分类在选项中不存在时回退 custom。</lang>
  // <lang en>Only writes values without mutating the draft; category falls back to custom when absent.</lang>
  function syncInputs(){
    setInputValue('themeNameInput',draft.name||autoThemeName(draft.primaryName,draft.secondaryName));
    const category=byId<HTMLSelectElement>('themeCategoryInput');
    // 分类选项中若无当前值，回退 'custom' 以免出现空选。
    // <lang zh-CN>避免脏数据导致下拉错位。</lang>
    // <lang en>Avoids dropdown desync from stale data.</lang>
    category.value=Array.from(category.options).some(x=>x.value===draft.category)?draft.category:'custom';
    setInputValue('primaryPicker',draft.primary);setInputValue('secondaryPicker',draft.secondary);
    setInputValue('primaryHexInput',draft.primary);setInputValue('secondaryHexInput',draft.secondary);
    setInputValue('primaryNameInput',draft.primaryName);setInputValue('secondaryNameInput',draft.secondaryName);
    // 第三色一等位（ADR-007 v2 定案 1）：仅三色模式显示；值来自草稿第三色（装配语义下草稿缺省由面板推导写入）。
    // <lang zh-CN>非三色模式隐藏整行；dual/single 不显示第三色拾色器。</lang>
    // <lang en>The third row shows in triad only.</lang>
    // 三格显隐：single 隐藏副/第三格（主色系 1 色）；triad 显示第三格。
    // <lang zh-CN>single 模式装配的 secondary 变体仍由 theme().secondary 承载，但操作台不显示其编辑位。</lang>
    // <lang en>single hides secondary/third groups; triad shows all three.</lang>
    const thirdGroup=document.querySelector<HTMLElement>('#seriesPickers [data-picker="third"]');
    if(thirdGroup)thirdGroup.hidden=draft.seriesMode!=='triad';
    const secGroup=document.querySelector<HTMLElement>('#seriesPickers [data-picker="secondary"]');
    if(secGroup)secGroup.hidden=draft.seriesMode==='single';
    if(draft.seriesMode==='triad'&&draft.thirdColor){
      setInputValue('thirdPicker',draft.thirdColor.value);
      setInputValue('thirdHexInput',draft.thirdColor.value);
      setInputValue('thirdNameInput',draft.thirdColor.name);
    }
  }

  // 从表单读取用户输入并校验，成功则写回草稿；updateName 控制是否按输入覆盖主题名。
  // <lang zh-CN>主副色必须合法 6 位 HEX，否则弹错并返回 false 中止后续渲染。</lang>
  // <lang en>Primary/secondary must be valid 6-digit HEX; otherwise alert and return false to abort rendering.</lang>
  function readInputs(updateName=true):boolean{
    const primary=normalizeHex(inputValue('primaryHexInput'));
    const secondary=normalizeHex(inputValue('secondaryHexInput'));
    // 校验主色；非法则提示并中止。
    // <lang zh-CN>normalizeHex 后仍不合法说明位数/字符错误。</lang>
    // <lang en>Still invalid after normalizeHex means wrong length/characters.</lang>
    if(!validHex(primary)){platform.alert('主色色值无效，请输入 6 位 HEX。');return false;}
    // 校验副色；非法则提示并中止。
    // <lang zh-CN>与主色对称。</lang>
    // <lang en>Symmetric with primary.</lang>
    if(!validHex(secondary)){platform.alert('副色色值无效，请输入 6 位 HEX。');return false;}
    draft.primary=primary;draft.secondary=secondary;
    // 第三色（三色模式）：读输入并组装完整 RoleColor（色阶/前景自动）。
    // <lang zh-CN>非三色模式不读（thirdColor 保持 undefined）。</lang>
    // <lang en>Read only in triad; otherwise thirdColor stays undefined.</lang>
    if(draft.seriesMode==='triad'){
      const thirdRaw=normalizeHex(inputValue('thirdHexInput'));
      if(validHex(thirdRaw)){
        draft.thirdColor={name:inputValue('thirdNameInput').trim()||'第三色',value:thirdRaw,scale:tonalScale(thirdRaw),on:bestOnColor(thirdRaw).hex};
      }
    }
    // 名称留空时回退到已有名或默认“主色/副色”。
    // <lang zh-CN>trim 去除首尾空格，避免空白名。</lang>
    // <lang en>trim removes leading/trailing spaces to avoid blank names.</lang>
    draft.primaryName=inputValue('primaryNameInput').trim()||draft.primaryName||'主色';
    draft.secondaryName=inputValue('secondaryNameInput').trim()||draft.secondaryName||'副色';
    draft.category=inputValue('themeCategoryInput')||draft.category||'custom';
    // updateName=true：用户输入的主题名优先，空则按主副色名自动生成。
    // <lang zh-CN>“应用”按钮走此分支，保证手动命名生效。</lang>
    // <lang en>True path: user-entered name wins, else auto-generate; used by Apply.</lang>
    if(updateName)draft.name=inputValue('themeNameInput').trim()||autoThemeName(draft.primaryName,draft.secondaryName);
    // updateName=false：保留已计算名，仅用输入框值覆盖（若填了）。
    // <lang zh-CN>候选切换时走此分支，避免覆盖自动生成的“主色·副色”。</lang>
    // <lang en>False path: keep computed name unless explicitly typed; used on candidate switch.</lang>
    else draft.name=inputValue('themeNameInput').trim()||draft.name;
    return true;
  }

  // 刷新令牌输出区：CSS 与 JSON 文本域，以及 PC 预览中的令牌代码块。
  // <lang zh-CN>基于当前主题重新导出，保证复制内容始终最新。</lang>
  // <lang en>Re-exports from the current theme so copied content is always fresh.</lang>
  function updateTokenOutputs(){
    const current=theme(),css=exportThemeCss(current);
    setInputValue('cssTokenOutput',css);
    setInputValue('jsonTokenOutput',exportThemeJson(current));
    setText('pcTokenPreview',css);
  }

  // 刷新所有“元信息”展示（预设名/分类/色值/小程序与设置面板中的主题信息）。
  // <lang zh-CN>覆盖操作台右侧与预览区多处只读文本。</lang>
  // <lang en>Updates read-only texts across the studio sidebar and preview regions.</lang>
  function updatePreviewMeta(){
    // 名称/分类/行业经 t() 翻译：内置数据命中字典，用户自定义内容按键缺失静默原样返回。
    // <lang zh-CN>category 为选项键时用 category.* 语义键；为中文标签时按中文原文键回退。</lang>
    // <lang en>Names/categories/industries go through t(): built-in data hits the dictionary;
    //   custom content passes through silently on missing keys.</lang>
    const catKnown=['default','business','industry','award','creative','dark','custom'];
    const catLabel=catKnown.includes(draft.category)?t(`category.${draft.category}`):t(draft.category);
    setText('activePresetName',t(draft.name));
    setText('activePresetMeta',`${catLabel} · ${draft.industry?t(draft.industry):t('未指定行业')}`);
    setText('activePresetColors',`${draft.primary} / ${draft.secondary}`);
    setText('wxThemeBadge',t(draft.name));
    setText('wxDetailThemeName',t(draft.name));
    setText('detailThemeName',t(draft.name));
    setText('settingsThemeName',t(draft.name));
    setText('settingsPrimary',draft.primary);
    setText('settingsSecondary',draft.secondary);
    // 设置页主体色/辅助色体现（W-tb-P12 完善批③）：kv 行与色条按装配结果显隐渲染。
    // <lang zh-CN>读取装配后的 theme()：第三色可能是规则推导产物；辅助槽位 0..n。</lang>
    // <lang en>Reads the assembled theme(): third may be rule-derived; aux slots are 0..n.</lang>
    const sth=theme();
    // sth 装配主题；thirdOn 判定三色且第三色存在。
    const thirdOn=sth.seriesMode==='triad'&&!!sth.thirdColor;
    byId<HTMLElement>('settingsThirdLabel').hidden=!thirdOn;
    byId<HTMLElement>('settingsThird').hidden=!thirdOn;
    setText('settingsThird',thirdOn?sth.thirdColor!.value:'');
    byId<HTMLElement>('settingsAuxLabel').hidden=!sth.auxiliary.length;
    byId<HTMLElement>('settingsAuxCount').hidden=!sth.auxiliary.length;
    setText('settingsAuxCount',t('p12.settings.auxCount',{n:String(sth.auxiliary.length)}));
    // 色条：成员（主/副/三）在前、辅助在后；每个色块 title 带名称与色值。
    const sstrip=byId<HTMLElement>('settingsSeriesStrip');
    // swatch 生成单个色块（背景=色值，title=名称+色值）。
    const swatch=(hex:string,label:string)=>`<span class="sss-swatch" style="background:${hex}" title="${escapeHtml(label)} ${hex}"></span>`;
    sstrip.innerHTML=[swatch(sth.primary.value,sth.primary.name),swatch(sth.secondary.value,sth.secondary.name),...(thirdOn?[swatch(sth.thirdColor!.value,sth.thirdColor!.name)]:[]),...sth.auxiliary.map(a=>swatch(a.value,a.name))].join('');
    // 布局/外观文案随模式切换更新。
    // <lang zh-CN>把枚举映射为中文标签。</lang>
    // <lang en>Maps enums to Chinese labels.</lang>
    setText('settingsLayout',layoutMode==='sidebar'?t('左右结构'):layoutMode==='top'?t('上下结构'):t('混合工作台'));
    setText('settingsAppearance',appearanceMode==='light'?t('p12.appearance.light'):t('p12.appearance.dark'));
  }

  // 统一应用当前草稿到界面：读取输入→注入变量→同步表单→令牌/元信息→重渲染候选。
  // <lang zh-CN>绝大多数交互的汇聚点；readInputs 失败则整体中止。</lang>
  // <lang en>Convergence point for most interactions; aborts entirely if readInputs fails.</lang>
  function applyCurrentTheme(updateName=true){
    if(!readInputs(updateName))return;
    applyRuntimeTheme();syncInputs();updateTokenOutputs();updatePreviewMeta();
    renderPrimaryCandidates();renderSecondaryCandidates();
  }

  // 渲染主色候选面板：按 group 分组，生成可点击色卡；当前主色高亮。
  // <lang zh-CN>卡片支持展示态切换（W-tb-P12 需求四 B/C）：普通候选 双色/三色，获奖候选 双色/三色/全色；
  //   应用时按当前态载入主体色成员（三色=类比第三色；全色=三色+两条规则辅助色）。</lang>
  // <lang en>Cards expose display modes (B/C): dual/triad for library cards, plus full for award cards;
  //   applying loads the body-color members per the current mode (triad=analogous third; full=triad+two rule auxes).</lang>
  const cardModes:Record<string,'dual'|'triad'|'full'>={};
  // 组合成员：按模式扩展（第三色用 analogous 规则推导；全色附两条规则辅助色）。
  function candidateCombo(c:PrimaryCandidate,mode:'dual'|'triad'|'full'):{members:{name:string;hex:string}[];auxes:{hex:string;name:string}[]}{
    const members:{name:string;hex:string}[]=[{name:t(c.name),hex:c.hex},{name:t(c.secondaryName),hex:c.secondaryHex}];
    if(mode!=='dual'){
      const third=deriveThirdByRelation(c.hex,c.secondaryHex,'analogous');
      if(third)members.push({name:t('p11.family.thirdShort'),hex:third});
    }
    const auxes=mode==='full'?generateAuxiliaryCandidates(c.hex).slice(0,2).map(a=>({hex:a.hex,name:a.name})):[];
    return{members,auxes};
  }
  function renderPrimaryCandidates(){
    // 按 group 把候选分组，便于展示“蓝色基准/获奖网站”等区块。
    // <lang zh-CN>分组键来自候选数据的 group 字段。</lang>
    // <lang en>Group key comes from each candidate's group field.</lang>
    const groups:Record<string,PrimaryCandidate[]>={};
    primaryCandidates.forEach(c=>(groups[c.group]||(groups[c.group]=[])).push(c));
    const wrap=byId<HTMLElement>('primaryCandidatesWrap');
    // 逐组拼出标题与色卡网格；色卡为 div+role=button（内含模式芯片，避免 button 嵌套非法）；
    // 色条按模式渲染多段（每段一成员色，全色含辅助段）。
    // <lang zh-CN>active 类标记当前主色（normalizeHex 比较）。</lang>
    // <lang en>Div cards with role=button host mode chips without illegal nesting; bar shows per-member segments.</lang>
    const en=getLocale()==='en';
    wrap.innerHTML=Object.entries(groups).map(([group,items])=>`<div class="group-title">${escapeHtml(t(group))} · ${items.length}</div><div class="grid-3">${items.map(c=>{
      const isAward=c.category==='award'||group.includes('获奖');
      const mode=cardModes[c.id]??'dual';
      const combo=candidateCombo(c,mode);
      const bar=[...combo.members.map(m=>m.hex),...combo.auxes.map(a=>a.hex)];
      const stops=bar.map((hex,i)=>`${hex} ${Math.round(i*100/bar.length)}% ${Math.round((i+1)*100/bar.length)}%`).join(',');
      const modesList:('dual'|'triad'|'full')[]=isAward?['dual','triad','full']:['dual','triad'];
      const chips=modesList.map(m=>`<button type="button" class="cm-chip${mode===m?' active':''}" data-card-mode="${m}" data-card-id="${escapeHtml(c.id)}" aria-label="${m==='dual'?t('p12.card.dual'):m==='triad'?t('p12.card.triad'):t('p12.card.full')}">${m==='dual'?t('p12.card.dual'):m==='triad'?t('p12.card.triad'):t('p12.card.full')}</button>`).join('');
      const dots=combo.members.map(m=>`<i style="background:${m.hex}"></i>`).join('')+combo.auxes.map(a=>`<i class="cm-aux-dot" style="background:${a.hex}"></i>`).join('');
      return`<div class="color-card ${normalizeHex(c.hex)===draft.primary?'active':''}" data-primary="${escapeHtml(c.id)}" role="button" tabindex="0" title="${escapeHtml(c.desc)}"><div class="color-top" style="background:linear-gradient(90deg,${stops})"><span>${escapeHtml(t(c.tag))}</span></div><h4>${escapeHtml(t(c.name))}</h4><div class="color-meta">${en?'':escapeHtml(c.en)}</div><div class="color-hex">${c.hex}</div><div class="cm-chips">${chips}</div><span class="pair-chip">${dots}${escapeHtml(t(c.secondaryName))}</span></div>`;
    }).join('')}</div>`).join('');
    // 模式芯片：切换该卡展示态（stopPropagation 防触发应用）。
    all<HTMLButtonElement>('[data-card-mode]',wrap).forEach(chip=>chip.addEventListener('click',e=>{
      e.stopPropagation();
      const id=chip.dataset.cardId;const m=chip.dataset.cardMode as 'dual'|'triad'|'full'|undefined;
      if(!id||!m)return;
      cardModes[id]=m;
      renderPrimaryCandidates();
    }));
    // 色卡应用：按当前模式载入主体色成员（三色附第三色；全色再替换辅助色为两条规则色）。
    // <lang zh-CN>div 卡 click+Enter/Space keydown 保持键盘可达。</lang>
    // <lang en>Click plus Enter/Space keydown keeps div cards keyboard-accessible.</lang>
    const applyCard=(btn:HTMLElement)=>{
      const c=primaryCandidates.find(x=>x.id===btn.dataset.primary);if(!c)return;
      const mode=cardModes[c.id]??'dual';
      const combo=candidateCombo(c,mode);
      primaryMeta=c;
      draft.primary=normalizeHex(c.hex);
      draft.secondary=normalizeHex(c.secondaryHex);
      draft.primaryName=c.name;
      draft.secondaryName=c.secondaryName;
      draft.category=c.category||'custom';
      // 主题名：用户已填则保留，否则按新主副色名自动生成。
      // <lang zh-CN>避免强制覆盖用户手动命名的主题。</lang>
      // <lang en>Avoids forcing over a user-typed theme name.</lang>
      draft.name=inputValue('themeNameInput').trim()||autoThemeName(c.name,c.secondaryName);
      // 三色/全色：派生模式 triad 并载入第三色成员；否则保持 dual。
      if(mode!=='dual'&&combo.members[2]){
        draft.seriesMode='triad';
        draft.seriesRelation='analogous';
        draft.thirdColor=makeRoleColor(combo.members[2].hex,combo.members[2].name);
      }else{
        draft.seriesMode='dual';
        draft.thirdColor=undefined;
      }
      // 全色：辅助槽位替换为该候选的两条规则强调色。
      if(mode==='full')draft.auxiliary=combo.auxes.map(a=>makeRoleColor(a.hex,a.name));
      secondaryCandidates=generateSecondarySet(c.hex,{hex:c.secondaryHex,name:c.secondaryName,scheme:c.secondaryScheme});
      syncInputs();applyCurrentTheme(false);renderSecondaryCandidates();renderPrimaryCandidates();renderHarmony();renderGradients();
      setText('generateStatus',mode==='dual'?t('p12.status.appliedDual',{name:t(c.name),hex:c.hex,sec:t(c.secondaryName),secHex:c.secondaryHex}):mode==='triad'?t('p12.status.appliedTriad',{name:t(c.name)}):t('p12.status.appliedFull',{name:t(c.name)}));
    };
    all<HTMLElement>('[data-primary]',wrap).forEach(btn=>{
      btn.addEventListener('click',()=>applyCard(btn));
      btn.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();applyCard(btn);}});
    });
  }

  // 渲染副色候选面板：展示当前副色候选集，当前副色高亮，点击即应用。
  // <lang zh-CN>首个候选通常为推荐副色；色卡含配色方案、中英文名与 HEX。</lang>
  // <lang en>First candidate is usually the recommended one; cards show scheme, zh/en names and HEX.</lang>
  function renderSecondaryCandidates(){
    const wrap=byId<HTMLElement>('secondaryCandidatesWrap');
    // 逐候选生成色卡，active 标记当前副色（normalizeHex 比较）。
    // <lang zh-CN>title 用 note 说明该副色来源/特点。</lang>
    // <lang en>title uses note to explain the candidate's origin/character.</lang>
    wrap.innerHTML=secondaryCandidates.map(c=>`<button class="color-card ${normalizeHex(c.hex)===draft.secondary?'active':''}" data-secondary="${escapeHtml(c.id)}" title="${escapeHtml(t(c.note))}"><div class="color-top" style="background:${c.hex}"><span>${escapeHtml(c.scheme.split('·').map(seg=>t(seg.trim())).join(' · '))}</span></div><h4>${escapeHtml(t(c.name))}</h4><div class="color-meta">${getLocale()==='en'?'':escapeHtml(c.en)}</div><div class="color-hex">${c.hex}</div></button>`).join('');
    // 点击副色：写回草稿并刷新界面（不覆盖主题名）。
    // <lang zh-CN>applyCurrentTheme(false) 保留当前主题名。</lang>
    // <lang en>applyCurrentTheme(false) keeps the current theme name.</lang>
    all<HTMLButtonElement>('[data-secondary]',wrap).forEach(btn=>btn.addEventListener('click',()=>{
      const c=secondaryCandidates.find(x=>x.id===btn.dataset.secondary);if(!c)return;
      draft.secondary=normalizeHex(c.hex);
      draft.secondaryName=c.name;
      syncInputs();applyCurrentTheme(false);renderSecondaryCandidates();
    }));
  }

  // 渲染渐变设置面板：对每个渐变角色生成配置卡（启用/色系/方向/起止阶/占比 + 预览 + 交换重置）。
  // <lang zh-CN>先 cloneGradientSettings 保证配置完整；每张卡含实时预览与“主色 起→止”说明。</lang>
  // <lang en>First clones settings for completeness; each card has a live preview and "family start→end" caption.</lang>
  function renderGradients(){
    // 以默认值补齐草稿的渐变配置（防止旧数据缺角色键）。
    // <lang zh-CN>cloneGradientSettings 会填充缺失角色并兼容旧 'balanced' 占比。</lang>
    // <lang en>cloneGradientSettings fills missing roles and maps legacy 'balanced' bias.</lang>
    draft.gradients=cloneGradientSettings(draft.gradients);
    const wrap=byId<HTMLElement>('gradientSettingsGrid');
    // 逐角色生成卡片 HTML：标题+启用、说明、预览、五个下拉、底部说明与交换/重置。
    // <lang zh-CN>预览用 runtime 模式 var()，下拉用 options() 复用标签映射。</lang>
    // <lang en>Preview uses runtime vars; dropdowns reuse options() with label maps.</lang>
    // 预设选项列表（`W-tb-P8` v2：自研下拉取代 datalist——原生 datalist 会按已填值前缀过滤，
    //   导致填入完整值后其余预设全部消失，违背可填可选要求；自研下拉点开常显全部预设）。
    // <lang zh-CN>方向/色阶/占比三组选项；色阶选项内联实时色块。</lang>
    // <lang en>Three option groups; shade options carry inline live swatches.</lang>
    const dirOptions=directions.map(d=>`<button type="button" class="combo-option" data-value="${d}">${directionLabels[d]??d}</button>`).join('');
    // 色阶选项基色解析：主/副走角色；third/aux 走对应槽位（ADR-007 v2 色源扩充）。
    // <lang zh-CN>槽位缺失（切模式残留）时回退主色。</lang>
    // <lang en>Falls back to primary when the slot is missing (stale after mode switches).</lang>
    const familyBase=(family:string)=>{const cur=theme();return family==='primary'?cur.primary.value:family==='secondary'?cur.secondary.value:family==='third'?cur.thirdColor?.value??cur.primary.value:cur.auxiliary[parseInt(family.slice(3),10)]?.value??cur.primary.value;};
    const shadeOptions=(family:string)=>shadeValues.map(s=>`<button type="button" class="combo-option" data-value="${s}"><i class="combo-swatch" style="background:${tonalScaleAt(familyBase(family),parseInt(s,10))}"></i>${s}</button>`).join('');
    const biasOptions=biasValues.map(b=>`<button type="button" class="combo-option" data-value="${b}">${biasLabel(b)}</button>`).join('');
    // 单卡片模板：色系仍为 select；方向/色阶/占比为自研组合框（可填可选 + 全部预设常显）；色阶带实时色块。
    // <lang zh-CN>色块经 tonalScaleAt 实时插值，任意色阶立即见效（ADR-004）。</lang>
    // <lang en>Swatches interpolate via tonalScaleAt so arbitrary shades show instantly (ADR-004).</lang>
    const card=(def:typeof GRADIENT_DEFS[number])=>{
      const cfg=draft.gradients[def.key];
      const base=familyBase(cfg.family);
      const swatch=(shade:string)=>{const n=parseInt(shade,10);return Number.isFinite(n)?tonalScaleAt(base,n):'transparent';};
      const combo=(field:'direction'|'start'|'end'|'bias',value:string,optionsHTML:string)=>`<div class="combo"><input class="gradient-input" data-gradient-field="${field}" value="${escapeHtml(value)}" autocomplete="off" spellcheck="false"><button type="button" class="combo-toggle" tabindex="-1" aria-hidden="true">▾</button><div class="combo-list" hidden>${optionsHTML}</div></div>`;
      // 色系下拉动态扩充（ADR-007 v2 机制扩充）：主/副之外，三色模式的第三色系与辅助槽位 N 均可作色源。
      // <lang zh-CN>third 仅三色模式出现；aux 按槽位逐个列出（名称取槽位名）。</lang>
      // <lang en>third appears in triad only; aux slots are listed per slot with their names.</lang>
      // 色源令牌表（主/副/第三/辅助N）：每项 [令牌, 标签, 色块hex@500]，供自定义 combo 渲染。
      // <lang zh-CN>第三色仅三色模式出现；辅助按槽位逐个列出（1-based 标签）。</lang>
      // <lang en>Third appears in triad only; aux slots listed 1-based with swatches.</lang>
      const curTheme=theme();
      const famList:[string,string,string][]=[
        ['primary',t('p12.family.primary'),curTheme.primary.scale['500']||curTheme.primary.value],
        ['secondary',t('p12.family.secondary'),curTheme.secondary.scale['500']||curTheme.secondary.value]];
      if(curTheme.thirdColor)famList.push(['third',t('p11.family.thirdShort'),curTheme.thirdColor.scale['500']||curTheme.thirdColor.value]);
      curTheme.auxiliary.forEach((a,i)=>famList.push([`aux${i}`,`${t('p11.family.aux')}${i+1}`,a.scale['500']||a.value]));
      const curFam=famList.find(o=>o[0]===cfg.family)??famList[0]!;
      const familyLabel=()=>curFam[1];
      const famCombo=`<div class="family-combo" data-fc-key="${def.key}"><button type="button" class="family-combo-toggle" aria-haspopup="listbox"><i class="combo-swatch" style="background:${curFam[2]}"></i><span>${escapeHtml(curFam[1])}</span><b class="fc-caret">▾</b></button><div class="family-combo-list" role="listbox" hidden>${famList.map(o=>`<button type="button" class="family-option${o[0]===cfg.family?' active':''}" role="option" aria-selected="${o[0]===cfg.family}" data-fc-value="${o[0]}" data-fc-swatch="${o[2]}"><i class="combo-swatch" style="background:${o[2]}"></i>${escapeHtml(o[1])}</button>`).join('')}</div></div>`;
      return`<div class="gradient-config-card" data-gradient-key="${def.key}"><div class="gradient-config-title"><strong>${t(def.label)}</strong><label><input type="checkbox" data-gradient-field="enabled" ${cfg.enabled!==false?'checked':''}>${t('启用')}</label></div><div class="gradient-config-desc">${t(def.desc)}</div><div class="gradient-config-preview" data-gradient-preview="${def.key}" style="background:${gradientCss(cfg,'runtime',theme())}"></div><div class="gradient-config-grid"><label class="gradient-field"><span>${t('色系')}</span>${famCombo}</label><label class="gradient-field"><span>${t('方向')}</span>${combo('direction',cfg.direction,dirOptions)}</label><label class="gradient-field"><span>${t('起始色阶')}</span><div class="gradient-shade-row">${combo('start',cfg.start,shadeOptions(cfg.family))}<i class="gradient-shade-swatch" style="background:${swatch(cfg.start)}"></i></div></label><label class="gradient-field"><span>${t('结束色阶')}</span><div class="gradient-shade-row">${combo('end',cfg.end,shadeOptions(cfg.family))}<i class="gradient-shade-swatch" style="background:${swatch(cfg.end)}"></i></div></label><label class="gradient-field" style="grid-column:1/-1"><span>${t('渐变占比')}</span>${combo('bias',biasLabel(cfg.bias),biasOptions)}</label></div><div class="gradient-config-footer"><span class="gradient-config-code" data-gradient-code="${def.key}">${familyLabel()} ${cfg.start} → ${cfg.end}</span><div class="gradient-mini-actions"><button class="gradient-mini-btn" data-gradient-swap>${t('交换')}</button><button class="gradient-mini-btn" data-gradient-reset>${t('重置')}</button></div></div></div>`;};
    wrap.innerHTML=GRADIENT_DEFS.map(def=>card(def)).join('');
    // 绑定字段变更：根据 data-gradient-field 写入对应配置项并刷新。
    // <lang zh-CN>非法值直接 return 不改草稿，保证类型安全。</lang>
    // <lang en>Invalid values return early without mutating the draft, keeping types safe.</lang>
    all<HTMLInputElement|HTMLSelectElement>('[data-gradient-field]',wrap).forEach(el=>el.addEventListener('change',()=>{
      const card=el.closest<HTMLElement>('[data-gradient-key]');
      const key=card?.dataset.gradientKey,field=el.dataset.gradientField;
      if(!key||!field)return;
      const cfg=draft.gradients[key];if(!cfg)return;
      switch(field){
        // 启用开关：写布尔。
        // <lang zh-CN>取消勾选则该角色渐变退化为纯色。</lang>
        // <lang en>Unchecked makes the role gradient degrade to a solid color.</lang>
        case'enabled':cfg.enabled=(el as HTMLInputElement).checked;break;
        // 色系：仅接受 primary/secondary。
        // <lang zh-CN>其他值忽略，避免污染 family 类型。</lang>
        // <lang en>Other values ignored to protect the family type.</lang>
        // 色族变更（ADR-007 v2）：主/副/第三/辅助 N 全部合法（third 仅三色模式、auxN 需槽位存在——由下拉选项保证）。
        // <lang zh-CN>合法性由 familyOpts 动态选项保证，此处直接采纳。</lang>
        // <lang en>Legality is guaranteed by the dynamic dropdown options.</lang>
        case'family':cfg.family=el.value as typeof cfg.family;break;
        // 起始/结束色阶（`W-tb-P8` 组合框）：任意整数 0-1000 直接生效（真实插值，无吸附）；
        //   非法输入重渲染面板以回退显示。
        // <lang zh-CN>ADR-004：自由值经 tonalScaleAt 插值，CSS 变量按引用生成。</lang>
        // <lang en>ADR-004: free values interpolate via tonalScaleAt; vars emitted per reference.</lang>
        case'start':case'end':{
          const v=el.value.trim();
          // 校验通过（整数 0-1000）后赋值；ShadeValue 为数值字符串模板类型，断言仅为收窄。
          // <lang zh-CN>正则已保证形态。</lang>
          // <lang en>The regex guarantees the shape.</lang>
          if(/^\d{1,4}$/.test(v)&&parseInt(v,10)<=1000)cfg[field as 'start'|'end']=v as typeof cfg['start'];
          else{renderGradients();return;}
          break;
        }
        // 方向（`W-tb-P8` 组合框）：接受合法 CSS 角度/关键字；非法回退。
        // <lang zh-CN>校验 deg/grad/rad/turn 与 to <side> 两种形态，大小写不敏感。</lang>
        // <lang en>Accepts deg/grad/rad/turn and to <side> forms, case-insensitive.</lang>
        case'direction':{
          const v=el.value.trim();
          if(/^(to\s+(top|right|bottom|left)(\s+(top|right|bottom|left))?|[+-]?\d+(\.\d+)?(deg|grad|rad|turn))$/i.test(v))cfg.direction=v;
          else{renderGradients();return;}
          break;
        }
        // 占比（`W-tb-P8` 组合框）：parseBiasInput 解析四种输入形态；非法回退。
        // <lang zh-CN>front/end + 0-100；解析失败重渲染以回退显示。</lang>
        // <lang en>front/end + 0-100; unparseable input re-renders to revert.</lang>
        case'bias':{
          const parsed=parseBiasInput(el.value);
          if(parsed)cfg.bias=parsed;
          else{renderGradients();return;}
          break;
        }
        default:return;
      }
      // 变更后刷新预览、持久化、令牌与面板自身。
      // <lang zh-CN>重渲染本面板以同步预览、色块与说明文字。</lang>
      // <lang en>Re-renders the panel to sync preview, swatches and captions.</lang>
      applyRuntimeTheme();saveGradients();updateTokenOutputs();renderGradients();
    }));
    // 组合框交互绑定（字段 change 绑定后执行，DOM 已就绪；每次重渲染重建并重绑）。
    // <lang zh-CN>自研下拉点开常显全部预设（修复原生 datalist 前缀过滤缺陷）。</lang>
    // <lang en>Custom dropdown always shows all presets (fixes native datalist prefix filtering).</lang>
    bindCombos(wrap);
    // 自定义色源 combo 接线（`W-tb-P12` 需求 1c：下拉带色块预览）。
    // <lang zh-CN>点击展开/收起列表；选择色源即写回 cfg.family 并全链刷新（同字段 change 语义）。</lang>
    // <lang en>Toggle list; pick a source writes cfg.family and refreshes (same semantics as field change).</lang>
    all<HTMLElement>('.family-combo',wrap).forEach(fc=>{
      const key=fc.dataset.fcKey;const list=fc.querySelector<HTMLElement>('.family-combo-list');const toggle=fc.querySelector<HTMLButtonElement>('.family-combo-toggle');
      if(!key||!list||!toggle)return;
      toggle.addEventListener('click',()=>{list.hidden=!list.hidden;});
      all<HTMLButtonElement>('.family-option',list).forEach(opt=>opt.addEventListener('click',()=>{
        const cfg=draft.gradients[key];if(!cfg)return;
        const v=opt.dataset.fcValue;if(!v)return;
        cfg.family=v as typeof cfg.family;
        applyRuntimeTheme();saveGradients();updateTokenOutputs();renderGradients();
      }));
    });
    // 交换按钮：起止色阶互换，并翻转占比（保持视觉权重一致）。
    // <lang zh-CN>如 front75 ↔ end75，避免交换后占比与方向错位。</lang>
    // <lang en>E.g. front75 ↔ end75, avoiding weight/ direction mismatch after swap.</lang>
    all<HTMLButtonElement>('[data-gradient-swap]',wrap).forEach(btn=>btn.addEventListener('click',()=>{
      const key=btn.closest<HTMLElement>('[data-gradient-key]')?.dataset.gradientKey;if(!key)return;
      const cfg=draft.gradients[key];if(!cfg)return;
      [cfg.start,cfg.end]=[cfg.end,cfg.start];
      cfg.bias=swapGradientBias(cfg.bias);
      applyRuntimeTheme();saveGradients();updateTokenOutputs();renderGradients();
    }));
    // 重置按钮：将该角色恢复为出厂默认配置。
    // <lang zh-CN>仅影响单个角色，不影响其他渐变。</lang>
    // <lang en>Only affects one role, leaving other gradients intact.</lang>
    all<HTMLButtonElement>('[data-gradient-reset]',wrap).forEach(btn=>btn.addEventListener('click',()=>{
      const key=btn.closest<HTMLElement>('[data-gradient-key]')?.dataset.gradientKey;if(!key)return;
      draft.gradients[key]={...GRADIENT_DEFAULTS[key]};
      applyRuntimeTheme();saveGradients();updateTokenOutputs();renderGradients();
    }));
  }

  // ===== `W-tb-P9` 预览三类型 / 导出三 Tab（ADR-005）/ 字体间距操作台（ADR-006） =====

  // 应用预览类型：面板显隐 + 子控件显隐 + 提示文案 + 导出 Tab 同构联动。
  // <lang zh-CN>default 显示 PC/小程序两块默认预览；classic/tdon 显示对应新面板；
  //   导出区三 Tab 与预览类型同构联动（用户仍可在导出区手动切换，不回写预览避免环）。</lang>
  // <lang en>default shows the PC/mini-program panels; classic/tdon show the new panels; the export tabs
  //   follow the preview type (manual export switching stays one-way to avoid loops).</lang>
  function applyPreviewMode(mode:'default'|'classic'|'tdon'){
    previewMode=mode;
    all<HTMLButtonElement>('#previewTypeSwitch .seg').forEach(btn=>btn.classList.toggle('active',btn.dataset.previewMode===mode));
    byId<HTMLElement>('classicTargetSelect').hidden=mode!=='classic';
    byId<HTMLElement>('tdonSourceSelect').hidden=mode!=='tdon';
    byId<HTMLButtonElement>('tdonConnectBtn').hidden=mode!=='tdon';
    byId<HTMLElement>('pcPreviewPanel').style.display=mode==='default'?'block':'none';
    byId<HTMLElement>('wxPreviewPanel').style.display=mode==='default'?'block':'none';
    byId<HTMLElement>('classicPreviewPanel').hidden=mode!=='classic';
    byId<HTMLElement>('tdonPreviewPanel').hidden=mode!=='tdon';
    byId<HTMLElement>('previewTypeHint').textContent=t(`p9.preview.hint.${mode}`);
    applyExportMode(mode);
  }
  // 应用导出区三 Tab 显隐（默认=CSS/JSON，经典=目标+文件树+ZIP，自定义=TDON 占位）。
  // <lang zh-CN>与 applyPreviewMode 解耦：可由预览联动触发，也可由导出 Tab 手动触发。</lang>
  // <lang en>Decoupled from applyPreviewMode: triggered by preview linkage or by manual export-tab clicks.</lang>
  function applyExportMode(mode:'default'|'classic'|'tdon'){
    all<HTMLButtonElement>('#exportTypeTabs .tab').forEach(btn=>btn.classList.toggle('active',btn.dataset.exportMode===mode));
    byId<HTMLElement>('exportViewDefault').hidden=mode!=='default';
    byId<HTMLElement>('exportViewClassic').hidden=mode!=='classic';
    byId<HTMLElement>('exportViewTdon').hidden=mode!=='tdon';
  }

  // 渲染经典支持场景预览：WordPress（前台 + 后台）或 Tailwind 落地页 mock。
  // <lang zh-CN>全部颜色/字体/间距引用当前主题变量（--hia-* 与 --p/--s 渐变/色阶），主题或字体间距令牌
  //   变更后重绘即生效；mock 元素均为展示用途（span/tabindex=-1），不产生交互误导。</lang>
  // <lang en>All colors/fonts/spacings reference the current theme vars (--hia-* plus --p/--s gradients/scales);
  //   re-rendering after theme or token edits applies them instantly. Mock elements are display-only
  //   (span/tabindex=-1) to avoid implying interactivity.</lang>
  function renderClassicPreview(){
    const wrap=byId<HTMLElement>('classicPreviewBody');
    // 新契约色块（完善批③）：第三/辅助色按装配结果出现，背景取运行时色阶变量。
    // <lang zh-CN>WP 与 Tailwind 两 mock 共用；无第三色/辅助时为空串。</lang>
    // <lang en>Shared by both mocks; empty strings when absent.</lang>
    const cth=theme();
    // thirdChip 三色模式才产出的 third-500 标签。
    const thirdChip=cth.seriesMode==='triad'?`<span class="mock-wp-chip" style="background:var(--t100);color:var(--t800)">third-500</span>`:'';
    // auxChips 前三个辅助槽位色阶标签（槽位过多时保持 mock 克制）。
    const auxChips=cth.auxiliary.slice(0,3).map((_,i)=>`<span class="mock-wp-chip" style="background:var(--a${i}100);color:var(--a${i}800)">aux${i}-500</span>`).join('');
    if(classicTargetId==='wordpress-child'){
      // WordPress 场景：前台（导航/主视觉/卡片网格）+ 后台（管理栏/侧边菜单/内容区）。
      // <lang zh-CN>主视觉用 --gradient-carousel，标题字号取 --hia-fs-h1，正文取 --hia-fs-body 与行高令牌。</lang>
      // <lang en>Hero uses --gradient-carousel; headings use --hia-fs-h1; body uses --hia-fs-body and the line-height token.</lang>
      const card=(title:string,body:string,chips=true)=>`<div class="mock-wp-card"><h4>${escapeHtml(title)}</h4><p>${escapeHtml(body)}</p>${chips?`<div class="mock-wp-chip-row"><span class="mock-wp-chip">primary-500</span><span class="mock-wp-chip alt">secondary-500</span>${thirdChip}${auxChips}</div>`:''}</div>`;
      wrap.innerHTML=`
        <div class="classic-mock-note">${t('p9.classic.wp.note')}</div>
        <span class="mock-label">${t('前台首页')}</span>
        <div class="mock-browser">
          <div class="mock-browser-bar" aria-hidden="true"><i></i><i></i><i></i><span class="mock-browser-url">https://example.com</span></div>
          <div class="mock-wp-front-nav"><b>${t('站点名称示例')}</b><span>${t('产品服务')}</span><span>${t('解决方案')}</span><span>${t('新闻动态')}</span><span>${t('关于我们')}</span><span class="mock-wp-btn" aria-hidden="true">${t('开始使用')}</span></div>
          <div class="mock-wp-front-hero"><h2>${t('欢迎来到企业门户')}</h2><p>${t('主视觉使用 HIA 渐变令牌（--hia-gradient-carousel），字号与间距随操作台实时变化。')}</p><span class="mock-wp-btn alt" aria-hidden="true">${t('查看文档')}</span></div>
          <div style="padding:12px;background:#F0F4F8"><div class="mock-wp-front-grid">${card(t('板块标题示例'),t('正文示例：字号取 --hia-fs-body，行高取 --hia-line-height-body，颜色取 --hia-primary-700。'))}${card(t('功能卡片二'),t('正文示例：字号取 --hia-fs-body，行高取 --hia-line-height-body，颜色取 --hia-primary-700。'),false)}${card(t('功能卡片三'),t('正文示例：字号取 --hia-fs-body，行高取 --hia-line-height-body，颜色取 --hia-primary-700。'),false)}</div></div>
        </div>
        <div style="height:14px"></div>
        <span class="mock-label">${t('后台管理')}</span>
        <div class="mock-browser">
          <div class="mock-browser-bar" aria-hidden="true"><i></i><i></i><i></i><span class="mock-browser-url">https://example.com/wp-admin/</span></div>
          <div class="mock-wp-adminbar"><span class="mock-wp-dot">W</span><span>${t('站点名称示例')}</span><span aria-hidden="true">＋ ${t('p12.admin.new')}</span><span style="margin-left:auto">Howdy, Admin</span></div>
          <div class="mock-wp-layout">
            <div class="mock-wp-menu"><div class="mock-wp-menu-group">Dashboard</div><div class="mock-wp-menu-item active">${t('仪表盘')}</div><div class="mock-wp-menu-item">${t('媒体')}</div><div class="mock-wp-menu-item">${t('页面')}</div><div class="mock-wp-menu-item">${t('外观')}</div><div class="mock-wp-menu-item">${t('插件')}</div><div class="mock-wp-menu-item">${t('用户')}</div><div class="mock-wp-menu-item">${t('设置')}</div></div>
            <div class="mock-wp-content">
              <div class="mock-wp-notice"><b>${t('站点公告')}</b> ${t('副色用于提醒与强调，符合 HIA 副色语义。')}</div>
              ${card(t('快速编辑'),t('正文示例：字号取 --hia-fs-body，行高取 --hia-line-height-body，颜色取 --hia-primary-700。'),false)}
              <div class="mock-wp-card"><h4>${t('站点健康')}</h4><p>${t('主题面板与渐变来自生成的 theme.json，色板含 10 档与自定义色阶。')}</p><div class="mock-wp-chip-row"><span class="mock-wp-chip">theme.json v2</span><span class="mock-wp-chip alt">hia-child</span></div></div>
            </div>
          </div>
        </div>`;
    }else{
      // Tailwind 场景：导航/主视觉/特性卡/页脚，色阶与字体族映射 config 的 colors/fontFamily。
      // <lang zh-CN>演示 bg-primary-700 类映射效果：卡片条用 --primary/--secondary/--p400 表示三档色。</lang>
      // <lang en>Demonstrates bg-primary-700-style mappings: card bars use --primary/--secondary/--p400 for three steps.</lang>
      const twCard=(title:string)=>`<div class="mock-tw-card"><div class="mock-tw-swatch"></div><h5>${escapeHtml(title)}</h5><p>${t('色阶令牌直接映射为 Tailwind 类名。')}</p></div>`;
      wrap.innerHTML=`
        <div class="classic-mock-note">${t('p9.classic.tw.note')}</div>
        <span class="mock-label">${t('Tailwind 落地页场景')}</span>
        <div class="mock-browser">
          <div class="mock-browser-bar" aria-hidden="true"><i></i><i></i><i></i><span class="mock-browser-url">https://example.com/</span></div>
          <div class="mock-tw-nav"><b>HIA Tailwind</b><a href="javascript:void(0)" tabindex="-1">${t('产品服务')}</a><a href="javascript:void(0)" tabindex="-1">${t('解决方案')}</a><a href="javascript:void(0)" tabindex="-1">${t('关于我们')}</a><span class="mock-wp-btn" aria-hidden="true">${t('开始使用')}</span></div>
          <div class="mock-tw-hero"><h2>${t('构建一致的设计系统')}</h2><p>${t('字体族经 fontFamily 透传（body / heading / mono），色阶类名即时可用。')}</p><div class="mock-tw-cta-row"><span class="mock-wp-btn" aria-hidden="true">${t('开始使用')}</span><span class="mock-wp-btn alt" aria-hidden="true">${t('查看文档')}</span></div></div>
          <div class="mock-tw-cards">${twCard(t('功能卡片一'))}${twCard(t('功能卡片二'))}${twCard(t('功能卡片三'))}</div>
          ${thirdChip||auxChips?`<div class="mock-wp-chip-row" style="padding:0 12px 14px">${thirdChip.replace('third-500','bg-third-500')}${auxChips.replace(/aux(\d)-500/g,'bg-aux$1-500')}</div>`:''}
          <div class="mock-tw-footer"><span>${t('由 HIA Theme Builder 生成')}</span><span>${escapeHtml(theme().name)}</span></div>
        </div>`;
    }
    setText('classicTargetLabel',classicTargetId==='wordpress-child'?t('p9.classic.target.wp'):t('p9.classic.target.tw'));
  }

  // 渲染 TDON 自定义支持面板占位（运行时延后）：说明连接器管线与规范出处。
  // <lang zh-CN>连接按钮保持禁用（HTML disabled），不提供假交互。</lang>
  // <lang en>The connect button stays disabled (HTML disabled); no fake interactions.</lang>
  function renderTdonPreview(){
    byId<HTMLElement>('tdonPreviewBody').innerHTML=`<div class="tdon-placeholder"><b>${t('p9.tdon.placeholder.title')}</b><p>${t('p9.tdon.placeholder.desc')}</p></div>`;
    // 状态标签回显当前选中的源子 Tab（url/local），连接按钮保持禁用。
    // <lang zh-CN>让"源子 Tab"状态可见，连接器接入后沿用同一状态位。</lang>
    // <lang en>Makes the source sub-tab choice visible; the connector reuses this state once it lands.</lang>
    setText('tdonStatusLabel',`${t('p9.tdon.status.pending')} · ${tdonSource==='url'?t('p9.tdon.source.url'):t('p9.tdon.source.local')}`);
  }

  // 渲染导出文件树：目标产物清单（路径 + 字节）+ 选中文件内容预览 + ZIP 名回显。
  // <lang zh-CN>清单由 getExportTarget(exportTargetId).files(theme()) 现算（纯函数），保证与 ZIP 内容一致；
  //   字节数用 TextEncoder 统计 UTF-8 长度。</lang>
  // <lang en>The list is computed live via getExportTarget(...).files(theme()) (pure), matching ZIP content exactly;
  //   byte size uses TextEncoder UTF-8 length.</lang>
  function renderExportTree(){
    const target=getExportTarget(exportTargetId);
    if(!target)return;
    const files=target.files(theme());
    // 未选中或选中项不在当前目标清单时，默认选中第一个文件。
    // <lang zh-CN>切换目标后自动回落，避免预览残留上一目标内容。</lang>
    // <lang en>Auto-falls back after target switches so stale content never lingers.</lang>
    if(!selectedExportFile||!files.some(f=>f.path===selectedExportFile))selectedExportFile=files[0]?.path??null;
    const tree=byId<HTMLElement>('exportFileTree');
    tree.innerHTML=files.map(f=>{
      const size=new TextEncoder().encode(f.content).length;
      const sizeLabel=size<1024?`${size} B`:`${(size/1024).toFixed(1)} KB`;
      return`<button type="button" class="export-file-row ${f.path===selectedExportFile?'active':''}" data-export-file="${escapeHtml(f.path)}"><i class="export-file-icon" aria-hidden="true"></i><span>${escapeHtml(f.path)}</span><span class="export-file-size">${sizeLabel}</span></button>`;
    }).join('');
    const preview=byId<HTMLTextAreaElement>('exportFilePreview');
    const current=files.find(f=>f.path===selectedExportFile);
    if(current){preview.hidden=false;preview.value=current.content;}else{preview.hidden=true;preview.value='';}
    setText('exportZipName',target.archiveName(theme()));
    all<HTMLButtonElement>('[data-export-file]',tree).forEach(btn=>btn.addEventListener('click',()=>{
      selectedExportFile=btn.dataset.exportFile||null;
      renderExportTree();
    }));
  }

  // 生成并下载目标 ZIP（fflate zipSync 打包虚拟文件树 → Blob → a[download]）。
  // <lang zh-CN>文件名取 target.archiveName(theme)；成功后回显"已生成"文案；失败走平台 alert。
  //   web/electron/tauri 共用同一实现（DOM 下载在三者宿主中均可用）。</lang>
  // <lang en>Packages via target.archiveName(theme); success echoes a generated note; failures alert via platform.
  //   Shared by web/electron/tauri (DOM downloads work in all three hosts).</lang>
  function downloadZip(){
    const target=getExportTarget(exportTargetId);
    if(!target)return;
    try{
      const files=target.files(theme());
      // zipSync 接受 {path: Uint8Array}；strToU8 完成 UTF-8 编码。
      // <lang zh-CN>ZIP 内路径即适配器给定的相对 POSIX 路径。</lang>
      // <lang en>ZIP entry paths are the adapter-provided relative POSIX paths.</lang>
      const zipped=zipSync(Object.fromEntries(files.map(f=>[f.path,strToU8(f.content)])));
      const url=URL.createObjectURL(new Blob([zipped],{type:'application/zip'}));
      const a=document.createElement('a');
      a.href=url;a.download=target.archiveName(theme());
      document.body.appendChild(a);a.click();a.remove();
      setTimeout(()=>URL.revokeObjectURL(url),1000);
      setText('exportZipName',t('p9.export.zip.done',{name:target.archiveName(theme()),count:files.length}));
    }catch{
      platform.alert(t('p9.export.zip.fail'));
    }
  }

  // 渲染字体/间距令牌操作台：左列控件与行高样张（草稿态回填），右列实时样张（字号阶梯/间距序列）。
  // <lang zh-CN>行高样张置于左列底部（2026-11-08 维护者反馈：原左列底部悬空 ~300px，移入后两列高度均衡）；
  //   每次字段生效后整块重绘（与渐变面板同一模式），保证回填与样张一致。</lang>
  // <lang en>Left column holds controls plus the line-height specimen (moved after maintainer feedback to balance
  //   column heights); whole-panel re-render after each applied field keeps inputs and specimens consistent.</lang>
  function renderTypography(){
    const wrap=byId<HTMLElement>('typographyBody');
    const ty=typoState,sp=spaceState;
    // 比例尺选项：常用模数比率；存储中的自定义比率回退显示 1.25。
    // <lang zh-CN>select 仅提供离散选项，自由比率经编辑输入仍可保留（仅展示回退）。</lang>
    // <lang en>The select offers discrete options; a stored custom ratio falls back in display only.</lang>
    const ratioOptions=['1.125','1.2','1.25','1.333','1.414','1.5'];
    const ratioSelected=ratioOptions.includes(String(ty.fontSizeScale.ratio))?String(ty.fontSizeScale.ratio):'1.25';
    const stepLabels:Record<string,string>={linear4:t('p9.typo.step.linear4'),x2:t('p9.typo.step.x2'),x15:t('p9.typo.step.x15')};
    // 字号阶梯样张行：档位变量名 + 按该档字号渲染的样张 + px 值。
    // <lang zh-CN>样张字体按档位语义取族（display..h3 标题族，body/small 正文族，展示 mono 行）。</lang>
    // <lang en>Specimen rows pick the family by step semantics (display..h3 heading, body/small body, plus a mono row).</lang>
    const steps=FONT_SIZE_STEPS.map(step=>{
      const px=fontSizeAt(ty,step);
      // 样张字体按档位语义取族：body/small 正文族，其余（display..h3）标题族；等宽族在 chips 行展示。
      // <lang zh-CN>FONT_SIZE_STEPS 无 mono 档，等宽样张由 Body/Heading/Mono chips 承担。</lang>
      // <lang en>FONT_SIZE_STEPS has no mono step; the mono specimen lives in the Body/Heading/Mono chips.</lang>
      const family=step==='body'||step==='small'?ty.fontFamily.body:ty.fontFamily.heading;
      return`<div class="typo-step-row"><span class="typo-step-name">--hia-fs-${step}</span><span class="typo-step-sample" style="font-size:${px}px;font-family:${escapeHtml(family)}">HIA Aa</span><span class="typo-step-px">${px}px</span></div>`;
    }).join('');
    // 间距序列条：按序列最大值归一化高度（6..96px 视觉域），标签显示实际 px。
    // <lang zh-CN>高度仅作视觉对比，不代表绝对比例。</lang>
    // <lang en>Bar heights are visual comparisons, not absolute scale.</lang>
    const seq=spacingSequence(sp);
    const maxSeq=Math.max(...seq,1);
    const spaceBars=seq.map((v,i)=>`<div class="typo-space-item"><i class="typo-space-bar" style="height:${Math.max(6,Math.min(96,Math.round(v/maxSeq*72)))}px"></i><span class="typo-space-name">${v}px</span><span class="typo-space-name">space-${i}</span></div>`).join('');
    wrap.innerHTML=`
      <div class="typo-controls">
        <div class="grid-2">
          <div class="control-group"><div class="label">${t('p9.typo.family.body')}</div><input class="input" data-typo-field="familyBody" value="${escapeHtml(ty.fontFamily.body)}" spellcheck="false"></div>
          <div class="control-group"><div class="label">${t('p9.typo.family.heading')}</div><input class="input" data-typo-field="familyHeading" value="${escapeHtml(ty.fontFamily.heading)}" placeholder="inherit" spellcheck="false"></div>
        </div>
        <div class="grid-2">
          <div class="control-group"><div class="label">${t('p9.typo.family.mono')}</div><input class="input" data-typo-field="familyMono" value="${escapeHtml(ty.fontFamily.mono)}" spellcheck="false"></div>
          <div class="control-group"><div class="label">${t('p9.typo.fs.base')} / ${t('p9.typo.fs.ratio')}</div><div class="row" style="flex-wrap:nowrap"><input class="input" type="number" min="9" max="48" step="1" data-typo-field="fsBase" value="${ty.fontSizeScale.base}" style="width:90px;flex:none"><select class="select" data-typo-field="fsRatio" style="width:110px;flex:none">${ratioOptions.map(r=>`<option value="${r}" ${r===ratioSelected?'selected':''}>${r}</option>`).join('')}</select></div></div>
        </div>
        <div class="grid-2">
          <div class="control-group"><div class="label">${t('p9.typo.lineHeight')}</div><input class="input" type="number" min="1" max="2.4" step="0.05" data-typo-field="lineHeight" value="${ty.lineHeightBody}"></div>
          <div class="control-group"><div class="label">${t('p9.typo.space.base')}</div><input class="input" type="number" min="2" max="32" step="1" data-typo-field="spaceBase" value="${sp.base}"></div>
        </div>
        <div class="grid-2">
          <div class="control-group"><div class="label">${t('p9.typo.space.step')}</div><select class="select" data-typo-field="spaceStep">${(['linear4','x2','x15']as const).map(s=>`<option value="${s}" ${s===sp.step?'selected':''}>${stepLabels[s]}</option>`).join('')}</select></div>
          <div class="control-group"><div class="label">${t('p9.typo.space.levels')}</div><input class="input" type="number" min="1" max="12" step="1" data-typo-field="spaceLevels" value="${sp.levels}"></div>
        </div>
        <div class="typo-hint">${t('p9.typo.family.heading.inherit')}</div>
        <div class="typo-preview-head" style="margin-top:2px"><b>${t('p9.typo.preview.lineHeightTitle')}</b></div>
        <div class="typo-line-height-demo">${t('p9.typo.preview.lineHeightBody')}</div>
      </div>
      <div class="typo-preview">
        <div class="typo-preview-head"><b>${t('p9.typo.preview.title')}</b><span class="small">--hia-font-* · --hia-fs-* · --hia-space-*</span></div>
        <div class="typo-font-row">
          <span class="typo-font-chip" style="font-family:${escapeHtml(ty.fontFamily.body)}">Body · ${escapeHtml(shortFontName(ty.fontFamily.body))}</span>
          <span class="typo-font-chip" style="font-family:${escapeHtml(ty.fontFamily.heading)}">Heading · ${escapeHtml(shortFontName(ty.fontFamily.heading))}</span>
          <span class="typo-font-chip" style="font-family:${escapeHtml(ty.fontFamily.mono)}">Mono · ${escapeHtml(shortFontName(ty.fontFamily.mono))}</span>
        </div>
        <div class="typo-steps" style="margin-top:12px">${steps}</div>
        <div class="typo-preview-head" style="margin-top:14px"><b>${t('p9.typo.preview.spaceTitle')}</b></div>
        <div class="typo-space-row">${spaceBars}</div>
      </div>`;
    // 字段变更绑定：change 事件统走 applyTypographyField 校验链。
    // <lang zh-CN>非法输入重绘回退显示（与渐变面板策略一致）。</lang>
    // <lang en>Invalid inputs re-render to revert display (same policy as the gradient panel).</lang>
    all<HTMLInputElement|HTMLSelectElement>('[data-typo-field]',wrap).forEach(el=>el.addEventListener('change',()=>{
      const field=el.dataset.typoField;
      if(field)applyTypographyField(field,el.value);
    }));
  }
  // 应用字体/间距字段：校验 → 写状态 → 持久化 → 运行时变量 → 令牌输出 → 样张/经典 mock 重绘。
  // <lang zh-CN>heading 允许 'inherit'（回退正文字体）；数值字段钳制到安全域；非法输入重绘回退。</lang>
  // <lang en>heading accepts 'inherit' (falls back to body family); numeric fields clamp; invalid input re-reverts.</lang>
  function applyTypographyField(field:string,raw:string){
    const v=raw.trim();
    switch(field){
      // 字体族：非空才写（清空回退默认/inherit），避免空串进入渲染。
      // <lang zh-CN>heading 空值视为 inherit。</lang>
      // <lang en>Empty heading means inherit; body/mono require non-empty.</lang>
      case'familyBody':if(v)typoState.fontFamily.body=v;break;
      case'familyHeading':typoState.fontFamily.heading=v||'inherit';break;
      case'familyMono':if(v)typoState.fontFamily.mono=v;break;
      case'fsBase':{const n=parseFloat(v);if(Number.isFinite(n))typoState.fontSizeScale.base=clampNum(n,typoState.fontSizeScale.base,9,48);else{renderTypography();return;}break;}
      case'fsRatio':{const n=parseFloat(v);if(Number.isFinite(n)&&n>=1&&n<=3)typoState.fontSizeScale.ratio=n;else{renderTypography();return;}break;}
      case'lineHeight':{const n=parseFloat(v);if(Number.isFinite(n))typoState.lineHeightBody=clampNum(n,typoState.lineHeightBody,1,2.4);else{renderTypography();return;}break;}
      case'spaceBase':{const n=parseFloat(v);if(Number.isFinite(n))spaceState.base=clampNum(n,spaceState.base,2,32);else{renderTypography();return;}break;}
      case'spaceStep':if(v==='linear4'||v==='x2'||v==='x15')spaceState.step=v;else{renderTypography();return;}break;
      case'spaceLevels':{const n=parseInt(v,10);if(Number.isFinite(n))spaceState.levels=Math.round(clampNum(n,spaceState.levels,1,12));else{renderTypography();return;}break;}
      default:return;
    }
    // 生效链：持久化 + 变量注入 + 令牌输出 + 样张重绘 + 经典 mock 刷新（字体族/字号实时跟随）。
    // <lang zh-CN>attachTokensToDraft 在 boot/换预设时已共享引用，这里改 typoState 即改 draft。</lang>
    // <lang en>References were shared at boot/preset-swap; mutating typoState mutates the draft too.</lang>
    saveTypography();applyRuntimeTheme();updateTokenOutputs();renderTypography();renderClassicPreview();
  }
  // 恢复字体/间距默认：重建状态对象并重新挂回草稿（引用更换后必须 attach）。
  // <lang zh-CN>cloneTypography/cloneSpacing 产生新对象，draft 引用需重挂。</lang>
  // <lang en>clone helpers create new objects, so the draft references must be re-attached.</lang>
  function resetTypography(){
    typoState=cloneTypography(DEFAULT_TYPOGRAPHY);
    spaceState=cloneSpacing(DEFAULT_SPACING);
    attachTokensToDraft();
    saveTypography();applyRuntimeTheme();updateTokenOutputs();renderTypography();renderClassicPreview();
  }
  // 字体栈短名：取第一个族名并去引号，用于 chip 标签展示。
  // <lang zh-CN>仅展示用途。</lang>
  // <lang en>Display-only.</lang>
  // ===== `W-tb-P12` 配色关系区（宝典选色弹层 + 规则补色；seriesMode 改派生） =====

  // 预设/组合应用前快照：还原用户色用（单层，重复应用覆盖）。
  // <lang zh-CN>宝典选色与成员删除/重排都是整体替换，快照支撑"还原用户色"。</lang>
  // <lang en>Snapshot supports "restore mine" for combo loads and member edits.</lang>
  let seriesSnapshot:{primary:string;primaryName:string;secondary:string;secondaryName:string;thirdColor?:RoleColor;seriesMode?:SeriesMode;seriesRelation?:SeriesRelationId}|null=null;
  // 宝典弹层状态：当前情感分类与情感清单（首次打开时收集）。
  // <lang zh-CN>情感顺序按 CHM 页序（complement 形态首见序）。</lang>
  // <lang en>Emotion order follows CHM page order (first-seen in complement pack).</lang>
  let baodianEmotions:string[]=[];
  let baodianEmotion='';

  // 组装角色色：与 buildTheme 同链路（规范化/色阶/前景色）。
  // <lang zh-CN>供第三色与辅助槽位从 hex 构建完整 RoleColor。</lang>
  // <lang en>Builds a full RoleColor from hex for third/auxiliary slots.</lang>
  function makeRoleColor(value:string,name:string):RoleColor{
    const hex=normalizeHex(value);
    return{name:name||'辅助色',value:hex,scale:tonalScale(hex),on:bestOnColor(hex).hex};
  }
  // 成员色列表（派生自草稿）：1=主色（single）/2=主+副（dual）/3=主+副+第三（triad）。
  // <lang zh-CN>模式不再手动切换——成员数即模式（single 时副色为装配变体，不列成员）。</lang>
  // <lang en>Mode derives from member count; in single mode the secondary is an assembly variant, not a member.</lang>
  function seriesMemberList():{name:string;value:string}[]{
    const t=theme();
    const out:[{name:string;value:string}]=[{name:t.primary.name,value:t.primary.value}];
    if(draft.seriesMode!=='single')out.push({name:t.secondary.name,value:t.secondary.value});
    if(t.thirdColor)out.push({name:t.thirdColor.name,value:t.thirdColor.value});
    return out;
  }
  // 成员列表写回草稿并重算派生模式（不足三位清第三色；单成员置 single）。
  // <lang zh-CN>写回后走全链刷新（syncInputs→applyCurrentTheme→渲染）。</lang>
  // <lang en>After commit the full chain refreshes.</lang>
  function commitSeriesMembers(list:{name:string;value:string}[]){
    if(!list.length)return;
    if(list.length===1){draft.seriesMode='single';draft.primary=normalizeHex(list[0]!.value);if(list[0]!.name)draft.primaryName=list[0]!.name;draft.thirdColor=undefined;}
    else if(list.length===2){draft.seriesMode='dual';draft.primary=normalizeHex(list[0]!.value);if(list[0]!.name)draft.primaryName=list[0]!.name;draft.secondary=normalizeHex(list[1]!.value);if(list[1]!.name)draft.secondaryName=list[1]!.name;draft.thirdColor=undefined;}
    else{draft.seriesMode='triad';draft.primary=normalizeHex(list[0]!.value);if(list[0]!.name)draft.primaryName=list[0]!.name;draft.secondary=normalizeHex(list[1]!.value);if(list[1]!.name)draft.secondaryName=list[1]!.name;draft.thirdColor=makeRoleColor(list[2]!.value,list[2]!.name||'第三色');}
    syncInputs();applyCurrentTheme(false);renderHarmony();renderGradients();renderClassicPreview();
  }
  // 交换两个主体色成员位（0主/1副/2第三）：{name,value} 互换后按现有成员数写回。
  // <lang zh-CN>single/dual 下 index2 不存在→等同"把该色升为第三色"（commit 会补齐前置位）。</lang>
  // <lang en>Swapping into a non-existent slot promotes the color (commit fills prerequisites).</lang>
  function swapMemberPair(a:number,b:number){
    const list=seriesMemberList();
    const get=(i:number)=>list[i]??null;
    const va=get(a),vb=get(b);
    // 目标位超出当前成员数：把源色移动到目标位（补齐中间位为现值）。
    if(!va||!vb){
      const from=va?a:b, to=va?b:a, moving=va??vb;
      if(!moving)return;
      // 补齐到 to 长度
      while(list.length<=to)list.push({name:'占位',value:normalizeHex(draft.secondary)});
      list[to]={name:moving.name,value:moving.value};
      list.splice(from,1);
    }else{
      const tmp=list[a]!;list[a]=list[b]!;list[b]=tmp;
    }
    // 清理中间可能产生的占位（保留真实成员）。
    commitSeriesMembers(list.filter(x=>x.name!=='占位'));
    // 若过滤后掉成员（少见），仍至少保留主色。
    if(!byId<HTMLElement>('seriesMembers').children.length)commitSeriesMembers([{name:draft.primaryName,value:draft.primary}]);
  }
  // 交换辅助槽位与某主体色成员位（0主/1副/2第三）：两侧 {name,value} 互换；
  //   若目标成员不存在（如 dual 下"与第三色互换"），辅助色升为该成员并从槽位移除。
  // <lang zh-CN>满足维护者"辅助加三互换按钮"诉求。</lang>
  // <lang en>Aux↔member swap; promoting aux into a missing member slot when needed.</lang>
  function swapAuxWithMember(auxIdx:number,memberIdx:number){
    const aux=draft.auxiliary?.[auxIdx];
    if(!aux)return;
    const list=seriesMemberList();
    if(memberIdx>=list.length){
      // 成员位空缺：aux 升为该成员并移除槽位。
      draft.auxiliary!.splice(auxIdx,1);
      if(memberIdx===1){draft.seriesMode='dual';draft.secondary=normalizeHex(aux.value);draft.secondaryName=aux.name;}
      else if(memberIdx===2){draft.seriesMode='triad';draft.thirdColor=makeRoleColor(aux.value,aux.name);}
    }else{
      const m=list[memberIdx]!;
      list[memberIdx]={name:aux.name,value:normalizeHex(aux.value)};
      // aux 槽位取成员原色。
      draft.auxiliary![auxIdx]=makeRoleColor(m.value,m.name);
      commitSeriesMembers(list);
      return;
    }
    saveAuxiliary();syncInputs();applyCurrentTheme(false);renderHarmony();renderGradients();renderClassicPreview();
  }

  // 规则可用性判定：可补副色=有 secondAngle 或 pure（变体）；可补第三色=有 thirdFromSecondary/thirdCombo 或 pure。
  // <lang zh-CN>manual 不可补（排除在下拉外）；不适用按钮置灰（维护者确认：置灰不适用）。</lang>
  // <lang en>manual excluded; inapplicable buttons are disabled.</lang>
  function ruleDef(id:string){return SERIES_RELATION_DEFS.find(r=>r.id===id)!;}
  function ruleCanSecondary(id:string):boolean{return id!=='manual';}
  function ruleCanThird(id:string):boolean{const d=ruleDef(id);return !!d.sideAngles||!!d.thirdCombo||d.id==='pure';}
  // 规则补色（补副色/补第三色）：pure 走主色明暗变体（700/300 档），其余走 core 推导。
  // <lang zh-CN>结果写入对应成员（名字标注规则来源，可再手动改）。</lang>
  // <lang en>Result fills the member slot with a rule-tagged name; manually editable afterwards.</lang>
  function completeSeriesMember(which:'secondary'|'third',ruleOverride?:string){
    const rule=ruleOverride??byId<HTMLSelectElement>('seriesRuleSelect').value;
    const d=ruleDef(rule);
    if(which==='secondary'){
      if(!ruleCanSecondary(rule)){platform.alert(t('p12.rule.noSecondary'));return;}
      const hex=d.id==='pure'?tonalScale(draft.primary)['700']!:(deriveSecondaryByRelation(draft.primary,rule as SeriesRelationId)??'');
      if(!hex)return;
      draft.secondary=normalizeHex(hex);
      draft.secondaryName=`${t(d.name)} ${t('p12.rule.derived')}`;
      if(draft.seriesMode==='single')draft.seriesMode='dual';
    }else{
      if(!ruleCanThird(rule)){platform.alert(t('p12.rule.noThird'));return;}
      const hex=d.id==='pure'?(tonalScale(draft.primary)['300']??draft.secondary):(deriveThirdByRelation(draft.primary,draft.secondary,rule as SeriesRelationId)??'');
      if(!hex)return;
      draft.thirdColor=makeRoleColor(hex,`${t(d.name)} ${t('p11.family.thirdShort')}`);
      draft.seriesMode='triad';
    }
    syncInputs();applyCurrentTheme(false);renderHarmony();renderGradients();renderClassicPreview();
  }
  // 渲染配色关系面板：规则下拉/按钮可用性/派生模式信息/成员卡/辅助槽位。
  // <lang zh-CN>每次主体色或模式变化后调用；成员卡色块=行内取色器（点击重选色），X 删除（仅剩 1 色隐藏）。</lang>
  // <lang en>Re-rendered on any series change; member swatches are inline color inputs, X removes (hidden at one member).</lang>
  function renderHarmony(){
    // 规则补色下拉：保留"手动（现行）"作为合法当前值（色组/宝典直用等非规则来源需要它），
    //   其补色动作按钮按既有语义置灰；值非法时才回退 manual。
    //   维护者 P18 反馈链修复：原实现把 manual 判非法并强改 complement——国旗/企业色组被误标为互补关系。
    // <lang en>Keep "manual" as a legal selection (non-rule sources need it); only invalid values fall back.</lang>
    const relSel=byId<HTMLSelectElement>('seriesRuleSelect');
    const manualDef=SERIES_RELATION_DEFS.find(r=>r.id==='manual');
    const defs=[...(manualDef?[manualDef]:[]),...SERIES_RELATION_DEFS.filter(r=>r.id!=='manual')];
    if(!defs.some(r=>r.id===draft.seriesRelation))draft.seriesRelation='manual';
    const relation:SeriesRelationId=draft.seriesRelation??'manual';
    relSel.innerHTML=defs.map(r=>`<option value="${r.id}"${r.id===relation?' selected':''}>${escapeHtml(t(r.name))}</option>`).join('');
    byId<HTMLButtonElement>('completeSecondaryBtn').disabled=!ruleCanSecondary(relation);
    byId<HTMLButtonElement>('completeThirdBtn').disabled=!ruleCanThird(relation);
    // 第三色自动匹配规则下拉：三色可用规则。
    const matchSel=byId<HTMLSelectElement>('thirdMatchRule');
    const thirdDefs=defs.filter(r=>ruleCanThird(r.id));
    matchSel.innerHTML=thirdDefs.map(r=>`<option value="${r.id}">${escapeHtml(t(r.name))}</option>`).join('');
    // 派生模式信息。
    const members=seriesMemberList();
    byId<HTMLElement>('seriesInfo').textContent=members.length===1?t('p12.mode.single'):members.length===2?t('p12.mode.dual'):t('p12.mode.triad');
    // 成员卡（色块行内取色 + X 删除）。
    const roleLabels=[t('p11.member.primary'),t('p11.member.secondary'),t('p11.member.third')];
    byId<HTMLElement>('seriesMembers').innerHTML=members.map((m,i)=>`<div class="pp-member" data-member-idx="${i}"><span class="pp-grip" draggable="true" aria-label="${escapeHtml(t('p12.drag.hint'))}">⠿</span><div class="pp-slot-head"><input type="color" class="pp-swatch-input" value="${m.value}" data-member-recolor="${i}" aria-label="${escapeHtml(t('p12.member.recolorAria'))}">${members.length>1?`<button class="pp-member-del" data-member-del="${i}" type="button" aria-label="${escapeHtml(t('p12.member.delAria'))}">×</button>`:''}</div><div class="pp-role">${escapeHtml(t(m.name))}</div><div class="pp-rolehex">${m.value}</div><div class="pp-rolefrom">${escapeHtml(roleLabels[i]||'')}</div></div>`).join('');
    all<HTMLInputElement>('[data-member-recolor]').forEach(inp=>inp.addEventListener('change',()=>{
      const list=seriesMemberList();const idx=+(inp.dataset.memberRecolor??-1);
      if(idx<0||!list[idx])return;
      list[idx]!.value=normalizeHex(inp.value);
      commitSeriesMembers(list);
    }));
    all<HTMLButtonElement>('[data-member-del]').forEach(btn=>btn.addEventListener('click',()=>{
      const list=seriesMemberList();const idx=+(btn.dataset.memberDel??-1);
      if(idx<=0||list.length<=1)return;
      list.splice(idx,1);
      commitSeriesMembers(list);
    }));
    // 成员卡拖拽互换（维护者：三色成员卡拖拽也要生效）：grip 承载 dragstart，卡承载 drop。
    // <lang zh-CN>与操作台拾色器同一"抓手"根因修复。</lang>
    // <lang en>Same grip fix as console pickers.</lang>
    let memDragSrc=-1;
    all<HTMLElement>('#seriesMembers .pp-member').forEach(card=>{
      const grip=card.querySelector<HTMLElement>('.pp-grip');
      if(!grip)return;
      grip.addEventListener('dragstart',e=>{memDragSrc=+(card.dataset.memberIdx??-1);e.dataTransfer?.setData('text/plain',String(memDragSrc));});
      card.addEventListener('dragover',e=>{e.preventDefault();if(memDragSrc>=0&&memDragSrc!==+(card.dataset.memberIdx??-1))card.style.outline='2px dashed var(--p400)';});
      card.addEventListener('dragleave',()=>{card.style.outline='';});
      card.addEventListener('drop',e=>{
        e.preventDefault();card.style.outline='';
        const dst=+(card.dataset.memberIdx??-1);
        const src=memDragSrc;memDragSrc=-1;
        if(src<0||dst<0||src===dst)return;
        swapMemberPair(src,dst);
      });
    });
    // 辅助槽位（显示+编辑+重排）：行内编辑（color/名称）+ 拖拽重排 + 上移/下移按钮 + 删除。
    // <lang zh-CN>编辑经 makeRoleColor 重建（色阶/前景自动）；重排影响 aux<N> token 编号。</lang>
    // <lang en>Inline edits rebuild via makeRoleColor; reorder renumbers aux<N> tokens.</lang>
    const auxWrap=byId<HTMLElement>('auxSlots');
    auxWrap.innerHTML=draft.auxiliary!.map((aux,i)=>`<div class="pp-slot" draggable="true" data-aux-idx="${i}"><div class="pp-slot-head"><input type="color" class="pp-aux-color" value="${aux.value}" data-aux-color="${i}" data-tooltip="${escapeHtml(t('p11.aux.colorAria',{i}))}" aria-label="${escapeHtml(t('p11.aux.colorAria',{i}))}"><input class="pp-slot-name" value="${escapeHtml(aux.name)}" data-aux-name="${i}" aria-label="${escapeHtml(t('p11.aux.nameAria',{i}))}"><button class="pp-slot-del" data-aux-del="${i}" type="button">${t('p11.aux.delete')}</button></div><div class="pp-slot-hex">${aux.value} · ${t('p11.aux.slotMeta',{i})}</div><div class="pp-mini-actions"><button class="pp-swap-btn" data-aux-swap="0" data-aux-i="${i}" type="button">${t('p12.aux.swapP')}</button><button class="pp-swap-btn" data-aux-swap="1" data-aux-i="${i}" type="button">${t('p12.aux.swapS')}</button><button class="pp-swap-btn" data-aux-swap="2" data-aux-i="${i}" type="button">${t('p12.aux.swapT')}</button><button class="pp-slot-del" data-aux-up="${i}" type="button" ${i===0?'disabled':''}>↑</button><button class="pp-slot-del" data-aux-down="${i}" type="button" ${i===draft.auxiliary!.length-1?'disabled':''}>↓</button><span class="pp-drag-hint">⠿ ${t('p11.aux.dragHint')}</span></div></div>`).join('');
    byId<HTMLElement>('auxEmptyHint').style.display=draft.auxiliary!.length?'none':'block';
    // 行内编辑：颜色/名称。
    all<HTMLInputElement>('[data-aux-color]',auxWrap).forEach(inp=>inp.addEventListener('change',()=>{
      const i=+(inp.dataset.auxColor||-1);const item=draft.auxiliary![i];
      if(!item)return;
      const rebuilt=makeRoleColor(inp.value,item.name);draft.auxiliary![i]=rebuilt;
      saveAuxiliary();renderHarmony();renderGradients();applyRuntimeTheme();updateTokenOutputs();
    }));
    all<HTMLInputElement>('[data-aux-name]',auxWrap).forEach(inp=>inp.addEventListener('change',()=>{
      const i=+(inp.dataset.auxName||-1);if(draft.auxiliary![i])draft.auxiliary![i]!.name=inp.value.trim()||`辅助 ${i+1}`;
      saveAuxiliary();renderHarmony();
    }));
    // 删除。
    all<HTMLButtonElement>('[data-aux-del]',auxWrap).forEach(btn=>btn.addEventListener('click',()=>{
      const idx=+(btn.dataset.auxDel ?? -1);
      if(idx>=0&&draft.auxiliary)draft.auxiliary.splice(idx,1);
      saveAuxiliary();renderHarmony();renderGradients();applyRuntimeTheme();updateTokenOutputs();
    }));
    // 上移/下移。
    const moveAux=(from:number,to:number)=>{
      if(to<0||to>=draft.auxiliary!.length)return;
      const item=draft.auxiliary!.splice(from,1)[0]!;
      draft.auxiliary!.splice(to,0,item);
      saveAuxiliary();renderHarmony();renderGradients();applyRuntimeTheme();updateTokenOutputs();
    };
    all<HTMLButtonElement>('[data-aux-swap]',auxWrap).forEach(btn=>btn.addEventListener('click',()=>{
      const i=+(btn.dataset.auxI??-1);const m=+(btn.dataset.auxSwap??-1);
      if(i<0||m<0)return;
      swapAuxWithMember(i,m);
    }));
    all<HTMLButtonElement>('[data-aux-up]',auxWrap).forEach(btn=>btn.addEventListener('click',()=>moveAux(+(btn.dataset.auxUp||0),+(btn.dataset.auxUp||0)-1)));
    all<HTMLButtonElement>('[data-aux-down]',auxWrap).forEach(btn=>btn.addEventListener('click',()=>moveAux(+(btn.dataset.auxDown||0),+(btn.dataset.auxDown||0)+1)));
    // 拖拽重排（move 语义：拖到目标位插入）。
    let auxDragSrc=-1;
    auxWrap.querySelectorAll<HTMLElement>('[data-aux-idx]').forEach(card=>{
      card.addEventListener('dragstart',e=>{auxDragSrc=+(card.dataset.auxIdx||-1);e.dataTransfer?.setData('text/plain',String(auxDragSrc));});
      card.addEventListener('dragover',e=>{e.preventDefault();card.style.outline='2px dashed var(--p400)';});
      card.addEventListener('dragleave',()=>{card.style.outline='';});
      card.addEventListener('drop',e=>{
        e.preventDefault();card.style.outline='';
        const dst=+(card.dataset.auxIdx||-1);
        if(auxDragSrc<0||dst===auxDragSrc)return;
        moveAux(auxDragSrc,dst);
      });
      card.addEventListener('dragend',()=>{card.style.outline='';});
    });
  }
  // 打开宝典弹层：收集情感（complement 首见序）→ 渲染菜单与 CHM 色卡区。
  // <lang zh-CN>右侧按十形态分区展示所选情感的全部组合（色条=色号底+编号，照搬 CHM 版式）。</lang>
  // <lang en>Right panel groups the selected emotion's combos by all ten forms, CHM-style swatch stacks.</lang>
  function ensureBaodianEmotions(){
    if(!baodianEmotions.length){
      // 情感清单：complement 形态页序优先，其余形态并集补全（保 24 类完整）。
      // <lang zh-CN>complement 缺某情感时（该页无补色组合）由其余形态补齐。</lang>
      // <lang en>Complement page order first; remaining forms union to full 24.</lang>
      const seen=new Set<string>();
      for(const c of FORM_PACKS['complement']??[])seen.add(c.e);
      for(const combos of Object.values(FORM_PACKS))for(const c of combos)seen.add(c.e);
      baodianEmotions=[...seen];
    }
    if(!baodianEmotion||!baodianEmotions.includes(baodianEmotion))baodianEmotion=baodianEmotions[0]||'';
  }
  function openBaodianModal(){
    ensureBaodianEmotions();
    colorSource='baodian';
    openColorSourceModal();
  }
  // 色卡信息浮层（W-tb-P17 扩充轮②）：hover 全部色卡（宝典色块/传统色卡）显示色值多形式（#hex/rgb/hsl）、
  //   颜色说明（传统色 note）与注意事项（预留：现数据无独立字段则不显行），逐项复制小图标。
  // <lang en>Color-card info tip: value forms/description/cautions with per-row copy icons.</lang>
  let ccTipEl:HTMLElement|null=null;
  // ccTipEnsure：单例浮层元素（body 直挂，fixed 定位）。
  function ccTipEnsure():HTMLElement{
    if(!ccTipEl){
      ccTipEl=document.createElement('div');
    ccTipEl.className='cc-tip';
    ccTipEl.hidden=true;
    document.body.appendChild(ccTipEl);
    }
    return ccTipEl;
  }
  // hexToRgb255/Hsl：tip 展示用主流色值形式。
  function hexToRgb255(hex:string):[number,number,number]{return[parseInt(hex.slice(1,3),16),parseInt(hex.slice(3,5),16),parseInt(hex.slice(5,7),16)]}
  function hexToHslStr(hex:string):string{
    const[r0,g0,b0]=hexToRgb255(hex);
    const r=r0/255,g=g0/255,b=b0/255;
    const mx=Math.max(r,g,b),mn=Math.min(r,g,b),d=mx-mn,l=(mx+mn)/2;
    if(d===0)return'hsl(0, 0%, '+Math.round(l*100)+'%)';
    const s=d/(1-Math.abs(2*l-1));
    let h=mx===r?((g-b)/d)%6:mx===g?(b-r)/d+2:(r-g)/d+4;
    h=Math.round((h*60+360)%360);
    return'hsl('+h+', '+Math.round(s*100)+'%, '+Math.round(l*100)+'%)';
  }
  // placeTip：零间距贴边定位——上方优先；放不下翻下方；加方向桥后用最终高度重算；四边夹取视口。
  //   贴边=浮层与卡片同边无缝，鼠标沿最短路径滑入不会经过 hover 空白带。
  // <lang en>Zero-gap placement with direction bridge; flip when the top lacks room; clamp to viewport.</lang>
  function placeTip(target:Element){
    const tip=ccTipEnsure();
    const el=tip as HTMLElement;
    if(el.hidden)return;
    const r0=target.getBoundingClientRect();
    // below 判定：上方空间不足（含 6px 边距）则翻下方。
    let below=r0.top-el.offsetHeight<6;
    el.classList.toggle('bridge-below',below);
    el.classList.toggle('bridge-above',!below);
    // 加桥后最终尺寸。
    const tw=el.offsetWidth,th=el.offsetHeight;
    const x=Math.min(Math.max(6,r0.left),window.innerWidth-tw-6);
    let y=below?r0.bottom:r0.top-th;
    // 下方也放不下→强制上方并接受轻微越界（保证不脱离卡片）。
    if(y+th>window.innerHeight-6&&!below){y=Math.max(6,r0.top-th);}
    el.style.left=x+'px';el.style.top=Math.max(6,y)+'px';
  }
  // ccTipShow：填充内容并触发定位。
  function ccTipShow(target:Element,opts:{title:string;hex:string;desc?:string;caution?:string;palette?:string[]}){
    const tip=ccTipEnsure();
    const hex=opts.hex;
    const[r,g,b]=hexToRgb255(hex);
    // 行集合：单色卡=HEX/RGB/HSL；色组卡=组内全部 HEX（逐色一行）+ 首色 RGB/HSL。
    // <lang en>Single cards show HEX/RGB/HSL; palette cards list every hex plus lead RGB/HSL.</lang>
    const rows:[string,string][]=opts.palette&&opts.palette.length>1
      ?[['RGB','rgb('+r+', '+g+', '+b+')'],['HSL',hexToHslStr(hex)]]
      :[['HEX',hex],['RGB','rgb('+r+', '+g+', '+b+')'],['HSL',hexToHslStr(hex)]];
    let html='<div class="cc-tip-title"><span class="cc-tip-swatch" style="background:'+hex+'"></span>'+escapeHtml(opts.title)+'</div>';
    // HEX 组头行可整体复制（逗号分隔）。
    if(opts.palette&&opts.palette.length>1){
      html+='<div class="cc-tip-row"><span class="cc-tip-label">HEX</span><span class="cc-tip-val">'+opts.palette.join(', ')+'</span>'
        +'<button type="button" class="cc-tip-copy" data-cc-copy="'+escapeHtml(opts.palette.join(', '))+'" title="'+t('p17.tip.copy')+'">⧉</button></div>';
    }
    for(const[label,val]of rows){
      if(!val)continue;
      html+='<div class="cc-tip-row"><span class="cc-tip-label">'+label+'</span><span class="cc-tip-val">'+val+'</span>'
        +'<button type="button" class="cc-tip-copy" data-cc-copy="'+val+'" title="'+t('p17.tip.copy')+'">⧉</button></div>';
    }
    // 说明段（色名考据/来源）与注意事项段（配色使用建议），各自可复制。
    // <lang en>Description and caution sections, each independently copyable.</lang>
    if(opts.desc){
      html+='<div class="cc-tip-row"><span class="cc-tip-label">'+t('p17.tip.desc')+'</span><button type="button" class="cc-tip-copy" data-cc-copy="'+escapeHtml(opts.desc)+'" title="'+t('p17.tip.copy')+'">⧉</button></div>';
      html+='<div class="cc-tip-desc">'+escapeHtml(opts.desc)+'</div>';
    }
    if(opts.caution){
      html+='<div class="cc-tip-row"><span class="cc-tip-label">'+t('p17.tip.caution')+'</span><button type="button" class="cc-tip-copy" data-cc-copy="'+escapeHtml(opts.caution)+'" title="'+t('p17.tip.copy')+'">⧉</button></div>';
      html+='<div class="cc-tip-desc cc-tip-caution">'+escapeHtml(opts.caution)+'</div>';
    }
    tip.innerHTML=html;
    (tip as HTMLElement).hidden=false;
    // 定位两拍：先粗略放（防闪烁），下一帧布局稳定后精确校正（字体/图标就绪后的真实高度）。
    //   维护者反馈：原 8px 间隙即 hover 断点；且首帧测高不准会压卡——零间距+rAF 校正一并解决。
    // <lang en>Two-phase placement: coarse now, exact after the next frame when layout has settled.</lang>
    placeTip(target);
    requestAnimationFrame(()=>placeTip(target));
  }
  // 隐藏宽限（150ms）：鼠标在卡片↔浮层之间移动时不立即消失。
  // <lang en>Delayed hide gives a 150ms grace window while crossing between card and tip.</lang>
  let ccTipTimer:number|undefined;
  function ccTipHideNow(){if(ccTipEl)(ccTipEl as HTMLElement).hidden=true}
  function ccTipHide(){window.clearTimeout(ccTipTimer);ccTipTimer=window.setTimeout(ccTipHideNow,150)}
  function ccTipKeep(){window.clearTimeout(ccTipTimer)}
  // 事件委托：mouseover 进色卡/色块显示，进浮层保持，出即隐藏；复制点击统一处理。
  // <lang en>Delegated hover/copy handling for the shared tip element.</lang>
  document.addEventListener('mouseover',e=>{
    const t0=e.target as Element;
    // 三类卡：宝典色块（.bd-bar）/ 传统色卡（.tc-card）/ 国旗企业色组卡（.bdc-card）。
    // <lang en>Three card kinds: baodian swatch, traditional color card, flag/brand palette card.</lang>
    const card=t0.closest('.bd-bar,.tc-card,.bdc-card');
    const tip=ccTipEnsure();
    if(card){
      if(tip.contains(card))return;
      ccTipKeep(); // 进入卡片即取消隐藏计时。
      if(card.classList.contains('bd-bar')){
        const hex=(card as HTMLElement).dataset.hex||'#cccccc';
        ccTipShow(card,{title:t('p12.baodian.tag')+' #'+(card.textContent||'').trim(),hex});
      }else if(card.classList.contains('bdc-card')){
        // 色组卡（国旗/企业）：标题=名称，色值行=组内全部 HEX，说明=设计说明（无 caution）。
        // <lang en>Palette card: name title, all palette hexes, design note.</lang>
        const el=card as HTMLElement;
        const colors=(el.dataset.bdcColors||'').split(',').filter(Boolean);
        ccTipShow(el,{title:el.dataset.bdcName||'',hex:colors[0]||'#cccccc',desc:el.dataset.bdcNote||undefined,palette:colors});
      }else{
        const el=card as HTMLElement;
        ccTipShow(el,{title:el.dataset.tcName||'',hex:el.dataset.tcHex||'#cccccc',desc:el.dataset.tcNote||undefined,caution:el.dataset.tcCaution||undefined});
      }
      return;
    }
    if(tip.contains(t0)){ccTipKeep();return;}
    ccTipHide();
  });
  // ccCopy：复制文本（clipboard API 优先，失败回退 execCommand——合成事件/非安全上下文兼容）。
  // <lang en>Copies text with clipboard API falling back to execCommand for untrusted/non-secure contexts.</lang>
  function ccCopy(v:string):Promise<void>{
    if(navigator.clipboard&&navigator.clipboard.writeText)return navigator.clipboard.writeText(v);
    return new Promise((res,rej)=>{
      const ta=document.createElement('textarea');
      ta.value=v;ta.style.position='fixed';ta.style.opacity='0';
      document.body.appendChild(ta);ta.select();
      const ok=document.execCommand('copy');
      ta.remove();
      ok?res():rej(new Error('execCommand copy failed'));
    });
  }
  document.addEventListener('click',e=>{
    const t0=e.target as HTMLElement;
    const btn=t0.closest('.cc-tip-copy') as HTMLElement|null;
    if(!btn||!btn.dataset.ccCopy)return;
    // 复制回执：图标短暂变 ✓。
    // <lang en>Feedback: the copy icon flips to a checkmark briefly.</lang>
    ccCopy(btn.dataset.ccCopy).then(()=>{
      btn.classList.add('done');btn.textContent='✓';
      setTimeout(()=>{btn.classList.remove('done');btn.textContent='⧉'},900);
    }).catch(()=>{});
  });

  // 弹层渲染分发（W-tb-P17）：按当前源渲染菜单与右区；标题与快照语义随源。
  // <lang en>Modal render dispatch by source; menu/right pane per source.</lang>
  function openColorSourceModal(){
    byId<HTMLElement>('baodianModal').hidden=false;
    byId<HTMLInputElement>('baodianAnchorToggle').checked=baodianAnchor;
    // 标题随源（宝典/传统色/国旗/企业）。
    setText('baodianTitle',colorSource==='baodian'?t('p12.baodian.title')
      :colorSource==='traditional'?t('p17.traditional.title')
      :colorSource==='flag'?t('p18.flag.title')
      :colorSource==='brand'?t('p18.brand.title')
      :colorSource==='nature'?t('p19.nature.title')
      :t('p19.social.title'));
    renderColorSourceModal();
  }
  function renderColorSourceModal(){
    if(colorSource==='baodian'){ensureBaodianEmotions();renderBaodianMenu();renderBaodianRight();return;}
    if(colorSource==='traditional'){renderTraditionalMenu();return;}
    if(colorSource==='flag'){renderFlagMenu();return;}
    if(colorSource==='brand'){renderBrandMenu();return;}
    if(colorSource==='nature'){renderNatureMenu();return;}
    renderSocialMenu();
  }
  // 国旗源（W-tb-P18）：左=大洲菜单，右=该国色组卡（色块条+国名），点击=依次填主/副/第三（定案 3）。
  // <lang en>Flag source: continent menu; country palette cards; apply fills primary/secondary/third in order.</lang>
  function renderFlagMenu(){
    const menu=byId<HTMLElement>('baodianMenu');
    const groups:('asia'|'europe'|'americas'|'africa'|'oceania')[]=['asia','europe','americas','africa','oceania'];
    menu.innerHTML=groups.map(g=>`<button type="button" class="baodian-emo${baodianFlagGroup===g?' active':''}" data-flag-group="${g}">${escapeHtml(t('p18.continent.'+g))}</button>`).join('');
    all<HTMLButtonElement>('[data-flag-group]',menu).forEach(btn=>btn.addEventListener('click',()=>{
      baodianFlagGroup=btn.dataset.flagGroup||'asia';renderFlagMenu();
    }));
    renderFlagRight();
  }
  // 国旗色说明：手工考据表优先（30+ 主要国家），其余按"颜色→象征"通识规则合成一句。
  // <lang en>Hand-curated notes first; the rest composed from conventional color symbolism.</lang>
  const FLAG_NOTES:Record<string,string>={
    'cn':'中华人民共和国国旗，红底黄星。红色象征革命，五颗黄星象征中国共产党领导下的人民大团结。',
    'hk':'中国香港特别行政区区旗，红底白色紫荆花。红色与祖国国旗一致，紫荆花象征香港。',
    'mo':'中国澳门特别行政区区旗，绿底白色莲花。绿色象征生机，莲花为澳门市花。',
    'jp':'日本国旗"日之丸"，白底红圆。红色象征太阳，白色象征纯洁与诚实。',
    'kr':'韩国国旗"太极旗"，白底太极图与四卦。白色象征和平，太极象征阴阳平衡。',
    'in':'印度国旗三色旗：藏红花色（勇气）、白色（和平与真理）、绿色（信仰），中央蓝色法轮象征法。',
    'th':'泰国国旗红白蓝三色横条，蓝色居中象征王室，红白象征国家与人民。',
    'gb':'英国"米字旗"，红白蓝三色组合，象征英格兰、苏格兰、爱尔兰的联合。',
    'fr':'法国三色旗蓝白红，源自法国大革命，象征自由、平等、博爱。',
    'de':'德国三色旗黑红金，源自 1848 年革命，象征统一与自由。',
    'it':'意大利三色旗绿白红，绿色象征希望，白色象征信仰，红色象征牺牲。',
    'es':'西班牙红黄红三色旗，黄色居中象征西班牙王国，红色象征力量。',
    'us':'美国"星条旗"，13 条红白相间象征建国 13 州，蓝底白星象征 50 州。',
    'br':'巴西绿底黄菱形蓝圆，绿色象征森林，黄色象征矿产，蓝色天球象征夜空。',
    'au':'澳大利亚蓝底米字旗加南十字星，象征英联邦与南半球。',
    'ca':'加拿大"枫叶旗"，红白红三竖条，中央红枫叶象征国家象征。',
    'mx':'墨西哥绿白红三色旗，中央国徽为鹰立仙人掌啄蛇，象征阿兹特克建国传说。',
    'ar':'阿根廷天蓝白天蓝三色横条，中央太阳象征五月革命与独立。',
    'za':'南非六色旗，Y 字形设计象征多种族融合，黑黄绿象征非洲，红白蓝象征欧洲遗产。',
    'eg':'埃及红白黑三色旗，中央金色鹰象征萨拉丁，红色象征革命，黑色象征压迫。',
    'ng':'尼日利亚绿白绿三色旗，绿色象征农业与森林，白色象征和平。',
    'ke':'肯尼亚黑红绿三色旗加白边与马赛盾牌，象征人民、鲜血、土地。',
    'et':'埃塞俄比亚绿黄红三色旗加蓝底金星，象征和平、繁荣、团结。',
    'ru':'俄罗斯白蓝红三色旗，白色象征高贵与坦率，蓝色象征忠诚，红色象征勇气。',
    'nl':'荷兰红白蓝三色旗，红色象征勇气，白色象征和平与诚实，蓝色象征忠诚。',
    'be':'比利时黑黄红三竖条，源自布拉班特公国纹章色。',
    'pl':'波兰白红双色旗，白色象征纯洁，红色象征热血与牺牲。',
    'se':'瑞典蓝底黄十字，蓝色象征真理与忠诚，黄色十字象征基督教信仰。',
    'no':'挪威红底蓝十字加白边，红白蓝取自法国三色，十字象征基督教传统。',
    'dk':'丹麦红底白十字，世界上最古老的国旗之一，十字象征基督教。',
    'fi':'芬兰白底蓝十字，白色象征冬雪，蓝色象征湖泊与天空。',
    'ch':'瑞士红底白十字，红色象征力量与勇气，白十字象征基督教信仰与中立。',
    'at':'奥地利红白红三横条，源自巴本堡家族纹章。',
    'pt':'葡萄牙绿红双色旗，绿色象征希望，红色象征勇气与鲜血。',
    'gr':'希腊蓝白条纹加左上角十字，蓝色象征天空与海洋，白色象征纯洁。',
    'tr':'土耳其红底白星月，红色象征鲜血与胜利，星月为伊斯兰文化象征。',
    'sa':'沙特阿拉伯绿底白色阿拉伯文与宝剑，绿色象征伊斯兰，文字为清真言。',
    'ae':'阿联酋红绿白黑四色，源自泛阿拉伯色：红色象征勇气，绿色象征希望，白色象征纯洁，黑色象征力量。',
    'il':'以色列白底蓝色大卫之星与上下蓝条，蓝色与白色取自犹太教祈祷披肩。',
    'ir':'伊朗绿白红三色旗，绿色象征伊斯兰与希望，白色象征和平，红色象征勇气。',
    'iq':'伊拉克红白黑三色旗，泛阿拉伯色组合。',
    'vn':'越南红底黄星，红色象征革命与鲜血，黄星象征工人农民士兵团结。',
    'id':'印度尼西亚红白双色旗，红色象征勇气，白色象征纯洁。',
    'my':'马来西亚红白条纹加蓝色 canton 与黄色星月，象征十四州与伊斯兰。',
    'sg':'新加坡红白双色旗，红色象征平等与友谊，白色象征纯洁与美德。',
    'ph':'菲律宾蓝红双色旗加白色三角与太阳三星，象征和平、爱国与三大区域。',
  };
  // 颜色象征词典（合成说明用）。
  const COLOR_SYMBOL:Record<string,string>={
    '红色':'勇气、鲜血与革命','绿色':'自然、希望与伊斯兰文化','蓝色':'天空、海洋与忠诚','白色':'和平、纯洁与诚实',
    '黄色':'财富、阳光与资源','黑色':'人民、力量与非洲遗产','橙色':'活力、温暖与勇气'
  };
  // 合成说明：按色系桶生成一句"颜色—象征"说明。
  // <lang en>Composes a symbolism sentence from the palette's hue buckets.</lang>
  function composedFlagNote(colors:string[]):string{
    const seen=new Set<string>();
    const parts:string[]=[];
    for(const hex of colors.slice(0,3)){
      const r=parseInt(hex.slice(1,3),16)/255,g=parseInt(hex.slice(3,5),16)/255,b=parseInt(hex.slice(5,7),16)/255;
      const mx=Math.max(r,g,b),mn=Math.min(r,g,b),d=mx-mn;
      // 低彩度归白/黑，其余按色相归类。
      let key='黄色';
      if(d<0.08)key=mx>0.85?'白色':mx>0.4?'黑色':'黑色';
      else{
        let h;
        if(mx===r)h=((g-b)/d)%6;else if(mx===g)h=(b-r)/d+2;else h=(r-g)/d+4;
        h=(h*60+360)%360;
        key=h<20||h>=340?'红色':h<50?'橙色':h<75?'黄色':h<180?'绿色':h<260?'蓝色':'黑色';
      }
      const sym=COLOR_SYMBOL[key];
      if(sym&&!seen.has(key)){seen.add(key);parts.push(key+'象征'+sym);}
    }
    return parts.length?('国旗配色通识：'+parts.join('；')+'。'):'国旗配色：多色组合，象征国家历史与价值。';
  }
  function renderFlagRight(){
    const right=byId<HTMLElement>('baodianRight');
    const items=FLAG_COLORS.filter(f=>f.continent===baodianFlagGroup);
    let html='<div class="bdc-grid">';
    for(const f of items){
      // note：手工考据优先，缺省合成。
      // 键为 ISO 码（表内用 cn/hk/...），卡片 id 为 flag-<iso>。
      const note=FLAG_NOTES[f.id.replace('flag-','')]||composedFlagNote(f.colors);
      const iso=f.id.replace('flag-','');
      html+=`<div class="bdc-card" role="button" tabindex="0" data-bdc-colors="${f.colors.join(',')}" data-bdc-name="${escapeHtml(f.name)}" data-bdc-kind="flag" data-bdc-note="${escapeHtml(note)}">
        <div class="bdc-strip">${f.colors.map(c=>`<span style="background:${c}"></span>`).join('')}</div>
        <div class="bdc-name"><span class="flag-thumb" data-thumb="flag"><span class="flag-bars">${f.colors.slice(0,4).map(c=>`<i style="background:${c}"></i>`).join('')}</span><img class="flag-img" src="./flags/${escapeHtml(iso)}.png" alt="" data-iso="${escapeHtml(iso)}"></span><span class="bdc-title">${escapeHtml(f.name)}</span><span class="bdc-sub">${escapeHtml(f.nameEn)}</span></div>
        <div class="bdc-hex">${f.colors.join(' ')}</div>
        <div class="bdc-note">${escapeHtml(note)}</div>
      </div>`;
    }
    html+='</div>';
    right.innerHTML=html||`<div class="small">${t('p12.baodian.empty')}</div>`;
    bindPaletteApply(right);
    bindFlagImages(right);
  }
  // 企业源（W-tb-P18）：左=行业菜单，右=品牌色组卡（色块条+品牌名），点击=依次填主/副/第三。
  // <lang en>Brand source: industry menu; brand palette cards; same apply semantics.</lang>
  function renderBrandMenu(){
    const menu=byId<HTMLElement>('baodianMenu');
    const groups:('tech'|'auto'|'food'|'finance'|'retail'|'media'|'travel'|'apparel'|'other')[]=['tech','auto','food','finance','retail','media','travel','apparel','other'];
    menu.innerHTML=groups.map(g=>`<button type="button" class="baodian-emo${baodianBrandGroup===g?' active':''}" data-brand-group="${g}">${escapeHtml(t('p18.industry.'+g))}</button>`).join('');
    all<HTMLButtonElement>('[data-brand-group]',menu).forEach(btn=>btn.addEventListener('click',()=>{
      baodianBrandGroup=btn.dataset.brandGroup||'tech';renderBrandMenu();
    }));
    renderBrandRight();
  }
  // 企业色说明：手工考据表优先（40+ 知名品牌），其余合成"品牌主色—行业气质"说明。
  // <lang en>Hand-curated brand notes first; others composed from primary colour + industry tone.</lang>
  const BRAND_NOTES:Record<string,string>={
    'Apple':'苹果标志性的银灰与白色，象征创新、简洁与现代科技美学。',
    'Microsoft':'四色方块（红绿蓝黄）象征 Windows 生态多样性，蓝色代表信任与专业。',
    'Google':'四色（蓝红黄绿）代表 Google 产品线的多样性与活力。',
    'Facebook':'Facebook 蓝，象征信任、专业与社交连接，全球统一品牌色。',
    'Twitter':'Twitter 蓝，象征沟通、开放与实时信息流。',
    'LinkedIn':'LinkedIn 蓝，象征专业、信任与职业发展。',
    'YouTube':'YouTube 红，象征活力、娱乐与全球视频平台。',
    'Instagram':'Instagram 渐变色，象征创意、活力与视觉内容。',
    'GitHub':'GitHub 黑，象征开发者文化、开源与专业工具。',
    'Adobe':'Adobe 红，象征创意、设计与专业软件。',
    'Intel':'Intel 蓝，象征科技、创新与半导体领导力。',
    'NVIDIA':'NVIDIA 绿，象征 GPU 计算、AI 与图形性能。',
    'Samsung':'Samsung 蓝，象征科技、创新与全球消费电子。',
    'IBM':'IBM 蓝，象征企业级计算、咨询与科技服务。',
    'Amazon':'Amazon 橙与箭头微笑，象征从 A 到 Z 的客户服务与电商。',
    'Netflix':'Netflix 红，象征流媒体娱乐、原创内容与全球覆盖。',
    'Spotify':'Spotify 绿，象征音乐流媒体、播客与音频内容。',
    'Nike Football':'Nike 黑与白，象征运动、性能与"Just Do It"精神。',
    'Adidas':'Adidas 黑与三道杠，象征运动性能、经典与全球体育。',
    'Coca-Cola':'可口可乐红，象征经典、活力与全球饮料领导品牌。',
    'Starbucks':'星巴克绿，象征咖啡文化、可持续与全球连锁。',
    "McDonald's":'麦当劳黄红，象征快餐、快乐与全球连锁。',
    'HBO':'HBO 黑底白字，象征高端原创内容、电影与电视剧。',
    'Disney':'迪士尼蓝与红，象征童话、家庭娱乐与全球 IP。',
    'PlayStation':'PlayStation 蓝，象征游戏、娱乐与索尼互动娱乐。',
    'Xbox':'Xbox 绿，象征微软游戏生态与跨平台娱乐。',
    'Nintendo':'任天堂红，象征游戏、创意与日本娱乐文化。',
    'Tesla':'Tesla 红，象征电动车、可持续能源与科技创新。',
    'PayPal':'PayPal 双蓝，象征在线支付、金融与信任。',
    'Stripe':'Stripe 紫，象征开发者支付、金融科技与创新。',
    'Airbnb':'Airbnb 红，象征旅行、住宿共享与全球社区。',
    'Uber':'Uber 黑，象征出行、共享经济与全球交通。',
    'Meta':'Meta 蓝，象征元宇宙、社交连接与科技平台。',
    'OpenAI':'OpenAI 绿，象征 AI 研究、创新与未来技术。',
    'BMW':'宝马蓝白，源自巴伐利亚州旗色，象征精密工程与驾驶乐趣。',
    'Mercedes-Benz':'奔驰银与黑，象征豪华、精密与汽车工业标杆。',
    'Ferrari':'法拉利红（Rosso Corsa），国际赛车运动的意大利代表色。',
    'Coca Cola':'可口可乐红，象征经典与活力。',
    'Visa':'Visa 蓝，象征全球支付网络的信任与速度。',
    'Mastercard':'万事达红橙双圆，象征全球支付连接。',
    'FedEx':'联邦快递紫橙，紫色象征高端，橙色象征速度与活力。',
    'UPS':'UPS 棕，象征可靠、稳重与物流传统。',
    'DHL':'DHL 黄红，黄色象征速度，红色象征活力。',
  };
  // 合成企业说明：主色 + 行业气质。
  // <lang en>Composes a brand note from the lead colour and industry tone.</lang>
  function composedBrandNote(name:string,colors:string[],industry:string):string{
    const tone:Record<string,string>={
      tech:'专业、创新与数字化',auto:'性能、精密与驾驶体验',food:'亲和、食欲与活力',finance:'信任、稳健与安全',
      retail:'活力、便利与商业效率',media:'创意、娱乐与传播力',travel:'速度、远行与服务品质',
      apparel:'风格、动感与生活方式',other:'品牌识别与差异化'
    };
    const hex=colors[0]||'#1F2937';
    const r=parseInt(hex.slice(1,3),16),g=parseInt(hex.slice(3,5),16),b=parseInt(hex.slice(5,7),16);
    const d=Math.max(r,g,b)-Math.min(r,g,b);
    const kind=d<24?(Math.max(r,g,b)>170?'浅中性色':'深中性色'):(r>=g&&r>=b?'暖色系':(b>=g?'冷蓝系':'绿系'));
    return`${name} 品牌主色为${kind}（${hex}），传达${tone[industry]||tone.other}的品牌气质。`;
  }
  function renderBrandRight(){
    const right=byId<HTMLElement>('baodianRight');
    const items=BRAND_COLORS.filter(b=>b.industry===baodianBrandGroup);
    let html='<div class="bdc-grid">';
    for(const b of items){
      const note=BRAND_NOTES[b.name]||composedBrandNote(b.name,b.colors,b.industry);
      // 品牌 logo：simple-icons CDN（CC0 图标库）按 slug 取图；加载失败由 bindBrandLogos 回退首字母徽标（离线可用）。
      // <lang en>Brand logo via simple-icons CDN (CC0); bindBrandLogos swaps in a monogram when loading fails.</lang>
      // 本地内置 logo（public/logos）；缺图品牌只显示字母徽标（无网络请求）。
      // <lang en>Bundled logo for available slugs; monogram only otherwise (no network requests).</lang>
      const mono=`<span class="brand-mono" style="background:${escapeHtml(b.colors[0]||'#1F2937')}">${escapeHtml((b.name[0]||'?').toUpperCase())}</span>`;
      const logo=b.hasLogo
        ?`<span class="brand-thumb">${mono}<img class="brand-logo" src="./logos/${escapeHtml(b.slug)}.svg" alt="" data-logo="1"></span>`
        :`<span class="brand-thumb">${mono}</span>`;
      html+=`<div class="bdc-card" role="button" tabindex="0" data-bdc-colors="${b.colors.slice(0,6).join(',')}" data-bdc-name="${escapeHtml(b.name)}" data-bdc-kind="brand" data-bdc-note="${escapeHtml(note)}">
        <div class="bdc-strip">${b.colors.slice(0,6).map(c=>`<span style="background:${c}"></span>`).join('')}</div>
        <div class="bdc-name">${logo}<span class="bdc-title">${escapeHtml(b.name)}</span></div>
        <div class="bdc-hex">${b.colors.slice(0,6).join(' ')}</div>
        <div class="bdc-note">${escapeHtml(note)}</div>
      </div>`;
    }
    html+='</div>';
    right.innerHTML=html||`<div class="small">${t('p12.baodian.empty')}</div>`;
    bindPaletteApply(right);
    bindBrandLogos(right);
  }
  // 自然源（W-tb-P19）：左=场景大类（天空/海洋/大地/植物/气象/矿物），右=色组卡（色条+名+说明）。
  // <lang en>Nature source: category menu + scene palette cards.</lang>
  function renderNatureMenu(){
    const menu=byId<HTMLElement>('baodianMenu');
    const groups:('sky'|'ocean'|'land'|'plant'|'weather'|'mineral')[]=['sky','ocean','land','plant','weather','mineral'];
    menu.innerHTML=groups.map(g=>`<button type="button" class="baodian-emo${baodianNatureGroup===g?' active':''}" data-nature-group="${g}">${escapeHtml(t('p19.nature.'+g))}</button>`).join('');
    all<HTMLButtonElement>('[data-nature-group]',menu).forEach(btn=>btn.addEventListener('click',()=>{
      baodianNatureGroup=btn.dataset.natureGroup||'sky';renderNatureMenu();
    }));
    renderNatureRight();
  }
  function renderNatureRight(){
    const right=byId<HTMLElement>('baodianRight');
    const items=NATURE_COLORS.filter(n=>n.category===baodianNatureGroup);
    renderPaletteGrid(right,items,'nature',n=>`<span class="bdc-title">${escapeHtml(n.name)}</span><span class="bdc-sub">${escapeHtml(n.nameEn)}</span>`);
  }
  // 社会场景源（W-tb-P19）：左=场景大类（应急/医疗/邮政/交通/安全/行业/文化），右=色组卡。
  // <lang en>Social source: convention category menu + palette cards.</lang>
  function renderSocialMenu(){
    const menu=byId<HTMLElement>('baodianMenu');
    const groups:('emergency'|'medical'|'postal'|'transport'|'safety'|'industry'|'cultural')[]=['emergency','medical','postal','transport','safety','industry','cultural'];
    menu.innerHTML=groups.map(g=>`<button type="button" class="baodian-emo${baodianSocialGroup===g?' active':''}" data-social-group="${g}">${escapeHtml(t('p19.social.'+g))}</button>`).join('');
    all<HTMLButtonElement>('[data-social-group]',menu).forEach(btn=>btn.addEventListener('click',()=>{
      baodianSocialGroup=btn.dataset.socialGroup||'emergency';renderSocialMenu();
    }));
    renderSocialRight();
  }
  function renderSocialRight(){
    const right=byId<HTMLElement>('baodianRight');
    const items=SOCIAL_COLORS.filter(n=>n.category===baodianSocialGroup);
    renderPaletteGrid(right,items,'social',n=>`<span class="bdc-title">${escapeHtml(n.name)}</span><span class="bdc-sub">${escapeHtml(n.nameEn)}</span>`);
  }
  // 通用色组网格（自然/社会共用）：色条+标题+HEX+说明；点击走多色组套用。
  // <lang en>Shared palette grid renderer for nature/social sources.</lang>
  function renderPaletteGrid(right:HTMLElement,items:{id:string;name:string;nameEn:string;colors:string[];note:string}[],kind:'nature'|'social',titleHtml:(n:{name:string;nameEn:string})=>string){
    let html='<div class="bdc-grid">';
    for(const n of items){
      html+=`<div class="bdc-card" role="button" tabindex="0" data-bdc-colors="${n.colors.join(',')}" data-bdc-name="${escapeHtml(n.name)}" data-bdc-kind="${kind}" data-bdc-note="${escapeHtml(n.note)}">
        <div class="bdc-strip">${n.colors.map(c=>`<span style="background:${c}"></span>`).join('')}</div>
        <div class="bdc-name">${titleHtml(n)}</div>
        <div class="bdc-hex">${n.colors.join(' ')}</div>
        <div class="bdc-note">${escapeHtml(n.note)}</div>
      </div>`;
    }
    html+='</div>';
    right.innerHTML=html||`<div class="small">${t('p12.baodian.empty')}</div>`;
    bindPaletteApply(right);
  }
  // 远程图标渐进增强：本地缩略（旗帜色条/品牌字母）默认可见且离线可用；
  //   真旗/品牌 logo 加载成功后加 .loaded 覆盖缩略图，失败则静默保留缩略。
  // <lang en>Progressive enhancement: local thumbnail is the default (offline-safe); a successfully
  //   loaded remote flag/logo overlays it via .loaded, failures silently keep the thumbnail.</lang>
  function bindRemoteThumbs(root:HTMLElement,thumbSel:string,imgSel:string){
    all<HTMLElement>(thumbSel,root).forEach(thumb=>{
      // img：该缩略内图片（加载成功即覆盖）。
      const img=thumb.querySelector<HTMLImageElement>(imgSel);
      if(!img)return;
      const done=()=>thumb.classList.add('loaded');
      if(img.complete&&img.naturalWidth>0)done();
      else img.addEventListener('load',done,{once:true});
    });
  }
  function bindFlagImages(root:HTMLElement){bindRemoteThumbs(root,'.flag-thumb','.flag-img');}
  function bindBrandLogos(root:HTMLElement){bindRemoteThumbs(root,'.brand-thumb','.brand-logo');}
  // 多色组套用（国旗/企业共用）：依次填主/副/第三（色数 1/2/3+），辅助色按规则补足 2 槽。
  // <lang en>Shared multi-color apply: fill primary/secondary/third by order, auxiliaries rule-generated.</lang>
  function bindPaletteApply(root:HTMLElement){
    all<HTMLButtonElement>('.bdc-card',root).forEach(btn=>btn.addEventListener('click',()=>{
      const colors=(btn.dataset.bdcColors||'').split(',').filter(Boolean);
      if(!colors.length)return;
      const name=btn.dataset.bdcName||'';
      const kind=btn.dataset.bdcKind||'flag';
      seriesSnapshot={primary:draft.primary,primaryName:draft.primaryName,secondary:draft.secondary,secondaryName:draft.secondaryName,thirdColor:draft.thirdColor,seriesMode:draft.seriesMode,seriesRelation:draft.seriesRelation};
      draft.primary=colors[0]!;
      draft.seriesMode=colors.length===1?'single':colors.length===2?'dual':'triad';
      draft.seriesRelation='manual';
      draft.secondary=colors[1]??colors[0]!;
      draft.thirdColor=colors.length>=3?makeRoleColor(colors[2]!,'第三色'):undefined;
      draft.primaryName=name;draft.secondaryName='副色';
      draft.auxiliary=generateAuxiliaryCandidates(colors[0]!).slice(0,TONE_AUX_SLOTS).map(c=>({name:c.name,value:c.hex,scale:tonalScale(c.hex),on:bestOnColor(c.hex).hex}));
      byId<HTMLElement>('baodianModal').hidden=true;
      syncInputs();applyCurrentTheme(false);renderHarmony();renderGradients();renderClassicPreview();updatePreviewMeta();
      // 回执按来源选择词条（国旗/企业/自然/社会）。
      // <lang en>Receipt keyed by source kind.</lang>
      setText('generateStatus',t(kind==='flag'?'p18.applied.flag':kind==='brand'?'p18.applied.brand':kind==='nature'?'p19.applied.nature':'p19.applied.social',{name,n:String(colors.length)}));
    })); 
  }
  // 传统色源：左=文化两级（日/中），右=色系桶分组色卡（名+HEX），点击=单色即主色（P17 定案）。
  // <lang en>Traditional source: culture menu on the left; hue-bucket swatch grid on the right.</lang>
  function renderTraditionalMenu(){
    const menu=byId<HTMLElement>('baodianMenu');
    const cultures:[('en'|'cn'|'ja'|'kr'),string][]=[['en','p17.culture.en'],['cn','p17.culture.cn'],['ja','p17.culture.ja'],['kr','p17.culture.kr']];
    menu.innerHTML=cultures.map(([c,key])=>`<button type="button" class="baodian-emo${(baodianTcCulture===c)?' active':''}" data-tc-culture="${c}">${escapeHtml(t(key))}</button>`).join('');
    all<HTMLButtonElement>('[data-tc-culture]',menu).forEach(btn=>btn.addEventListener('click',()=>{
      baodianTcCulture=(btn.dataset.tcCulture as ('en'|'cn'|'ja'|'kr'));renderTraditionalMenu();
    }));
    renderTraditionalRight();
  }
  function renderTraditionalRight(){
    const right=byId<HTMLElement>('baodianRight');
    const entries=TRADITIONAL_COLORS.filter(e=>e.culture===baodianTcCulture);
    // 色系桶分组（bucket 为解析期粗分）。
    const buckets=new Map<string,typeof entries>();
    for(const e of entries){(buckets.get(e.bucket)||buckets.set(e.bucket,[]).get(e.bucket)!).push(e);}
    let html='';
    for(const[bucket,items]of buckets){
      html+=`<div class="bd-form"><div class="bd-form-title">${escapeHtml(t('p17.bucket.'+bucket))} · ${items.length}</div><div class="tc-grid">`;
      for(const e of items){
        html+=`<button type="button" class="tc-card" data-tc-hex="${e.hex}" data-tc-name="${escapeHtml(e.name)}" data-tc-note="${escapeHtml(e.note||'')}" data-tc-caution="${escapeHtml(e.caution||'')}" title="${escapeHtml(e.nameEn)} ${e.hex}"><span class="tc-chip" style="background:${e.hex}"></span><span class="tc-name">${escapeHtml(e.name)}</span><span class="tc-hex">${e.hex}</span></button>`;
      }
      html+='</div></div>';
    }
    right.innerHTML=html||`<div class="small">${t('p12.baodian.empty')}</div>`;
    // 单色即主色（P17 定案）：主色=条目；副色=互补规则推导；模式/关系显式 dual/complement；辅助=规则生成 2 槽。
    // <lang en>Entry apply: primary=swatch hex; secondary=complement-derived; aux generated; explicit dual/complement.</lang>
    all<HTMLButtonElement>('.tc-card',right).forEach(btn=>btn.addEventListener('click',()=>{
      const hex=normalizeHex(btn.dataset.tcHex||'');
      if(!hex)return;
      seriesSnapshot={primary:draft.primary,primaryName:draft.primaryName,secondary:draft.secondary,secondaryName:draft.secondaryName,thirdColor:draft.thirdColor,seriesMode:draft.seriesMode,seriesRelation:draft.seriesRelation};
      const secondary=deriveSecondaryByRelation(hex,'complement')||hex;
      const aux=generateAuxiliaryCandidates(hex).slice(0,TONE_AUX_SLOTS).map(c=>({name:c.name,value:c.hex,scale:tonalScale(c.hex),on:bestOnColor(c.hex).hex}));
      draft.primary=hex;draft.seriesMode='dual';draft.seriesRelation='complement';draft.secondary=secondary;draft.thirdColor=undefined;draft.auxiliary=aux;
      draft.primaryName=btn.dataset.tcName||'主色';draft.secondaryName='副色';
      byId<HTMLElement>('baodianModal').hidden=true;
      syncInputs();applyCurrentTheme(false);renderHarmony();renderGradients();renderClassicPreview();updatePreviewMeta();
      setText('generateStatus',t('p17.traditional.apply',{name:btn.dataset.tcName||''}));
    }));
  }
  function renderBaodianMenu(){
    const menu=byId<HTMLElement>('baodianMenu');
    // 一键套用（完善批④）：⚡ = 该情感"补色"形态首个组合；该情感无补色组合时回退任一形态首组。
    // <lang zh-CN>24 情感逐个可点；套用走快照+applyBaodianCombo 既有链路（含弹层关闭，与点组合卡一致）。</lang>
    // <lang en>Per-mood lightning button applies its first complement combo (fallback: any form),
    //   keeping the modal open and reusing the snapshot-backed apply path.</lang>
    const quickCombo=(emo:string):number[]|null=>{
      // 首选该情感在 complement 形态的第一组合。
      const comp=(FORM_PACKS['complement']||[]).find(c=>c.e===emo);
      if(comp)return comp.n;
      // 回退：按形态表顺序取该情感首个可用组合。
      for(const list of Object.values(FORM_PACKS)){const c=list.find(x=>x.e===emo);if(c)return c.n;}
      return null;
    };
    menu.innerHTML=baodianEmotions.map(e=>{
      // q：该情感的首个可套用组合（null 则不渲染快捷钮）。
      const q=quickCombo(e);
      return `<button type="button" class="baodian-emo${e===baodianEmotion?' active':''}" data-emo="${escapeHtml(e)}">${escapeHtml(t(e))}${q?`<span class="bd-quick" role="button" tabindex="0" data-bd-quick="${escapeHtml(e)}" title="${escapeHtml(t('p12.baodian.quick'))}">⚡</span>`:''}</button>`;
    }).join('');
    all<HTMLButtonElement>('[data-emo]',menu).forEach(btn=>btn.addEventListener('click',()=>{baodianEmotion=btn.dataset.emo||baodianEmotion;renderBaodianMenu();renderBaodianRight();}));
    // 快捷钮事件：阻断冒泡避免同时触发情感切换的重复渲染；键盘可达（Enter/Space）。
    // <lang en>stopPropagation keeps quick-apply from double-firing the mood-select handler.</lang>
    all<HTMLElement>('[data-bd-quick]',menu).forEach(sp=>{
      // go：选中该情感并套用其首个组合。
      const go=(ev:Event)=>{
        ev.stopPropagation();
        const emo=sp.getAttribute('data-bd-quick')||baodianEmotion;
        const combo=quickCombo(emo);
        if(!combo)return;
        baodianEmotion=emo;renderBaodianMenu();renderBaodianRight();
        applyBaodianCombo(combo);
      };
      sp.addEventListener('click',go);
      sp.addEventListener('keydown',ev=>{if(ev.key==='Enter'||ev.key===' '){ev.preventDefault();go(ev);}});
    });
  }
  function renderBaodianRight(){
    const right=byId<HTMLElement>('baodianRight');
    // 形态中文标题映射（BAODIAN_FORM_NAMES 反查）。
    const titleOf=(id:string)=>Object.entries(BAODIAN_FORM_NAMES).find(([,v])=>v===id)?.[0]||id;
    let html='';
    for(const[formId,combos]of Object.entries(FORM_PACKS)){
      const mine=combos.filter(c=>c.e===baodianEmotion);
      if(!mine.length)continue;
      html+=`<div class="bd-form"><div class="bd-form-title">${escapeHtml(t(titleOf(formId)))} · ${mine.length}</div><div class="bd-combos">`;
      for(let ci=0;ci<mine.length;ci++){
        const c=mine[ci]!;
        // W-tb-P15：卡外包 wrapper，追加"整套"小按钮——按 当前情感+形态+组合序号 构建语气预设整体应用。
        // <lang en>Card wrapper adds a "full set" badge building the tone preset for this mood/form/combo.</lang>
        html+=`<div class="bd-card"><button type="button" class="bd-combo" data-form="${escapeHtml(formId)}" data-nums="${c.n.join(',')}" aria-label="${escapeHtml(c.n.join('+'))}">`+c.n.map(num=>`<span class="bd-bar" style="background:${BAODIAN_PALETTE[num]||'#ccc'}" data-hex="${BAODIAN_PALETTE[num]||'#cccccc'}">${num}</span>`).join('')+`</button><button type="button" class="bd-full" data-full-form="${escapeHtml(formId)}" data-full-idx="${ci}" title="${escapeHtml(t('p15.tone.applyFull'))}" aria-label="${escapeHtml(t('p15.tone.applyFull'))}">${escapeHtml(t('p15.tone.applyFull'))}</button></div>`;
      }
      html+='</div></div>';
    }
    right.innerHTML=html||`<div class="small">${t('p12.baodian.empty')}</div>`;
    all<HTMLButtonElement>('.bd-combo',right).forEach(btn=>btn.addEventListener('click',()=>{
      const nums=(btn.dataset.nums||'').split(',').filter(Boolean).map(Number);
      if(nums.length)applyBaodianCombo(nums);
    }));
    // 套用整套：构建语气预设 → applyPresetData（模式/规则/成员/辅助色整体落位）→ 关弹层 + 状态回执。
    // <lang en>Full-set action: build the tone preset, apply wholly, close the modal and report.</lang>
    all<HTMLButtonElement>('.bd-full',right).forEach(btn=>btn.addEventListener('click',()=>{
      const formId=btn.dataset.fullForm||'';
      const idx=Number(btn.dataset.fullIdx||'0');
      const p=buildTonePreset(baodianEmotion,titleOf(formId),idx);
      if(!p)return;
      applyPresetData(p);
      byId<HTMLElement>('baodianModal').hidden=true;
      setText('generateStatus',t('p15.tone.applied',{name:t(p.name)}));
    }));
  }
  // 应用宝典组合：记录快照 → 成员=组合色号（名字带 #编号）→ 模式派生成员数 → 关闭弹层。
  // <lang zh-CN>1 色组合=single；2=dual；3=triad（主副/第三顺序=组合顺序）。</lang>
  // <lang en>Combo size maps to mode; member order follows the combo order.</lang>
  function applyBaodianCombo(nums:number[]){
    seriesSnapshot={primary:draft.primary,primaryName:draft.primaryName,secondary:draft.secondary,secondaryName:draft.secondaryName,thirdColor:draft.thirdColor,seriesMode:draft.seriesMode,seriesRelation:draft.seriesRelation};
    // 锚定分支（W-tb-P16）：成员[0]=用户当前主色（恒等），其余按组合色相关系重映射；命名标记（锚）。
    // <lang en>Anchor branch: member[0] is the user's primary verbatim; the rest re-map by combo hue relations.</lang>
    let list:{name:string;value:string}[];
    if(baodianAnchor){
      const hexes=anchorComboMembers(nums.map(num=>BAODIAN_PALETTE[num]||'#cccccc'),draft.primary);
      list=hexes.map((hex,i)=>({name:`${t('p12.baodian.tag')} #${nums[i]}${t('p16.anchor.mark')}`,value:hex}));
    }else{
      list=nums.map(num=>({name:`${t('p12.baodian.tag')} #${num}`,value:BAODIAN_PALETTE[num]||'#cccccc'}));
    }
    byId<HTMLElement>('baodianModal').hidden=true;
    commitSeriesMembers(list);
    setText('generateStatus',t('p12.baodian.applied',{combo:nums.join('+')}));
  }
  // 还原快照：恢复成员与模式。
  // <lang zh-CN>还原后清快照，避免重复回退。</lang>
  // <lang en>Snapshot cleared after restore to avoid repeat rollback.</lang>
  function restoreSeriesSnapshot(){
    if(!seriesSnapshot){platform.alert(t('p11.series.noSnapshot'));return;}
    // 局部捕获：快照非空已由上方判空保证，断言以通过严格空检查。
    // <lang zh-CN>快照字段在写入时均为已定义值。</lang>
    // <lang en>Snapshot fields are all defined when written.</lang>
    const snap=seriesSnapshot;
    draft.primary=snap.primary;
    draft.primaryName=snap.primaryName;
    draft.secondary=snap.secondary;
    draft.secondaryName=snap.secondaryName;
    draft.thirdColor=snap.thirdColor;
    draft.seriesMode=snap.seriesMode??'dual';
    draft.seriesRelation=snap.seriesRelation??'complement';
    seriesSnapshot=null;
    syncInputs();applyCurrentTheme(false);renderHarmony();renderGradients();renderClassicPreview();
  }
  // 持久化辅助槽位（独立维度，随草稿存储由 presetFromDraft/serialize 承载）。
  // <lang zh-CN>auxiliary 存于草稿；库文件/分享导出已传导。</lang>
  // <lang en>Auxiliary lives on the draft; library/share exports already carry it.</lang>
  function saveAuxiliary(){applyCurrentTheme(false);}
  // 添加辅助槽位（手动）：拾色器 + 名称。
  // <lang zh-CN>经 makeRoleColor 补全色阶与前景色。</lang>
  // <lang en>Builds a full RoleColor from the picker hex.</lang>
  function addAuxiliary(){
    const hex=normalizeHex(byId<HTMLInputElement>('auxColorPicker').value);
    if(!validHex(hex))return;
    const name=byId<HTMLInputElement>('auxNameInput').value.trim()||`辅助 ${draft.auxiliary!.length+1}`;
    draft.auxiliary!.push(makeRoleColor(hex,name));
    byId<HTMLInputElement>('auxNameInput').value='';
    saveAuxiliary();renderHarmony();renderGradients();
  }
  // 按规则生成辅助候选：加入三个强调候选（定案 3）。
  // <lang zh-CN>generateAuxiliaryCandidates 从主色推导 ±60°/150°/-90° 候选。</lang>
  // <lang en>Derives three accent candidates from the primary.</lang>
  function generateAuxiliary(){
    const cands=generateAuxiliaryCandidates(draft.primary);
    cands.forEach(c=>draft.auxiliary!.push(makeRoleColor(c.hex,c.name)));
    saveAuxiliary();renderHarmony();renderGradients();
  }
  // 清空辅助槽位。
  // <lang zh-CN>显式清空（[]），不影响主色系成员。</lang>
  // <lang en>Explicit clear; series members untouched.</lang>
  function clearAuxiliary(){draft.auxiliary=[];saveAuxiliary();renderHarmony();renderGradients();}
  // 关系推导链（v2）：补副/补第三与宝典应用均由 completeSeriesMember/applyBaodianCombo 承载。
  // <lang zh-CN>取色应用后同样按模式推导（single 变体自动、triad 第三色推导、辅助不动）。</lang>
  // <lang en>Explore-apply follows the same semantics (single variant auto; triad third derived; auxiliary untouched).</lang>

  function shortFontName(stack:string):string{
    const first=stack.split(',')[0]?.trim()??stack;
    return first.replace(/^['"]+|['"]+$/g,'');
  }

  // ===== `W-tb-P10` 分享链接 / 主题库导入导出 / 远程预设源（市场骨架） =====

  // 应用市场子 Tab：本地库（摘要+列表）与远程源（源栏+远程列表）互斥显示。
  // <lang zh-CN>本地视图沿用既有 summary-strip/presetList；远程视图独立容器。</lang>
  // <lang en>The local view reuses existing summary/list; the remote view uses its own container.</lang>
  function applyMarketTab(tab:'local'|'remote'){
    marketTab=tab;
    all<HTMLButtonElement>('#marketTabs [data-market-tab]').forEach(btn=>btn.classList.toggle('active',btn.dataset.marketTab===tab));
    byId<HTMLElement>('marketLocalView').hidden=tab!=='local';
    byId<HTMLElement>('presetList').hidden=tab!=='local';
    byId<HTMLElement>('marketRemoteView').hidden=tab!=='remote';
  }

  // 渲染远程源下拉：默认源置首位且名称标注"官方"。
  // <lang zh-CN>value 存完整 URL；label 截短展示。</lang>
  // <lang en>value holds the full URL; label is a truncated display.</lang>
  function renderRemoteSources(){
    const sel=byId<HTMLSelectElement>('remoteSourceSelect');
    sel.innerHTML=remoteSources.map(u=>`<option value="${escapeHtml(u)}">${escapeHtml(u===DEFAULT_REMOTE_SOURCE?t('p10.tab.local')+' · '+t('p12.source.official'):u.length>52?u.slice(0,52)+'…':u)}</option>`).join('');
    sel.value=remoteSources[0]??'';
  }
  // 恢复持久化源列表（默认源恒在首位，去重）。
  // <lang zh-CN>存储损坏/为空时仅保留默认源。</lang>
  // <lang en>Falls back to the default source alone when storage is broken/empty.</lang>
  function loadRemoteSources(){
    try{
      const raw=platform.storage.getItem(REMOTE_SOURCES_STORAGE);
      const saved=raw?(JSON.parse(raw) as unknown):[];
      const list=Array.isArray(saved)?saved.filter((u):u is string=>typeof u==='string'&&/^https?:\/\//.test(u)):[];
      remoteSources=[DEFAULT_REMOTE_SOURCE,...list.filter(u=>u!==DEFAULT_REMOTE_SOURCE)];
    }catch{
      remoteSources=[DEFAULT_REMOTE_SOURCE];
    }
    renderRemoteSources();
  }
  function saveRemoteSources(){
    platform.storage.setItem(REMOTE_SOURCES_STORAGE,JSON.stringify(remoteSources.filter(u=>u!==DEFAULT_REMOTE_SOURCE)));
  }

  // 加载当前选中远程源：fetchText → parseThemePack → 内存预设列表 + 状态行。
  // <lang zh-CN>失败不阻塞本地库；成功后过滤（复用 presetSearchInput/presetFilterSelect）并渲染卡片。</lang>
  // <lang en>Failures never block the local library; on success the same search/filter controls apply to remote cards.</lang>
  async function loadRemoteSource(){
    if(remoteLoading)return;
    const url=byId<HTMLSelectElement>('remoteSourceSelect').value;
    if(!url){setText('remoteStatus',t('p10.remote.emptySelect'));return;}
    remoteLoading=true;
    setText('remoteStatus',t('p10.remote.status.loading'));
    try{
      const raw=await platform.fetchText!.fetchText(url);
      const pack=parseThemePack(raw);
      if(!pack){setText('remoteStatus',t('p10.remote.status.fail',{reason:t('p10.import.fail')}));return;}
      remotePresets=pack.presets;
      remoteDropped=pack.dropped;
      const droppedText=remoteDropped>0?t('p10.remote.status.droppedSuffix',{n:remoteDropped}):'';
      setText('remoteStatus',t('p10.remote.status.ok',{source:url.length>60?url.slice(0,60)+'…':url,count:String(remotePresets.length),dropped:droppedText}));
    }catch(e){
      remotePresets=[];remoteDropped=0;
      setText('remoteStatus',t('p10.remote.status.fail',{reason:e instanceof Error?e.message:String(e)}));
    }finally{
      remoteLoading=false;
      renderRemoteList();
    }
  }

  // 渲染远程预设卡片（复用 preset-card 视觉）+ 搜索过滤 + 逐条导入按钮。
  // <lang zh-CN>过滤复用本地搜索控件；卡片按钮 data-remote-import 触发单条导入。</lang>
  // <lang en>Filtering reuses the local controls; card buttons carry data-remote-import for one-shot import.</lang>
  function renderRemoteList(){
    const list=filterPresets(remotePresets,inputValue('presetSearchInput'),inputValue('presetFilterSelect'));
    setText('remoteCountLabel',t('p10.remote.count',{count:String(list.length)}));
    const wrap=byId<HTMLElement>('remotePresetList');
    wrap.innerHTML=list.map(p=>{const bdTag=t('p12.baodian.tag');return `<div class="preset-card"><div class="preset-head"><div><div class="preset-name">${escapeHtml(t(p.name))}</div><div class="small">${escapeHtml(t(p.category))} · ${escapeHtml(t(p.industry||t('未分类')))}</div></div></div>${presetSwatches(p)}<div class="small" style="margin-top:8px">${escapeHtml(t(p.primaryName).replace('宝典',bdTag))} / ${escapeHtml(t(p.secondaryName).replace('宝典',bdTag))}</div><div class="small" style="margin-top:4px">${escapeHtml(p.note?t(p.note):'')}</div><div class="preset-actions"><button class="btn primary" data-remote-import="${escapeHtml(p.id)}" style="padding:8px 10px">${t('p10.remote.importOne')}</button></div></div>`;}).join('');
    all<HTMLButtonElement>('[data-remote-import]',wrap).forEach(btn=>btn.addEventListener('click',()=>{
      const target=remotePresets.find(x=>x.id===btn.dataset.remoteImport);
      if(!target)return;
      importPresets([target]);
    }));
  }
  // 导入预设到本地库：mergeImportedPresets（id 冲突重命名）→ 持久化 → 刷新列表。
  // <lang zh-CN>导入后回执文案含重命名与丢弃计数；远程列表不动（源内容只读）。</lang>
  // <lang en>Receipt includes rename/drop counts; the remote list is untouched (sources are read-only).</lang>
  function importPresets(incoming:Preset[]){
    const before=customPresets.length;
    const {merged,renamed}=mergeImportedPresets(customPresets,incoming);
    customPresets=merged;
    saveCustomPresets();
    renderPresetList();
    setText('presetCount',String(getAllPresets().length));
    platform.alert(t('p10.import.done',{count:String(customPresets.length-before),renamed:String(renamed),dropped:'0'}));
  }

  // 导出主题库文件：serializeThemeLibrary → Blob 下载（复用 P9 下载模式）。
  // <lang zh-CN>文件名带日期；仅导出自定义预设（内置预设随产品分发无需搬运）。</lang>
  // <lang en>Date-stamped filename; exports custom presets only (built-ins ship with the app).</lang>
  function exportLibrary(){
    const json=serializeThemeLibrary(customPresets);
    const stamp=new Date().toISOString().slice(0,10).replace(/-/g,'');
    const url=URL.createObjectURL(new Blob([json],{type:'application/json'}));
    const a=document.createElement('a');
    a.href=url;a.download=`hia-themes-${stamp}.json`;
    document.body.appendChild(a);a.click();a.remove();
    setTimeout(()=>URL.revokeObjectURL(url),1000);
    setText('remoteStatus',t('p10.export.done',{count:String(customPresets.length)}));
  }
  // 触发本地文件选择（input[type=file] DOM 方案三端通用）。
  // <lang zh-CN>点击隐藏的 file input；change 在 bind 里注册。</lang>
  // <lang en>Clicks the hidden file input; change is registered in bind.</lang>
  function triggerImport(){byId<HTMLInputElement>('importLibraryFile').click();}

  // 复制分享链接：当前草稿 → buildSharePayload → encodeShareHash → 绝对 URL。
  // <lang zh-CN>链接=当前页面地址（去 hash）+ #hia=…；electron/tauri 的 file:/tauri:// 同样可还原（本机打开）。</lang>
  // <lang en>Link = current page (hash stripped) + #hia=…; file:/tauri:// restores fine when opened locally.</lang>
  async function shareLink(){
    const hash=encodeShareHash(buildSharePayload(draft));
    const base=location.origin+location.pathname;
    await copy(`${base}#${hash}`);
    setText('generateStatus',t('p10.share.copied'));
  }
  // 启动时检测分享 hash：还原为预览态（填充草稿与界面，不自动入库），并清理地址栏。
  // <lang zh-CN>清 hash 防刷新重复还原；还原失败静默清理（不打扰正常启动）。</lang>
  // <lang en>Strips the hash to avoid re-restore on refresh; invalid hashes are cleaned silently.</lang>
  function restoreFromHash(){
    if(!location.hash.startsWith('#hia='))return;
    const restored=decodeShareHash(location.hash);
    history.replaceState(null,'',location.pathname+location.search);
    if(!restored){
      setText('generateStatus',t('p10.share.invalid'));
      return;
    }
    draft.name=restored.name;
    draft.primary=restored.primary;
    draft.secondary=restored.secondary;
    draft.primaryName=restored.primaryName;
    draft.secondaryName=restored.secondaryName;
    draft.category=restored.category||'custom';
    draft.industry=restored.industry||'';
    draft.note=restored.note||'';
    draft.gradients=restored.gradients??draft.gradients;
    selectedPresetId='';
    syncInputs();applyCurrentTheme(false);renderGradients();
    setText('generateStatus',t('p10.share.restored',{name:restored.name}));
  }


  // 预设卡色板（ADR-007 v2 机制扩充）：主色系成员（1-3）+ 辅助色条。
  // <lang zh-CN>旧预设（无 third/auxiliary）保持两块；新预设第三色/辅助色逐块展示。</lang>
  // <lang en>Legacy presets keep two swatches; new ones show third and auxiliary swatches.</lang>
  function presetSwatches(p:Preset):string{
    const blocks=[p.primary,p.secondary];
    if(p.thirdColor)blocks.push(p.thirdColor.value);
    const aux=(p.auxiliary??[]).map(a=>a.value);
    return `<div class="preset-swatch">${blocks.map(c=>`<i style="background:${c}"></i>`).join('')}${aux.length?`<i class="preset-aux-group" style="background:linear-gradient(90deg,${aux.join(',')})" title="${t('p11.card.auxGroup')}"></i>`:''}</div>`;
  }
  // 渲染预设列表：按搜索词/分类过滤，生成卡片并绑定应用/载入/删除。
  // <lang zh-CN>内置预设不显示删除；当前选中项加“当前”徽标；计数显示总数。</lang>
  // <lang en>Built-ins hide delete; the selected item gets a "当前" badge; count shows the total.</lang>
  function renderPresetList(){
    // 先按关键字与分类过滤，再更新总数文本。
    // <lang zh-CN>filterPresets 对空 query/全部分类返回全量。</lang>
    // <lang en>filterPresets returns all for empty query / 'all' category.</lang>
    const list=filterPresets(getAllPresets(),inputValue('presetSearchInput'),inputValue('presetFilterSelect'));
    setText('presetCount',String(getAllPresets().length));
    const wrap=byId<HTMLElement>('presetList');
    // 逐预设生成卡片：头部（名/分类/行业 + 当前徽标）、双色板、名称、说明、操作按钮。
    // <lang zh-CN>动态文本经 escapeHtml；删除按钮仅自定义预设显示。</lang>
    // <lang en>Dynamic text escaped; delete button only for custom presets.</lang>
    wrap.innerHTML=list.map(p=>{const bi=isBuiltinPresetId(p.id);const bdTag=t('p12.baodian.tag');const nm=t(p.name).replace('宝典',t('p12.baodian.tag'));const ct=t(p.category);const ind=p.industry?t(p.industry):p.industry;return `<div class="preset-card"><div class="preset-head"><div><div class="preset-name">${escapeHtml(nm)}</div><div class="small">${escapeHtml(ct)} · ${escapeHtml(ind||t('未分类'))}</div></div>${selectedPresetId===p.id?`<span class="badge">${t('当前')}</span>`:''}</div>${presetSwatches(p)}<div class="small" style="margin-top:8px">${escapeHtml(t(p.primaryName).replace('宝典',bdTag))} / ${escapeHtml(t(p.secondaryName).replace('宝典',bdTag))}</div><div class="small" style="margin-top:4px">${escapeHtml(p.note?t(p.note):'')}</div><div class="preset-actions"><button class="btn primary" data-apply-preset="${escapeHtml(p.id)}" style="padding:8px 10px">${t('应用')}</button><button class="btn outline" data-load-preset="${escapeHtml(p.id)}" style="padding:8px 10px">${t('载入操作台')}</button>${!bi?`<button class="btn ghost" data-delete-preset="${escapeHtml(p.id)}" style="padding:8px 10px;color:var(--danger)">${t('删除')}</button>`:''}</div></div>`;}).join('');
    // 应用按钮：直接套用预设到当前主题。
    // <lang zh-CN>改变界面与草稿，但不保存为新预设。</lang>
    // <lang en>Changes UI and draft but does not save a new preset.</lang>
    all<HTMLButtonElement>('[data-apply-preset]',wrap).forEach(btn=>btn.addEventListener('click',()=>applyPreset(btn.dataset.applyPreset)));
    // 载入按钮：与“应用”在此实现中行为一致（均调用 applyPreset）。
    // <lang zh-CN>保留两个入口以贴合原 HTML 文案。</lang>
    // <lang en>Keeps both entries to match the original HTML labels.</lang>
    all<HTMLButtonElement>('[data-load-preset]',wrap).forEach(btn=>btn.addEventListener('click',()=>applyPreset(btn.dataset.loadPreset)));
    // 删除按钮：仅自定义预设，移除后刷新列表。
    // <lang zh-CN>删除当前选中则回退默认预设。</lang>
    // <lang en>Deleting the selected one falls back to the default preset.</lang>
    all<HTMLButtonElement>('[data-delete-preset]',wrap).forEach(btn=>btn.addEventListener('click',()=>deletePreset(btn.dataset.deletePreset)));
  }

  // 由当前草稿构建预设对象（id 缺省用时间戳生成自定义 id）。
  // <lang zh-CN>先 readInputs 同步最新输入，再导出预设。</lang>
  // <lang en>Syncs latest inputs via readInputs, then exports a preset.</lang>
  function makePreset(id=`custom-${platform.now()}`){readInputs(true);return presetFromDraft(draft,id);}
  // 保存为新自定义预设：upsert 到列表、持久化、标记选中并刷新。
  // <lang zh-CN>新预设置顶，当前草稿切换为该预设态。</lang>
  // <lang en>New preset goes first; current draft becomes that preset's state.</lang>
  function savePreset(){const p=makePreset();customPresets=upsertPreset(customPresets,p);saveCustomPresets();selectedPresetId=p.id;draft=draftFromPreset(p);renderPresetList();updatePreviewMeta();}
  // 更新当前自定义预设：拦截内置预设与找不到的情况。
  // <lang zh-CN>内置预设不可覆盖，需另存为自定义。</lang>
  // <lang en>Built-ins cannot be overwritten; save as custom instead.</lang>
  function updatePreset(){
    if(isBuiltinPresetId(selectedPresetId)){platform.alert('当前选中的是内置预设，不能直接覆盖。请另存为自定义主题。');return;}
    if(!customPresets.some(x=>x.id===selectedPresetId)){platform.alert('未找到当前自定义预设。');return;}
    const p=makePreset(selectedPresetId);
    customPresets=upsertPreset(customPresets,p);
    saveCustomPresets();
    draft=draftFromPreset(p);
    renderPresetList();updatePreviewMeta();
  }
  // 删除自定义预设：从列表移除并持久化；若删的是当前项则回退默认。
  // <lang zh-CN>纯不可变更新，不触碰内置预设。</lang>
  // <lang en>Immutable update; never touches built-ins.</lang>
  function deletePreset(id:string|undefined){
    if(!id)return;
    customPresets=removePreset(customPresets,id);
    saveCustomPresets();
    if(selectedPresetId===id)selectedPresetId='preset-default';
    renderPresetList();
  }
  // 渲染网址取色探索面板（指令十五节）：阶段状态、推荐主副色、置信度、reasons、8~12 候选、warnings、应用入口。
  // <lang zh-CN>无 explorer 能力时隐藏面板；无结果时仅显示状态；有结果时展开完整报告。</lang>
  // <lang en>Hidden without explorer; only status when empty; full report when a result exists.</lang>
  // 文档子站链接语言同步（W-tb-P14 维护者反馈）：href 携带 ?lang=，文档站按参数切换语言；
  //   <html> 内静态链接在 bind() 时与语言切换时各调一次。
  // <lang en>Keeps the docs link in step with the UI locale via a ?lang= param the docs site honors.</lang>
  function syncDocsLink(){
    const a=document.querySelector<HTMLAnchorElement>('a[data-i18n="top.docs"]');
    if(!a)return;
    a.href=`https://mandolin.github.io/HIA-Theme-Builder/docs/?lang=${getLocale()==='en'?'en':'zh'}`;
  }
  function renderExplore(){
    const wrap=byId<HTMLElement>('explorePanel');
    // 无探索能力（纯浏览器）则隐藏整块面板，保持界面整洁。
    // <lang zh-CN>explorer 由 platform 按宿主注入决定，未提供则不打扰用户。</lang>
    // <lang en>explorer is host-injected; absent means plain browser, so hide the panel.</lang>
    if(!platform.explorer){wrap.style.display='none';return;}
    wrap.style.display='block';
    const status=byId<HTMLElement>('exploreStatus');
    const stageText={idle:t('等待输入网址'),exploring:t('正在渲染与分析…'),done:t('已生成推荐主题'),degraded:t('已生成（静态降级，置信度受限）'),error:t('探索失败')} as const;
    status.textContent=stageText[exploreStage];
    status.dataset.stage=exploreStage;
    const body=byId<HTMLElement>('exploreBody');
    if(!exploreResult){body.innerHTML='';return;}
    const a=exploreResult;
    // 主副色色板：含 HEX、置信度百分比；副色 derived 明确标注。
    // <lang zh-CN>置信度用百分比呈现，低于 0.5 视觉提示“低于建议阈值”。</lang>
    // <lang en>Confidence shown as percent; below 0.5 flagged visually as under suggestion.</lang>
    const primary=a.primary,secondary=a.secondary;
    const pColor=primary?primary.hex:'—',sColor=secondary?secondary.hex:'—';
    const pConf=primary?Math.round(primary.confidence*100):0;
    const sConf=secondary?Math.round(secondary.confidence*100):0;
    const sDerived=secondary?.derived?'<span class="explore-derived" title="由主色协调生成，非网页原始颜色">协调生成</span>':'';
    const sTag=secondary?.origin==='harmony-fallback'?'<span class="explore-tag">derived</span>':'';
    // reasons：取主色前 5 条，保证 3~5 条可解释。
    // <lang zh-CN>不足 5 条则取全部，便于审阅证据来源。</lang>
    // <lang en>Fewer than 5 falls back to all so evidence sources stay reviewable.</lang>
    const reasons=primary?primary.reasons.slice(0,5):[];
    const reasonHtml=reasons.map(r=>`<li>${escapeHtml(r)}</li>`).join('');
    // 候选：8~12 个 alternatives，色块 + HEX；命中 logo 来源时标注。
    // <lang zh-CN>点击候选直接填入副色输入框，便于快速对比。</lang>
    // <lang en>Clicking a candidate fills the secondary input for quick comparison.</lang>
    const logoSet=new Set(a.logoHexes||[]);
    const altHtml=a.alternatives.slice(0,12).map(c=>`<button class="explore-swatch" data-alt="${escapeHtml(c.hex)}" title="${escapeHtml(c.hex)}${logoSet.has(c.hex)?'（logo）':''}" style="background:${c.hex}"><span>${escapeHtml(c.hex)}</span>${logoSet.has(c.hex)?'<i class="explore-logo-tag">logo</i>':''}</button>`).join('');
    // warnings：降级/证据不足提示。
    // <lang zh-CN>warnings 为空时显示“无特别提示”。</lang>
    // <lang en>Empty warnings show "无特别提示".</lang>
    const warnHtml=a.warnings.length?a.warnings.map(w=>`<li>${escapeHtml(w)}</li>`).join(''):'<li class="explore-muted">无特别提示</li>';
    // 高置信不自动覆盖：应用按钮文案随置信度变化，主色高置信时强调“确认后应用”。
    // <lang zh-CN>应用动作始终需用户主动点击，不静默覆盖当前主题。</lang>
    // <lang en>Apply is always an explicit user click; never silently overwrites the current theme.</lang>
    const high=a.confidence>=0.5;
    // dark 双模式主色：由 signals.darkMode 复采评出，独立展示避免与 light 混淆。
    // <lang zh-CN>仅在存在 dark 结果时显示深色模式卡片。</lang>
    // <lang en>Dark card shown only when a dark result exists.</lang>
    const dColor=a.darkPrimary?a.darkPrimary.hex:'—';
    const dConf=a.darkPrimary?Math.round(a.darkPrimary.confidence*100):0;
    const darkHtml=a.darkPrimary?`<div class="explore-color-card"><div class="explore-swatch-lg" style="background:${dColor}"></div><div class="explore-color-meta"><div class="explore-label">${t('深色模式主色')}</div><div class="explore-hex">${dColor}</div><div class="explore-conf">${t('置信度')} ${dConf}%</div></div></div>`:'';
    body.innerHTML=`
      <div class="explore-colors">
        <div class="explore-color-card"><div class="explore-swatch-lg" style="background:${pColor}"></div><div class="explore-color-meta"><div class="explore-label">推荐主色（浅色）</div><div class="explore-hex">${pColor}</div><div class="explore-conf">${t('置信度')} ${pConf}%</div></div></div>
        <div class="explore-color-card"><div class="explore-swatch-lg" style="background:${sColor}"></div><div class="explore-color-meta"><div class="explore-label">推荐副色 ${sDerived} ${sTag}</div><div class="explore-hex">${sColor}</div><div class="explore-conf">${t('置信度')} ${sConf}%</div></div></div>
        ${darkHtml}
      </div>
      <div class="explore-block"><div class="explore-sub">推荐理由（前 ${reasons.length} 条）</div><ul class="explore-reasons">${reasonHtml}</ul></div>
      <div class="explore-block"><div class="explore-sub">备选颜色（${a.alternatives.length} 个，点击设为副色）</div><div class="explore-swatches">${altHtml}</div></div>
      <div class="explore-block"><div class="explore-sub">注意事项</div><ul class="explore-warnings">${warnHtml}</ul></div>
      <!-- 应用范围复选框（W-tb-P14）：应用主副色 / 其它候选色进辅助色，均默认勾选；两者皆不选时按钮给出提示。 -->
      <!-- Apply-scope checkboxes (W-tb-P14): both default-checked; button hints when neither selected. -->
      <div class="explore-apply-opts" role="group" aria-label="${escapeHtml(t('explore.apply.scopeAria'))}">
        <label class="explore-opt"><input type="checkbox" id="exploreApplyBase" checked> ${escapeHtml(t('explore.apply.base'))}</label>
        <label class="explore-opt"><input type="checkbox" id="exploreApplyAux" checked> ${escapeHtml(t('explore.apply.aux'))}</label>
      </div>
      <div class="explore-actions"><button class="btn primary" id="exploreApplyBtn">${high?'确认并应用到操作台':'应用到操作台'}</button><span class="explore-muted">${high?'高置信度，请确认后覆盖当前主副色':'置信度偏低，建议人工校正后再应用'}</span></div>
    `;
    // 候选点击：写入副色输入框并同步拾色器（不自动应用）。
    // <lang zh-CN>仅填充输入，由用户决定是否应用。</lang>
    // <lang en>Only fills inputs; user decides whether to apply.</lang>
    all<HTMLButtonElement>('[data-alt]',body).forEach(btn=>btn.addEventListener('click',()=>{
      const hex=normalizeHex(btn.dataset.alt||'');
      if(!validHex(hex))return;
      setInputValue('secondaryHexInput',hex);byId<HTMLInputElement>('secondaryPicker').value=hex;
      draft.secondary=hex;setInputValue('secondaryNameInput','副色');
      applyCurrentTheme(false);
    }));
    // 应用按钮：按两个范围复选框组装应用内容（显式点击，遵循高置信不静默覆盖）。
    // <lang zh-CN>①应用主副色=原行为；②其它色到辅助色=候选色剔除推荐主/副后按 AUXILIARY_MAX(=12) 填满，
    //   整组替换辅助槽位（命名"取色辅助 N"）；两者皆不选 → 状态行提示不动作。刷新链含关系区与经典 mock。</lang>
    // <lang en>(1) base = previous behavior; (2) aux = alternatives minus recommended pair, up to AUXILIARY_MAX(=12)
    //   (AUXILIARY_MAX), replacing the auxiliary set ("Explore aux N"). Refresh chain mirrors applyPreset.</lang>
    byId<HTMLButtonElement>('exploreApplyBtn').addEventListener('click',()=>{
      if(!primary)return;
      const applyBase=byId<HTMLInputElement>('exploreApplyBase').checked;
      const applyAux=byId<HTMLInputElement>('exploreApplyAux').checked;
      if(!applyBase&&!applyAux){setText('generateStatus',t('explore.apply.none'));return;}
      if(applyBase){
        draft.primary=normalizeHex(primary.hex);
        if(secondary)draft.secondary=normalizeHex(secondary.hex);
        draft.primaryName=primary.role==='brand'?'提取主色':'提取主色';
        draft.secondaryName=secondary?'提取副色':'副色';
        draft.name=inputValue('themeNameInput').trim()||autoThemeName(draft.primaryName,draft.secondaryName);
      }
      if(applyAux){
        // 辅助候选：剔除推荐主/副色（避免与主体色重复），截断到槽位上限后整组替换。
        const auxList=a.alternatives
          .filter(c=>c.hex!==primary?.hex&&c.hex!==secondary?.hex)
          .slice(0,AUXILIARY_MAX)
          .map((c,i)=>makeRoleColor(normalizeHex(c.hex),`${t('explore.auxName')} ${i+1}`));
        draft.auxiliary=auxList;
      }
      // 取色推导链（ADR-007 v2）：single 模式 secondary 变体与 triad 第三色由 buildTheme 装配按规则自动推导；
      //   仅勾辅助色时不动主副色（独立维度互不覆盖）。规则推导值可手动覆写（completeSeriesMember 同语义）。
      // <lang zh-CN>装配语义已覆盖推导；辅助色整组替换后走 applyPreset 同款刷新链（关系区/渐变/经典 mock/设置页）。
      //   auxCount 局部捕获：草稿辅助槽位数（applyAux 已写入，避免可空收窄噪音）。</lang>
      // <lang en>Assembly semantics cover derivation; aux-only apply keeps base colors untouched. auxCount is a local
      //   snapshot of the slot count after the aux write (avoids optional-narrowing noise).</lang>
      const auxCount=applyAux?draft.auxiliary?.length??0:0;
      syncInputs();applyCurrentTheme(false);renderHarmony();renderGradients();renderClassicPreview();updatePreviewMeta();
      setText('generateStatus',applyBase
        ?`已应用网址取色结果（主色 ${draft.primary}${secondary?` / 副色 ${draft.secondary}`:''}${applyAux?` / 辅助色 ${auxCount} 槽`:''}）。`
        :`已将 ${auxCount} 个取色候选写入辅助色槽位。`);
    });
  }

  // 应用预设对象主体（W-tb-P15 拆分）：标记选中、载入草稿、重算副色候选并刷新全界面；
  //   供库内 id 应用与宝典弹层"套用整套"两条入口复用。
  // <lang zh-CN>同时持久化当前渐变（独立键），并回显主色候选来源。</lang>
  // <lang en>Shared apply body used by both the library-id path and the baodian full-set action.</lang>
  function applyPresetData(p:Preset){
    // 锚定分支（W-tb-P16）：仅语气预设（category tone）且开关开启——主色保持用户当前值，
    //   副色/第三色按组合关系重映射，辅助色从用户主色重新生成；经典/自定义预设不受影响。
    //   修复：变换后赋回参数继续主流程（原实现递归调用自身且 category 不变→无限递归，handler 静默崩溃）。
    // <lang en>Anchor branch transforms p in place (the earlier self-recursion never terminated).</lang>
    if(baodianAnchor&&p.category==='tone'){
      p={...p,
        primary:draft.primary,
        secondary:shiftHueTo(p.secondary,p.primary,draft.primary),
        ...(p.thirdColor?{thirdColor:{...p.thirdColor,value:shiftHueTo(p.thirdColor.value,p.primary,draft.primary)}}:{}),
        auxiliary:generateAuxiliaryCandidates(draft.primary).slice(0,TONE_AUX_SLOTS).map(c=>({name:c.name,value:c.hex,scale:tonalScale(c.hex),on:bestOnColor(c.hex).hex}))
      };
    }
    selectedPresetId=p.id;
    draft=draftFromPreset(p);
    // 字体/间距令牌为操作台全局状态（既定决策）：换预设后重新挂回，保持编辑连续性。
    // <lang zh-CN>draftFromPreset 不携带令牌字段（预设仅颜色+渐变），需显式重挂共享引用。</lang>
    // <lang en>draftFromPreset carries no token fields (presets are colors+gradients only), so re-attach explicitly.</lang>
    attachTokensToDraft();
    saveGradients();
    // 尝试匹配主色候选，以决定副色候选集是否置顶推荐副色。
    // <lang zh-CN>命中则 primaryMeta 非空，副色候选与预设配对一致。</lang>
    // <lang en>On hit, primaryMeta is non-null so secondary candidates align with the preset.</lang>
    primaryMeta=findMatchingPrimaryCandidate(draft,primaryCandidates)||null;
    secondaryCandidates=secondarySetForDraft(draft,primaryMeta);
    // 刷新链补 renderHarmony：预设携带的 seriesMode/relation/third/auxiliary 须同步关系区
    //   （规则下拉、成员卡、辅助槽位）——缺失时载入预设后这些控件停留在旧状态（W-tb-P12 完善批②修复）。
    // <lang en>renderHarmony is required so preset-carried v2 fields repaint the relation block.</lang>
    syncInputs();applyRuntimeTheme();renderHarmony();renderGradients();updateTokenOutputs();updatePreviewMeta();
    // 经典 mock 同步刷新：预设可携带第三/辅助色（完善批③补链，与批②同类的链路缺失）。
    // <lang en>Repaint the classic mock since presets may carry third/aux colors.</lang>
    renderClassicPreview();
    renderPrimaryCandidates();renderSecondaryCandidates();renderPresetList();
  }

  // 按 id 应用预设（库列表入口）：查找后走 applyPresetData 主体。
  // <lang en>Apply-by-id (library entry): resolves then delegates to applyPresetData.</lang>
  function applyPreset(id:string|undefined){
    if(!id)return;
    const p=getAllPresets().find(x=>x.id===id);
    if(!p)return;
    applyPresetData(p);
  }

  // 切换 PC 预览布局：更新状态、分段控件高亮、内容 CSS 类与侧栏/顶栏/轨道显隐。
  // <lang zh-CN>sidebar 显侧栏，top 显顶栏，mixed 显右侧轨道。</lang>
  // <lang en>sidebar shows the sidebar, top shows the top nav, mixed shows the right rail.</lang>
  function applyLayout(mode:'sidebar'|'top'|'mixed'){
    layoutMode=mode;
    all<HTMLButtonElement>('#pcLayoutSwitch .seg').forEach(btn=>btn.classList.toggle('active',btn.dataset.layout===mode));
    byId<HTMLElement>('pcContent').className='pc-content '+(mode==='sidebar'?'pc-layout-sidebar':mode==='top'?'pc-layout-top':'pc-layout-mixed');
    byId<HTMLElement>('pcSidebar').style.display=mode==='sidebar'?'block':'none';
    byId<HTMLElement>('pcRail').style.display=mode==='mixed'?'grid':'none';
    byId<HTMLElement>('pcTopNav').style.display=mode==='top'?'flex':'none';
    setText('layoutModeLabel',mode==='sidebar'?t('左右结构'):mode==='top'?t('上下结构'):t('混合工作台'));
    updatePreviewMeta();
  }
  // 切换 PC/小程序外观浅深：更新状态、高亮、pcShell/wxFrame 的 dark 类与开关。
  // <lang zh-CN>影响预览区的明暗主题呈现。</lang>
  // <lang en>Affects the preview's light/dark presentation.</lang>
  function applyAppearance(mode:'light'|'dark'){
    appearanceMode=mode;
    all<HTMLButtonElement>('#appearanceSwitch .seg').forEach(btn=>btn.classList.toggle('active',btn.dataset.appearance===mode));
    byId<HTMLElement>('pcShell').classList.toggle('dark',mode==='dark');
    byId<HTMLElement>('wxFrame').classList.toggle('dark',mode==='dark');
    setText('appearanceModeLabel',mode==='light'?t('浅色模式'):t('深色模式'));
    byId<HTMLInputElement>('settingsDarkToggle').checked=mode==='dark';
    updatePreviewMeta();
  }
  // 预览滤镜族（W-tb-P21）：透明度淡化/低饱和褪色/亮度增减/灰度程度。
  //   实现=CANVAS 无关的 CSS filter 叠加到预览容器（PC shell + 小程序机身 + 经典 mock），
  //   仅影响预览呈现；导出令牌与主题数据不受影响（设计确定性）。
  // <lang en>Preview-only CSS filters applied to preview containers; exports stay untouched.</lang>
  type PreviewFilter='none'|'alpha'|'desat'|'bright'|'dim'|'gray25'|'gray50'|'gray100';
  // 滤镜 → CSS filter 映射（alpha 用透明度+轻微降饱和模拟"淡化"）。
  // <lang en>Filter → CSS filter mapping (alpha fades via opacity plus slight desaturation).</lang>
  const FILTER_CSS:Record<PreviewFilter,string>={
    none:'',alpha:'opacity(.85)',desat:'saturate(.55)',bright:'brightness(1.12)',
    dim:'brightness(.88)',gray25:'grayscale(.25)',gray50:'grayscale(.5)',gray100:'grayscale(1)'
  };
  // previewFilter：当前滤镜（localStorage 持久化）。
  let previewFilter:PreviewFilter='none';
  try{const v=localStorage.getItem('hia-preview-filter');if(v&&v in FILTER_CSS)previewFilter=v as PreviewFilter;}catch{/* ignore */}
  // applyPreviewFilter：写入容器 filter 并持久化。
  // <lang en>Applies the filter to preview containers and persists the choice.</lang>
  function applyPreviewFilter(f:PreviewFilter){
    previewFilter=f;
    try{localStorage.setItem('hia-preview-filter',f);}catch{/* ignore */}
    // 容器：PC 预览完整外壳（含顶部 banner/侧栏/内容）+ 小程序机身 + 经典 mock。
    //   修复：原仅作用于 #pcContent，顶部 banner 在 #pcShell > .pc-topbar 之外，导致灰度不生效。
    // <lang en>Apply to the whole pcShell (banner included), the phone frame and the classic mock.</lang>
    const targets=['pcShell','wxFrame','classicPreviewBody'];
    for(const id of targets){
      const el=document.getElementById(id);
      if(el)el.style.filter=FILTER_CSS[f]||'';
    }
    const sel=byId<HTMLSelectElement>('previewFilterSelect');
    if(sel)sel.value=f;
  }
  // 切换 PC 预览页面标签：高亮激活页、隐藏其余、显示目标页并更新标题/面包屑。
  // <lang zh-CN>titles 给出“标题/面包屑”中英或中中对照。</lang>
  // <lang en>titles provides title/crumb text pairs.</lang>
  function switchPcPage(page:'dashboard'|'list'|'form'|'detail'|'analytics'|'settings'){
    all<HTMLButtonElement>('#pcPageTabs .tab').forEach(btn=>btn.classList.toggle('active',btn.dataset.page===page));
    all<HTMLElement>('.pc-page').forEach(el=>el.style.display='none');
    byId<HTMLElement>('pcPage-'+page).style.display='block';
    const titles:Record<typeof page,[string,string]>={dashboard:['项目运行总览','仪表盘'],list:['用户与业务列表','列表页'],form:['主题表单示例','表单页'],detail:['项目详情','详情页'],analytics:['分析页示例','分析页'],settings:['系统设置','设置页']};
    setText('pcPageTitle',t(titles[page][0]));
    setText('pcPageCrumb',t(titles[page][1]));
  }
  // 切换小程序预览页面：高亮激活段、隐藏其余、显示目标页。
  // <lang zh-CN>home/list/detail/profile/form 五个小程序页面。</lang>
  // <lang en>home/list/detail/profile/form mini-program pages.</lang>
  function switchWxPage(page:'home'|'list'|'detail'|'profile'|'form'){
    all<HTMLButtonElement>('#wxPageTabs .seg').forEach(btn=>btn.classList.toggle('active',btn.dataset.wxPage===page));
    all<HTMLElement>('.wx-page').forEach(el=>el.classList.add('hidden'));
    byId<HTMLElement>('wxPage-'+page).classList.remove('hidden');
  }
  // 复制文本到剪贴板，失败则提示手动复制。
  // <lang zh-CN>包装平台剪贴板能力，统一错误反馈。</lang>
  // <lang en>Wraps the platform clipboard with uniform error feedback.</lang>
  async function copy(value:string):Promise<void>{
    try{await platform.clipboard.writeText(value);}
    catch{platform.alert('复制失败，请手动复制。');}
  }

  // 绑定所有交互事件：生成副色、应用/保存/更新预设、自动命名、取色器联动、过滤、布局/外观/页面切换、复制、渐变重置与折叠。
  // <lang zh-CN>在 boot 末尾调用一次，集中注册监听器。</lang>
  // <lang en>Registered once at the end of boot; centralizes all listeners.</lang>
  function bind(){
    // 语言切换（`W-tb-P7`）：切换 → 持久化 → 静态 DOM/演示内容翻译 → 动态区域全量重渲染。
    // <lang zh-CN>按钮文案始终显示"目标语言"（中文界面显示 EN，英文界面显示 中文）。</lang>
    // <lang en>The button always shows the target language ("EN" on zh UI, "中文" on en UI).</lang>
    byId<HTMLButtonElement>('langToggleBtn').addEventListener('click',()=>{
      const next=getLocale()==='zh-CN'?'en':'zh-CN';
      if(!setLocale(next))return;
      applyAll();
      // 动态区域重渲染：与 boot() 的渲染序列保持一致。
      // <lang zh-CN>复用同一渲染链，保证语言切换后所有面板与翻译同步；`W-tb-P9` 面板（字体操作台/经典
      //   mock/TDON 占位/预览提示）一并重绘。</lang>
      // <lang en>Reuses the same render chain so every panel re-renders in the new locale; `W-tb-P9` panels
      //   (typography console / classic mocks / TDON placeholder / preview hint) re-render too.</lang>
      syncInputs();renderPrimaryCandidates();renderSecondaryCandidates();renderGradients();renderPresetList();updateTokenOutputs();updatePreviewMeta();renderExplore();
      renderTypography();renderClassicPreview();renderTdonPreview();applyPreviewMode(previewMode);renderExportTree();
      renderRemoteSources();renderRemoteList();renderHarmony();
      byId<HTMLButtonElement>('langToggleBtn').textContent=t('lang.switch');
      document.documentElement.lang=next;
      // 文档链接随界面语言同步（W-tb-P14 维护者反馈：从首页进入文档站应保持当前语言）。
      // <lang en>Docs link follows the UI locale (maintainer feedback): the docs site opens in the same language.</lang>
      syncDocsLink();
    });
    // 生成副色：以当前主色（若有匹配候选则用其推荐副色置顶）生成候选集并刷新。
    // <lang zh-CN>点击“生成副色”按钮触发，不改动草稿基色。</lang>
    // <lang en>Triggered by "生成副色"; does not mutate draft base colors.</lang>
    byId('generateSecondaryBtn').addEventListener('click',()=>{
      const hex=normalizeHex(inputValue('primaryHexInput')),
        name=inputValue('primaryNameInput').trim()||'主色',
        // 仅当主色候选命中时把推荐副色作为置顶项。
        // <lang zh-CN>否则按草稿当前副色生成候选。</lang>
        // <lang en>Otherwise generates candidates from the draft's current secondary.</lang>
        preferred=primaryMeta&&normalizeHex(primaryMeta.hex)===hex?{hex:primaryMeta.secondaryHex,name:primaryMeta.secondaryName,scheme:primaryMeta.secondaryScheme}:null;
      secondaryCandidates=generateSecondarySet(hex,preferred);
      renderSecondaryCandidates();
      // 自动加载首位"推导候选"到操作台（维护者定案：preferred 预设置顶项除外）。
      // <lang zh-CN>加载后同步输入并应用主题（不改名），状态行说明自动加载结果。</lang>
      // <lang en>The first derived candidate (not the pinned preferred) auto-loads into the console.</lang>
      const auto=secondaryCandidates.find(c=>c.id!=='preferred-secondary')??secondaryCandidates[0];
      if(auto){
        draft.secondary=normalizeHex(auto.hex);
        draft.secondaryName=auto.name;
        syncInputs();applyCurrentTheme(false);renderSecondaryCandidates();
        setText('generateStatus',`已针对 ${name} ${hex} 生成 ${secondaryCandidates.length} 个副色候选，并自动加载首位「${auto.name} ${auto.hex}」。`);
      }else{
        setText('generateStatus',`已针对 ${name} ${hex} 生成 ${secondaryCandidates.length} 个副色候选。`);
      }
    });
    // 应用主题：从输入读回并应用到界面（覆盖命名）。
    // <lang zh-CN>“应用”按钮，确保手填主题名生效。</lang>
    // <lang en>Apply button; ensures a hand-typed theme name takes effect.</lang>
    byId('applyThemeBtn').addEventListener('click',()=>applyCurrentTheme(true));
    // 保存预设：先应用再保存为新自定义预设。
    // <lang zh-CN>“保存预设”按钮。</lang>
    // <lang en>Save preset button.</lang>
    byId('savePresetBtn').addEventListener('click',()=>{applyCurrentTheme(true);savePreset();});
    // 更新预设：先应用再覆盖当前自定义预设（内置会拦截）。
    // <lang zh-CN>“更新预设”按钮。</lang>
    // <lang en>Update preset button.</lang>
    byId('updatePresetBtn').addEventListener('click',()=>{applyCurrentTheme(true);updatePreset();});
    // 自动命名：按主副色名生成主题名并写回输入框。
    // <lang zh-CN>“自动命名”按钮，方便一键规范命名。</lang>
    // <lang en>Auto-name button for one-click canonical naming.</lang>
    byId('autoNameBtn').addEventListener('click',()=>{
      const name=autoThemeName(inputValue('primaryNameInput').trim(),inputValue('secondaryNameInput').trim());
      setInputValue('themeNameInput',name);
      draft.name=name;
      updatePreviewMeta();
    });
    // 取色器 → HEX 输入：主/副色拾色器变化时同步大写 HEX 文本。
    // <lang zh-CN>保证视觉选色与文本输入双向同步。</lang>
    // <lang en>Keeps visual picker and text input in two-way sync.</lang>
    byId<HTMLInputElement>('primaryPicker').addEventListener('input',e=>setInputValue('primaryHexInput',(e.currentTarget as HTMLInputElement).value.toUpperCase()));
    byId<HTMLInputElement>('secondaryPicker').addEventListener('input',e=>setInputValue('secondaryHexInput',(e.currentTarget as HTMLInputElement).value.toUpperCase()));
    // 第三色拾色器↔HEX 联动（`W-tb-P11` 一等位，模式同主/副）。
    // <lang zh-CN>输入后需点"应用当前主题"生效（与主副色一致）。</lang>
    // <lang en>Applied via the Apply button, consistent with primary/secondary.</lang>
    byId<HTMLInputElement>('thirdPicker').addEventListener('input',e=>setInputValue('thirdHexInput',(e.currentTarget as HTMLInputElement).value.toUpperCase()));
    byId<HTMLInputElement>('thirdHexInput').addEventListener('input',e=>{const target=e.currentTarget as HTMLInputElement,v=normalizeHex(target.value);if(v.length<=7)target.value=v;if(validHex(v))byId<HTMLInputElement>('thirdPicker').value=v;});
    // 操作台三拾色器拖拽互换（`W-tb-P12` 修复）：改用专用"抓手"承载 draggable——
    //   根因：格子内 input[type=color]/text 会吞掉 HTML5 拖拽的 dragstart，使整组 draggable 无效；
    //   现由 grip 单独 draggable，拖到另一组即两成员 {name,value} 互换（swapMemberPair）。
    // <lang zh-CN>拖拽失效根因是嵌套可编辑元素吞事件，抓手是最小可靠修复。</lang>
    // <lang en>The failure was inputs swallowing dragstart; a dedicated grip is the minimal reliable fix.</lang>
    let pickDragSrc:string|null=null;
    const pickerIndex=(p:string|null)=>p==='primary'?0:p==='secondary'?1:p==='third'?2:-1;
    all<HTMLElement>('#seriesPickers [data-picker]').forEach(group=>{
      const grip=group.querySelector<HTMLElement>('[data-grip]');
      if(!grip)return;
      grip.setAttribute('draggable','true');
      grip.addEventListener('dragstart',e=>{pickDragSrc=group.dataset.picker??null;e.dataTransfer?.setData('text/plain',pickDragSrc??'');});
      group.addEventListener('dragover',e=>{e.preventDefault();if(pickDragSrc&&pickDragSrc!==group.dataset.picker)group.style.outline='2px dashed var(--p400)';});
      group.addEventListener('dragleave',()=>{group.style.outline='';});
      group.addEventListener('drop',e=>{
        e.preventDefault();group.style.outline='';
        const dst=pickerIndex(group.dataset.picker??null);
        const src=pickerIndex(pickDragSrc);
        pickDragSrc=null;
        if(src<0||dst<0||src===dst)return;
        swapMemberPair(src,dst);
      });
    });
    // HEX 输入 → 取色器：实时规范化并回填，合法时同步拾色器。
    // <lang zh-CN>限制长度避免溢出，validHex 通过才更新拾色器值。</lang>
    // <lang en>Caps length to avoid overflow; only updates the picker when validHex passes.</lang>
    byId<HTMLInputElement>('primaryHexInput').addEventListener('input',e=>{const target=e.currentTarget as HTMLInputElement,v=normalizeHex(target.value);if(v.length<=7)target.value=v;if(validHex(v))byId<HTMLInputElement>('primaryPicker').value=v;});
    byId<HTMLInputElement>('secondaryHexInput').addEventListener('input',e=>{const target=e.currentTarget as HTMLInputElement,v=normalizeHex(target.value);if(v.length<=7)target.value=v;if(validHex(v))byId<HTMLInputElement>('secondaryPicker').value=v;});
    // 预设搜索/分类：即时过滤列表（本地与远程共用同一组过滤控件）。
    // <lang zh-CN>输入即筛选，无需额外按钮；远程 Tab 打开时同步过滤远程卡片。</lang>
    // <lang en>Filters live as you type and drive both local and remote lists.</lang>
    byId('presetSearchInput').addEventListener('input',()=>{renderPresetList();if(marketTab==='remote')renderRemoteList();});
    byId('presetFilterSelect').addEventListener('change',()=>{renderPresetList();if(marketTab==='remote')renderRemoteList();});
    // 市场子 Tab：本地库/远程源切换（`W-tb-P10`）。
    // <lang zh-CN>仅接受两个合法枚举值。</lang>
    // <lang en>Accepts only the two legal enum values.</lang>
    all<HTMLButtonElement>('#marketTabs [data-market-tab]').forEach(btn=>btn.addEventListener('click',()=>{const tab=btn.dataset.marketTab;if(tab==='local'||tab==='remote')applyMarketTab(tab);}));
    // 远程源加载：fetchText + parseThemePack（状态行回执）。
    // <lang zh-CN>见 loadRemoteSource。</lang>
    // <lang en>See loadRemoteSource.</lang>
    byId('remoteLoadBtn').addEventListener('click',()=>loadRemoteSource());
    // 添加源：协议白名单 + 去重 + 持久化。
    // <lang zh-CN>非法/重复给状态行反馈，不改列表。</lang>
    // <lang en>Invalid/duplicate URLs report via the status line without mutating the list.</lang>
    byId('remoteAddSourceBtn').addEventListener('click',()=>{
      const url=inputValue('remoteSourceInput').trim();
      if(!/^https?:\/\//i.test(url)){setText('remoteStatus',t('p10.remote.badUrl'));return;}
      if(remoteSources.includes(url)){setText('remoteStatus',t('p10.remote.dupeSource'));return;}
      remoteSources=[...remoteSources,url];
      saveRemoteSources();renderRemoteSources();
      setInputValue('remoteSourceInput','');
      byId<HTMLSelectElement>('remoteSourceSelect').value=url;
      setText('remoteStatus','');
    });
    // 移除源：默认源不可移除。
    // <lang zh-CN>移除后选首位（默认源）。</lang>
    // <lang en>After removal, selection falls back to the first (default) source.</lang>
    byId('remoteRemoveSourceBtn').addEventListener('click',()=>{
      const url=byId<HTMLSelectElement>('remoteSourceSelect').value;
      if(url===DEFAULT_REMOTE_SOURCE)return;
      remoteSources=remoteSources.filter(u=>u!==url);
      saveRemoteSources();renderRemoteSources();
      setText('remoteStatus','');
    });
    // 整源导入：全部远程预设走合并链（重命名+计数回执）。
    // <lang zh-CN>见 importPresets。</lang>
    // <lang en>See importPresets.</lang>
    byId('remoteImportAllBtn').addEventListener('click',()=>{if(remotePresets.length)importPresets(remotePresets);});
    // 主题库导出/导入（`W-tb-P10` 文件搬运闭环）。
    // <lang zh-CN>导出=自定义预设 JSON 下载；导入=文件→清洗→合并→回执。</lang>
    // <lang en>Export downloads custom presets as JSON; import = file → sanitize → merge → receipt.</lang>
    byId('exportLibraryBtn').addEventListener('click',exportLibrary);
    byId('importLibraryBtn').addEventListener('click',triggerImport);
    byId<HTMLInputElement>('importLibraryFile').addEventListener('change',e=>{
      const file=(e.currentTarget as HTMLInputElement).files?.[0];
      if(!file)return;
      const reader=new FileReader();
      reader.onload=()=>{
        const pack=parseThemePack(String(reader.result));
        if(!pack||pack.presets.length===0){
          platform.alert(t('p10.import.fail'));
          return;
        }
        const before=customPresets.length;
        const {merged,renamed}=mergeImportedPresets(customPresets,pack.presets);
        customPresets=merged;
        saveCustomPresets();
        renderPresetList();
        setText('presetCount',String(getAllPresets().length));
        platform.alert(t('p10.import.done',{count:String(customPresets.length-before),renamed:String(renamed),dropped:String(pack.dropped)}));
      };
      reader.onerror=()=>platform.alert(t('p10.import.fail'));
      reader.readAsText(file);
      (e.currentTarget as HTMLInputElement).value='';
    });
    // 分享链接：当前草稿编码进 hash 并复制（`W-tb-P10`）。
    // <lang zh-CN>见 shareLink。</lang>
    // <lang en>See shareLink.</lang>
    byId('shareLinkBtn').addEventListener('click',()=>shareLink());
    // PC 布局分段：点击切换到 sidebar/top/mixed。
    // <lang zh-CN>仅接受合法枚举值。</lang>
    // <lang en>Only accepts legal enum values.</lang>
    all<HTMLButtonElement>('#pcLayoutSwitch .seg').forEach(btn=>btn.addEventListener('click',()=>{const mode=btn.dataset.layout;if(mode==='sidebar'||mode==='top'||mode==='mixed')applyLayout(mode);}));
    // 外观分段：点击切换 light/dark。
    // <lang zh-CN>与开关状态保持同步。</lang>
    // <lang en>Stays in sync with the toggle state.</lang>
    all<HTMLButtonElement>('#appearanceSwitch .seg').forEach(btn=>btn.addEventListener('click',()=>{const mode=btn.dataset.appearance;if(mode==='light'||mode==='dark')applyAppearance(mode);}));
    // 预览滤镜（W-tb-P21）：切换即应用并持久化；启动时恢复。
    byId<HTMLSelectElement>('previewFilterSelect').addEventListener('change',e=>applyPreviewFilter((e.currentTarget as HTMLSelectElement).value as PreviewFilter));
    applyPreviewFilter(previewFilter);
    // PC 页面标签：点击切换到对应预览页。
    // <lang zh-CN>六个页面枚举校验。</lang>
    // <lang en>Validates against the six page enums.</lang>
    all<HTMLButtonElement>('#pcPageTabs .tab').forEach(btn=>btn.addEventListener('click',()=>{const page=btn.dataset.page;if(page==='dashboard'||page==='list'||page==='form'||page==='detail'||page==='analytics'||page==='settings')switchPcPage(page);}));
    // 小程序页面段：点击切换到对应预览页。
    // <lang zh-CN>五个页面枚举校验。</lang>
    // <lang en>Validates against the five page enums.</lang>
    all<HTMLButtonElement>('#wxPageTabs .seg').forEach(btn=>btn.addEventListener('click',()=>{const page=btn.dataset.wxPage;if(page==='home'||page==='list'||page==='detail'||page==='profile'||page==='form')switchWxPage(page);}));
    // 复制 CSS / JSON 令牌到剪贴板。
    // <lang zh-CN>分别取对应输出文本框内容。</lang>
    // <lang en>Takes the respective output textarea content.</lang>
    byId('copyCssBtn').addEventListener('click',()=>copy(inputValue('cssTokenOutput')));
    byId('copyJsonBtn').addEventListener('click',()=>copy(inputValue('jsonTokenOutput')));
    // 设置区深色开关：变更时切换外观。
    // <lang zh-CN>checkbox 与分段控件双向联动。</lang>
    // <lang en>Checkbox and segmented control stay two-way linked.</lang>
    byId<HTMLInputElement>('settingsDarkToggle').addEventListener('change',e=>applyAppearance((e.currentTarget as HTMLInputElement).checked?'dark':'light'));
    // 重置全部渐变：回到出厂默认并刷新。
    // <lang zh-CN>一键恢复八张渐变角色默认配置。</lang>
    // <lang en>One-click restore of all eight gradient role defaults.</lang>
    byId('resetAllGradientsBtn').addEventListener('click',()=>{draft.gradients=cloneGradientSettings(GRADIENT_DEFAULTS);applyRuntimeTheme();saveGradients();updateTokenOutputs();renderGradients();});
    // 折叠/展开渐变设置面板：切换 collapsed 类并更新按钮文案。
    // <lang zh-CN>按钮文字在“展开设置/收起设置”间切换。</lang>
    // <lang en>Button text toggles between "展开设置" / "收起设置".</lang>
    byId<HTMLButtonElement>('toggleGradientPanelBtn').addEventListener('click',e=>{const panel=byId<HTMLElement>('gradientSettingsPanel');panel.classList.toggle('collapsed');(e.currentTarget as HTMLButtonElement).textContent=panel.classList.contains('collapsed')?'展开设置':'收起设置';});
    // 预览三类型切换（`W-tb-P9`）：面板显隐 + 子控件显隐 + 导出 Tab 同构联动。
    // <lang zh-CN>仅接受三个合法枚举值。</lang>
    // <lang en>Accepts only the three legal enum values.</lang>
    all<HTMLButtonElement>('#previewTypeSwitch .seg').forEach(btn=>btn.addEventListener('click',()=>{const mode=btn.dataset.previewMode;if(mode==='default'||mode==='classic'||mode==='tdon')applyPreviewMode(mode);}));
    // 经典目标下拉：切换 WP/Tailwind 场景并重绘 mock。
    // <lang zh-CN>枚举校验后记录 classicTargetId。</lang>
    // <lang en>Records classicTargetId after enum validation.</lang>
    byId<HTMLSelectElement>('classicTargetSelect').addEventListener('change',()=>{const v=byId<HTMLSelectElement>('classicTargetSelect').value;if(v==='wordpress-child'||v==='tailwind-config')classicTargetId=v;renderClassicPreview();});
    // TDON 源子 Tab：仅记录选择；连接按钮按规划延后（保持禁用），不提供假交互。
    // <lang zh-CN>url/local 两源；后续接入 SSRF 管线/本地文件读取。</lang>
    // <lang en>url/local sources; the SSRF pipeline / local-file read lands with the runtime.</lang>
    byId<HTMLSelectElement>('tdonSourceSelect').addEventListener('change',()=>{const v=byId<HTMLSelectElement>('tdonSourceSelect').value;if(v==='url'||v==='local'){tdonSource=v;renderTdonPreview();}});
    // 导出三 Tab：手动切换（默认/经典/自定义）。
    // <lang zh-CN>与预览联动独立：预览切换会跟随导出 Tab，导出切换不回写预览。</lang>
    // <lang en>Independent of preview linkage: preview follows export mode, but export clicks do not rewrite preview mode.</lang>
    all<HTMLButtonElement>('#exportTypeTabs .tab').forEach(btn=>btn.addEventListener('click',()=>{const mode=btn.dataset.exportMode;if(mode==='default'||mode==='classic'||mode==='tdon')applyExportMode(mode);}));
    // 导出目标切换：记录目标并重绘文件树（选中文件回落第一个）。
    // <lang zh-CN>三个内置目标 id 与 core 注册表一致。</lang>
    // <lang en>The three built-in target ids match the core registry.</lang>
    byId<HTMLSelectElement>('exportTargetSelect').addEventListener('change',()=>{exportTargetId=byId<HTMLSelectElement>('exportTargetSelect').value;selectedExportFile=null;renderExportTree();});
    // ZIP 下载：fflate 打包虚拟文件树并触发浏览器下载。
    // <lang zh-CN>见 downloadZip；文件名由适配器 archiveName 决定。</lang>
    // <lang en>See downloadZip; filename comes from the adapter's archiveName.</lang>
    byId<HTMLButtonElement>('exportZipBtn').addEventListener('click',downloadZip);
    // 字体/间距恢复默认（ADR-006）：重置令牌组并全链刷新。
    // <lang zh-CN>见 resetTypography。</lang>
    // <lang en>See resetTypography.</lang>
    byId<HTMLButtonElement>('resetTypographyBtn').addEventListener('click',resetTypography);
    // 配色关系面板交互（`W-tb-P11`）：模式 segmented / 规则下拉 / 预设应用 / 辅助槽位按钮。
    // <lang zh-CN>仅接受合法枚举；辅助按钮见各 handler。</lang>
    // <lang en>Enum-validated; see handlers for auxiliary actions.</lang>
    // 配色关系区（`W-tb-P12`）：宝典弹层 / 规则补色 / 补副补第三 / 第三色自动匹配与删除 / 辅助按钮。
    // <lang zh-CN>segmented 移除，模式由成员数派生；成员卡行内重选色/删除在 renderHarmony 内绑定。</lang>
    // <lang en>Segmented removed (mode derives); member inline recolor/delete bound inside renderHarmony.</lang>
    byId('baodianPickBtn').addEventListener('click',openBaodianModal);
    byId('baodianCloseBtn').addEventListener('click',()=>{byId<HTMLElement>('baodianModal').hidden=true;});
    // 锚定开关（W-tb-P16）：切换即持久化（默认直用，维护者定案 2）。
    // <lang en>Anchor toggle: persisted on change (default literal, maintainer decision 2).</lang>
    byId<HTMLInputElement>('baodianAnchorToggle').addEventListener('change',e=>saveAnchorMode((e.currentTarget as HTMLInputElement).checked));
    // 多源下拉（W-tb-P17）：主按钮=开当前源弹层；▾=源菜单；菜单项切换源并开弹层；外点收起。
    // <lang en>Multi-source dropdown: main button opens current source; caret opens the menu.</lang>
    byId<HTMLButtonElement>('baodianPickBtn').addEventListener('click',()=>{openColorSourceModal();});
    byId<HTMLButtonElement>('sourceDdCaret').addEventListener('click',e=>{
      e.stopPropagation();
      const menu=byId<HTMLElement>('sourceMenu');
      menu.hidden=!menu.hidden;
    });
    all<HTMLButtonElement>('#sourceMenu [data-source]').forEach(btn=>btn.addEventListener('click',()=>{
      colorSource=(btn.dataset.source as'baodian'|'traditional');
      byId<HTMLElement>('sourceMenu').hidden=true;
      openColorSourceModal();
    }));
    document.addEventListener('click',e=>{
      const menu=byId<HTMLElement>('sourceMenu');
      if(!menu.hidden&&!menu.contains(e.target as Node)&&(e.target as Element).id!=='sourceDdCaret')menu.hidden=true;
    });
    byId<HTMLElement>('baodianModal').addEventListener('click',e=>{if(e.target===e.currentTarget)byId<HTMLElement>('baodianModal').hidden=true;});
    byId<HTMLSelectElement>('seriesRuleSelect').addEventListener('change',()=>{draft.seriesRelation=byId<HTMLSelectElement>('seriesRuleSelect').value as SeriesRelationId;renderHarmony();});
    byId('completeSecondaryBtn').addEventListener('click',()=>completeSeriesMember('secondary'));
    byId('completeThirdBtn').addEventListener('click',()=>completeSeriesMember('third'));
    byId('thirdMatchBtn').addEventListener('click',()=>{completeSeriesMember('third',byId<HTMLSelectElement>('thirdMatchRule').value);});
    byId('seriesResetBtn').addEventListener('click',restoreSeriesSnapshot);
    byId('thirdRemoveBtn').addEventListener('click',()=>{const list=seriesMemberList();if(list.length>1){list.pop();commitSeriesMembers(list);}});
    byId('auxAddBtn').addEventListener('click',addAuxiliary);
    byId('auxGenBtn').addEventListener('click',generateAuxiliary);
    byId('auxClearBtn').addEventListener('click',clearAuxiliary);
    // 网址取色探索：提交 URL 给宿主 explorer，更新阶段状态并渲染 V2 报告。
    // <lang zh-CN>仅当存在 explorer 能力时绑定，纯浏览器不报错。</lang>
    // <lang en>Only binds when an explorer exists; plain browsers stay error-free.</lang>
    const exploreBtn=byId<HTMLButtonElement>('exploreBtn');
    if(platform.explorer&&exploreBtn){
      exploreBtn.addEventListener('click',async()=>{
        if(exploring)return;
        const url=inputValue('exploreUrlInput').trim();
        if(!/^https?:\/\//i.test(url)){platform.alert('请输入以 http(s):// 开头的网址。');return;}
        exploring=true;exploreStage='exploring';renderExplore();
        try{
          const result=await platform.explorer!.exploreUrl(url);
          exploreResult=result;
          // 降级（degraded-static）或置信度封顶时标记 degraded 阶段。
          // <lang zh-CN>让 UI 提示证据不完整，应用更审慎。</lang>
          // <lang en>Lets the UI flag incomplete evidence and recommend caution.</lang>
          exploreStage=result.diagnostics.mode==='degraded-static'||result.confidence<=0.45?'degraded':'done';
        }catch(e){exploreStage='error';exploreResult=null;platform.alert(e instanceof Error?e.message:'网址探索失败。');}
        finally{exploring=false;renderExplore();}
      });
    }
  }

  // 启动操作台：恢复持久化数据、初始化候选、首渲染各区域并绑定事件。
  // <lang zh-CN>挂载后仅调用一次；恢复自定义预设与渐变，再以默认布局/外观/页面进入。</lang>
  // <lang en>Called once after mount; restores custom presets and gradients, then enters with default layout/appearance/page.</lang>
  function boot(){
    // 从存储恢复自定义预设与渐变（容错：失败返回空/默认）。
    // <lang zh-CN>parseThemeLibrary/parseGradientSettings 均已做容错。</lang>
    // <lang en>parseThemeLibrary/parseGradientSettings are fault-tolerant.</lang>
    customPresets=parseThemeLibrary(platform.storage.getItem(THEME_STORAGE));
    draft.gradients=parseGradientSettings(platform.storage.getItem(GRADIENT_STORAGE));
    // 恢复字体/间距令牌并挂回草稿（ADR-006 / `W-tb-P9`）：与渐变同一持久化先例。
    // <lang zh-CN>必须在首轮 applyRuntimeTheme 之前，保证 --hia-font-*/fs/space 变量按存储值注入。</lang>
    // <lang en>Must run before the first applyRuntimeTheme so --hia-font-*/fs/space vars inject from stored values.</lang>
    loadTypography();attachTokensToDraft();
    secondaryCandidates=secondarySetForDraft(draft,primaryMeta);
    // 首轮渲染：运行时变量、表单、候选、渐变、预设、令牌、元信息。
    // <lang zh-CN>顺序保证变量注入先于依赖 var() 的预览渲染。</lang>
    // <lang en>Order ensures vars are injected before var()-dependent previews render.</lang>
    applyRuntimeTheme();syncInputs();renderPrimaryCandidates();renderSecondaryCandidates();renderGradients();renderPresetList();updateTokenOutputs();updatePreviewMeta();
    // `W-tb-P9` 首轮渲染：字体/间距操作台、经典 mock、TDON 占位、预览类型（默认）与导出文件树。
    // <lang zh-CN>applyPreviewMode 内部联动导出 Tab；经典 mock 依赖已注入变量，置于其后。</lang>
    // <lang en>applyPreviewMode links the export tabs; classic mocks need injected vars, hence placed after.</lang>
    renderTypography();renderClassicPreview();renderTdonPreview();applyPreviewMode('default');renderExportTree();
    // `W-tb-P10` 首轮渲染：市场子 Tab（默认本地）、远程源列表与分享 hash 还原。
    // <lang zh-CN>restoreFromHash 须在表单/渐变/候选初始化之后执行；还原后清 hash 防刷新重复。</lang>
    // <lang en>restoreFromHash runs after form/gradient/candidate init; the hash is stripped to avoid re-restore.</lang>
    loadRemoteSources();applyMarketTab('local');restoreFromHash();renderHarmony();
    // 探索面板初始渲染（无 explorer 时隐藏）。
    // <lang zh-CN>放在最后避免影响其他面板的首次布局。</lang>
    // <lang en>Rendered last to avoid disturbing other panels' first layout.</lang>
    renderExplore();
    // 进入默认视图：左右布局、浅色、PC 仪表盘、小程序首页。
    // <lang zh-CN>与原 HTML 初始呈现一致。</lang>
    // <lang en>Matches the original HTML's initial presentation.</lang>
    applyLayout('sidebar');applyAppearance('light');switchPcPage('dashboard');switchWxPage('home');
    // 最后注册事件，避免首渲染期间触发重复绑定。
    // <lang zh-CN>bind 只调用一次。</lang>
    // <lang en>bind runs exactly once.</lang>
    bind();
  }
  boot();

  // 返回控制句柄：宿主可读取草稿/主题、应用外部草稿；dispose 当前为空（无定时器/订阅需清理）。
  // <lang zh-CN>applyDraft 会重算候选并刷新全界面，便于外部原生面板驱动。</lang>
  // <lang en>applyDraft recomputes candidates and refreshes the UI, enabling external native-panel driving.</lang>
  return{
    getDraft:()=>createThemeDraft(draft),
    getTheme:()=>theme(),
    applyDraft(next){
      draft=createThemeDraft(next);
      // 字体/间距令牌保持操作台全局状态（与 applyPreset 同策略）。
      // <lang zh-CN>外部草稿不携带令牌组时以当前令牌状态接管。</lang>
      // <lang en>External drafts without token groups adopt the current token state.</lang>
      attachTokensToDraft();
      primaryMeta=findMatchingPrimaryCandidate(draft,primaryCandidates)||null;
      secondaryCandidates=secondarySetForDraft(draft,primaryMeta);
      syncInputs();applyRuntimeTheme();renderPrimaryCandidates();renderSecondaryCandidates();renderGradients();updateTokenOutputs();updatePreviewMeta();
    },
    dispose(){}
  };
}
