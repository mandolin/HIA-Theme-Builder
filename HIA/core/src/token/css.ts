import type{Theme}from'../types.js';
import{exportGradientVariableLines}from'../gradient/render.js';

// 将完整主题导出为 :root CSS 自定义属性文本（设计系统/小程序消费入口）。
// <lang zh-CN>包含角色基色、前景色、主副色各 10 级色阶与全部渐变变量；缩进贴近手写样式表。</lang>
// <lang en>Emits role base colors, foregrounds, 10-step scales and all gradient vars; indentation mimics hand-written sheets.</lang>
export function exportThemeCss(theme:Theme):string{
  return`:root {\n  --hia-primary: ${theme.primary.value};\n  --hia-on-primary: ${theme.primary.on};\n  --hia-secondary: ${theme.secondary.value};\n  --hia-on-secondary: ${theme.secondary.on};\n  ${Object.entries(theme.primary.scale).map(([k,v])=>`--hia-primary-${k}: ${v};`).join('\n  ')}\n  ${Object.entries(theme.secondary.scale).map(([k,v])=>`--hia-secondary-${k}: ${v};`).join('\n  ')}\n${exportGradientVariableLines(theme.gradients)}\n}`;
}
