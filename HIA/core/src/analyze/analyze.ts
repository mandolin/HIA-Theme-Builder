/**
 * @lang zh-CN 网址取色的多信号加权分析核心：把采集端信号综合为主副色候选与置信度。
 * 纯函数、可单测、无 DOM/网络依赖，供 web/electron/tauri 共用。
 * @lang en Multi-signal weighted analysis core for URL color extraction: fuse collector signals into primary/secondary candidates with confidence. Pure, testable, no DOM/network; shared by web/electron/tauri.
 */

import {
  normalizeHex,
  hexToOklch,
  validHex
} from '../color/convert.js';
import { contrast } from '../color/contrast.js';
import type {
  ExtractSignals,
  ScoredColor,
  ExtractResult,
  CssVarSignal,
  DomColorSignal,
  ScreenshotColorSignal
} from './types.js';

/** @lang zh-CN 语义关键词：变量名含这些词时权重最高。 @lang en Semantic keywords: variables with these words get top weight. */
const SEMANTIC_KEYWORDS = ['primary', 'secondary', 'accent', 'brand', 'theme', 'main', 'highlight', 'link', 'button'];

/** @lang zh-CN 区域权重：品牌/导航/按钮等区域比 general 更重要。 @lang en Region weights: brand/nav/button matter more than general. */
const REGION_WEIGHT: Record<DomColorSignal['region'], number> = {
  brand: 3,
  header: 1.6,
  nav: 1.5,
  button: 1.8,
  link: 1.2,
  banner: 1.4,
  general: 1
};

/** @lang zh-CN 中性/状态色 HEX（白/近白/黑/近黑/常见成功/警告/错误）。 @lang en Neutral/state colors (white/near-white/black/near-black/common success/warn/error). */
const NEUTRAL_OR_STATE = ['#FFFFFF', '#FCFCFC', '#0F172A', '#111827', '#16A34A', '#D97706', '#DC2626'];

/**
 * @lang zh-CN 判定是否中性/低彩/状态色，需降权或排除。
 * @lang en Decide whether a color is neutral/low-chroma/state, to penalize or exclude.
 */
function isNeutralOrState(hex: string): boolean {
  // <lang zh-CN>先归一，再对已知中性/状态色做精确匹配。</lang>
  // <lang en>Normalize first, then exact-match known neutral/state colors.</lang>
  const h = normalizeHex(hex);
  if (NEUTRAL_OR_STATE.includes(h)) return true;
  // <lang zh-CN>再按 OKLCH 彩度判断低彩中性（C 很小视为灰）。</lang>
  // <lang en>Then judge low-chroma neutral by OKLCH C (tiny C means gray).</lang>
  const { C } = hexToOklch(h);
  return C < 0.02;
}

/**
 * @lang zh-CN 对一个候选色的"主色适合度"打分：综合语义、DOM 频率、区域、截图占比，减去中性惩罚。
 * @lang en Score a candidate's "primary suitability": combine semantics, DOM frequency, region, screenshot ratio, minus neutral penalty.
 */
function scoreColor(hex: string, signals: ExtractSignals): { score: number; sources: string[] } {
  // <lang zh-CN>跳过非法或中性/状态色，直接给 0 分。</lang>
  // <lang en>Skip invalid or neutral/state colors with zero score.</lang>
  const h = normalizeHex(hex);
  if (!validHex(h) || isNeutralOrState(h)) return { score: 0, sources: [] };
  let score = 0;
  const sources: string[] = [];

  // <lang zh-CN>第一层：CSS 变量语义信号，命中关键词加分最高。</lang>
  // <lang en>Layer 1: CSS variable semantics; keyword hit gives top boost.</lang>
  (signals.cssVars || []).forEach((v: CssVarSignal) => {
    if (normalizeHex(v.hex) !== h) return;
    const lower = v.name.toLowerCase();
    if (SEMANTIC_KEYWORDS.some((k) => lower.includes(k))) {
      score += 5;
      sources.push('css-var:' + v.name);
    }
  });

  // <lang zh-CN>第二层：DOM 最终样式，按区域权重累加。</lang>
  // <lang en>Layer 2: DOM resolved styles, summed by region weight.</lang>
  (signals.domColors || []).forEach((d: DomColorSignal) => {
    if (normalizeHex(d.hex) !== h) return;
    score += d.count * 0.01 * REGION_WEIGHT[d.region];
    sources.push('dom:' + d.region);
  });

  // <lang zh-CN>第三层：截图像素占比（开方以抑制超大色块碾压）。</lang>
  // <lang en>Layer 3: screenshot area ratio (sqrt to avoid huge blocks dominating).</lang>
  (signals.screenshotColors || []).forEach((s: ScreenshotColorSignal) => {
    if (normalizeHex(s.hex) !== h) return;
    score += Math.sqrt(s.ratio) * 2;
    sources.push('screenshot');
  });

  return { score, sources };
}

/**
 * @lang zh-CN 汇总所有信号来源出现过的颜色，逐色打分并降序排序。
 * @lang en Collect all colors seen across signal sources, score each and sort descending.
 */
