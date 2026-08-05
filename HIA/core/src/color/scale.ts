/**
 * @lang zh-CN 由单个主/副色生成 50–900 色阶。基于 OKLCH 亮度与彩度的固定曲线推导。
 * @lang en Generate a 50–900 tonal scale from a single primary/secondary color, via fixed OKLCH lightness/chroma curve.
 */

import { clamp, hexToOklch, gamutMapOklch, normalizeHex } from './convert.js';
import type { ColorScale } from '../types.js';

/**
 * @lang zh-CN 色阶定义表：键为阶名，值为 [目标亮度L, 相对彩度乘子]。500 阶固定为输入色本身。
 * @lang en Scale definition: key is shade name, value is [target L, relative chroma multiplier]. 500 is the input color itself.
 */
const SCALE_DEFS: Array<[keyof ColorScale, number, number]> = [
  ['50', 0.97, 0.12],
  ['100', 0.92, 0.24],
  ['200', 0.84, 0.46],
  ['300', 0.74, 0.68],
  ['400', 0.62, 0.88],
  ['500', 1, 1],
  ['600', 0.54, 0.95],
  ['700', 0.46, 0.84],
  ['800', 0.38, 0.66],
  ['900', 0.3, 0.46]
];

/**
 * @lang zh-CN 由输入 HEX 生成完整 ColorScale。500 阶直接使用原色，其余阶由 OKLCH 曲线推导并做色域映射。
 * @lang en Build a full ColorScale from input HEX. 500 uses the original color; other shades derive from OKLCH curve with gamut mapping.
 */
export function tonalScale(hex: string): ColorScale {
  // <lang zh-CN>先把输入色转到 OKLCH，作为后续阶的色相锚点与基准彩度。</lang>
  // <lang en>Convert input to OKLCH as the hue anchor and base chroma for derived shades.</lang>
  const c = hexToOklch(hex);
  const out = {} as ColorScale;
  SCALE_DEFS.forEach(([key, L, cm]) => {
    if (key === '500') {
      // <lang zh-CN>500 阶直接采用输入原色，保证品牌主色不失真。</lang>
      // <lang en>500 uses the raw input to preserve brand color fidelity.</lang>
      out['500'] = normalizeHex(hex);
      return;
    }
    // <lang zh-CN>依据阶定义推导目标亮度，并以基准彩度乘子缩放；600–900 再随阶加深额外降亮。</lang>
    // <lang en>Derive target L from the shade def and scale chroma by the multiplier; 600–900 also darken further by shade.</lang>
    const targetL = key === '600'
      ? clamp(c.L - 0.08, 0.3, 0.62)
      : key === '700'
        ? clamp(c.L - 0.15, 0.23, 0.54)
        : key === '800'
          ? clamp(c.L - 0.23, 0.16, 0.45)
          : key === '900'
            ? clamp(c.L - 0.31, 0.1, 0.36)
            : L;
    // <lang zh-CN>以基准彩度乘以相对乘子，做色域映射得到可显示 HEX。</lang>
    // <lang en>Scale base chroma by the relative multiplier and gamut-map to a displayable HEX.</lang>
    out[key] = gamutMapOklch(targetL, c.C * cm, c.h).hex;
  });
  return out;
}
