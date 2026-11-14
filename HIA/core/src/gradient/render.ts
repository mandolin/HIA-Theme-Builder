import type{CssVariableMap,ColorFamily,GradientBias,GradientConfig,GradientFamily,GradientSettings,ShadeValue,Theme}from'../types.js';
import{bestOnColor}from'../color/contrast.js';
import{tonalScaleAt}from'../color/scale.js';
import{typographySpacingVars}from'../token/typography.js';
import{radiusSequence,shadowCss}from'../token/radius.js';
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
/** @lang zh-CN 解析任意色阶引用为实际色值（`W-tb-P38` 导出为 DTCG 渐变 stops 所需，改公开）。 @lang en Resolves an arbitrary shade reference to its colour (exported for `W-tb-P38` DTCG gradient stops). */
export function resolveScaleColor(theme:Theme,family:GradientFamily,shade:ShadeValue):string{
  // 色族解析：主/副走角色表；third 走第三角色；aux<N> 走对应辅助槽位（ADR-007 v2）。
  // <lang zh-CN>third/aux 槽位缺失（模式不匹配/槽位未加）时回退主色 500，保证渲染不断。</lang>
  // <lang en>Missing third/aux slots fall back to primary 500 so rendering never breaks.</lang>
  const role=family==='third'?theme.thirdColor:family.startsWith('aux')?theme.auxiliary[parseInt(family.slice(3),10)]:theme[family as ColorFamily];
  if(!role)return theme.primary.scale['500']!;
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
  // runtime 简写变量：主/副 --p/--s、第三角色 --t、辅助 --a<N>（ADR-007 v2 渐变色源扩充）。
  // <lang zh-CN>第三角色仅三色模式写入 --t{shade}；辅助槽位写入 --a<N>{shade}（createRuntimeCssVariables）。</lang>
  // <lang en>Third emits --t{shade}; aux slot N emits --a<N>{shade} via createRuntimeCssVariables.</lang>
  if(mode==='runtime'){
    const fam=config.family;
    const prefix=fam==='primary'?'p':fam==='secondary'?'s':fam==='third'?'t':'a'+fam.slice(3);
    return`var(--${prefix}${shade})`;
  }
  if(mode==='export')return`var(--hia-${config.family}-${shade})`;
  // literal 模式无法凭空生成，必须提供已构建主题以取色阶色值。
  // <lang zh-CN>缺 theme 属调用错误，提前抛出便于定位。</lang>
  // <lang en>Missing theme is a caller error; throw early to aid debugging.</lang>
  if(!theme)throw new Error('Literal gradient rendering requires a theme.');
  return resolveScaleColor(theme,config.family,shade);
}

