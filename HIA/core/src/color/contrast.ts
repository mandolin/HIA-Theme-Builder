/**
 * @lang zh-CN 对比度与可读前景色：基于 WCAG 相对亮度计算，为主/副色选择最佳文字色。
 * @lang en Contrast and readable foreground: WCAG relative luminance to choose the best text color on primary/secondary.
 */

import { hexToRgb, srgbToLinear } from './convert.js';

/**
 * @lang zh-CN 计算 HEX 的相对亮度（WCAG），用于对比度。内部复用 sRGB 线性解码。
 * @lang en Compute WCAG relative luminance of a HEX (used for contrast). Reuses sRGB linear decode internally.
 */
export function luminance(hex: string): number {
  // <lang zh-CN>对三通道做 gamma 解码后按感知权重求和。</lang>
  // <lang en>Gamma-decode channels then weight-sum by perceptual coefficients.</lang>
  const [r, g, b] = hexToRgb(hex).map(srgbToLinear);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/**
 * @lang zh-CN 计算两色 WCAG 对比度（≥1，越大越易读）。
 * @lang en Compute WCAG contrast between two colors (≥1, higher is more readable).
 */
export function contrast(a: string, b: string): number {
  // <lang zh-CN>取两色亮度并按从大到小排序，套用 (L1+0.05)/(L2+0.05)。</lang>
  // <lang en>Sort the two luminances descending and apply (L1+0.05)/(L2+0.05).</lang>
  const arr = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (arr[0] + 0.05) / (arr[1] + 0.05);
}

/**
 * @lang zh-CN 在主色上选择可读性最佳的前景色：白或深蓝灰，返回 HEX 与对比度。
 * @lang en Choose the most readable foreground on a color: white or dark slate; returns HEX and the contrast ratio.
 */
export function bestOnColor(hex: string): { hex: string; label: string; ratio: number } {
  // <lang zh-CN>分别算与白、深蓝灰的对比度，取较大者作为前景。</lang>
  // <lang en>Compute contrast vs white and dark slate, take the larger as foreground.</lang>
  const white = contrast(hex, '#FFFFFF');
  const dark = contrast(hex, '#0F172A');
  return white >= dark
    ? { hex: '#FFFFFF', label: '白色文字', ratio: white }
    : { hex: '#0F172A', label: '深色文字', ratio: dark };
}
