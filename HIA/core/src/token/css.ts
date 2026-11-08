import type{Theme}from'../types.js';
import{collectCustomShades,exportGradientVariableLines}from'../gradient/render.js';

// 将完整主题导出为 :root CSS 自定义属性文本（设计系统/小程序消费入口）。
// <lang zh-CN>包含角色基色、前景色、主副色各 10 级色阶、渐变引用的自定义色阶（ADR-004 附加式）、
//   第三角色（ADR-007 v2，仅三色模式）、辅助色槽位与全部渐变变量；缩进贴近手写样式表。</lang>
// <lang en>Emits role base colors, foregrounds, 10-step scales, gradient-referenced custom shades
//   (ADR-004 additive), the third role (ADR-007 v2, triad only), auxiliary slots and all gradient vars.</lang>
export function exportThemeCss(theme:Theme):string{
  // 自定义色阶：与运行时变量同源（collectCustomShades 去重插值），保证导出即可用。
  // <lang zh-CN>键名与 --hia-primary-{shade} 规则一致，消费方 var() 引用无需区分。</lang>
  // <lang en>Keys follow --hia-primary-{shade}; consumers' var() references need no branching.</lang>
  const custom=collectCustomShades(theme);
  const customLines=(role:'primary'|'secondary')=>Object.entries(custom[role])
    .map(([k,v])=>`--hia-${role}-${k}: ${v};`).join('\n  ');
  const primaryCustom=customLines('primary');
  const secondaryCustom=customLines('secondary');
  // 第三角色变量段（ADR-007 v2）：仅三色模式存在（thirdColor 缺省 undefined → 段为空串，产物与旧版一致）。
  // <lang zh-CN>键名 --hia-third[-<shade>] / --hia-on-third；与主副色同构。</lang>
  // <lang en>Keys --hia-third[-<shade>] / --hia-on-third; same shape as primary/secondary.</lang>
  const thirdLines=theme.thirdColor?[
    `  --hia-third: ${theme.thirdColor.value};`,
    `  --hia-on-third: ${theme.thirdColor.on};`,
    ...Object.entries(theme.thirdColor.scale).map(([k,v])=>`--hia-third-${k}: ${v};`)
  ].join('\n  '):'';
  // 辅助色槽位（ADR-007）：每槽基色/前景 + 10 档，键名 --hia-aux<N>[-<shade>]（N 从 0）。
  // <lang zh-CN>辅助为空时该段为空串，产物与旧版逐字节一致（向后兼容）。</lang>
  // <lang en>Empty auxiliary → empty segment, keeping output byte-identical to legacy.</lang>
  const auxLines=theme.auxiliary.map((aux,i)=>[
    `  --hia-aux${i}: ${aux.value};`,
    `  --hia-on-aux${i}: ${aux.on};`,
    ...Object.entries(aux.scale).map(([k,v])=>`--hia-aux${i}-${k}: ${v};`)
  ].join('\n  ')).join(theme.auxiliary.length?'\n':'');
  return`:root {
  --hia-primary: ${theme.primary.value};
  --hia-on-primary: ${theme.primary.on};
  --hia-secondary: ${theme.secondary.value};
  --hia-on-secondary: ${theme.secondary.on};
  ${Object.entries(theme.primary.scale).map(([k,v])=>`--hia-primary-${k}: ${v};`).join('\n  ')}${primaryCustom?`\n  ${primaryCustom}`:''}
  ${Object.entries(theme.secondary.scale).map(([k,v])=>`--hia-secondary-${k}: ${v};`).join('\n  ')}${secondaryCustom?`\n  ${secondaryCustom}`:''}${thirdLines?`\n  ${thirdLines}`:''}${auxLines?`\n  ${auxLines}`:''}
${exportGradientVariableLines(theme.gradients)}
}`;
}
