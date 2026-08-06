/**
 * @lang zh-CN 浏览器端颜色归一化：把多种 CSS 颜色格式统一到不透明 sRGB 十六进制。
 *   纯解析部分（hex/rgb/hsl/命名色）可在 Node 单测；依赖浏览器原生解析的格式（oklab/lch/color()/color-mix()）
 *   由 injectParseColor() 注入的运行时函数处理（页面端用 CSS 变量解析或 1×1 canvas）。
 * @lang en Browser-side color normalization: unify CSS color formats to opaque sRGB hex.
 *   Pure parsing (hex/rgb/hsl/named) is Node-testable; browser-only formats (oklab/lch/color()/color-mix())
 *   are resolved by the runtime injected via injectParseColor() (CSS var resolution or 1×1 canvas in-page).
 */

// 本地 HEX 规范化与校验（页面端自包含，避免浏览器 bundle 依赖 @hia/theme-core 运行时）。
// <lang zh-CN>仅做形态归一与 6 位合法性校验；core 侧另有完整实现，此处保持最小可用。</lang>
// <lang en>Local hex normalize/validate so the browser bundle has no runtime dep on core; core keeps its full impl.</lang>
function normalizeHexLocal(value:string):string{
  let hex=String(value||'').trim().toUpperCase();
  if(!hex.startsWith('#'))hex='#'+hex.replace(/^#+/,'');
  return hex;
}
function validHexLocal(value:string):boolean{ return /^#[0-9A-F]{6}$/.test(normalizeHexLocal(value)); }

// CSS 命名色最小白名单（常用品牌/中性色）；完整集合由浏览器原生解析覆盖。
// <lang zh-CN>仅作为 Node 环境下的兜底；真实页面端走 injectParseColor。</lang>
// <lang en>Fallback only under Node; real in-page uses injectParseColor.</lang>
const NAMED:Record<string,string>={
  white:'#FFFFFF', black:'#000000', red:'#FF0000', green:'#008000', blue:'#0000FF',
  transparent:'#00000000', currentcolor:'#000000'
};

// 运行时解析器：由页面端注入，利用浏览器原生 CSS 解析能力解析任意格式。
// <lang zh-CN>默认实现只处理纯函数可解的几种；Page 端应覆盖为 canvas/CSS 变量解析。</lang>
// <lang en>Default handles only pure-parseable formats; the page should override with canvas/CSS-var resolution.</lang>
let runtimeParse:(input:string)=>string|null = (input)=>{
  const key=input.trim().toLowerCase();
  if(key in NAMED)return NAMED[key]!;
  return null;
};

// 注入页面端解析器（真实 scanner 启动时调用）。
// <lang zh-CN>页面端传入利用 getComputedStyle/CSS.supports/1×1 canvas 的函数。</lang>
// <lang en>Page passes a function using getComputedStyle/CSS.supports/1×1 canvas.</lang>
export function injectParseColor(fn:(input:string)=>string|null):void{ runtimeParse=fn; }

// 解析 3/4/6/8 位 HEX。
// <lang zh-CN>4/8 位含 alpha，归一化时丢弃 alpha 取 rgb 部分。</lang>
// <lang en>4/8-digit hex carry alpha; normalization drops alpha, keeps rgb.</lang>
function parseHex(input:string):string|null{
  const m=input.trim().toLowerCase().match(/^#([0-9a-f]{3,8})$/);
  if(!m)return null;
  let h=m[1]!;
  if(h.length===3)h=h.split('').map(c=>c+c).join('');
  if(h.length===4)h=h.slice(0,3);
  if(h.length===8)h=h.slice(0,6);
  if(h.length!==6)return null;
  return '#'+h;
}

// 解析 rgb()/rgba() 旧/新语法（含百分比）。
// <lang zh-CN>百分比按 255 折算；alpha 丢弃。</lang>
// <lang en>Percentages scaled by 255; alpha dropped.</lang>
function parseRgb(input:string):string|null{
  const m=input.trim().toLowerCase().match(/^rgba?\(\s*([^)]+)\s*\)$/);
  if(!m)return null;
  const parts=m[1]!.split(/[,/\s]+/).filter(Boolean);
  if(parts.length<3)return null;
  const to255=(p:string)=>p.endsWith('%')?Math.round(parseFloat(p)/100*255):parseInt(p,10);
  const r=to255(parts[0]!), g=to255(parts[1]!), b=to255(parts[2]!);
  if([r,g,b].some(n=>Number.isNaN(n)||n<0||n>255))return null;
  const h=(n:number)=>n.toString(16).padStart(2,'0');
  return '#'+h(r)+h(g)+h(b);
}

// 解析 hsl()/hsla()（含百分比与角度）。
// <lang zh-CN>hsl→rgb 标准转换；alpha 丢弃。</lang>
// <lang en>Standard hsl→rgb; alpha dropped.</lang>
function parseHsl(input:string):string|null{
  const m=input.trim().toLowerCase().match(/^hsla?\(\s*([^)]+)\s*\)$/);
  if(!m)return null;
  const parts=m[1]!.split(/[,/\s]+/).filter(Boolean);
  if(parts.length<3)return null;
  const h=parseFloat(parts[0]!)/360;
  const s=parseFloat(parts[1]!.replace('%',''))/100;
  const l=parseFloat(parts[2]!.replace('%',''))/100;
  if([h,s,l].some(Number.isNaN))return null;
  const k=(n:number)=>(n+h*12)%12;
  const a=s*Math.min(l,1-l);
  const f=(n:number)=>l-a*Math.max(-1,Math.min(k(n)-3,Math.min(9-k(n),1)));
  const to255=(x:number)=>Math.round(255*Math.max(0,Math.min(1,x)));
  const r=to255(f(0)), g=to255(f(8)), b=to255(f(4));
  const hx=(n:number)=>n.toString(16).padStart(2,'0');
  return '#'+hx(r)+hx(g)+hx(b);
}

/**
 * @lang zh-CN 归一化任意 CSS 颜色字符串为不透明 sRGB 十六进制（非法/透明返回 null）。
 *   解析顺序：hex → rgb → hsl → 命名色 → 运行时注入的浏览器解析器。
 * @lang en Normalize any CSS color string to opaque sRGB hex (null if invalid/transparent).
 *   Order: hex → rgb → hsl → named → injected browser parser.
 */
export function normalizeBrowserColor(input:string):string|null{
  if(!input||input==='transparent')return null;
  const hex=parseHex(input);
  if(hex&&validHexLocal(hex))return normalizeHexLocal(hex).toLowerCase();
  const rgb=parseRgb(input);
  if(rgb&&validHexLocal(rgb))return normalizeHexLocal(rgb).toLowerCase();
  const hsl=parseHsl(input);
  if(hsl&&validHexLocal(hsl))return normalizeHexLocal(hsl).toLowerCase();
  const named=runtimeParse(input);
  if(named&&validHexLocal(named))return normalizeHexLocal(named).toLowerCase();
  return null;
}
