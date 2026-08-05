/**
 * @lang zh-CN @hia/theme-core 公共 API 出口。各端只需从此处导入，避免依赖内部路径。
 * @lang en @hia/theme-core public API entry. Ends import only from here to avoid internal-path coupling.
 */

// 类型
export type {
  ColorScale,
  RoleColor,
  GradientConfig,
  GradientSettings,
  Theme,
  ThemeInput,
  PrimaryCandidate,
  Preset,
  HarmonyDef
} from './types.js';

// 颜色算法
export {
  normalizeHex,
  validHex,
  hexToRgb,
  rgbToHex,
  rgbToOklab,
  oklabToRgb,
  hexToOklch,
  oklchToRgb,
  inGamut,
  gamutMapOklch,
  srgbToLinear
} from './color/convert.js';
export { tonalScale } from './color/scale.js';
export {
  HARMONY_DEFS,
  harmonyCandidate,
  generateSecondarySet
} from './color/harmony.js';
export type { SecondaryCandidate } from './color/harmony.js';
export { luminance, contrast, bestOnColor } from './color/contrast.js';

// 数据
export { primaryCandidates } from './data/primaryCandidates.js';
export { builtinPresets } from './data/presets.js';
export { GRADIENT_DEFS, GRADIENT_DEFAULTS, cloneGradientSettings } from './data/gradients.js';

// Token 导出
export { exportThemeCss } from './token/css.js';
export { exportThemeJson } from './token/json.js';

// 主题整合
export { buildTheme } from './theme.js';

// 网址取色分析（多信号加权，纯函数，供三端共用）
export { analyzeTheme } from './analyze/analyze.js';
export type {
  ExtractSignals,
  ScoredColor,
  ExtractResult,
  CssVarSignal,
  DomColorSignal,
  ScreenshotColorSignal
} from './analyze/types.js';
