/**
 * @lang zh-CN 颜色空间转换：HEX ↔ sRGB(0–1) ↔ OKLab ↔ OKLCH。所有算法源于 HIA 单文件工具的已验证实现。
 * @lang en Color space conversions: HEX ↔ sRGB(0–1) ↔ OKLab ↔ OKLCH. Ported from the verified single-file HIA tool.
 */

/** @lang zh-CN 将数值限制在 [min, max] 区间。 @lang en Clamp a number into the [min, max] range. */
export function clamp(value: number, min: number, max: number): number {
  // <lang zh-CN>若超出下界取 min，超出上界取 max，否则原值返回。</lang>
  // <lang en>Return min if below, max if above, otherwise the value itself.</lang>
  return Math.max(min, Math.min(max, value));
}

/**
 * @lang zh-CN 规范化 HEX：去除多余 # 并转大写，保证 #RRGGBB 形式。
 * @lang en Normalize HEX: strip redundant # and uppercase, ensuring #RRGGBB form.
 */
export function normalizeHex(value: string): string {
  // <lang zh-CN>先转字符串并去首尾空白，避免前后空格导致解析失败。</lang>
  // <lang en>Coerce to string and trim, avoiding parse failure from surrounding spaces.</lang>
  let x = String(value ?? '').trim().toUpperCase();
  // <lang zh-CN>统一补一个 # 前缀，无论用户是否输入。</lang>
  // <lang en>Ensure a single leading # regardless of user input.</lang>
  if (!x.startsWith('#')) x = '#' + x.replace(/^#+/, '');
  return x;
}

/**
 * @lang zh-CN 校验是否为合法的 6 位 HEX（#RRGGBB）。
 * @lang en Validate a legal 6-digit HEX (#RRGGBB).
 */
export function validHex(value: string): boolean {
  // <lang zh-CN>先规范化再正则匹配，避免大小写或多余 # 干扰。</lang>
  // <lang en>Normalize first, then regex match to ignore case or stray #.</lang>
  return /^#[0-9A-F]{6}$/.test(normalizeHex(value));
}

/**
 * @lang zh-CN 将 HEX 转为 sRGB 分量数组（每分量 0–1）。
 * @lang en Convert HEX to sRGB channel array (each channel 0–1).
 */
export function hexToRgb(hex: string): [number, number, number] {
  // <lang zh-CN>取规范化后的 6 位十六进制，按 RR/GGBB/BB 解析为 0–255 再归一化。</lang>
  // <lang en>Take the 6 hex digits, parse RR/GGBB/BB to 0–255 then normalize to 0–1.</lang>
  const h = normalizeHex(hex).slice(1);
  return [
    parseInt(h.slice(0, 2), 16) / 255,
    parseInt(h.slice(2, 4), 16) / 255,
    parseInt(h.slice(4, 6), 16) / 255
  ];
}

/**
 * @lang zh-CN 将 sRGB 分量数组（0–1）转回 #RRGGBB（大写）。
 * @lang en Convert sRGB channel array (0–1) back to #RRGGBB (uppercase).
 */
export function rgbToHex(rgb: [number, number, number]): string {
  // <lang zh-CN>逐通道钳制到 0–1、乘 255、四舍五入并补零为两位十六进制。</lang>
  // <lang en>Per-channel clamp to 0–1, scale to 255, round and pad to two hex digits.</lang>
  return (
    '#' +
    rgb
      .map((v) => Math.round(clamp(v, 0, 1) * 255).toString(16).padStart(2, '0'))
      .join('')
      .toUpperCase()
  );
}

/** @lang zh-CN sRGB 转线性光（gamma 解码）。 @lang en sRGB to linear light (gamma decode). */
export function srgbToLinear(c: number): number {
  // <lang zh-CN>低于阈值为线性段，否则采用 1.055 幂律解码（IEC 61966-2-1）。</lang>
  // <lang en>Linear segment below threshold, otherwise 1.055 power-law decode (IEC 61966-2-1).</lang>
  return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
}

/** @lang zh-CN 线性光转 sRGB（gamma 编码）。 @lang en Linear light to sRGB (gamma encode). */
function linearToSrgb(c: number): number {
  // <lang zh-CN>低值走线性段，其余走逆幂律编码。</lang>
  // <lang en>Low values use linear segment, others use inverse power-law encode.</lang>
  return c <= 0.0031308 ? 12.92 * c : 1.055 * Math.pow(c, 1 / 2.4) - 0.055;
}

/**
 * @lang zh-CN 将 sRGB(0–1) 转 OKLab。
 * @lang en Convert sRGB(0–1) to OKLab.
 */
export function rgbToOklab(rgb: [number, number, number]): [number, number, number] {
  // <lang zh-CN>先对三通道做 gamma 解码得到线性光。</lang>
  // <lang en>Gamma-decode each channel to linear light first.</lang>
  const [r, g, b] = rgb.map(srgbToLinear);
  // <lang zh-CN>通过 Björn Ottosson 的线性矩阵得到 LMS 立方根，再合成 OKLab 三轴。</lang>
  // <lang en>Use Ottosson's linear matrix to LMS cube roots, then compose OKLab axes.</lang>
  const l = 0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b;
  const m = 0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b;
  const s = 0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b;
  const l_ = Math.cbrt(l);
  const m_ = Math.cbrt(m);
  const s_ = Math.cbrt(s);
  return [
    0.2104542553 * l_ + 0.793617785 * m_ - 0.0040720468 * s_,
    1.9779984951 * l_ - 2.428592205 * m_ + 0.4505937099 * s_,
    0.0259040371 * l_ + 0.7827717662 * m_ - 0.808675766 * s_
  ];
}

/**
 * @lang zh-CN 将 OKLab 转回 sRGB(0–1)。
 * @lang en Convert OKLab back to sRGB(0–1).
 */
export function oklabToRgb(lab: [number, number, number]): [number, number, number] {
  // <lang zh-CN>由 OKLab 反算 LMS 立方根，再立方得到线性光。</lang>
  // <lang en>Invert OKLab to LMS cube roots, then cube to linear light.</lang>
  const [L, A, B] = lab;
  const l_ = L + 0.3963377774 * A + 0.2158037573 * B;
  const m_ = L - 0.1055613458 * A - 0.0638541728 * B;
  const s_ = L - 0.0894841775 * A - 1.291485548 * B;
  const l = l_ ** 3;
  const m = m_ ** 3;
  const s = s_ ** 3;
  // <lang zh-CN>线性光经 gamma 编码得到最终 sRGB 通道。</lang>
  // <lang en>Gamma-encode linear light into final sRGB channels.</lang>
  return [
    linearToSrgb(4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s),
    linearToSrgb(-1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s),
    linearToSrgb(-0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s)
  ];
}

/**
 * @lang zh-CN 将 HEX 转 OKLCH（L 亮度、C 彩度、h 色相角）。
 * @lang en Convert HEX to OKLCH (L lightness, C chroma, h hue angle).
 */
export function hexToOklch(hex: string): { L: number; C: number; h: number } {
  // <lang zh-CN>先到 OKLab，再由 a/b 求极坐标得到 C 与 h。</lang>
  // <lang en>Go to OKLab, then derive polar C and h from a/b.</lang>
  const [L, a, b] = rgbToOklab(hexToRgb(hex));
  return {
    L,
    C: Math.hypot(a, b),
    h: ((Math.atan2(b, a) * 180) / Math.PI + 360) % 360
  };
}

/**
 * @lang zh-CN 将 OKLCH 转 sRGB(0–1)，不做色域裁剪。
 * @lang en Convert OKLCH to sRGB(0–1) without gamut clipping.
 */
export function oklchToRgb(L: number, C: number, h: number): [number, number, number] {
  // <lang zh-CN>由色相角还原 a/b 笛卡尔坐标，再回 OKLab 与 sRGB。</lang>
  // <lang en>Reconstruct a/b from hue angle, then back to OKLab and sRGB.</lang>
  const rad = (h * Math.PI) / 180;
  return oklabToRgb([L, C * Math.cos(rad), C * Math.sin(rad)]);
}

/**
 * @lang zh-CN 判断 sRGB 是否落在 0–1 显示色域内。
 * @lang en Whether sRGB lies within the 0–1 display gamut.
 */
export function inGamut(rgb: [number, number, number]): boolean {
  // <lang zh-CN>任一通道越界即视为超出色域。</lang>
  // <lang en>Any out-of-range channel means out of gamut.</lang>
  return rgb.every((v) => v >= 0 && v <= 1);
}

/**
 * @lang zh-CN 色域映射：当 OKLCH 转 sRGB 越界时二分缩小 C 直到可显示，返回 HEX 与最终 C。
 * @lang en Gamut map: when OKLCH→sRGB overflows, binary-search shrink C until displayable; return HEX and final C.
 */
export function gamutMapOklch(L: number, C: number, h: number): { hex: string; C: number } {
  // <lang zh-CN>先尝试原彩度；若已在色域内直接返回。</lang>
  // <lang en>Try original chroma first; if already in gamut, return directly.</lang>
  let rgb = oklchToRgb(L, C, h);
  if (inGamut(rgb)) return { hex: rgbToHex(rgb), C };
  // <lang zh-CN>否则在 [0, C] 上二分：保留可显示的下界，逐步逼近最大可显示彩度。</lang>
  // <lang en>Otherwise binary-search in [0, C]: keep displayable lower bound, approach max displayable chroma.</lang>
  let low = 0;
  let high = C;
  for (let i = 0; i < 28; i++) {
    const mid = (low + high) / 2;
    rgb = oklchToRgb(L, mid, h);
    if (inGamut(rgb)) low = mid;
    else high = mid;
  }
  // <lang zh-CN>用逼近到的下界彩度生成最终 HEX。</lang>
  // <lang en>Generate final HEX with the approached lower-bound chroma.</lang>
  return { hex: rgbToHex(oklchToRgb(L, low, h)), C: low };
}
