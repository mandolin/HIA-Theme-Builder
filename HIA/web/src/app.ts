/**
 * DOM-only shared renderer. Theme models, color algorithms, gradients, presets and token export
 * are imported from @hia/theme-core so Browser/Electron/Tauri share the same domain implementation.
 */
import{
  GRADIENT_DEFAULTS,GRADIENT_DEFS,autoThemeName,buildThemeFromDraft,builtinPresets,
  cloneGradientSettings,createRuntimeCssVariables,createThemeDraft,draftFromPreset,
  exportThemeCss,exportThemeJson,filterPresets,findMatchingPrimaryCandidate,generateSecondarySet,
  gradientCss,isBuiltinPresetId,mergePresets,normalizeHex,parseGradientSettings,parseThemeLibrary,
  presetFromDraft,primaryCandidates,removePreset,secondarySetForDraft,serializeThemeLibrary,
  upsertPreset,validHex,type Theme,type ThemeDraft,type Preset,type PrimaryCandidate,type SecondaryCandidate,type GradientBias,type ShadeKey
}from'@hia/theme-core';
import{all,byId,inputValue,setInputValue,setText}from'./dom.js';
import type{ThemeManagerPlatform}from'./platform.js';

export interface ThemeManagerHandle{getDraft():ThemeDraft;getTheme():Theme;applyDraft(draft:ThemeDraft):void;dispose():void;}

const THEME_STORAGE='hia-theme-manager-presets-v1';
const GRADIENT_STORAGE='hia-gradient-settings-v1';
const shadeValues:ShadeKey[]=['900','800','700','600','500','400','300','200','100','50'];
const directions=['45deg','90deg','110deg','120deg','135deg','160deg','180deg'] as const;
const directionLabels:Record<string,string>={'45deg':'↗ 45°','90deg':'→ 90°','110deg':'↘ 110°','120deg':'↘ 120°','135deg':'↘ 135°','160deg':'↘ 160°','180deg':'↓ 180°'};
const biasValues:GradientBias[]=['front75','front65','end65','end75'];
const biasLabels:Record<GradientBias,string>={front75:'前色占 75%',front65:'前色占 65%',end65:'后色占 65%',end75:'后色占 75%'};
const swappedBias:Record<GradientBias,GradientBias>={front75:'end75',front65:'end65',end65:'front65',end75:'front75'};

function escapeHtml(value:unknown):string{return String(value??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]??ch));}
function options(values:readonly string[],current:string,labels:Record<string,string>={}){return values.map(v=>`<option value="${v}" ${v===current?'selected':''}>${labels[v]||v}</option>`).join('');}

