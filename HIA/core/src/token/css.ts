/**
 * @lang zh-CN 主题 Token 的 CSS 导出：把 Theme 转为 :root 下的 CSS 自定义属性文本（含渐变行）。
 * @lang en CSS export of theme tokens: turn a Theme into :root CSS custom properties text (including gradient lines).
 */

import type { Theme, GradientConfig } from '../types.js';
import { GRADIENT_DEFS } from '../data/gradients.js';

/**
 * @lang zh-CN 计算单条渐变的 CSS 值：禁用时退化为单色 var()，否则输出 linear-gradient。
 * @lang en Compute one gradient's CSS value: degrade to a single-color var() when disabled, else output linear-gradient.
 */
function gradientCss(cfg: GradientConfig): string {
  // <lang zh-CN>统一用导出态 token 名 --hia-{family}-{shade}。</lang>
  // <lang en>Use export token name --hia-{family}-{shade} consistently.</lang>
  const a = `var(--hia-${cfg.family}-${cfg.start})`;
  const b = `var(--hia-${cfg.family}-${cfg.end})`;
  // <lang zh-CN>禁用时只返回起始色，保持可用的最小表达。</lang>
  // <lang en>When disabled, return only the start color as a minimal usable expression.</lang>
  if (cfg.enabled === false) return a;
  // <lang zh-CN>按占比偏好拼装色标起止位置。</lang>
  // <lang en>Compose color-stop positions by bias preference.</lang>
  const stops =
    cfg.bias === 'front75'
      ? `${a} 0%, ${a} 75%, ${b} 100%`
      : cfg.bias === 'front65'
        ? `${a} 0%, ${a} 65%, ${b} 100%`
        : cfg.bias === 'end65'
          ? `${a} 0%, ${b} 35%, ${b} 100%`
          : `${a} 0%, ${b} 25%, ${b} 100%`;
  return `linear-gradient(${cfg.direction}, ${stops})`;
}

/**
 * @lang zh-CN 导出所有渐变角色的 CSS 变量行（--hia-gradient-{key}）。
 * @lang en Export CSS variable lines for all gradient roles (--hia-gradient-{key}).
 */
function exportGradientLines(theme: Theme): string {
  // <lang zh-CN>遍历渐变定义列表，逐条生成变量赋值。</lang>
  // <lang en>Iterate gradient defs, generate one variable assignment each.</lang>
  return GRADIENT_DEFS.map(
    (def) => `  --hia-gradient-${def.key}: ${gradientCss(theme.gradients[def.key])};`
  ).join('\n');
}

/**
 * @lang zh-CN 将 Theme 导出为完整 CSS 文本（:root 块），可直接写入样式表或预览。
 * @lang en Export a Theme to full CSS text (:root block), ready to write into a stylesheet or preview.
 */
export function exportThemeCss(theme: Theme): string {
  // <lang zh-CN>逐阶展开主/副色色阶，拼接为 :root 内属性行。</lang>
  // <lang en>Expand primary/secondary scales shade by shade into :root property lines.</lang>
  const p = theme.primary.scale;
  const s = theme.secondary.scale;
  return `:root {
  --hia-primary: ${theme.primary.value};
  --hia-on-primary: ${theme.primary.on};
  --hia-secondary: ${theme.secondary.value};
  --hia-on-secondary: ${theme.secondary.on};
  ${Object.entries(p).map(([k, v]) => `--hia-primary-${k}: ${v};`).join('\n  ')}
  ${Object.entries(s).map(([k, v]) => `--hia-secondary-${k}: ${v};`).join('\n  ')}
${exportGradientLines(theme)}
}`;
}
