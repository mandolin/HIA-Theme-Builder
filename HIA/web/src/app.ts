/**
 * @lang zh-CN 仅依赖 DOM 的共享操作台渲染器。主题模型、颜色算法、渐变、预设与令牌导出均来自 @hia/theme-core，
 *   使浏览器 / Electron / Tauri 复用同一套领域实现；本文件只负责把状态映射到界面并绑定交互。
 * @lang en DOM-only shared studio renderer. Theme models, color algorithms, gradients, presets and token export come from @hia/theme-core,
 *   so Browser/Electron/Tauri share one domain implementation; this file only maps state to the UI and binds interactions.
 */
import{
  GRADIENT_DEFAULTS,GRADIENT_DEFS,autoThemeName,buildThemeFromDraft,builtinPresets,
  cloneGradientSettings,createRuntimeCssVariables,createThemeDraft,draftFromPreset,
  exportThemeCss,exportThemeJson,filterPresets,findMatchingPrimaryCandidate,generateSecondarySet,
  gradientCss,isBuiltinPresetId,mergePresets,normalizeHex,parseGradientSettings,parseThemeLibrary,
  presetFromDraft,primaryCandidates,removePreset,secondarySetForDraft,serializeThemeLibrary,
  upsertPreset,validHex,type Theme,type ThemeDraft,type Preset,type PrimaryCandidate,type SecondaryCandidate,type GradientBias,type ShadeKey,
  type WebsiteThemeAnalysisV2
}from'@hia/theme-core';
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
// 色阶下拉选项：由深到浅排列，符合选色直觉。
// <lang zh-CN>与 SHADE_KEYS 同值，仅顺序不同（UI 偏好深→浅）。</lang>
// <lang en>Same values as SHADE_KEYS but ordered dark→light for UI preference.</lang>
const shadeValues:ShadeKey[]=['900','800','700','600','500','400','300','200','100','50'];
// 渐变方向选项（CSS 角度）。
// <lang zh-CN>覆盖常用对角线与水平/垂直方向。</lang>
// <lang en>Covers common diagonal and horizontal/vertical directions.</lang>
const directions=['45deg','90deg','110deg','120deg','135deg','160deg','180deg'] as const;
// 方向的中文标签（带箭头示意）。
// <lang zh-CN>提升下拉可读性，避免纯角度难以理解。</lang>
// <lang en>Improves dropdown readability versus bare angles.</lang>
const directionLabels:Record<string,string>={'45deg':'↗ 45°','90deg':'→ 90°','110deg':'↘ 110°','120deg':'↘ 120°','135deg':'↘ 135°','160deg':'↘ 160°','180deg':'↓ 180°'};
// 渐变占比选项。
// <lang zh-CN>对应 GradientBias 四种策略。</lang>
// <lang en>Maps to the four GradientBias strategies.</lang>
const biasValues:GradientBias[]=['front75','front65','end65','end75'];
// 占比的中文标签。
// <lang zh-CN>解释前/后色在渐变中的主导比例。</lang>
// <lang en>Explains how much the start/end color dominates the gradient.</lang>
// 占比标签：渲染时经 t() 现算（键=中文原文），保证语言切换后立即生效。
// <lang zh-CN>不能在模块加载时固化——那会锁定初始语言。</lang>
// <lang en>Must not be fixed at module load — that would freeze the initial locale.</lang>
function biasLabelsNow():Record<GradientBias,string>{return{front75:t('前色占 75%'),front65:t('前色占 65%'),end65:t('后色占 65%'),end75:t('后色占 75%')};}
// 交换起止色时对应的占比翻转映射。
// <lang zh-CN>前色主导翻为后色主导，保持视觉权重一致。</lang>
// <lang en>Front-dominant flips to end-dominant, keeping visual weight consistent.</lang>
const swappedBias:Record<GradientBias,GradientBias>={front75:'end75',front65:'end65',end65:'front65',end75:'front75'};

