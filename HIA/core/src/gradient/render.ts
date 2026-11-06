import type{CssVariableMap,ColorFamily,GradientBias,GradientConfig,GradientSettings,ShadeValue,Theme}from'../types.js';
import{bestOnColor}from'../color/contrast.js';
import{tonalScaleAt}from'../color/scale.js';
import{clamp}from'../color/convert.js';
import{GRADIENT_DEFS}from'../data/gradients.js';

// 渐变渲染模式：runtime 用当前主题 CSS 变量；export 用 --hia-* 变量；literal 直接内联色值。
// <lang zh-CN>runtime 适合实时预览，export 适合生成可复用样式表，literal 适合无变量环境。</lang>
// <lang en>runtime for live preview, export for reusable stylesheets, literal for var-less environments.</lang>
export type GradientRenderMode='runtime'|'export'|'literal';

// 占比合法性：^(front|end)\d{1,3}$ 且数值 0-100（ADR-004 数值化）。
// <lang zh-CN>旧 4 枚举（front75 等）天然匹配；非法值由解析层回退默认。</lang>
// <lang en>Legacy 4 enums (front75 etc.) match naturally; invalid values fall back at the parse layer.</lang>
const BIAS_RE=/^(front|end)(\d{1,3})$/;

// 将起止色与占比策略拼成 CSS 渐变停靠点字符串（ADR-004 数值化：按百分比生成）。
// <lang zh-CN>front N 表示前色（start）占 N%；end N 表示后色占 N%（即前色只到 100-N%）；
//   非法 bias 防御性回退为无停靠点的简单线性渐变。</lang>
// <lang en>'front N' holds the start color to N%; 'end N' holds the end color from 100-N%;
//   an invalid bias defensively degrades to a plain linear gradient.</lang>
export function gradientStops(a:string,b:string,bias:GradientBias):string{
  const m=BIAS_RE.exec(bias);
  if(!m)return`${a} 0%, ${b} 100%`;
  const n=clamp(parseInt(m[2]!,10),0,100);
  return m[1]==='front'?`${a} 0%, ${a} ${n}%, ${b} 100%`:`${a} 0%, ${b} ${100-n}%, ${b} 100%`;
}

// 交换占比主导端：翻转 front/end 前缀、保留百分比（ADR-004 数值化通用化）。
// <lang zh-CN>旧版为 4 值映射表，数值化后按前缀翻转即可保持视觉权重一致。</lang>
// <lang en>The legacy 4-value map generalizes to prefix flip, keeping the percentage.</lang>
export function swapGradientBias(bias:GradientBias):GradientBias{
  const m=BIAS_RE.exec(bias);
  if(!m)return bias;
  return(m[1]==='front'?`end${m[2]}`:`front${m[2]}`)as GradientBias;
}

// 解析任意色阶引用为实际色值（ADR-004）：标准 10 档查 scale 表；自定义值 tonalScaleAt 插值。
// <lang zh-CN>theme[family].value 为基色 HEX；非法数字回退 500 档（基色本色）。</lang>
// <lang en>theme[family].value is the base HEX; invalid numbers fall back to step 500 (the base).</lang>
function resolveScaleColor(theme:Theme,family:ColorFamily,shade:ShadeValue):string{
  const role=theme[family];
  if(shade in role.scale)return role.scale[shade as keyof typeof role.scale];
  const n=parseInt(shade,10);
  return Number.isFinite(n)?tonalScaleAt(role.value,n):role.scale['500'];
}

// 把某色阶解析为对应模式下的色值引用（变量或字面量）。
// <lang zh-CN>runtime 用 --p/--s 简写变量（自定义色阶变量由 createRuntimeCssVariables 按引用生成）；
//   export 用 --hia-*；literal 必须传入 theme，经 resolveScaleColor 支持任意色阶。</lang>
// <lang en>runtime uses --p/--s shorthand vars (custom-shade vars are emitted per reference by
//   createRuntimeCssVariables); export uses --hia-*; literal requires a theme and supports arbitrary
//   shades via resolveScaleColor.</lang>
function tokenFor(config:GradientConfig,shade:ShadeValue,mode:GradientRenderMode,theme?:Theme):string{
  if(mode==='runtime')return`var(--${config.family==='primary'?'p':'s'}${shade})`;
  if(mode==='export')return`var(--hia-${config.family}-${shade})`;
  // literal 模式无法凭空生成，必须提供已构建主题以取色阶色值。
  // <lang zh-CN>缺 theme 属调用错误，提前抛出便于定位。</lang>
  // <lang en>Missing theme is a caller error; throw early to aid debugging.</lang>
  if(!theme)throw new Error('Literal gradient rendering requires a theme.');
  return resolveScaleColor(theme,config.family,shade);
}

// 生成单条渐变的 CSS：禁用时退化为纯色（起始色），否则输出 linear-gradient。
// <lang zh-CN>默认 runtime 模式；mode/literal 决定是否内联色值。</lang>
// <lang en>Defaults to runtime; mode/literal decide whether colors are inlined.</lang>
export function gradientCss(config:GradientConfig,mode:GradientRenderMode='runtime',theme?:Theme):string{
  const start=tokenFor(config,config.start,mode,theme),
    end=tokenFor(config,config.end,mode,theme);
  // 禁用则直接返回起始色，等效纯背景。
  // <lang zh-CN>让调用方无需区分“未启用”与“启用”。</lang>
  // <lang en>Lets callers treat disabled uniformly as a solid background.</lang>
  return config.enabled===false?start:`linear-gradient(${config.direction}, ${gradientStops(start,end,config.bias)})`;
}