function rankColors(signals: ExtractSignals): ScoredColor[] {
  // <lang zh-CN>用归一 HEX 作为去重键，合并各来源同一色的分数。</lang>
  // <lang en>Use normalized HEX as dedup key, merging scores for the same color.</lang>
  const map = new Map<string, ScoredColor>();
  const add = (hex: string, partial: { score: number; sources: string[] }) => {
    const h = normalizeHex(hex);
    const prev = map.get(h);
    if (prev) {
      prev.score += partial.score;
      prev.sources.push(...partial.sources);
    } else {
      map.set(h, { hex: h, score: partial.score, sources: partial.sources });
    }
  };
  (signals.cssVars || []).forEach((v) => add(v.hex, scoreColor(v.hex, signals)));
  (signals.domColors || []).forEach((d) => add(d.hex, scoreColor(d.hex, signals)));
  (signals.screenshotColors || []).forEach((s) => add(s.hex, scoreColor(s.hex, signals)));
  return [...map.values()].sort((a, b) => b.score - a.score);
}

/**
 * @lang zh-CN 由主色与候选集选出副色：取分数次高且与主色有足够感知区分、且非中性/状态色的颜色。
 * @lang en Pick secondary from candidates: next-highest score, perceptually distinct from primary, non-neutral/state.
 */
function pickSecondary(primaryHex: string, ranked: ScoredColor[]): ScoredColor | null {
  // <lang zh-CN>主色 OKLCH 用于计算色相差与区分度。</lang>
  // <lang en>Primary OKLCH used to compute hue difference and distinctness.</lang>
  const p = hexToOklch(primaryHex);
  for (const c of ranked) {
    if (c.hex === normalizeHex(primaryHex)) continue;
    if (isNeutralOrState(c.hex)) continue;
    const o = hexToOklch(c.hex);
    // <lang zh-CN>色相差或明度差足够，即视为有区分度的副色候选。</lang>
    // <lang en>Sufficient hue or lightness gap means a distinct secondary candidate.</lang>
    const hueGap = Math.min(Math.abs(o.h - p.h), 360 - Math.abs(o.h - p.h));
    const lightGap = Math.abs(o.L - p.L);
    const distinct = hueGap > 25 || lightGap > 0.12;
    // <lang zh-CN>对比度也需可读（避免主副近乎同色导致界面浑浊）。</lang>
    // <lang en>Contrast must be readable to avoid muddy UI from near-identical colors.</lang>
    const readable = contrast(primaryHex, c.hex) > 1.6;
    if (distinct && readable) return c;
  }
  return null;
}

/**
 * @lang zh-CN 由信号集解析主副色候选与置信度。纯函数，供三端共用。
 * @lang en Resolve primary/secondary candidates and confidence from signals. Pure function shared by all ends.
 */
export function analyzeTheme(signals: ExtractSignals): ExtractResult {
  // <lang zh-CN>先汇总排序所有候选色。</lang>
  // <lang en>Rank all candidate colors first.</lang>
  const ranked = rankColors(signals);
  // <lang zh-CN>无候选时返回空结果（置信度 0、动作 manual）。</lang>
  // <lang en>No candidates yields empty result (confidence 0, action manual).</lang>
  if (ranked.length === 0 || ranked[0].score <= 0) {
    return {
      primary: { hex: '#0047AB', score: 0, sources: [] },
      secondary: null,
      primaryConfidence: 0,
      secondaryConfidence: 0,
      action: 'manual',
      alternatives: []
    };
  }
  const primary = ranked[0];
  const secondary = pickSecondary(primary.hex, ranked);

  // <lang zh-CN>置信度用最高分与次高分之差刻画：领先越多越可信。基准用 top（top>0）使单一语义主色可达 auto。</lang>
  // <lang en>Confidence from gap between top and second scores: larger lead = more可信. Base on top (top>0) so a sole semantic primary reaches auto.</lang>
  const top = primary.score;
  const second = ranked[1] ? ranked[1].score : 0;
  const gap = top - second;
  const primaryConfidence = top > 0 ? Math.max(0, Math.min(1, gap / top)) : 0;
  const secondaryConfidence = secondary && top > 0 ? Math.max(0, Math.min(1, (secondary.score / top) * 0.9)) : 0;

  // <lang zh-CN>动作阈值：≥0.8 自动；0.6–0.8 建议确认；否则仅显示候选。</lang>
  // <lang en>Action thresholds: ≥0.8 auto; 0.6–0.8 confirm; else manual.</lang>
  const action: ExtractResult['action'] =
    primaryConfidence >= 0.8 ? 'auto' : primaryConfidence >= 0.6 ? 'confirm' : 'manual';

  return {
    primary,
    secondary,
    primaryConfidence,
    secondaryConfidence,
    action,
    // <lang zh-CN>备选返回前 4 个（不含主色与副色）。</lang>
    // <lang en>Alternatives: top 4 excluding primary and secondary.</lang>
    alternatives: ranked.slice(1, 5)
  };
}
