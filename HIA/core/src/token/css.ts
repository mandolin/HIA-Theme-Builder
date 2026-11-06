import type{Theme}from'../types.js';
import{collectCustomShades,exportGradientVariableLines}from'../gradient/render.js';

// 将完整主题导出为 :root CSS 自定义属性文本（设计系统/小程序消费入口）。
// <lang zh-CN>包含角色基色、前景色、主副色各 10 级色阶、渐变引用的自定义色阶（ADR-004 附加式）
//   与全部渐变变量；缩进贴近手写样式表。</lang>
// <lang en>Emits role base colors, foregrounds, 10-step scales, gradient-referenced custom shades
//   (ADR-004 additive) and all gradient vars; indentation mimics hand-written sheets.</lang>
export function exportThemeCss(theme:Theme):string{
  // 自定义色阶：与运行时变量同源（collectCustomShades 去重插值），保证导出即可用。
  // <lang zh-CN>键名与 --hia-primary-{shade} 规则一致，消费方 var() 引用无需区分。</lang>
  // <lang en>Keys follow --hia-primary-{shade}; consumers' var() references need no branching.</lang>
  const custom=collectCustomShades(theme);
  const customLines=(role:'primary'|'secondary')=>Object.entries(custom[role])
    .map(([k,v])=>`--hia-${role}-${k}: ${v};`).join('\n  ');
  const primaryCustom=customLines('primary');
  const secondaryCustom=customLines('secondary');
  return`:root {\n  --hia-primary: ${theme.primary.value};\n  --hia-on-primary: ${theme.primary.on};\n  --hia-secondary: ${theme.secondary.value};\n  --hia-on-secondary: ${theme.secondary.on};\n  ${Object.entries(theme.primary.scale).map(([k,v])=>`--hia-primary-${k}: ${v};`).join('\n  ')}${primaryCustom?`\n  ${primaryCustom}`:''}\n  ${Object.entries(theme.secondary.scale).map(([k,v])=>`--hia-secondary-${k}: ${v};`).join('\n  ')}${secondaryCustom?`\n  ${secondaryCustom}`:''}\n${exportGradientVariableLines(theme.gradients)}\n}`;
}
