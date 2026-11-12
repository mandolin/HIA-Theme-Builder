/**
 * @lang zh-CN TDON 令牌解析（`W-tb-P26` / 规范 §5.1、TDON-5.6、TDON-5.7、TDON-4.2）：
 *   把 TDON 的引用串（`primary.500`、`gradient:carousel`、`font:body`、`fs:h1`、`space:2`、`on:primary`）
 *   解析为当前主题上的具体 CSS 值。纯函数、无 IO、无缓存——主题变更后重新解析即得新值。
 * @lang en TDON token resolution (`W-tb-P26` / §5.1, TDON-5.6, TDON-5.7, TDON-4.2): turns a reference string
 *   (`primary.500`, `gradient:carousel`, `font:body`, `fs:h1`, `space:2`, `on:primary`) into a concrete CSS value
 *   on the current theme. Pure, IO-free, uncached — re-resolving after a theme change yields the new value.
 */
import type{Theme}from'@hia/theme-core';
import{exportThemeCss}from'@hia/theme-core';
import{typographySpacingVars,fontSizeAt,spacingSequence}from'@hia/theme-core';
import{gradientCss,collectCustomShades}from'@hia/theme-core';
import{GRADIENT_DEFS}from'@hia/theme-core';
import{tonalScaleAt}from'@hia/theme-core';
import{FONT_SIZE_STEPS}from'@hia/theme-core';

// 令牌引用解析结果：成功给 css 值，失败给原因（不抛错——校验器需要收集多条问题而非中断）。
// <lang zh-CN>value 为可直接放进 style 的 CSS 值（颜色/渐变/字体族/尺寸）。</lang>
// <lang en>value is a CSS value ready for a style declaration (color/gradient/font family/dimension).</lang>
export type TdonTokenResult={ok:true;value:string}|{ok:false;reasonZh:string;reasonEn:string};

// 颜色角色解析：primary/secondary/third/aux<N> → RoleColor。
// <lang zh-CN>third 仅在 triad 模式存在；aux<N> 越界即失败（TDON-4.2）。</lang>
// <lang en>third exists only in triad mode; aux<N> out of range fails (TDON-4.2).</lang>
function roleColorFor(theme:Theme,role:string){
  if(role==='primary')return theme.primary;
  if(role==='secondary')return theme.secondary;
  // 第三角色：三色模式才有；单/双色模式下 third.xxx 引用一律不可解析。
  // <lang zh-CN>错误文案点明模式要求，便于用户理解而非猜测。</lang>
  // <lang en>The message names the mode requirement so users understand rather than guess.</lang>
  if(role==='third')return theme.thirdColor??null;
  // 辅助槽位：aux0..auxN（N 从 0，需小于当前槽数）。
  // <lang zh-CN>正则严格匹配 `aux` + 非负整数，`aux` 后跟字母不算。</lang>
  // <lang en>Strictly `aux` plus a non-negative integer; letters after aux do not match.</lang>
  const m=/^aux(\d{1,2})$/.exec(role);
  if(m){
    const idx=Number(m[1]);
    return theme.auxiliary[idx]??null;
  }
  return null;
}

// 色阶取值：标准键直接取 scale，数值走 tonalScaleAt 插值（ADR-004 任意色阶）。
// <lang zh-CN>数值域 0–1000（TDON-4.3），越界由调用方先行校验；这里再做一次兜底。</lang>
// <lang en>Numeric range is 0–1000 (TDON-4.3); the caller checks first, this is a defensive second pass.</lang>
function shadeValueOf(theme:Theme,roleColor:{value:string;scale:Record<string,string>},shade:string):string|null{
  if(Object.prototype.hasOwnProperty.call(roleColor.scale,shade)){
    const v=roleColor.scale[shade];
    return typeof v==='string'?v:null;
  }
  // 非标准键但为合法整数：按该角色基色插值（与导出侧的自定义色阶同源）。
  // <lang zh-CN>用角色自身基色而非主色，保证与 --hia-<role>-<n> 导出变量一致。</lang>
  // <lang en>Interpolates from the role's own base color, matching the exported --hia-<role>-<n> variables.</lang>
  if(/^\d{1,4}$/.test(shade)){
    const n=Number(shade);
    if(n>=0&&n<=1000)return tonalScaleAt(roleColor.value,n);
  }
  return null;
}