export function mountThemeManager(platform:ThemeManagerPlatform):ThemeManagerHandle{
  let draft=createThemeDraft();
  let selectedPresetId='preset-default';
  let primaryMeta:PrimaryCandidate|null=primaryCandidates.find(x=>x.id==='cobalt')||null;
  let secondaryCandidates:SecondaryCandidate[]=[];
  let customPresets:Preset[]=[];
  let layoutMode:'sidebar'|'top'|'mixed'='sidebar';
  let appearanceMode:'light'|'dark'='light';

  function theme():Theme{return buildThemeFromDraft(draft);}
  function getAllPresets():Preset[]{return mergePresets(builtinPresets,customPresets);}
  function saveCustomPresets(){platform.storage.setItem(THEME_STORAGE,serializeThemeLibrary(customPresets));}
  function saveGradients(){platform.storage.setItem(GRADIENT_STORAGE,JSON.stringify(draft.gradients));}

  function applyRuntimeTheme(){
    const vars=createRuntimeCssVariables(theme());
    Object.entries(vars).forEach(([key,value])=>document.documentElement.style.setProperty(key,value));
    GRADIENT_DEFS.forEach(def=>{
      const cfg=draft.gradients[def.key];
      const preview=document.querySelector<HTMLElement>(`[data-gradient-preview="${def.key}"]`);
      if(preview)preview.style.background=gradientCss(cfg,'runtime',theme());
      const code=document.querySelector<HTMLElement>(`[data-gradient-code="${def.key}"]`);
      if(code)code.textContent=`${cfg.family==='primary'?'主色':'副色'} ${cfg.start} → ${cfg.end}`;
    });
  }

  function syncInputs(){
    setInputValue('themeNameInput',draft.name||autoThemeName(draft.primaryName,draft.secondaryName));
    const category=byId<HTMLSelectElement>('themeCategoryInput');
    category.value=Array.from(category.options).some(x=>x.value===draft.category)?draft.category:'custom';
    setInputValue('primaryPicker',draft.primary);setInputValue('secondaryPicker',draft.secondary);
    setInputValue('primaryHexInput',draft.primary);setInputValue('secondaryHexInput',draft.secondary);
    setInputValue('primaryNameInput',draft.primaryName);setInputValue('secondaryNameInput',draft.secondaryName);
  }

  function readInputs(updateName=true):boolean{
    const primary=normalizeHex(inputValue('primaryHexInput'));
    const secondary=normalizeHex(inputValue('secondaryHexInput'));
    if(!validHex(primary)){platform.alert('主色色值无效，请输入 6 位 HEX。');return false;}
    if(!validHex(secondary)){platform.alert('副色色值无效，请输入 6 位 HEX。');return false;}
    draft.primary=primary;draft.secondary=secondary;
    draft.primaryName=inputValue('primaryNameInput').trim()||draft.primaryName||'主色';
    draft.secondaryName=inputValue('secondaryNameInput').trim()||draft.secondaryName||'副色';
    draft.category=inputValue('themeCategoryInput')||draft.category||'custom';
    if(updateName)draft.name=inputValue('themeNameInput').trim()||autoThemeName(draft.primaryName,draft.secondaryName);
    else draft.name=inputValue('themeNameInput').trim()||draft.name;
    return true;
  }

  function updateTokenOutputs(){
    const current=theme(),css=exportThemeCss(current);
    setInputValue('cssTokenOutput',css);setInputValue('jsonTokenOutput',exportThemeJson(current));setText('pcTokenPreview',css);
  }

  function updatePreviewMeta(){
    setText('activePresetName',draft.name);setText('activePresetMeta',`${draft.category} · ${draft.industry||'未指定行业'}`);
    setText('activePresetColors',`${draft.primary} / ${draft.secondary}`);setText('wxThemeBadge',draft.name);
    setText('wxDetailThemeName',draft.name);setText('detailThemeName',draft.name);setText('settingsThemeName',draft.name);
    setText('settingsPrimary',draft.primary);setText('settingsSecondary',draft.secondary);
    setText('settingsLayout',layoutMode==='sidebar'?'左右结构':layoutMode==='top'?'上下结构':'混合工作台');
    setText('settingsAppearance',appearanceMode==='light'?'浅色':'深色');
  }

  function applyCurrentTheme(updateName=true){
    if(!readInputs(updateName))return;
    applyRuntimeTheme();syncInputs();updateTokenOutputs();updatePreviewMeta();renderPrimaryCandidates();renderSecondaryCandidates();
  }

  function renderPrimaryCandidates(){
    const groups:Record<string,PrimaryCandidate[]>={};primaryCandidates.forEach(c=>(groups[c.group]||(groups[c.group]=[])).push(c));
    const wrap=byId<HTMLElement>('primaryCandidatesWrap');
    wrap.innerHTML=Object.entries(groups).map(([group,items])=>`<div class="group-title">${escapeHtml(group)} · ${items.length}</div><div class="grid-3">${items.map(c=>`<button class="color-card ${normalizeHex(c.hex)===draft.primary?'active':''}" data-primary="${escapeHtml(c.id)}" title="${escapeHtml(c.desc)}"><div class="color-top" style="background:${c.hex}"><span>${escapeHtml(c.tag)}</span></div><h4>${escapeHtml(c.name)}</h4><div class="color-meta">${escapeHtml(c.en)}</div><div class="color-hex">${c.hex}</div><span class="pair-chip"><i style="background:${c.hex}"></i><i style="background:${c.secondaryHex}"></i>${escapeHtml(c.secondaryName)}</span></button>`).join('')}</div>`).join('');
    all<HTMLButtonElement>('[data-primary]',wrap).forEach(btn=>btn.addEventListener('click',()=>{
      const c=primaryCandidates.find(x=>x.id===btn.dataset.primary);if(!c)return;
      primaryMeta=c;draft.primary=normalizeHex(c.hex);draft.secondary=normalizeHex(c.secondaryHex);
      draft.primaryName=c.name;draft.secondaryName=c.secondaryName;draft.category=c.category||'custom';
      draft.name=inputValue('themeNameInput').trim()||autoThemeName(c.name,c.secondaryName);
      secondaryCandidates=generateSecondarySet(c.hex,{hex:c.secondaryHex,name:c.secondaryName,scheme:c.secondaryScheme});
      syncInputs();applyCurrentTheme(false);renderSecondaryCandidates();renderPrimaryCandidates();
      setText('generateStatus',`主色已切换为 ${c.name} ${c.hex}，已自动套用预设副色 ${c.secondaryName} ${c.secondaryHex}。`);
    }));
  }

  function renderSecondaryCandidates(){
    const wrap=byId<HTMLElement>('secondaryCandidatesWrap');
    wrap.innerHTML=secondaryCandidates.map(c=>`<button class="color-card ${normalizeHex(c.hex)===draft.secondary?'active':''}" data-secondary="${escapeHtml(c.id)}" title="${escapeHtml(c.note)}"><div class="color-top" style="background:${c.hex}"><span>${escapeHtml(c.scheme)}</span></div><h4>${escapeHtml(c.name)}</h4><div class="color-meta">${escapeHtml(c.en)}</div><div class="color-hex">${c.hex}</div></button>`).join('');
    all<HTMLButtonElement>('[data-secondary]',wrap).forEach(btn=>btn.addEventListener('click',()=>{
      const c=secondaryCandidates.find(x=>x.id===btn.dataset.secondary);if(!c)return;
      draft.secondary=normalizeHex(c.hex);draft.secondaryName=c.name;syncInputs();applyCurrentTheme(false);renderSecondaryCandidates();
    }));
  }

  function renderGradients(){
    draft.gradients=cloneGradientSettings(draft.gradients);const wrap=byId<HTMLElement>('gradientSettingsGrid');
    wrap.innerHTML=GRADIENT_DEFS.map(def=>{const cfg=draft.gradients[def.key];return`<div class="gradient-config-card" data-gradient-key="${def.key}"><div class="gradient-config-title"><strong>${def.label}</strong><label><input type="checkbox" data-gradient-field="enabled" ${cfg.enabled!==false?'checked':''}>启用</label></div><div class="gradient-config-desc">${def.desc}</div><div class="gradient-config-preview" data-gradient-preview="${def.key}" style="background:${gradientCss(cfg,'runtime',theme())}"></div><div class="gradient-config-grid"><label class="gradient-field"><span>色系</span><select class="gradient-select" data-gradient-field="family">${options(['primary','secondary'],cfg.family,{primary:'主色系',secondary:'副色系'})}</select></label><label class="gradient-field"><span>方向</span><select class="gradient-select" data-gradient-field="direction">${options(directions,cfg.direction,directionLabels)}</select></label><label class="gradient-field"><span>起始色阶</span><select class="gradient-select" data-gradient-field="start">${options(shadeValues,cfg.start)}</select></label><label class="gradient-field"><span>结束色阶</span><select class="gradient-select" data-gradient-field="end">${options(shadeValues,cfg.end)}</select></label><label class="gradient-field" style="grid-column:1/-1"><span>渐变占比</span><select class="gradient-select" data-gradient-field="bias">${options(biasValues,cfg.bias,biasLabels)}</select></label></div><div class="gradient-config-footer"><span class="gradient-config-code" data-gradient-code="${def.key}">${cfg.family==='primary'?'主色':'副色'} ${cfg.start} → ${cfg.end}</span><div class="gradient-mini-actions"><button class="gradient-mini-btn" data-gradient-swap>交换</button><button class="gradient-mini-btn" data-gradient-reset>重置</button></div></div></div>`;}).join('');
    all<HTMLInputElement|HTMLSelectElement>('[data-gradient-field]',wrap).forEach(el=>el.addEventListener('change',()=>{
      const card=el.closest<HTMLElement>('[data-gradient-key]');
      const key=card?.dataset.gradientKey,field=el.dataset.gradientField;
      if(!key||!field)return;
      const cfg=draft.gradients[key];if(!cfg)return;
      switch(field){
        case'enabled':cfg.enabled=(el as HTMLInputElement).checked;break;
        case'family':if(el.value==='primary'||el.value==='secondary')cfg.family=el.value;else return;break;
        case'start':if(shadeValues.includes(el.value as ShadeKey))cfg.start=el.value as ShadeKey;else return;break;
        case'end':if(shadeValues.includes(el.value as ShadeKey))cfg.end=el.value as ShadeKey;else return;break;
        case'direction':cfg.direction=el.value;break;
        case'bias':if(biasValues.includes(el.value as GradientBias))cfg.bias=el.value as GradientBias;else return;break;
        default:return;
      }
      applyRuntimeTheme();saveGradients();updateTokenOutputs();renderGradients();
    }));
    all<HTMLButtonElement>('[data-gradient-swap]',wrap).forEach(btn=>btn.addEventListener('click',()=>{const key=btn.closest<HTMLElement>('[data-gradient-key]')?.dataset.gradientKey;if(!key)return;const cfg=draft.gradients[key];if(!cfg)return;[cfg.start,cfg.end]=[cfg.end,cfg.start];cfg.bias=swappedBias[cfg.bias];applyRuntimeTheme();saveGradients();updateTokenOutputs();renderGradients();}));
    all<HTMLButtonElement>('[data-gradient-reset]',wrap).forEach(btn=>btn.addEventListener('click',()=>{const key=btn.closest<HTMLElement>('[data-gradient-key]')?.dataset.gradientKey;if(!key)return;draft.gradients[key]={...GRADIENT_DEFAULTS[key]};applyRuntimeTheme();saveGradients();updateTokenOutputs();renderGradients();}));
  }

  function renderPresetList(){
    const list=filterPresets(getAllPresets(),inputValue('presetSearchInput'),inputValue('presetFilterSelect'));setText('presetCount',String(getAllPresets().length));
    const wrap=byId<HTMLElement>('presetList');
    wrap.innerHTML=list.map(p=>`<div class="preset-card"><div class="preset-head"><div><div class="preset-name">${escapeHtml(p.name)}</div><div class="small">${escapeHtml(p.category)} · ${escapeHtml(p.industry||'未分类')}</div></div>${selectedPresetId===p.id?'<span class="badge">当前</span>':''}</div><div class="preset-swatch"><i style="background:${p.primary}"></i><i style="background:${p.secondary}"></i></div><div class="small" style="margin-top:8px">${escapeHtml(p.primaryName)} / ${escapeHtml(p.secondaryName)}</div><div class="small" style="margin-top:4px">${escapeHtml(p.note||'')}</div><div class="preset-actions"><button class="btn primary" data-apply-preset="${escapeHtml(p.id)}" style="padding:8px 10px">应用</button><button class="btn outline" data-load-preset="${escapeHtml(p.id)}" style="padding:8px 10px">载入操作台</button>${!isBuiltinPresetId(p.id)?`<button class="btn ghost" data-delete-preset="${escapeHtml(p.id)}" style="padding:8px 10px;color:var(--danger)">删除</button>`:''}</div></div>`).join('');
    all<HTMLButtonElement>('[data-apply-preset]',wrap).forEach(btn=>btn.addEventListener('click',()=>applyPreset(btn.dataset.applyPreset)));
    all<HTMLButtonElement>('[data-load-preset]',wrap).forEach(btn=>btn.addEventListener('click',()=>applyPreset(btn.dataset.loadPreset)));
    all<HTMLButtonElement>('[data-delete-preset]',wrap).forEach(btn=>btn.addEventListener('click',()=>deletePreset(btn.dataset.deletePreset)));
  }

  function makePreset(id=`custom-${platform.now()}`){readInputs(true);return presetFromDraft(draft,id);}
  function savePreset(){const p=makePreset();customPresets=upsertPreset(customPresets,p);saveCustomPresets();selectedPresetId=p.id;draft=draftFromPreset(p);renderPresetList();updatePreviewMeta();}
  function updatePreset(){if(isBuiltinPresetId(selectedPresetId)){platform.alert('当前选中的是内置预设，不能直接覆盖。请另存为自定义主题。');return;}if(!customPresets.some(x=>x.id===selectedPresetId)){platform.alert('未找到当前自定义预设。');return;}const p=makePreset(selectedPresetId);customPresets=upsertPreset(customPresets,p);saveCustomPresets();draft=draftFromPreset(p);renderPresetList();updatePreviewMeta();}
  function deletePreset(id:string|undefined){if(!id)return;customPresets=removePreset(customPresets,id);saveCustomPresets();if(selectedPresetId===id)selectedPresetId='preset-default';renderPresetList();}
  function applyPreset(id:string|undefined){if(!id)return;const p=getAllPresets().find(x=>x.id===id);if(!p)return;selectedPresetId=id;draft=draftFromPreset(p);saveGradients();primaryMeta=findMatchingPrimaryCandidate(draft,primaryCandidates)||null;secondaryCandidates=secondarySetForDraft(draft,primaryMeta);syncInputs();applyRuntimeTheme();renderGradients();updateTokenOutputs();updatePreviewMeta();renderPrimaryCandidates();renderSecondaryCandidates();renderPresetList();}

  function applyLayout(mode:'sidebar'|'top'|'mixed'){layoutMode=mode;all<HTMLButtonElement>('#pcLayoutSwitch .seg').forEach(btn=>btn.classList.toggle('active',btn.dataset.layout===mode));byId<HTMLElement>('pcContent').className='pc-content '+(mode==='sidebar'?'pc-layout-sidebar':mode==='top'?'pc-layout-top':'pc-layout-mixed');byId<HTMLElement>('pcSidebar').style.display=mode==='sidebar'?'block':'none';byId<HTMLElement>('pcRail').style.display=mode==='mixed'?'grid':'none';byId<HTMLElement>('pcTopNav').style.display=mode==='top'?'flex':'none';setText('layoutModeLabel',mode==='sidebar'?'左右结构':mode==='top'?'上下结构':'混合工作台');updatePreviewMeta();}
  function applyAppearance(mode:'light'|'dark'){appearanceMode=mode;all<HTMLButtonElement>('#appearanceSwitch .seg').forEach(btn=>btn.classList.toggle('active',btn.dataset.appearance===mode));byId<HTMLElement>('pcShell').classList.toggle('dark',mode==='dark');byId<HTMLElement>('wxFrame').classList.toggle('dark',mode==='dark');setText('appearanceModeLabel',mode==='light'?'浅色模式':'深色模式');byId<HTMLInputElement>('settingsDarkToggle').checked=mode==='dark';updatePreviewMeta();}
  function switchPcPage(page:'dashboard'|'list'|'form'|'detail'|'analytics'|'settings'){all<HTMLButtonElement>('#pcPageTabs .tab').forEach(btn=>btn.classList.toggle('active',btn.dataset.page===page));all<HTMLElement>('.pc-page').forEach(el=>el.style.display='none');byId<HTMLElement>('pcPage-'+page).style.display='block';const titles:Record<typeof page,[string,string]>={dashboard:['项目运行总览','仪表盘'],list:['用户与业务列表','列表页'],form:['主题表单示例','表单页'],detail:['项目详情','详情页'],analytics:['分析页示例','分析页'],settings:['系统设置','设置页']};setText('pcPageTitle',titles[page][0]);setText('pcPageCrumb',titles[page][1]);}
  function switchWxPage(page:'home'|'list'|'detail'|'profile'|'form'){all<HTMLButtonElement>('#wxPageTabs .seg').forEach(btn=>btn.classList.toggle('active',btn.dataset.wxPage===page));all<HTMLElement>('.wx-page').forEach(el=>el.classList.add('hidden'));byId<HTMLElement>('wxPage-'+page).classList.remove('hidden');}
  async function copy(value:string):Promise<void>{try{await platform.clipboard.writeText(value);}catch{platform.alert('复制失败，请手动复制。');}}

  function bind(){
    byId('generateSecondaryBtn').addEventListener('click',()=>{const hex=normalizeHex(inputValue('primaryHexInput')),name=inputValue('primaryNameInput').trim()||'主色',preferred=primaryMeta&&normalizeHex(primaryMeta.hex)===hex?{hex:primaryMeta.secondaryHex,name:primaryMeta.secondaryName,scheme:primaryMeta.secondaryScheme}:null;secondaryCandidates=generateSecondarySet(hex,preferred);renderSecondaryCandidates();setText('generateStatus',`已针对 ${name} ${hex} 生成 ${secondaryCandidates.length} 个副色候选。`);});
    byId('applyThemeBtn').addEventListener('click',()=>applyCurrentTheme(true));byId('savePresetBtn').addEventListener('click',()=>{applyCurrentTheme(true);savePreset();});byId('updatePresetBtn').addEventListener('click',()=>{applyCurrentTheme(true);updatePreset();});
    byId('autoNameBtn').addEventListener('click',()=>{const name=autoThemeName(inputValue('primaryNameInput').trim(),inputValue('secondaryNameInput').trim());setInputValue('themeNameInput',name);draft.name=name;updatePreviewMeta();});
    byId<HTMLInputElement>('primaryPicker').addEventListener('input',e=>setInputValue('primaryHexInput',(e.currentTarget as HTMLInputElement).value.toUpperCase()));byId<HTMLInputElement>('secondaryPicker').addEventListener('input',e=>setInputValue('secondaryHexInput',(e.currentTarget as HTMLInputElement).value.toUpperCase()));
    byId<HTMLInputElement>('primaryHexInput').addEventListener('input',e=>{const target=e.currentTarget as HTMLInputElement,v=normalizeHex(target.value);if(v.length<=7)target.value=v;if(validHex(v))byId<HTMLInputElement>('primaryPicker').value=v;});byId<HTMLInputElement>('secondaryHexInput').addEventListener('input',e=>{const target=e.currentTarget as HTMLInputElement,v=normalizeHex(target.value);if(v.length<=7)target.value=v;if(validHex(v))byId<HTMLInputElement>('secondaryPicker').value=v;});
    byId('presetSearchInput').addEventListener('input',renderPresetList);byId('presetFilterSelect').addEventListener('change',renderPresetList);
    all<HTMLButtonElement>('#pcLayoutSwitch .seg').forEach(btn=>btn.addEventListener('click',()=>{const mode=btn.dataset.layout;if(mode==='sidebar'||mode==='top'||mode==='mixed')applyLayout(mode);}));
    all<HTMLButtonElement>('#appearanceSwitch .seg').forEach(btn=>btn.addEventListener('click',()=>{const mode=btn.dataset.appearance;if(mode==='light'||mode==='dark')applyAppearance(mode);}));
    all<HTMLButtonElement>('#pcPageTabs .tab').forEach(btn=>btn.addEventListener('click',()=>{const page=btn.dataset.page;if(page==='dashboard'||page==='list'||page==='form'||page==='detail'||page==='analytics'||page==='settings')switchPcPage(page);}));
    all<HTMLButtonElement>('#wxPageTabs .seg').forEach(btn=>btn.addEventListener('click',()=>{const page=btn.dataset.wxPage;if(page==='home'||page==='list'||page==='detail'||page==='profile'||page==='form')switchWxPage(page);}));
    byId('copyCssBtn').addEventListener('click',()=>copy(inputValue('cssTokenOutput')));byId('copyJsonBtn').addEventListener('click',()=>copy(inputValue('jsonTokenOutput')));byId<HTMLInputElement>('settingsDarkToggle').addEventListener('change',e=>applyAppearance((e.currentTarget as HTMLInputElement).checked?'dark':'light'));
    byId('resetAllGradientsBtn').addEventListener('click',()=>{draft.gradients=cloneGradientSettings(GRADIENT_DEFAULTS);applyRuntimeTheme();saveGradients();updateTokenOutputs();renderGradients();});byId<HTMLButtonElement>('toggleGradientPanelBtn').addEventListener('click',e=>{const panel=byId<HTMLElement>('gradientSettingsPanel');panel.classList.toggle('collapsed');(e.currentTarget as HTMLButtonElement).textContent=panel.classList.contains('collapsed')?'展开设置':'收起设置';});
  }

  function boot(){customPresets=parseThemeLibrary(platform.storage.getItem(THEME_STORAGE));draft.gradients=parseGradientSettings(platform.storage.getItem(GRADIENT_STORAGE));secondaryCandidates=secondarySetForDraft(draft,primaryMeta);applyRuntimeTheme();syncInputs();renderPrimaryCandidates();renderSecondaryCandidates();renderGradients();renderPresetList();updateTokenOutputs();updatePreviewMeta();applyLayout('sidebar');applyAppearance('light');switchPcPage('dashboard');switchWxPage('home');bind();}
  boot();
  return{getDraft:()=>createThemeDraft(draft),getTheme:()=>theme(),applyDraft(next){draft=createThemeDraft(next);primaryMeta=findMatchingPrimaryCandidate(draft,primaryCandidates)||null;secondaryCandidates=secondarySetForDraft(draft,primaryMeta);syncInputs();applyRuntimeTheme();renderPrimaryCandidates();renderSecondaryCandidates();renderGradients();updateTokenOutputs();updatePreviewMeta();},dispose(){}};
}
