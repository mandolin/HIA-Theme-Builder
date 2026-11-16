/**
 * @lang zh-CN API 面快照单测（`W-tb-P43` / ADR-016）：锁定 `@hia/theme-core` 的公开导出清单。
 *   任何新增/删除/重命名导出都会使本测试失败——新增是**有意的加性变更**，须同步更新快照并
 *   在 ADR-016 附录登记。快照基线 = v0.7.0（142 个导出）。
 *
 *   维护方式：跑一次 `node --test test/api-surface.test.mjs`，失败信息会给出实际导出清单——
 *   确认变更是有意的，把新清单粘回 EXPECTED_API_SURFACE，并在 ADR-016 附录记一行。
 *
 * @lang en API surface snapshot tests (`W-tb-P43` / ADR-016): lock the public export list of
 *   `@hia/theme-core`. Any added/removed/renamed export fails this test — additions are **deliberate
 *   additive changes** and must update the snapshot and be recorded in the ADR-016 appendix. The baseline
 *   is v0.7.0 (142 exports).
 *
 *   Maintenance: run the test once; the failure prints the actual list — confirm the change is intentional,
 *   paste the new list into EXPECTED_API_SURFACE, and log one line in the ADR-016 appendix.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import * as core from '../dist/index.js';

// 冻结基线（v0.7.0，ADR-016 决策 1）。按字母序维护，与 Object.keys().sort() 对齐。
// <lang en>Frozen baseline (v0.7.0, ADR-016 decision 1). Keep alphabetical, matching Object.keys().sort().</lang>
const EXPECTED_API_SURFACE = [
  'AUXILIARY_MAX', 'BAODIAN_FORM_NAMES', 'BAODIAN_PALETTE', 'BRAND_COLORS', 'CVD_LABELS',
  'DEFAULT_SPACING', 'DEFAULT_THEME_DRAFT', 'DEFAULT_TYPOGRAPHY', 'EDITOR_THEME_GENERATORS',
  'EXPORT_TARGETS', 'FLAG_COLORS', 'FONT_SIZE_STEPS', 'FORM_PACKS', 'GRADIENT_DEFAULTS',
  'GRADIENT_DEFS', 'HARMONY_DEFS', 'HUE_NAMES', 'IMAGE_EXTRACT_CLUSTERS', 'IMAGE_EXTRACT_MAX_DIM',
  'MACHADO_2009_SEV1', 'MODIFIER_NAMES', 'MOOD_PRIMARY_COLORS', 'NATURE_COLORS', 'RADIUS_DEFAULTS',
  'SEMANTIC_HUES', 'SEMANTIC_NAMES', 'SERIES_RELATION_DEFS', 'SHADE_KEYS', 'SHADOW_DEFAULTS',
  'SOCIAL_COLORS', 'THEME_PACK_MAX_PRESETS', 'TONE_AUX_SLOTS', 'TONE_DEFAULT_PRIORITY',
  'TONE_FORM_PRIORITY', 'TONE_MOODS', 'TRADITIONAL_COLORS', 'analyzeTheme', 'analyzeThemeV2',
  'anchorComboMembers', 'apcaLc', 'apcaY', 'autoThemeName', 'bestOnColor', 'buildSharePayload',
  'buildTheme', 'buildThemeFromDraft', 'buildTonePreset', 'builtinPresets', 'clamp',
  'cloneGradientSettings', 'cloneRadiusTokens', 'cloneSemanticTokens', 'cloneShadowTokens',
  'cloneSpacing', 'cloneTypography', 'clusterEvidence', 'collectCustomShades', 'commentSafe',
  'contrast', 'contrastMatrix', 'createRuntimeCssVariables', 'createThemeDraft', 'decodeShareHash',
  'deriveSecondaryByRelation', 'deriveSemanticTokens', 'deriveThirdByRelation', 'downsamplePixels',
  'draftFromPreset', 'dtcgExportTarget', 'emacsTheme', 'encodeShareHash', 'exportDtcgTokens',
  'exportGradientVariableLines', 'exportThemeCss', 'exportThemeJson', 'extractImagePalette',
  'filterPresets', 'findEditorThemeGenerator', 'findMatchingPrimaryCandidate', 'fontSizeAt',
  'gamutMapOklch', 'generateAuxiliaryCandidates', 'generateSecondarySet', 'getExportTarget',
  'getSeriesRelationDef', 'gradientCss', 'gradientDominantColor', 'gradientStops', 'harmonyCandidate',
  'hexToOklch', 'hexToRgb', 'hueNameFor', 'inGamut', 'injectTemplateTarget', 'isBuiltinPresetId',
  'isSemanticDerived', 'linearToSrgb', 'listExportTargets', 'luminance', 'mergeImportedPresets',
  'mergePresets', 'modifierFor', 'moodPrimaryColorFor', 'nameColor', 'normalizeHex', 'oklabToRgb',
  'oklchToRgb', 'parseDtcgTokens', 'parseGradientSettings', 'parseThemeLibrary', 'parseThemePack',
  'presetFromDraft', 'primaryCandidates', 'radiusSequence', 'removePreset', 'rgbToHex', 'rgbToOklab',
  'sanitizePreset', 'secondarySetForDraft', 'serializeThemeLibrary', 'shadowCss', 'shiftHueTo',
  'simulateCvd', 'slugifyThemeName', 'spacingSequence', 'srgbToLinear', 'stepForContrast',
  'suggestGradientDirection', 'swapGradientBias', 'tailwindConfigTarget', 'tailwindV4Target',
  'textmateTheme', 'toV2Signals', 'tonalScale', 'tonalScaleAt', 'tonePresets',
  'typographySpacingVars', 'upsertPreset', 'validHex', 'vimTheme', 'vscodeTheme',
  'wordpressChildTarget'
];

test('API 面：公开导出与冻结基线逐符号一致（ADR-016）', () => {
  const actual = Object.keys(core).sort();
  const expected = [...EXPECTED_API_SURFACE].sort();
  const added = actual.filter(n => !expected.includes(n));
  const removed = expected.filter(n => !actual.includes(n));
  // 分列报错，便于"确认有意 → 更新快照"的维护流程。
  // <lang en>Report additions and removals separately to support the "confirm intentional → update
  //   snapshot" maintenance flow.</lang>
  assert.deepEqual(
    { added, removed },
    { added: [], removed: [] },
    `API 面偏离冻结基线——新增（加性变更，更新快照并登记 ADR-016 附录）：${added.join(',') || '无'}；` +
    `删除/重命名（破坏性，走 major）：${removed.join(',') || '无'}`
  );
  assert.equal(actual.length, EXPECTED_API_SURFACE.length);
});
