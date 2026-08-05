/**
 * @lang zh-CN 网址取色的信号与结果类型：采集端提供原始信号，分析端产出主副色候选与置信度。
 * @lang en Signal and result types for URL color extraction: collector supplies raw signals, analyzer emits primary/secondary candidates with confidence.
 */

import type { SecondaryCandidate } from '../color/harmony.js';

/** @lang zh-CN 单个 CSS 变量的语义信号。 @lang en One CSS-variable semantic signal. */
export interface CssVarSignal {
  /** @lang zh-CN 变量名（如 --primary-color）。 @lang en Variable name (e.g. --primary-color). */
  name: string;
  /** @lang zh-CN 变量色 HEX。 @lang en Variable color HEX. */
  hex: string;
}

/** @lang zh-CN 一个 DOM 颜色观察：最终样式色、出现频次与区域权重标签。 @lang en One DOM color observation: resolved style color, frequency and region-weight tag. */
export interface DomColorSignal {
  /** @lang zh-CN 颜色 HEX。 @lang en Color HEX. */
  hex: string;
  /** @lang zh-CN 出现频次（像素/元素计数）。 @lang en Occurrence frequency (pixel/element count). */
  count: number;
  /** @lang zh-CN 区域权重标签：brand/header/nav/button/link/banner/general。 @lang en Region weight tag: brand/header/nav/button/link/banner/general. */
  region: 'brand' | 'header' | 'nav' | 'button' | 'link' | 'banner' | 'general';
}

/** @lang zh-CN 截图聚类的颜色块。 @lang en One screenshot-clustered color block. */
export interface ScreenshotColorSignal {
  /** @lang zh-CN 颜色 HEX。 @lang en Color HEX. */
  hex: string;
  /** @lang zh-CN 占比（0–1）。 @lang en Area ratio (0–1). */
  ratio: number;
}

/** @lang zh-CN 采集端提供的全部信号。 @lang en All signals supplied by the collector. */
export interface ExtractSignals {
  cssVars?: CssVarSignal[];
  domColors?: DomColorSignal[];
  screenshotColors?: ScreenshotColorSignal[];
}

/** @lang zh-CN 单个候选色的综合得分结果。 @lang en One candidate color with composite score. */
export interface ScoredColor {
  hex: string;
  /** @lang zh-CN 综合分（已归一参考）。 @lang en Composite score (normalized reference). */
  score: number;
  /** @lang zh-CN 命中信号来源（用于解释）。 @lang en Hit signal sources (for explanation). */
  sources: string[];
}

/** @lang zh-CN 主副色候选结果（含置信度）。 @lang en Primary/secondary candidate result with confidence. */
export interface ExtractResult {
  primary: ScoredColor;
  /** @lang zh-CN 副色候选（可能为 null，当无足够区分度时）。 @lang en Secondary candidate (null when insufficient contrast). */
  secondary: ScoredColor | null;
  /** @lang zh-CN 主色置信度 0–1。 @lang en Primary confidence 0–1. */
  primaryConfidence: number;
  /** @lang zh-CN 副色置信度 0–1；无副色时为 0。 @lang en Secondary confidence 0–1; 0 when absent. */
  secondaryConfidence: number;
  /** @lang zh-CN 主色建议动作：auto/confirm/manual（与阈值对应）。 @lang en Suggested primary action: auto/confirm/manual (mapped to thresholds). */
  action: 'auto' | 'confirm' | 'manual';
  /** @lang zh-CN 备选颜色列表（前若干）。 @lang en Alternative colors list (top few). */
  alternatives: ScoredColor[];
}