// 解析单条令牌引用（§5.1 的六种形式之一）。
// <lang zh-CN>形状不符 → 语法错误；形状正确但目标不存在 → 不可解析；两者在 UI 上语义不同。</lang>
// <lang en>Malformed shape → syntax error; well-formed but missing target → unresolved. The UI distinguishes them.</lang>
export function resolveTdonToken(theme:Theme,ref:string):TdonTokenResult{
  // 颜色角色 + 色阶：`<role>.<shade>`，如 primary.500 / aux0.800 / third.100。
  // <lang zh-CN>点号前为角色、后为色阶，均不允许空。</lang>
  // <lang en>Role before the dot, shade after; neither may be empty.</lang>
  const dot=/^([a-z][a-z0-9]{0,15})\.([0-9]{1,4})$/.exec(ref);
  if(dot){
    const role=dot[1]!;const shade=dot[2]!;
    const rc=roleColorFor(theme,role);
    if(!rc)return{ok:false,reasonZh:`当前主题不含颜色角色「${role}」。`,reasonEn:`The current theme has no color role "${role}".`};
    const v=shadeValueOf(theme,{value:rc.value,scale:rc.scale as unknown as Record<string,string>},shade);
    if(!v)return{ok:false,reasonZh:`色阶 ${shade} 无法从「${role}」解析。`,reasonEn:`Shade ${shade} cannot be resolved from "${role}".`};
    return{ok:true,value:v};
  }
  // 渐变：`gradient:<role>`，角色须为 GRADIENT_DEFS 中的键，且该渐变已启用。
  // <lang zh-CN>未启用渐变不提供背景值——避免渲染出空梯度造成的视觉断层。</lang>
  // <lang en>A disabled gradient yields no value, avoiding a visually broken empty gradient.</lang>
  // 渲染模式用 literal（内联真实色值）：预览宿主注入的是 --p/--s 简写变量，导出模式的
  //   `var(--hia-primary-700)` 在预览里全部落空（实测 hero 背景解析为 none 的根因）。
  //   内联色值同时让 TDON 预览不依赖宿主变量命名，跨端一致。
  // <lang en>Literal mode inlines real colors: the preview host injects --p/--s shorthand vars, so export-mode
  //   `var(--hia-primary-700)` resolves to nothing (the root cause of hero background "none"). Inlining also
  //   frees the preview from host variable naming, keeping it identical across runtimes.</lang>
  const gm=/^gradient:([a-z][a-z0-9-]{0,23})$/.exec(ref);
  if(gm){
    const key=gm[1]!;
    if(!GRADIENT_DEFS.some(d=>d.key===key))return{ok:false,reasonZh:`未知渐变角色「${key}」。`,reasonEn:`Unknown gradient role "${key}".`};
    const cfg=theme.gradients[key];
    if(!cfg||!cfg.enabled)return{ok:false,reasonZh:`渐变「${key}」当前未启用。`,reasonEn:`Gradient "${key}" is currently disabled.`};
    return{ok:true,value:gradientCss(cfg,'literal',theme)};
  }
  // 前景色：`on:<role>` → 角色上的可读前景（白/深）。
  // <lang zh-CN>用于按钮/徽标的文字色，避免用户在 TDON 里硬编码白或黑。</lang>
  // <lang en>Used for text on buttons/badges so users never hardcode white or black.</lang>
  const om=/^on:([a-z][a-z0-9]{0,15})$/.exec(ref);
  if(om){
    const role=om[1]!;
    const rc=roleColorFor(theme,role);
    if(!rc)return{ok:false,reasonZh:`当前主题不含颜色角色「${role}」。`,reasonEn:`The current theme has no color role "${role}".`};
    return{ok:true,value:rc.on};
  }
  // 字体族：`font:body|heading|mono`。
  // <lang zh-CN>取 typographySpacingVars 的最终值（heading=inherit 时已回退 body）。</lang>
  // <lang en>Reads the final typographySpacingVars value (heading already fell back to body when inherit).</lang>
  const fm=/^font:(body|heading|mono)$/.exec(ref);
  if(fm){
    const vars=typographySpacingVars(theme);
    const v=vars[`--hia-font-${fm[1]!}`];
    if(!v)return{ok:false,reasonZh:`字体族「${fm[1]!}」不可用。`,reasonEn:`Font family "${fm[1]!}" is unavailable.`};
    return{ok:true,value:v};
  }
  // 字号档：`fs:<step>`，档位限定 FONT_SIZE_STEPS。
  // <lang zh-CN>未知档位按语法错误处理（档位集合是固定契约）。</lang>
  // <lang en>Unknown steps are treated as syntax errors (the step set is a fixed contract).</lang>
  const sm=/^fs:([a-z0-9]{1,10})$/.exec(ref);
  if(sm){
    const step=sm[1]!;
    if(!(FONT_SIZE_STEPS as readonly string[]).includes(step))return{ok:false,reasonZh:`未知字号档「${step}」。`,reasonEn:`Unknown font-size step "${step}".`};
    return{ok:true,value:`${fontSizeAt(theme.typography,step as typeof FONT_SIZE_STEPS[number])}px`};
  }
  // 间距级：`space:<i>`，索引须落在 spacingSequence 的长度内。
  // <lang zh-CN>越界说明当前主题的间距级数，帮助用户改引用而不是改主题。</lang>
  // <lang en>Out-of-range messages name the current level count so users fix the reference, not the theme.</lang>
  const pm=/^space:(\d{1,2})$/.exec(ref);
  if(pm){
    const seq=spacingSequence(theme.spacing);
    const idx=Number(pm[1]);
    const v=seq[idx];
    if(typeof v!=='number')return{ok:false,reasonZh:`间距级 ${idx} 超出当前主题范围（共 ${seq.length} 级）。`,reasonEn:`Spacing level ${idx} is out of range (the theme has ${seq.length} levels).`};
    return{ok:true,value:`${v}px`};
  }
  // 其余一律视为语法错误（TDON-5.6）。
  // <lang zh-CN>文案列出六种合法形式，减少用户猜测。</lang>
  // <lang en>The message lists the six legal forms to remove guesswork.</lang>
  return{ok:false,reasonZh:`令牌引用格式非法：「${ref}」。合法形式：<role>.<shade>、gradient:<role>、on:<role>、font:<group>、fs:<step>、space:<i>。`,reasonEn:`Illegal token reference "${ref}". Legal forms: <role>.<shade>, gradient:<role>, on:<role>, font:<group>, fs:<step>, space:<i>.`};
}

