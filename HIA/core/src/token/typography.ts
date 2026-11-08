import type{CssVariableMap,SpacingTokens,Theme,TypographyTokens}from'../types.js';
import{clamp}from'../color/convert.js';

// 字体/间距令牌默认值（ADR-006）：旧数据/缺省输入以默认补齐（向后兼容）。
// <lang zh-CN>默认字体族走系统栈；字号基数 16、比率 1.25（大四度）；间距 8pt 网格倍增 6 级。</lang>
// <lang en>Defaults use system font stacks; font base 16 with ratio 1.25 (major third); spacing 8pt grid doubling 6 levels.</lang>
export const DEFAULT_TYPOGRAPHY:TypographyTokens={
  fontFamily:{body:"system-ui,-apple-system,'Segoe UI',sans-serif",heading:"inherit",mono:"ui-monospace,SFMono-Regular,Consolas,monospace"},
  fontSizeScale:{base:16,ratio:1.25},
  lineHeightBody:1.65
};
export const DEFAULT_SPACING:SpacingTokens={base:8,step:'x2',levels:6};

// 字号档位名（顺序由大到小：display…small）。
// <lang zh-CN>与预览/导出共用同一份档位名。</lang>
// <lang en>Shared step names across preview and exports.</lang>
export const FONT_SIZE_STEPS=['display','h1','h2','h3','body','small']as const;
export type FontSizeStep=typeof FONT_SIZE_STEPS[number];
// 档位偏移：display 为 +2 档，small 为 -1 档（相对 body）。
// <lang zh-CN>body 恒为基数；其余按偏移做模数缩放。</lang>
// <lang en>body is the base; others scale by modular offset.</lang>
// 档位偏移（相对 body=0）：display +4、h1 +3、h2 +2、h3 +1、body 0、small -1。
// <lang zh-CN>body 恒等于基数；向上按比率放大、向下按比率缩小。</lang>
// <lang en>body equals the base; steps above scale up by ratio, below scale down.</lang>
const STEP_OFFSET:Record<FontSizeStep,number>={display:4,h1:3,h2:2,h3:1,body:0,small:-1};

// 按档位名取字号（px，保留一位小数）：模数比例尺 + 单档覆写。
// <lang zh-CN>overrides 键为档位名（如 'h1': 18）；结果 clamp 到 9–64px 可显示域。</lang>
// <lang en>overrides keyed by step name (e.g. 'h1': 18); results clamped to 9–64px.</lang>
export function fontSizeAt(t:TypographyTokens,step:FontSizeStep):number{
  const o=t.fontSizeScale.overrides?.[step];
  if(typeof o==='number')return Math.round(o*10)/10;
  const v=t.fontSizeScale.base*Math.pow(t.fontSizeScale.ratio,STEP_OFFSET[step]);
  return Math.round(clamp(v,9,64)*10)/10;
}

// 间距序列生成（px 数组）：基数起步，按步进策略推进，级数=levels；overrides 按索引覆写。
// <lang zh-CN>linear4=+4 线性、x2=倍增、x15=×1.5。</lang>
// <lang en>linear4=+4 linear, x2=double, x15=×1.5.</lang>
export function spacingSequence(t:SpacingTokens):number[]{
  const out:number[]=[];
  let v=t.base;
  for(let i=0;i<Math.max(1,Math.min(12,t.levels));i++){
    const o=t.overrides?.[String(i)];
    out.push(typeof o==='number'?o:Math.round(v*10)/10);
    if(t.step==='linear4')v+=4;
    else if(t.step==='x2')v*=2;
    else v=Math.round(v*1.5*10)/10;
  }
  return out;
}

// 字体/间距令牌写入 CSS 变量（`W-tb-P9`）：--hia-font-* / --hia-fs-* / --hia-space-*。
// <lang zh-CN>供预览区（全部三类）与导出模板消费。</lang>
// <lang en>Consumed by all preview types and export templates.</lang>
export function typographySpacingVars(theme:Theme):CssVariableMap{
  const t=theme.typography,s=theme.spacing;
  const vars:CssVariableMap={
    '--hia-font-body':t.fontFamily.body,
    '--hia-font-heading':t.fontFamily.heading==='inherit'?t.fontFamily.body:t.fontFamily.heading,
    '--hia-font-mono':t.fontFamily.mono,
    '--hia-line-height-body':String(t.lineHeightBody)
  };
  for(const step of FONT_SIZE_STEPS)vars[`--hia-fs-${step}`]=fontSizeAt(t,step)+'px';
  const seq=spacingSequence(s);
  seq.forEach((v,i)=>{vars[`--hia-space-${i}`]=v+'px';});
  return vars;
}
