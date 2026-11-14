import type{Theme}from'../types.js';
import{collectCustomShades,exportGradientVariableLines}from'../gradient/render.js';
import{radiusSequence,shadowCss}from'./radius.js';

// 将完整主题导出为 :root CSS 自定义属性文本（设计系统/小程序消费入口）。
// <lang zh-CN>包含角色基色、前景色、主副色各 10 级色阶、渐变引用的自定义色阶（ADR-004 附加式）、
//   第三角色（ADR-007 v2，仅三色模式）、辅助色槽位与全部渐变变量；`W-tb-P37` 追加语义状态色、
//   圆角与阴影令牌；缩进贴近手写样式表。</lang>
// <lang en>Emits role base colors, foregrounds, 10-step scales, gradient-referenced custom shades
//   (ADR-004 additive), the third role (ADR-007 v2, triad only), auxiliary slots and all gradient vars;
//   `W-tb-P37` adds semantic status tokens, radius and shadow tokens.</lang>
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
  // 语义状态色（ADR-012）：仅当主题携带该组时输出；键名 --hia-<status>[-<shade>]/--hia-on-<status>。
  // <lang zh-CN>未派生的旧主题不出现该段（产物与旧版一致）。</lang>
  // <lang en>Emitted only when the theme carries the group; old themes without it keep identical output.</lang>
  const semanticLines=theme.semantic?(Object.entries(theme.semantic)as[ keyof typeof theme.semantic & string, typeof theme.semantic[keyof typeof theme.semantic] ][]).map(([k,role])=>[
    `  --hia-${k}: ${role.value};`,
    `  --hia-on-${k}: ${role.on};`,
    ...Object.entries(role.scale).map(([shade,v])=>`--hia-${k}-${shade}: ${v};`)
  ].join('\n  ')).join('\n'):'';
  // 圆角/阴影（`W-tb-P37`）：五档圆角 px + 三档阴影字符串；阴影可随主色染色。
  // <lang en>Radius/shadow (`W-tb-P37`): five radius steps (px) + three shadow strings; shadows may tint with
  //   the primary.</lang>
  const radius=radiusSequence(theme.radius);
  const shadows=shadowCss(theme.shadow,theme.primary.value);
  const radiusLines=(Object.entries(radius)as[string,number][]).map(([k,v])=>`  --hia-radius-${k}: ${v}px;`).join('\n');
  const shadowLines=(Object.entries(shadows)as[string,string][]).map(([k,v])=>`  --hia-shadow-${k}: ${v};`).join('\n');
  return`:root {
  --hia-primary: ${theme.primary.value};
  --hia-on-primary: ${theme.primary.on};
  --hia-secondary: ${theme.secondary.value};
  --hia-on-secondary: ${theme.secondary.on};
  ${Object.entries(theme.primary.scale).map(([k,v])=>`--hia-primary-${k}: ${v};`).join('\n  ')}${primaryCustom?`\n  ${primaryCustom}`:''}
  ${Object.entries(theme.secondary.scale).map(([k,v])=>`--hia-secondary-${k}: ${v};`).join('\n  ')}${secondaryCustom?`\n  ${secondaryCustom}`:''}${thirdLines?`\n  ${thirdLines}`:''}${auxLines?`\n  ${auxLines}`:''}${semanticLines?`\n  ${semanticLines}`:''}
${exportGradientVariableLines(theme.gradients)}
  ${radiusLines}
  ${shadowLines}
}`;
}