// 判断引用串的**语法形状**是否合法（不查主题）。
// <lang zh-CN>用于 §4 tokens.include / constraints 里"无需主题即可判定"的前置校验。</lang>
// <lang en>Used for pre-checks in §4 tokens.include / constraints where no theme is needed.</lang>
export function isTdonTokenSyntax(ref:string):boolean{
  return /^([a-z][a-z0-9]{0,15})\.([0-9]{1,4})$/.test(ref)
    ||/^gradient:[a-z][a-z0-9-]{0,23}$/.test(ref)
    ||/^on:[a-z][a-z0-9]{0,15}$/.test(ref)
    ||/^font:(body|heading|mono)$/.test(ref)
    ||/^fs:[a-z0-9]{1,10}$/.test(ref)
    ||/^space:\d{1,2}$/.test(ref);
}

// 列出当前主题可用的颜色角色名（供校验器做 aux 越界判定与 UI 提示）。
// <lang zh-CN>顺序固定：主→副→第三→辅助，便于错误文案保持一致。</lang>
// <lang en>Fixed order — primary, secondary, third, auxiliary — keeps error copy consistent.</lang>
export function listTdonColorRoles(theme:Theme):string[]{
  const roles=['primary','secondary'];
  if(theme.thirdColor)roles.push('third');
  theme.auxiliary.forEach((_,i)=>roles.push(`aux${i}`));
  return roles;
}

// 主题可用令牌的完整清单（调试与 UI 下拉数据源）。
// <lang zh-CN>仅颜色角色与色阶、渐变、字体、字号、间距级——与 §5.1 六种形式一一对应。</lang>
// <lang en>Covers exactly the six §5.1 forms: color roles+shades, gradients, fonts, font sizes, spacing levels.</lang>
export function listTdonTokens(theme:Theme):{ref:string;value:string}[]{
  const out:{ref:string;value:string}[]=[];
  // 颜色：每个角色的 10 个标准档。
  // <lang zh-CN>自定义色阶不入清单（数量无上界），但解析器仍支持。</lang>
  // <lang en>Custom shades are excluded from the list (unbounded), though the resolver still supports them.</lang>
  for(const role of listTdonColorRoles(theme)){
    const rc=roleColorFor(theme,role);
    if(!rc)continue;
    out.push({ref:`on:${role}`,value:rc.on});
    for(const [shade,val] of Object.entries(rc.scale))out.push({ref:`${role}.${shade}`,value:val});
  }
  // 渐变：仅列已启用的。
  // <lang zh-CN>与解析器的可用性判定保持一致。</lang>
  // <lang en>Matches the resolver's availability rule.</lang>
  for(const def of GRADIENT_DEFS){
    const cfg=theme.gradients[def.key];
    if(cfg?.enabled)out.push({ref:`gradient:${def.key}`,value:gradientCss(cfg,'literal',theme)});
  }
  // 字体族与字号档。
  // <lang zh-CN>直接复用 typographySpacingVars 保证与导出变量同值。</lang>
  // <lang en>Reuses typographySpacingVars so values match exported variables.</lang>
  const vars=typographySpacingVars(theme);
  for(const g of ['body','heading','mono']as const)out.push({ref:`font:${g}`,value:vars[`--hia-font-${g}`]??''});
  for(const s of FONT_SIZE_STEPS)out.push({ref:`fs:${s}`,value:`${fontSizeAt(theme.typography,s)}px`});
  // 间距级。
  // <lang zh-CN>索引与 --hia-space-<i> 对齐。</lang>
  // <lang en>Indices align with --hia-space-<i>.</lang>
  spacingSequence(theme.spacing).forEach((v,i)=>out.push({ref:`space:${i}`,value:`${v}px`}));
  return out;
}

// 供导出侧使用的完整令牌 CSS（复用内置注入模板生成器，避免两套令牌文本）。
// <lang zh-CN>TDON 的 templateRef「builtin:hia-tokens-css」直接返回此文本。</lang>
// <lang en>The TDON templateRef "builtin:hia-tokens-css" returns exactly this text.</lang>
export function tdonBuiltinTokensCss(theme:Theme):string{
  return exportThemeCss(theme);
}

// 自定义色阶集合（供导出侧补齐 var 引用）。
// <lang zh-CN>直接透出 gradient/render 的去重插值结果，保证与 --hia-* 变量一致。</lang>
// <lang en>Passes through gradient/render's deduplicated interpolation so it matches the --hia-* variables.</lang>
export function tdonCustomShades(theme:Theme){return collectCustomShades(theme);}
