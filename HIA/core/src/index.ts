/**
 * @lang zh-CN HIA 主题核心公共入口（barrel）。聚合导出类型、颜色算法、数据、渐变、主题构建与操作台 API。
 *   各端（web/electron/tauri）统一从此处按需引入，避免直连内部子模块。
 * @lang en HIA theme-core public entry (barrel). Re-exports types, color algorithms, data, gradients, theme building and studio API.
 *   Every runtime (web/electron/tauri) imports from here to avoid reaching into internal submodules.
 */

// 类型与常量导出。
// <lang zh-CN>类型用 export type 保留编译期隔离；SHADE_KEYS 为运行时常量。</lang>
// <lang en>Types use `export type` for compile-time isolation; SHADE_KEYS is a runtime constant.</lang>
export type{ColorScale,RoleColor,GradientConfig,GradientSettings,Theme,ThemeInput,PrimaryCandidate,Preset,HarmonyDef,ThemeDraft,ThemeLibraryDocument,CssVariableMap,ShadeKey,ColorFamily,GradientBias,TypographyTokens,SpacingTokens,SeriesMode,SeriesRelationId,AuxiliaryModifier}from'./types.js';
export{SHADE_KEYS}from'./types.js';

// 颜色转换与数学工具（HEX/RGB/OKLab/OKLCH 互转、色域映射、线性化）。
// <lang zh-CN>所有色彩计算的底层原语，均为纯函数。</lang>
// <lang en>Low-level color primitives (HEX/RGB/OKLab/OKLCH conversion, gamut mapping, linearization); all pure.</lang>
export{clamp,normalizeHex,validHex,hexToRgb,rgbToHex,rgbToOklab,oklabToRgb,hexToOklch,oklchToRgb,inGamut,gamutMapOklch,srgbToLinear,linearToSrgb}from'./color/convert.js';
// 由基色生成 10 级色阶。
// <lang zh-CN>主题色阶的唯一来源，输出已做色域校正。</lang>
// <lang en>Single source of tonal scales; output is gamut-corrected.</lang>
export{tonalScale,tonalScaleAt}from'./color/scale.js';
// 和谐配色定义与副色生成。
// <lang zh-CN>副色候选的理论依据与生成入口；SecondaryCandidate 为类型。</lang>
// <lang en>Harmony definitions and secondary generation; SecondaryCandidate is the type.</lang>
export{HARMONY_DEFS,harmonyCandidate,generateSecondarySet}from'./color/harmony.js';
export type{SecondaryCandidate}from'./color/harmony.js';
// 配色关系模式与辅助色（ADR-007 / `W-tb-P11`）：模式定义表与槽位生成。
// <lang zh-CN>generateAuxiliarySet 为纯函数（Theme 装配与 UI 重生成共用）。</lang>
// <lang en>Pure generator shared by Theme assembly and UI regeneration.</lang>
export{SERIES_RELATION_DEFS,getSeriesRelationDef,deriveSecondaryByRelation,deriveThirdByRelation,generateAuxiliaryCandidates,shiftHueTo,anchorComboMembers}from'./color/harmony.js';
export type{SeriesRelationDef}from'./color/harmony.js';
// 对比度与最佳前景色选择（WCAG 相对亮度）。
// <lang zh-CN>用于自动决定角色色上的文字用白还是深色。</lang>
// <lang en>Decides white vs dark foreground on a role color via WCAG relative luminance.</lang>
export{luminance,contrast,bestOnColor}from'./color/contrast.js';

// 数据：主色候选库、内置预设、渐变定义与默认配置。
// <lang zh-CN>候选库与预设为静态数据；GRADIENT_* 为渐变角色契约与默认值。</lang>
// <lang en>Static data: primary candidates and built-in presets; GRADIENT_* are gradient role contracts and defaults.</lang>
export{primaryCandidates}from'./data/primaryCandidates.js';
export{builtinPresets}from'./data/presets.js';
export{GRADIENT_DEFS,GRADIENT_DEFAULTS,cloneGradientSettings}from'./data/gradients.js';
// 配色宝典组合预设数据（`W-tb-P11` 数据工程）：97 色号表 + 10 形态 × 1067 组合。
// <lang zh-CN>数据文件自动抽取自配色宝典 CHM 源（抽取脚本留档 WorkZone 会话日志）；关系规则下拉的预设数据源。</lang>
// <lang en>Auto-extracted from the Peise Baodian CHM source; backs the relation-rule preset dropdown.</lang>
export{BAODIAN_PALETTE,FORM_PACKS,BAODIAN_FORM_NAMES}from'./data/palette-packs.js';
export type{BaodianCombo}from'./data/palette-packs.js';
export{tonePresets,buildTonePreset,TONE_MOODS,TONE_FORM_PRIORITY,TONE_DEFAULT_PRIORITY,TONE_AUX_SLOTS}from'./data/tone-presets.js';

