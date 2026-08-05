/**
 * @lang zh-CN 公共主题模型类型定义。所有跨端共享的主题数据结构在此声明。
 * @lang en Public theme model type definitions. All cross-end shared theme data structures are declared here.
 */

/**
 * @lang zh-CN 单个颜色的色阶映射，键为 50/100/…/900，值为 HEX 字符串。
 * @lang en Tonal scale map for a single color; keys are 50/100/…/900, values are HEX strings.
 */
export interface ColorScale {
  /** @lang zh-CN 50 最浅阶。 @lang en 50 lightest shade. */
  '50': string;
  '100': string;
  '200': string;
  '300': string;
  '400': string;
  '500': string;
  '600': string;
  '700': string;
  '800': string;
  '900': string;
}

/**
 * @lang zh-CN 单个角色色（主色或副色）的完整描述，包含名称、原始值与派生色阶。
 * @lang en Full description of one role color (primary or secondary), with name, raw value and derived scale.
 */
export interface RoleColor {
  /** @lang zh-CN 人类可读的中文/英文名称。 @lang en Human-readable name (zh-CN/en). */
  name: string;
  /** @lang zh-CN 该角色的原始输入色（通常为 500 阶对应的 HEX）。 @lang en Raw input color (usually the 500-shade HEX). */
  value: string;
  /** @lang zh-CN 由 value 派生的 50–900 色阶。 @lang en 50–900 tonal scale derived from value. */
  scale: ColorScale;
  /** @lang zh-CN 在该色上可读性最佳的前景色（白或深蓝灰）。 @lang en Best readable foreground (white or dark slate) on this color. */
  on: string;
}

/**
 * @lang zh-CN 渐变配置项，对应一个命名渐变角色（轮播、Banner、文字卡片等）。
 * @lang en Gradient configuration for one named gradient role (carousel, banner, text card, etc.).
 */
export interface GradientConfig {
  /** @lang zh-CN 是否启用该渐变。 @lang en Whether the gradient is enabled. */
  enabled: boolean;
  /** @lang zh-CN 取色来源：主色系或副色系。 @lang en Color source: primary or secondary family. */
  family: 'primary' | 'secondary';
  /** @lang zh-CN 起始色阶（50–900）。 @lang en Start shade (50–900). */
  start: string;
  /** @lang zh-CN 结束色阶（50–900）。 @lang en End shade (50–900). */
  end: string;
  /** @lang zh-CN 渐变方向角度，如 135deg。 @lang en Gradient direction angle, e.g. 135deg. */
  direction: string;
  /** @lang zh-CN 占比偏好：前色占大头或后色占大头。 @lang en Bias preference: front or end color dominates. */
  bias: 'front75' | 'front65' | 'end65' | 'end75';
}

/**
 * @lang zh-CN 全局渐变设置，键为渐变角色 key。
 * @lang en Global gradient settings; key is gradient role key.
 */
export interface GradientSettings {
  [key: string]: GradientConfig;
}

/**
 * @lang zh-CN 完整主题对象，由 buildTheme 产出，是各端渲染与导出的统一输入。
 * @lang en Full theme object produced by buildTheme; the unified input for all end rendering and export.
 */
export interface Theme {
  /** @lang zh-CN 主题名称。 @lang en Theme name. */
  name: string;
  /** @lang zh-CN 主题分类。 @lang en Theme category. */
  category: string;
  /** @lang zh-CN 行业标签（可空）。 @lang en Industry tag (may be empty). */
  industry: string;
  /** @lang zh-CN 主色角色。 @lang en Primary role color. */
  primary: RoleColor;
  /** @lang zh-CN 副色角色。 @lang en Secondary role color. */
  secondary: RoleColor;
  /** @lang zh-CN 全局渐变设置。 @lang en Global gradient settings. */
  gradients: GradientSettings;
  /** @lang zh-CN 备注说明（可空）。 @lang en Free-form note (may be empty). */
  note?: string;
}

/**
 * @lang zh-CN 构建主题的最小输入；其余字段由算法派生。
 * @lang en Minimal input to build a theme; remaining fields are derived by algorithm.
 */
export interface ThemeInput {
  /** @lang zh-CN 主题名称（可空，缺省由主副色名合成）。 @lang en Theme name (optional; synthesized from role names by default). */
  name?: string;
  /** @lang zh-CN 主题分类，默认 custom。 @lang en Theme category, default custom. */
  category?: string;
  /** @lang zh-CN 行业标签，默认空。 @lang en Industry tag, default empty. */
  industry?: string;
  /** @lang zh-CN 主色 HEX（必填）。 @lang en Primary HEX (required). */
  primary: string;
  /** @lang zh-CN 副色 HEX（必填）。 @lang en Secondary HEX (required). */
  secondary: string;
  /** @lang zh-CN 主色名称，默认“主色”。 @lang en Primary name, default "主色". */
  primaryName?: string;
  /** @lang zh-CN 副色名称，默认“副色”。 @lang en Secondary name, default "副色". */
  secondaryName?: string;
  /** @lang zh-CN 渐变设置（可空，缺省用全局默认）。 @lang en Gradient settings (optional; global defaults used if omitted). */
  gradients?: GradientSettings;
  /** @lang zh-CN 备注（可空）。 @lang en Note (optional). */
  note?: string;
}

/**
 * @lang zh-CN 主色候选库的单项结构。
 * @lang en One entry of the primary color candidate library.
 */
export interface PrimaryCandidate {
  id: string;
  name: string;
  en: string;
  hex: string;
  tag: string;
  group: string;
  desc: string;
  secondaryName: string;
  secondaryHex: string;
  secondaryScheme: string;
  category: string;
}

/**
 * @lang zh-CN 主题预设项结构（内置或用户自定义）。
 * @lang en Theme preset entry (built-in or user-defined).
 */
export interface Preset {
  id: string;
  name: string;
  category: string;
  industry: string;
  primary: string;
  secondary: string;
  primaryName: string;
  secondaryName: string;
  note: string;
  gradients?: GradientSettings;
}

/**
 * @lang zh-CN 副色和谐生成的候选定义（类比/互补/三角等方案）。
 * @lang en Secondary harmony candidate definition (analogous/complementary/triad schemes).
 */
export interface HarmonyDef {
  id: string;
  name: string;
  en: string;
  scheme: string;
  offset: number;
  L?: number;
  C?: number;
  note: string;
}
