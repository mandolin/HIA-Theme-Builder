/**
 * @lang zh-CN 导出适配器共享工具（内部模块，不进公共 barrel）：名称 slug 化、令牌 CSS 变量块拼装。
 *   全部为确定性纯函数——同一主题输入必得逐字节相同的输出，这是可复现性单测的前提（`ADR-005`）。
 * @lang en Shared helpers for export adapters (internal module, not in the public barrel): name slugification
 *   and token CSS variable block assembly. All are deterministic pure functions — identical input yields
 *   byte-identical output, which is the precondition for reproducibility tests (`ADR-005`).
 */
import type{Theme}from'../types.js';
import{exportThemeCss}from'../token/css.js';
import{typographySpacingVars}from'../token/typography.js';

// 将主题名归一化为 ASCII kebab-case slug（用于文件名/文本域，不含扩展名）。
// <lang zh-CN>仅保留字母数字序列并以连字符连接；中文等非 ASCII 字符被剔除，结果为空时回退 'theme'。
//   不做音译——slug 只用于文件名唯一性，主题的可读名仍完整保留在产物内部。</lang>
// <lang en>Keeps alphanumerics as hyphen-joined runs; non-ASCII (e.g. CJK) is stripped, falling back to
//   'theme' when empty. No transliteration — slugs only disambiguate filenames, readable names stay intact
//   inside the artifacts.</lang>
export function slugifyThemeName(name:string):string{
  // 按非字母数字切分后重组：保留大小写原样的小写化交给调用方语义（此处统一小写，文件名惯例）。
  // <lang zh-CN>toLowerCase 保证 Windows 大小写不敏感文件系统上的稳定行为。</lang>
  // <lang en>toLowerCase keeps behavior stable on case-insensitive filesystems such as Windows.</lang>
  const slug=name.toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'');
  return slug||'theme';
}

// 使任意文本可安全嵌入块注释（/* … */）与 JS 模板头：中和注释结束符 `*/`。
// <lang zh-CN>主题名可由用户任意输入（如含 `*/` 的名字会提前终结注释、破坏生成文件）；
//   以 U+2215（∕）替换斜杠，保留视觉形态且不再是合法结束符。</lang>
// <lang en>Theme names are user input (a name containing `*/` would terminate the comment early and corrupt the
//   generated file); the slash is replaced with U+2215 (∕), preserving the visual form while no longer closing.</lang>
export function commentSafe(text:string):string{
  return text.replace(/\*\//g,'*∕');
}

// 生成字体/间距令牌的 :root CSS 块（ADR-006 变量面 --hia-font-* / --hia-fs-* / --hia-space-*）。
// <lang zh-CN>颜色与渐变变量由 exportThemeCss 输出独立 :root 块；本函数补齐字体/间距，多 :root 块为合法 CSS。</lang>
// <lang en>Color/gradient vars come from exportThemeCss in their own :root block; this adds font/spacing vars.
//   Multiple :root blocks are valid CSS.</lang>
export function typographySpacingCssBlock(theme:Theme):string{
  // 取变量映射后按固定插入序输出（typographySpacingVars 的键序即生成序，确定性）。
  // <lang zh-CN>每行两个空格缩进，与 exportThemeCss 的缩进风格一致。</lang>
  // <lang en>Two-space indent per line, consistent with exportThemeCss style.</lang>
  const lines=Object.entries(typographySpacingVars(theme)).map(([k,v])=>`  ${k}: ${v};`);
  return`:root {\n${lines.join('\n')}\n}`;
}

// 生成"完整令牌 CSS"文本：颜色/渐变块 + 字体/间距块 + 头部说明注释。
// <lang zh-CN>Tailwind 适配器的 tokens.css 与通用注入适配器的 hia-tokens.css 共用此生成器，仅头部注释不同。</lang>
// <lang en>The Tailwind adapter's tokens.css and the generic injector's hia-tokens.css share this generator,
//   differing only in the header comment.</lang>
export function fullTokenCss(theme:Theme,headerComment:string):string{
  // 头部说明 + 颜色/渐变 :root 块 + 空行 + 字体/间距 :root 块，结尾换行保证文件以 \n 结束。
  // <lang zh-CN>顺序固定：先颜色后排版，消费方阅读与 diff 均稳定。</lang>
  // <lang en>Fixed order: colors first, then typography — stable for consumers and diffs.</lang>
  return`${headerComment}\n\n${exportThemeCss(theme)}\n\n${typographySpacingCssBlock(theme)}\n`;
}