// 渐变渲染：起止色停靠点、CSS 生成、运行时变量与导出变量行。
// <lang zh-CN>GradientRenderMode 区分运行时 var()、导出 var() 与字面量三种渲染。</lang>
// <lang en>GradientRenderMode switches between runtime var(), export var() and literal rendering.</lang>
export{gradientStops,gradientCss,gradientDominantColor,createRuntimeCssVariables,exportGradientVariableLines,swapGradientBias,collectCustomShades}from'./gradient/render.js';
export{DEFAULT_TYPOGRAPHY,DEFAULT_SPACING,fontSizeAt,spacingSequence,typographySpacingVars,FONT_SIZE_STEPS}from'./token/typography.js';
export type{FontSizeStep}from'./token/typography.js';
export type{GradientRenderMode}from'./gradient/render.js';
// 由主题输入构建完整主题。
// <lang zh-CN>连接 color/scale 与 studio 的顶层主题工厂。</lang>
// <lang en>Top-level theme factory linking color/scale and studio.</lang>
export{buildTheme,cloneTypography,cloneSpacing}from'./theme.js';

// 操作台状态层 API（草稿/预设/库读写）。
// <lang zh-CN>web 操作台与各端 UI 的主要调用面。</lang>
// <lang en>Primary call surface for the web studio and other runtimes' UIs.</lang>
export{DEFAULT_THEME_DRAFT,autoThemeName,createThemeDraft,draftFromPreset,buildThemeFromDraft,presetFromDraft,findMatchingPrimaryCandidate,secondarySetForDraft,mergePresets,filterPresets,upsertPreset,removePreset,isBuiltinPresetId,serializeThemeLibrary,parseThemeLibrary,parseGradientSettings}from'./studio.js';

// 令牌导出：CSS 自定义属性与 JSON 主题描述。
// <lang zh-CN>导出物供设计系统/小程序消费；analyzeTheme 提供网址取色分析。</lang>
// <lang en>Exports consumed by design systems / mini-programs; analyzeTheme provides URL color extraction.</lang>
// 分享链接与主题包（`W-tb-P10` / M-THEME-BUILDER-MARKET）：分享编解码 + 远程源/文件清洗合并。
// <lang zh-CN>均为纯函数（core 无 DOM/网络）；fetch 由 web 层完成。</lang>
// <lang en>All pure (no DOM/network in core); fetching belongs to the web layer.</lang>
export type{SharePayload}from'./share.js';
export{buildSharePayload,encodeShareHash,decodeShareHash}from'./share.js';
export{parseThemePack,mergeImportedPresets,sanitizePreset,THEME_PACK_MAX_PRESETS,AUXILIARY_MAX}from'./pack.js';
export{exportThemeCss}from'./token/css.js';
export{exportThemeJson}from'./token/json.js';
// 导出适配器：虚拟文件树目标注册表与三个内置适配器（`ADR-005` / `W-tb-P9`）。
// <lang zh-CN>适配器为纯函数（Theme → {path,content}[]）；ZIP 打包由各端 UI 层用 fflate 完成，core 无 IO。</lang>
// <lang en>Adapters are pure (Theme → {path,content}[]); ZIP packaging is done per-runtime with fflate in the UI layer — core stays IO-free.</lang>
export type{VirtualFile,ExportTarget,ExportAdapterOptions}from'./export/types.js';
export{EXPORT_TARGETS,getExportTarget,listExportTargets}from'./export/registry.js';
export{wordpressChildTarget}from'./export/wordpress.js';
export{tailwindConfigTarget}from'./export/tailwind.js';
export{injectTemplateTarget}from'./export/inject-template.js';
export{analyzeTheme}from'./analyze/analyze.js';
export type{ExtractSignals,ScoredColor,ExtractResult,CssVarSignal,DomColorSignal,ScreenshotColorSignal}from'./analyze/types.js';
// V2 契约与 V1→V2 兼容层（P0 建立，P1/P3 填充真实渲染实现）。
// <lang zh-CN>V2 为跨端取色分析的稳定可序列化契约。</lang>
// <lang en>V2 is the stable serializable contract for cross-end extraction analysis.</lang>
export type{ColorSource,SemanticRole,ColorEvidence,CaptureWarning,CaptureDiagnostics,WebsiteColorSignalsV2,ScoredColorV2,WebsiteThemeAnalysisV2}from'./analyze/types-v2.js';
export{toV2Signals}from'./analyze/v1-compat.js';
// V2 分析：OKLab 聚类 + role-aware 评分 + 主副色/置信度/alternatives（P3）。
// <lang zh-CN>P3 跨端共用的主题分析实现，输入 V2 信号，输出可读分析报告。</lang>
// <lang en>P3 cross-end theme analysis: takes V2 signals, emits explainable report.</lang>
export{analyzeThemeV2,clusterEvidence}from'./analyze/analyze-v2.js';