// 转义 HTML 特殊字符，防止插入用户/候选文本时产生 XSS。
// <lang zh-CN>用于所有动态拼入 innerHTML 的字符串。</lang>
// <lang en>Used for every dynamic string injected into innerHTML.</lang>
function escapeHtml(value:unknown):string{return String(value??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]??ch));}
// 生成 <option> 列表字符串，current 项标记 selected，labels 提供可读文案。
// <lang zh-CN>复用于分类、色系、方向、色阶、占比等所有下拉。</lang>
// <lang en>Reused by every dropdown: category, family, direction, shade, bias.</lang>
function options(values:readonly string[],current:string,labels:Record<string,string>={}){return values.map(v=>`<option value="${v}" ${v===current?'selected':''}>${labels[v]||v}</option>`).join('');}

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

  // 由当前草稿构建完整主题（用于渲染/导出）。
  // <lang zh-CN>每次调用都会重新计算色阶，确保与草稿同步。</lang>
  // <lang en>Recomputes scales each call so it stays in sync with the draft.</lang>
  function theme():Theme{return buildThemeFromDraft(draft);}
  // 合并内置与自定义预设，作为列表与查找的完整来源。
  // <lang zh-CN>内置在前，自定义在后。</lang>
  // <lang en>Built-ins first, custom after.</lang>
  function getAllPresets():Preset[]{return mergePresets(builtinPresets,customPresets);}
  // 持久化自定义预设到平台存储。
  // <lang zh-CN>序列化前会规范化基色，保证读写一致。</lang>
  // <lang en>Base colors are normalized before serialization for consistent round-trips.</lang>
  function saveCustomPresets(){platform.storage.setItem(THEME_STORAGE,serializeThemeLibrary(customPresets));}
  // 持久化当前渐变设置到平台存储（独立于预设库）。
  // <lang zh-CN>确保渐变编辑不依赖预设保存也能跨会话保留。</lang>
  // <lang en>Ensures gradient edits persist across sessions even without saving a preset.</lang>
  function saveGradients(){platform.storage.setItem(GRADIENT_STORAGE,JSON.stringify(draft.gradients));}

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
    setText('activePresetName',draft.name);
    setText('activePresetMeta',`${draft.category} · ${draft.industry||'未指定行业'}`);
    setText('activePresetColors',`${draft.primary} / ${draft.secondary}`);
    setText('wxThemeBadge',draft.name);
    setText('wxDetailThemeName',draft.name);
    setText('detailThemeName',draft.name);
    setText('settingsThemeName',draft.name);
    setText('settingsPrimary',draft.primary);
    setText('settingsSecondary',draft.secondary);
    // 布局/外观文案随模式切换更新。
    // <lang zh-CN>把枚举映射为中文标签。</lang>
    // <lang en>Maps enums to Chinese labels.</lang>
    setText('settingsLayout',layoutMode==='sidebar'?t('左右结构'):layoutMode==='top'?t('上下结构'):t('混合工作台'));
    setText('settingsAppearance',appearanceMode==='light'?'浅色':'深色');
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
  // <lang zh-CN>色卡含色样、标签、中英文名、HEX 与推荐副色配对；所有动态文本经 escapeHtml。</lang>
  // <lang en>Cards show swatch, tag, zh/en names, HEX and recommended secondary; all dynamic text is escaped.</lang>
  function renderPrimaryCandidates(){
    // 按 group 把候选分组，便于展示“蓝色基准/获奖网站”等区块。
    // <lang zh-CN>分组键来自候选数据的 group 字段。</lang>
    // <lang en>Group key comes from each candidate's group field.</lang>
    const groups:Record<string,PrimaryCandidate[]>={};
    primaryCandidates.forEach(c=>(groups[c.group]||(groups[c.group]=[])).push(c));
    const wrap=byId<HTMLElement>('primaryCandidatesWrap');
    // 逐组拼出标题与色卡网格；active 类标记当前选中的主色。
    // <lang zh-CN>normalizeHex 比较保证大小写/格式差异下高亮正确。</lang>
    // <lang en>normalizeHex comparison keeps highlighting correct despite case/format differences.</lang>
    wrap.innerHTML=Object.entries(groups).map(([group,items])=>`<div class="group-title">${escapeHtml(group)} · ${items.length}</div><div class="grid-3">${items.map(c=>`<button class="color-card ${normalizeHex(c.hex)===draft.primary?'active':''}" data-primary="${escapeHtml(c.id)}" title="${escapeHtml(c.desc)}"><div class="color-top" style="background:${c.hex}"><span>${escapeHtml(c.tag)}</span></div><h4>${escapeHtml(c.name)}</h4><div class="color-meta">${escapeHtml(c.en)}</div><div class="color-hex">${c.hex}</div><span class="pair-chip"><i style="background:${c.hex}"></i><i style="background:${c.secondaryHex}"></i>${escapeHtml(c.secondaryName)}</span></button>`).join('')}</div>`).join('');
    // 每个色卡绑定点击：切主色、套用其推荐副色并刷新全局面板。
    // <lang zh-CN>点击后更新 primaryMeta、草稿基色与名称，并生成副色候选集。</lang>
    // <lang en>On click updates primaryMeta, draft base colors and name, then regenerates secondary candidates.</lang>
    all<HTMLButtonElement>('[data-primary]',wrap).forEach(btn=>btn.addEventListener('click',()=>{
      const c=primaryCandidates.find(x=>x.id===btn.dataset.primary);if(!c)return;
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
      // 以候选的推荐副色作为置顶项生成副色候选集。
      // <lang zh-CN>保证选主色后副色候选与预设配对一致。</lang>
      // <lang en>Keeps secondary candidates aligned with the preset pairing after picking a primary.</lang>
      secondaryCandidates=generateSecondarySet(c.hex,{hex:c.secondaryHex,name:c.secondaryName,scheme:c.secondaryScheme});
      syncInputs();applyCurrentTheme(false);renderSecondaryCandidates();renderPrimaryCandidates();
      setText('generateStatus',`主色已切换为 ${c.name} ${c.hex}，已自动套用预设副色 ${c.secondaryName} ${c.secondaryHex}。`);
    }));
  }

  // 渲染副色候选面板：展示当前副色候选集，当前副色高亮，点击即应用。
  // <lang zh-CN>首个候选通常为推荐副色；色卡含配色方案、中英文名与 HEX。</lang>
  // <lang en>First candidate is usually the recommended one; cards show scheme, zh/en names and HEX.</lang>
  function renderSecondaryCandidates(){
    const wrap=byId<HTMLElement>('secondaryCandidatesWrap');
    // 逐候选生成色卡，active 标记当前副色（normalizeHex 比较）。
    // <lang zh-CN>title 用 note 说明该副色来源/特点。</lang>
    // <lang en>title uses note to explain the candidate's origin/character.</lang>
    wrap.innerHTML=secondaryCandidates.map(c=>`<button class="color-card ${normalizeHex(c.hex)===draft.secondary?'active':''}" data-secondary="${escapeHtml(c.id)}" title="${escapeHtml(c.note)}"><div class="color-top" style="background:${c.hex}"><span>${escapeHtml(c.scheme)}</span></div><h4>${escapeHtml(c.name)}</h4><div class="color-meta">${escapeHtml(c.en)}</div><div class="color-hex">${c.hex}</div></button>`).join('');
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
    wrap.innerHTML=GRADIENT_DEFS.map(def=>{const cfg=draft.gradients[def.key];return`<div class="gradient-config-card" data-gradient-key="${def.key}"><div class="gradient-config-title"><strong>${t(def.label)}</strong><label><input type="checkbox" data-gradient-field="enabled" ${cfg.enabled!==false?'checked':''}>${t('启用')}</label></div><div class="gradient-config-desc">${t(def.desc)}</div><div class="gradient-config-preview" data-gradient-preview="${def.key}" style="background:${gradientCss(cfg,'runtime',theme())}"></div><div class="gradient-config-grid"><label class="gradient-field"><span>${t('色系')}</span><select class="gradient-select" data-gradient-field="family">${options(['primary','secondary'],cfg.family,{primary:t('主色系'),secondary:t('副色系')})}</select></label><label class="gradient-field"><span>${t('方向')}</span><select class="gradient-select" data-gradient-field="direction">${options(directions,cfg.direction,directionLabels)}</select></label><label class="gradient-field"><span>${t('起始色阶')}</span><select class="gradient-select" data-gradient-field="start">${options(shadeValues,cfg.start)}</select></label><label class="gradient-field"><span>${t('结束色阶')}</span><select class="gradient-select" data-gradient-field="end">${options(shadeValues,cfg.end)}</select></label><label class="gradient-field" style="grid-column:1/-1"><span>${t('渐变占比')}</span><select class="gradient-select" data-gradient-field="bias">${options(biasValues,cfg.bias,biasLabelsNow())}</select></label></div><div class="gradient-config-footer"><span class="gradient-config-code" data-gradient-code="${def.key}">${cfg.family==='primary'?t('主色'):t('副色')} ${cfg.start} → ${cfg.end}</span><div class="gradient-mini-actions"><button class="gradient-mini-btn" data-gradient-swap>${t('交换')}</button><button class="gradient-mini-btn" data-gradient-reset>${t('重置')}</button></div></div></div>`;}).join('');
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
        case'family':if(el.value==='primary'||el.value==='secondary')cfg.family=el.value;else return;break;
        // 起始色阶：仅接受合法 ShadeKey。
        // <lang zh-CN>非法阶名忽略。</lang>
        // <lang en>Illegal step names ignored.</lang>
        case'start':if(shadeValues.includes(el.value as ShadeKey))cfg.start=el.value as ShadeKey;else return;break;
        // 结束色阶：同起始色阶校验。
        // <lang zh-CN>对称处理。</lang>
        // <lang en>Symmetric handling.</lang>
        case'end':if(shadeValues.includes(el.value as ShadeKey))cfg.end=el.value as ShadeKey;else return;break;
        // 方向：接受任意字符串（CSS 角度）。
        // <lang zh-CN>用于 linear-gradient 的方向参数。</lang>
        // <lang en>Feeds the linear-gradient direction argument.</lang>
        case'direction':cfg.direction=el.value;break;
        // 占比：仅接受四种合法 GradientBias。
        // <lang zh-CN>非法忽略，保持渲染分支完备。</lang>
        // <lang en>Illegal ignored so the render switch stays exhaustive.</lang>
        case'bias':if(biasValues.includes(el.value as GradientBias))cfg.bias=el.value as GradientBias;else return;break;
        default:return;
      }
      // 变更后刷新预览、持久化、令牌与面板自身。
      // <lang zh-CN>重渲染本面板以同步预览与说明文字。</lang>
      // <lang en>Re-renders the panel to sync preview and captions.</lang>
      applyRuntimeTheme();saveGradients();updateTokenOutputs();renderGradients();
    }));
    // 交换按钮：起止色阶互换，并翻转占比（保持视觉权重一致）。
    // <lang zh-CN>如 front75 ↔ end75，避免交换后占比与方向错位。</lang>
    // <lang en>E.g. front75 ↔ end75, avoiding weight/ direction mismatch after swap.</lang>
    all<HTMLButtonElement>('[data-gradient-swap]',wrap).forEach(btn=>btn.addEventListener('click',()=>{
      const key=btn.closest<HTMLElement>('[data-gradient-key]')?.dataset.gradientKey;if(!key)return;
      const cfg=draft.gradients[key];if(!cfg)return;
      [cfg.start,cfg.end]=[cfg.end,cfg.start];
      cfg.bias=swappedBias[cfg.bias];
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
    wrap.innerHTML=list.map(p=>`<div class="preset-card"><div class="preset-head"><div><div class="preset-name">${escapeHtml(p.name)}</div><div class="small">${escapeHtml(p.category)} · ${escapeHtml(p.industry||'未分类')}</div></div>${selectedPresetId===p.id?'<span class="badge">当前</span>':''}</div><div class="preset-swatch"><i style="background:${p.primary}"></i><i style="background:${p.secondary}"></i></div><div class="small" style="margin-top:8px">${escapeHtml(p.primaryName)} / ${escapeHtml(p.secondaryName)}</div><div class="small" style="margin-top:4px">${escapeHtml(p.note||'')}</div><div class="preset-actions"><button class="btn primary" data-apply-preset="${escapeHtml(p.id)}" style="padding:8px 10px">${t('应用')}</button><button class="btn outline" data-load-preset="${escapeHtml(p.id)}" style="padding:8px 10px">${t('载入操作台')}</button>${!isBuiltinPresetId(p.id)?`<button class="btn ghost" data-delete-preset="${escapeHtml(p.id)}" style="padding:8px 10px;color:var(--danger)">${t('删除')}</button>`:''}</div></div>`).join('');
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
    // 应用按钮：用推荐主副色覆盖草稿并刷新全界面（显式点击，遵循高置信不静默覆盖）。
    // <lang zh-CN>始终需用户主动确认；应用后仍可被后续“取色器/候选”改动撤销。</lang>
    // <lang en>Always an explicit confirm; later picker/candidate edits can still override.</lang>
    byId<HTMLButtonElement>('exploreApplyBtn').addEventListener('click',()=>{
      if(!primary)return;
      draft.primary=normalizeHex(primary.hex);
      if(secondary)draft.secondary=normalizeHex(secondary.hex);
      draft.primaryName=primary.role==='brand'?'提取主色':'提取主色';
      draft.secondaryName=secondary?'提取副色':'副色';
      draft.name=inputValue('themeNameInput').trim()||autoThemeName(draft.primaryName,draft.secondaryName);
      syncInputs();applyCurrentTheme(false);
      setText('generateStatus',`已应用网址取色结果（主色 ${draft.primary}${secondary?` / 副色 ${draft.secondary}`:''}）。`);
    });
  }

  // 应用预设到操作台：标记选中、载入草稿、重算副色候选并刷新全界面。
  // <lang zh-CN>同时持久化当前渐变（独立键），并回显主色候选来源。</lang>
  // <lang en>Also persists current gradients (separate key) and re-shows the primary candidate source.</lang>
  function applyPreset(id:string|undefined){
    if(!id)return;
    const p=getAllPresets().find(x=>x.id===id);
    if(!p)return;
    selectedPresetId=id;
    draft=draftFromPreset(p);
    saveGradients();
    // 尝试匹配主色候选，以决定副色候选集是否置顶推荐副色。
    // <lang zh-CN>命中则 primaryMeta 非空，副色候选与预设配对一致。</lang>
    // <lang en>On hit, primaryMeta is non-null so secondary candidates align with the preset.</lang>
    primaryMeta=findMatchingPrimaryCandidate(draft,primaryCandidates)||null;
    secondaryCandidates=secondarySetForDraft(draft,primaryMeta);
    syncInputs();applyRuntimeTheme();renderGradients();updateTokenOutputs();updatePreviewMeta();
    renderPrimaryCandidates();renderSecondaryCandidates();renderPresetList();
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
  // 切换 PC 预览页面标签：高亮激活页、隐藏其余、显示目标页并更新标题/面包屑。
  // <lang zh-CN>titles 给出“标题/面包屑”中英或中中对照。</lang>
  // <lang en>titles provides title/crumb text pairs.</lang>
  function switchPcPage(page:'dashboard'|'list'|'form'|'detail'|'analytics'|'settings'){
    all<HTMLButtonElement>('#pcPageTabs .tab').forEach(btn=>btn.classList.toggle('active',btn.dataset.page===page));
    all<HTMLElement>('.pc-page').forEach(el=>el.style.display='none');
    byId<HTMLElement>('pcPage-'+page).style.display='block';
    const titles:Record<typeof page,[string,string]>={dashboard:['项目运行总览','仪表盘'],list:['用户与业务列表','列表页'],form:['主题表单示例','表单页'],detail:['项目详情','详情页'],analytics:['分析页示例','分析页'],settings:['系统设置','设置页']};
    setText('pcPageTitle',titles[page][0]);
    setText('pcPageCrumb',titles[page][1]);
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
      // <lang zh-CN>复用同一渲染链，保证语言切换后所有面板与翻译同步。</lang>
      // <lang en>Reuses the same render chain so every panel re-renders in the new locale.</lang>
      syncInputs();renderPrimaryCandidates();renderSecondaryCandidates();renderGradients();renderPresetList();updateTokenOutputs();updatePreviewMeta();renderExplore();
      byId<HTMLButtonElement>('langToggleBtn').textContent=t('lang.switch');
      document.documentElement.lang=next;
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
      setText('generateStatus',`已针对 ${name} ${hex} 生成 ${secondaryCandidates.length} 个副色候选。`);
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
    // HEX 输入 → 取色器：实时规范化并回填，合法时同步拾色器。
    // <lang zh-CN>限制长度避免溢出，validHex 通过才更新拾色器值。</lang>
    // <lang en>Caps length to avoid overflow; only updates the picker when validHex passes.</lang>
    byId<HTMLInputElement>('primaryHexInput').addEventListener('input',e=>{const target=e.currentTarget as HTMLInputElement,v=normalizeHex(target.value);if(v.length<=7)target.value=v;if(validHex(v))byId<HTMLInputElement>('primaryPicker').value=v;});
    byId<HTMLInputElement>('secondaryHexInput').addEventListener('input',e=>{const target=e.currentTarget as HTMLInputElement,v=normalizeHex(target.value);if(v.length<=7)target.value=v;if(validHex(v))byId<HTMLInputElement>('secondaryPicker').value=v;});
    // 预设搜索/分类：即时过滤列表。
    // <lang zh-CN>输入即筛选，无需额外按钮。</lang>
    // <lang en>Filters live as you type; no extra button needed.</lang>
    byId('presetSearchInput').addEventListener('input',renderPresetList);
    byId('presetFilterSelect').addEventListener('change',renderPresetList);
    // PC 布局分段：点击切换到 sidebar/top/mixed。
    // <lang zh-CN>仅接受合法枚举值。</lang>
    // <lang en>Only accepts legal enum values.</lang>
    all<HTMLButtonElement>('#pcLayoutSwitch .seg').forEach(btn=>btn.addEventListener('click',()=>{const mode=btn.dataset.layout;if(mode==='sidebar'||mode==='top'||mode==='mixed')applyLayout(mode);}));
    // 外观分段：点击切换 light/dark。
    // <lang zh-CN>与开关状态保持同步。</lang>
    // <lang en>Stays in sync with the toggle state.</lang>
    all<HTMLButtonElement>('#appearanceSwitch .seg').forEach(btn=>btn.addEventListener('click',()=>{const mode=btn.dataset.appearance;if(mode==='light'||mode==='dark')applyAppearance(mode);}));
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
    secondaryCandidates=secondarySetForDraft(draft,primaryMeta);
    // 首轮渲染：运行时变量、表单、候选、渐变、预设、令牌、元信息。
    // <lang zh-CN>顺序保证变量注入先于依赖 var() 的预览渲染。</lang>
    // <lang en>Order ensures vars are injected before var()-dependent previews render.</lang>
    applyRuntimeTheme();syncInputs();renderPrimaryCandidates();renderSecondaryCandidates();renderGradients();renderPresetList();updateTokenOutputs();updatePreviewMeta();
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
      primaryMeta=findMatchingPrimaryCandidate(draft,primaryCandidates)||null;
      secondaryCandidates=secondarySetForDraft(draft,primaryMeta);
      syncInputs();applyRuntimeTheme();renderPrimaryCandidates();renderSecondaryCandidates();renderGradients();updateTokenOutputs();updatePreviewMeta();
    },
    dispose(){}
  };
}