// 取渐变“主色”用于决定前景色：end 占比时取结束色阶，否则取起始色阶。
// <lang zh-CN>主色阶决定该卡片上文字该用白还是深，影响可读性；任意色阶经 resolveScaleColor 插值。</lang>
// <lang en>The dominant step decides white vs dark text; arbitrary shades resolve via resolveScaleColor.</lang>
export function gradientDominantColor(config:GradientConfig,theme:Theme):string{
  return resolveScaleColor(theme,config.family,config.bias.startsWith('end')?config.end:config.start);
}

// 收集渐变配置引用的全部"自定义色阶"（ADR-004）：按色族去重并返回插值色值映射。
// <lang zh-CN>供 runtime 变量生成与 CSS/JSON 导出三处共用；标准 10 档不进入结果。</lang>
// <lang en>Shared by runtime var generation and CSS/JSON exports; standard 10 steps are excluded.</lang>
export function collectCustomShades(theme:Theme):{primary:Record<string,string>;secondary:Record<string,string>}{
  const out:{primary:Record<string,string>;secondary:Record<string,string>}={primary:{},secondary:{}};
  for(const def of GRADIENT_DEFS){
    const config=theme.gradients[def.key];
    if(!config)continue;
    for(const family of['primary','secondary'] as const){
      if(config.family!==family)continue;
      for(const shade of[config.start,config.end] as ShadeValue[]){
        if(shade in theme[family].scale)continue;
        const n=parseInt(shade,10);
        if(!Number.isFinite(n))continue;
        const pos=clamp(Math.round(n),50,900);
        out[family][String(pos)]=tonalScaleAt(theme[family].value,pos);
      }
    }
  }
  return out;
}

// 生成注入 :root 的运行时 CSS 变量集合：角色色、10 级色阶、自定义色阶与全部渐变（含各自前景色）。
// <lang zh-CN>web 预览与小程序均以这些变量驱动界面；--on-* 为自动对比前景；自定义色阶按渐变引用去重生成（ADR-004）。</lang>
// <lang en>Web preview and mini-program are driven by these vars; --on-* are auto contrast foregrounds;
//   custom shades are emitted per gradient reference (ADR-004).</lang>
export function createRuntimeCssVariables(theme:Theme):CssVariableMap{
  const vars:CssVariableMap={
    '--primary':theme.primary.value,
    '--secondary':theme.secondary.value,
    '--on-primary':theme.primary.on,
    '--on-secondary':theme.secondary.on
  };
  // 主色色阶写入 --p{step} 变量。
  // <lang zh-CN>简写变量便于渐变与组件快速引用。</lang>
  // <lang en>Shorthand vars let gradients/components reference steps quickly.</lang>
  for(const[k,v]of Object.entries(theme.primary.scale))vars[`--p${k}`]=v;
  // 副色色阶写入 --s{step} 变量。
  // <lang zh-CN>与主色对称。</lang>
  // <lang en>Symmetric with the primary.</lang>
  for(const[k,v]of Object.entries(theme.secondary.scale))vars[`--s${k}`]=v;
  // 自定义色阶变量：按渐变引用去重生成 --p650 / --s650 等附加变量（ADR-004）。
  // <lang zh-CN>与标准 10 档同名规则，tokenFor 的 var() 引用无需区分。</lang>
  // <lang en>Same naming as the standard steps, so tokenFor's var() references need no branching.</lang>
  const custom=collectCustomShades(theme);
  for(const[k,v]of Object.entries(custom.primary))vars[`--p${k}`]=v;
  for(const[k,v]of Object.entries(custom.secondary))vars[`--s${k}`]=v;
  // 每个渐变角色生成背景变量与对应前景变量。
  // <lang zh-CN>缺失配置跳过，保证不写入 undefined。</lang>
  // <lang en>Skips missing configs so nothing undefined is written.</lang>
  for(const def of GRADIENT_DEFS){
    const config=theme.gradients[def.key];
    if(!config)continue;
    vars[`--gradient-${def.key}`]=gradientCss(config,'runtime',theme);
    vars[`--on-gradient-${def.key}`]=bestOnColor(gradientDominantColor(config,theme)).hex;
  }
  return vars;
}

// 生成导出用渐变变量文本行（仅包含已启用角色），供 CSS 令牌文件拼接。
// <lang zh-CN>每行一个 --hia-gradient-*，空行过滤后按角色顺序连接。</lang>
// <lang en>One --hia-gradient-* per line; blank lines filtered, joined in role order.</lang>
export function exportGradientVariableLines(settings:GradientSettings):string{
  return GRADIENT_DEFS.map(def=>settings[def.key]?`  --hia-gradient-${def.key}: ${gradientCss(settings[def.key]!,'export')};`:'').filter(Boolean).join('\n');
}
