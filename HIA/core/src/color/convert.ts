// 将数值限制在 [min,max] 区间内（用于色阶分量钳制）。
// <lang zh-CN>纯函数；rgb 分量与亮度计算常用，避免越界导致色值非法。</lang>
// <lang en>Pure helper; used by RGB components and lightness math to keep values in legal range.</lang>
export function clamp(value:number,min:number,max:number):number{return Math.max(min,Math.min(max,value));}

// 规范化 HEX 字符串：去空格、补 '#'、转大写，得到统一表示。
// <lang zh-CN>容忍 "#abc"、"ABC"、多余 '#' 等输入；不校验长度，仅做形态归一。</lang>
// <lang en>Tolerates "#abc", "ABC", extra '#'; normalizes shape without length validation.</lang>
export function normalizeHex(value:string):string{
  let hex=String(value||'').trim().toUpperCase();
  // 缺省 '#' 时补上，并去掉首个字符前多余 '#'。
  // <lang zh-CN>保证结果以单个 '#' 开头。</lang>
  // <lang en>Ensures exactly one leading '#'.</lang>
  if(!hex.startsWith('#'))hex='#'+hex.replace(/^#+/,'');
  return hex;
}

// 校验是否为合法的 6 位 HEX（#RRGGBB）。
// <lang zh-CN>先 normalizeHex 再正则，确保 "#abc" 会被判为非法（长度不足）。</lang>
// <lang en>Normalizes first then regex-tests, so "#abc" is rejected for insufficient length.</lang>
export function validHex(value:string):boolean{return /^#[0-9A-F]{6}$/.test(normalizeHex(value));}

// 将 HEX 解析为 0..1 范围的 RGB 三元组。
// <lang zh-CN>取后 6 位按 16 进制分段并归一化到 [0,1]。</lang>
// <lang en>Takes the last 6 hex digits, parses each channel and normalizes to [0,1].</lang>
export function hexToRgb(hex:string):[number,number,number]{
  const value=normalizeHex(hex).slice(1);
  return[parseInt(value.slice(0,2),16)/255,parseInt(value.slice(2,4),16)/255,parseInt(value.slice(4,6),16)/255];
}

// 将 0..1 的 RGB 三元组编码回大写 HEX，分量越界先钳制。
// <lang zh-CN>四舍五入后转 16 进制并补零，保证两位通道。</lang>
// <lang en>Rounds then hex-encodes each channel zero-padded to two digits.</lang>
export function rgbToHex(rgb:readonly number[]):string{return'#'+rgb.map(value=>Math.round(clamp(value,0,1)*255).toString(16).padStart(2,'0')).join('').toUpperCase();}

// sRGB 编码值转线性光（gamma 解码），阈值分段处理。
// <lang zh-CN>低于 0.04045 走线性近似，否则走 2.4 次幂；为 OKLab 计算前置步骤。</lang>
// <lang en>Linearizes sRGB; below 0.04045 uses the linear approximation, else 2.4 power; pre-step for OKLab.</lang>
export function srgbToLinear(value:number):number{return value<=.04045?value/12.92:Math.pow((value+.055)/1.055,2.4);}

// 线性光转 sRGB 编码值（gamma 编码），阈值分段处理。
// <lang zh-CN>srgbToLinear 的逆运算，用于 OKLab 回到显示空间。</lang>
// <lang en>Inverse of srgbToLinear; returns from OKLab to display space.</lang>
export function linearToSrgb(value:number):number{return value<=.0031308?12.92*value:1.055*Math.pow(value,1/2.4)-.055;}

// 线性 RGB 转 OKLab（Björn Ottosson 标准矩阵）。
// <lang zh-CN>先线性化，再经 LMS 立方根与线性变换得到感知均匀的 L/a/b。</lang>
// <lang en>Linearizes, then LMS cube-root and linear transform to perceptually uniform L/a/b.</lang>
export function rgbToOklab(rgb:readonly number[]):[number,number,number]{
  const[r,g,b]=rgb.map(srgbToLinear) as[number,number,number];
  // 线性 RGB 混合到 LMS 锥空间。
  // <lang zh-CN>三组固定系数来自 OKLab 官方定义。</lang>
  // <lang en>Fixed coefficients come from the official OKLab definition.</lang>
  const l=.4122214708*r+.5363325363*g+.0514459929*b,
    m=.2119034982*r+.6806995451*g+.1073969566*b,
    s=.0883024619*r+.2817188376*g+.6299787005*b;
  // LMS 取立方根后线性组合为 OKLab。
  // <lang zh-CN>cube root 为非线性感知压缩，使亮度近似线性。</lang>
  // <lang en>Cube root is the non-linear perception compression making lightness near-linear.</lang>
  const l_=Math.cbrt(l),m_=Math.cbrt(m),s_=Math.cbrt(s);
  return[.2104542553*l_+.793617785*m_-.0040720468*s_,1.9779984951*l_-2.428592205*m_+.4505937099*s_,.0259040371*l_+.7827717662*m_-.808675766*s_];
}

// OKLab 转线性 RGB（rgbToOklab 的逆运算）。
// <lang zh-CN>先反变换回 LMS 立方，再三次方反伽马编码到 sRGB。</lang>
// <lang en>Inverts to LMS cubes, then cubic and gamma-encodes back to sRGB.</lang>
export function oklabToRgb([L,a,b]:readonly[number,number,number]):[number,number,number]{
  const l_=L+.3963377774*a+.2158037573*b,
    m_=L-.1055613458*a-.0638541728*b,
    s_=L-.0894841775*a-1.291485548*b;
  // LMS 立方恢复为线性光。
  // <lang zh-CN>三次方抵消之前的 cube root。</lang>
  // <lang en>Cubing undoes the earlier cube root.</lang>
  const l=l_**3,m=m_**3,s=s_**3;
  // 线性光经固定矩阵转回 sRGB 并 gamma 编码。
  // <lang zh-CN>结果可能越界，交由调用方做色域判定/映射。</lang>
  // <lang en>Result may be out of gamut; the caller decides gamut check/mapping.</lang>
  return[linearToSrgb(4.0767416621*l-3.3077115913*m+.2309699292*s),linearToSrgb(-1.2684380046*l+2.6097574011*m-.3413193965*s),linearToSrgb(-.0041960863*l-.7034186147*m+1.707614701*s)];
}

// HEX 转 OKLCH（极坐标 OKLab），分解为亮度 L、彩度 C、色相 h(0..360)。
// <lang zh-CN>a/b 经勾股得 C，atan2 得色相；加 360 取模保证非负角度。</lang>
// <lang en>Pythagorean a/b gives C; atan2 gives hue; +360 mod 360 keeps a non-negative angle.</lang>
export function hexToOklch(hex:string):{L:number;C:number;h:number}{
  const[L,a,b]=rgbToOklab(hexToRgb(hex));
  return{L,C:Math.hypot(a,b),h:(Math.atan2(b,a)*180/Math.PI+360)%360};
}

// OKLCH 转 RGB：把极坐标 C/h 还原为 OKLab 的 a/b 后再转 RGB。
// <lang zh-CN>色相转弧度，C 投影到 a/b 轴。</lang>
// <lang en>Converts hue to radians and projects C onto the a/b axes.</lang>
export function oklchToRgb(L:number,C:number,h:number):[number,number,number]{
  const radians=h*Math.PI/180;
  return oklabToRgb([L,C*Math.cos(radians),C*Math.sin(radians)]);
}

// 判断 RGB 三元组是否全部落在 sRGB 色域 [0,1] 内。
// <lang zh-CN>任一分量越界即视为超出可显示范围。</lang>
// <lang en>Any out-of-range channel means the color is not displayable.</lang>
export function inGamut(rgb:readonly number[]):boolean{return rgb.every(value=>value>=0&&value<=1);}

// OKLCH 色域映射：保持 L/h 不变，二分收窄 C 直到落入 sRGB。
// <lang zh-CN>在色域内直接返回原彩度；否则 28 次二分逼近最大可显示彩度，写入时返回十六进制并附最终 C。</lang>
// <lang en>In-gamut returns original C; otherwise 28 bisections find the max displayable C, returning hex plus the final C.</lang>
export function gamutMapOklch(L:number,C:number,h:number):{hex:string;C:number}{
  let rgb=oklchToRgb(L,C,h);
  // 已在色域内则无需收窄。
  // <lang zh-CN>直接返回，保留原始彩度。</lang>
  // <lang en>Return directly, preserving the original chroma.</lang>
  if(inGamut(rgb))return{hex:rgbToHex(rgb),C};
  // 二分搜索最大可显示彩度：low 始终可显示，high 不可显示。
  // <lang zh-CN>28 次迭代精度足以满足视觉；最终取 low 端作为安全彩度。</lang>
  // <lang en>28 iterations suffice visually; low end is taken as the safe chroma.</lang>
  let low=0,high=C;
  for(let i=0;i<28;i++){
    const mid=(low+high)/2;
    rgb=oklchToRgb(L,mid,h);
    if(inGamut(rgb))low=mid;else high=mid;
  }
  return{hex:rgbToHex(oklchToRgb(L,low,h)),C:low};
}
