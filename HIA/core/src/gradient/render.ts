import type{CssVariableMap,GradientBias,GradientConfig,GradientSettings,Theme}from'../types.js';
import{bestOnColor}from'../color/contrast.js';
import{GRADIENT_DEFS}from'../data/gradients.js';

// 渐变渲染模式：runtime 用当前主题 CSS 变量；export 用 --hia-* 变量；literal 直接内联色值。
// <lang zh-CN>runtime 适合实时预览，export 适合生成可复用样式表，literal 适合无变量环境。</lang>
// <lang en>runtime for live preview, export for reusable stylesheets, literal for var-less environments.</lang>
export type GradientRenderMode='runtime'|'export'|'literal';

// 将起止色与占比策略拼成 CSS 渐变停靠点字符串。
// <lang zh-CN>front 前缀表示前色（start）占大头，end 前缀表示后色（end）占大头。</lang>
// <lang en>'front' prefix means the start color dominates; 'end' means the end color dominates.</lang>
export function gradientStops(a:string,b:string,bias:GradientBias):string{
  switch(bias){
    case'front75':return`${a} 0%, ${a} 75%, ${b} 100%`;
    case'front65':return`${a} 0%, ${a} 65%, ${b} 100%`;
    case'end65':return`${a} 0%, ${b} 35%, ${b} 100%`;
    case'end75':return`${a} 0%, ${b} 25%, ${b} 100%`;
  }
}

// 把某色阶解析为对应模式下的色值引用（变量或字面量）。
// <lang zh-CN>runtime 用 --p/--s 简写变量；export 用 --hia-*；literal 必须传入 theme 否则抛错。</lang>
// <lang en>runtime uses --p/--s shorthand vars; export uses --hia-*; literal requires a theme or throws.</lang>
function tokenFor(config:GradientConfig,shade:string,mode:GradientRenderMode,theme?:Theme):string{
  if(mode==='runtime')return`var(--${config.family==='primary'?'p':'s'}${shade})`;
  if(mode==='export')return`var(--hia-${config.family}-${shade})`;
  // literal 模式无法凭空生成，必须提供已构建主题以取色阶色值。
  // <lang zh-CN>缺 theme 属调用错误，提前抛出便于定位。</lang>
  // <lang en>Missing theme is a caller error; throw early to aid debugging.</lang>
  if(!theme)throw new Error('Literal gradient rendering requires a theme.');
  return theme[config.family].scale[shade as keyof typeof theme.primary.scale];
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
// <lang zh-CN>主色阶决定该卡片上文字该用白还是深，影响可读性。</lang>
// <lang en>The dominant step decides white vs dark text, affecting legibility.</lang>
export function gradientDominantColor(config:GradientConfig,theme:Theme):string{
  return theme[config.family].scale[config.bias.startsWith('end')?config.end:config.start];
}

// 生成注入 :root 的运行时 CSS 变量集合：角色色、10 级色阶与全部渐变（含各自前景色）。
// <lang zh-CN>web 预览与小程序均以这些变量驱动界面；--on-* 为自动对比前景。</lang>
// <lang en>Web preview and mini-program are both driven by these vars; --on-* are auto contrast foregrounds.</lang>
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