// 生成单条渐变的 CSS：禁用时退化为纯色（起始色），否则输出 linear-gradient。
// <lang zh-CN>默认 runtime 模式；mode/literal 决定是否内联色值。
//   **降级链（`W-tb-P37`）**：启用态在渐变层下追加起始色纯色垫底（多层背景，渐变在上）——
//   渐变含半透明色标时不会露出容器底色；消费方需完全的解析级降级时应另行双声明
//   （background-color 先行，background-image 后行，见 inject-template）。
//   underlay=false 供不容许多层背景的消费方（WordPress 渐变预设解析器）关闭。
// </lang>
// <lang en>Defaults to runtime; mode/literal decide whether colors are inlined.
//   **Degradation chain (`W-tb-P37`)**: when enabled, a solid start-colour underlay is appended beneath the
//   gradient layer (multi-layer background, gradient on top) so translucent stops never expose the container.
//   Consumers needing parse-level fallback should emit two declarations (background-color first, then
//   background-image — see inject-template). underlay=false for consumers that cannot take multi-layer
//   backgrounds (the WordPress gradient preset parser).</lang>
export function gradientCss(config:GradientConfig,mode:GradientRenderMode='runtime',theme?:Theme,underlay=true):string{
  const start=tokenFor(config,config.start,mode,theme),
    end=tokenFor(config,config.end,mode,theme);
  // 禁用则直接返回起始色，等效纯背景。
  // <lang zh-CN>让调用方无需区分“未启用”与“启用”。</lang>
  // <lang en>Lets callers treat disabled uniformly as a solid background.</lang>
  if(config.enabled===false)return start;
  const gradient=`linear-gradient(${config.direction}, ${gradientStops(start,end,config.bias)})`;
  // 纯色垫底与起始色同源：降级时呈现"起始色平铺"的合理近似。
  // <lang en>The underlay mirrors the start colour: degradation degrades to a sensible flat start colour.</lang>
  return underlay?`${gradient}, ${start}`:gradient;
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
  // 第三角色变量（ADR-007 v2）：仅三色模式存在（--third / --t{step} / --on-third）。
  // <lang zh-CN>thirdColor 缺省 undefined 时不写入，预览与产物保持旧形态。</lang>
  // <lang en>Omitted when thirdColor is absent, keeping previews and artifacts in legacy shape.</lang>
  if(theme.thirdColor){
    vars['--third']=theme.thirdColor.value;
    vars['--on-third']=theme.thirdColor.on;
    for(const[k,v]of Object.entries(theme.thirdColor.scale))vars[`--t${k}`]=v;
  }
  // 第三角色运行时变量已在上方写入；辅助槽位变量（ADR-007 v2 渐变色源扩充）：--a<N>{step} / --aux<N> / --on-aux<N>。
  // <lang zh-CN>有辅助槽位时逐槽写入，供渐变 runtime 引用与预览消费。</lang>
  // <lang en>Per-slot vars emitted when slots exist, for gradient runtime refs and previews.</lang>
  theme.auxiliary.forEach((aux,i)=>{
    vars[`--aux${i}`]=aux.value;
    vars[`--on-aux${i}`]=aux.on;
    for(const[k,v]of Object.entries(aux.scale))vars[`--a${i}${k}`]=v;
  });
  // 字体/间距变量（ADR-006）：--hia-font-* / --hia-fs-* / --hia-space-*，供全部预览类型与导出消费。
  // <lang zh-CN>追加入 :root 内联变量集合。</lang>
  // <lang en>Merged into the :root inline var set.</lang>
  Object.assign(vars,typographySpacingVars(theme));
  // 语义状态色变量（`W-tb-P37`/ADR-012）：主题携带时写入 --success/-info/-warning/-danger 及 500/700 阶，
  //   供预览（状态卡/按钮）消费；未携带的主题不写入（旧形态不变）。
  // <lang en>Semantic status vars (`W-tb-P37`/ADR-012): emitted when carried for preview consumption; absent
  //   groups keep the legacy shape.</lang>
  if(theme.semantic){
    for(const[k,role]of Object.entries(theme.semantic)as Array<[keyof typeof theme.semantic & string,typeof theme.semantic[keyof typeof theme.semantic]]>){
      vars[`--${k}`]=role.value;
      vars[`--on-${k}`]=role.on;
      vars[`--${k}-500`]=role.scale['500']??role.value;
      vars[`--${k}-100`]=role.scale['100']??role.value;
    }
  }
  // 圆角/阴影变量（`W-tb-P37`）：--radius-* / --shadow-*，供预览与导出统一消费。
  // <lang en>Radius/shadow vars (`W-tb-P37`): --radius-* / --shadow-* consumed by preview and exports.</lang>
  const radius=radiusSequence(theme.radius);
  for(const[k,v]of Object.entries(radius))vars[`--radius-${k}`]=`${v}px`;
  // 阴影固定三档：sm/md/lg 键集稳定，避免 Object.entries 的隐式 any。
  // <lang en>Shadow levels are the stable sm/md/lg set, avoiding implicit-any from Object.entries.</lang>
  const shadows=shadowCss(theme.shadow,theme.primary.value);
  for(const k of ['sm','md','lg'] as const)vars[`--shadow-${k}`]=shadows[k];
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
