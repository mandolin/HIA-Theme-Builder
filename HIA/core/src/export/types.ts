/**
 * @lang zh-CN 导出适配器契约（`ADR-005` / `W-tb-P9`）。适配器是纯函数：输入已构建主题，输出虚拟文件树；
 *   core 不做 IO 与打包，ZIP 由 web 层（fflate）完成。内置适配器与 TDON 声明式适配器共享同一形态。
 * @lang en Export adapter contract (`ADR-005` / `W-tb-P9`). Adapters are pure functions: a built theme in,
 *   a virtual file tree out; core does no IO or packaging — ZIP is assembled by the web layer (fflate).
 *   Built-in adapters and TDON declarative adapters share this same shape.
 */
import type{Theme}from'../types.js';

// 虚拟文件：相对路径 + 文本内容（适配器只产文本产物，二进制不在 v1 范围）。
// <lang zh-CN>path 一律使用 POSIX 斜杠与相对路径，保证跨端产物一致与可复现。</lang>
// <lang en>path always uses POSIX slashes and is relative, keeping artifacts identical and reproducible across runtimes.</lang>
export interface VirtualFile{path:string;content:string;}

// 适配器可选参数。
// <lang zh-CN>当前仅 WordPress 子主题需要 parentTemplate（父主题目录 slug，决定 style.css 的 Template 头）。</lang>
// <lang en>Currently only the WordPress child theme needs parentTemplate (parent theme dir slug for the style.css Template header).</lang>
export interface ExportAdapterOptions{parentTemplate?:string;}

// 导出目标：注册表条目——目标元信息 + 文件树纯函数 + 打包名建议。
// <lang zh-CN>files 必须是确定性的纯函数（同入参必同输出），供单测做可复现性断言；archiveName 由 web 层用于 ZIP 下载文件名。</lang>
// <lang en>files must be a deterministic pure function (same input, same output) so tests can assert reproducibility;
//   archiveName is used by the web layer as the ZIP download filename.</lang>
export interface ExportTarget{
  /** @lang zh-CN 目标 id（kebab-case，全局唯一，注册表检索键）。 @lang en Target id (kebab-case, globally unique, registry lookup key). */
  id:string;
  /** @lang zh-CN 中文名（UI 展示）。 @lang en Chinese display name (UI). */
  name:string;
  /** @lang en English display name (UI). @lang zh-CN 英文名（UI 展示）。 */
  nameEn:string;
  /** @lang zh-CN 中文说明（适用场景与产物清单）。 @lang en Chinese notes (use cases and artifact list). */
  notes:string;
  /** @lang en English notes. @lang zh-CN 英文说明。 */
  notesEn:string;
  // 生成 ZIP 下载文件名（含扩展名，确定性）。
  // <lang zh-CN>基于主题名 slug 化；web 层直接使用，不再自行拼接。</lang>
  // <lang en>Derived from a slugified theme name; the web layer uses it as-is.</lang>
  archiveName(theme:Theme):string;
  // 生成该目标的虚拟文件树（纯函数）。
  // <lang zh-CN>可选 options 只承载跨端可序列化的简单值（如父主题 slug），保持 core 无 IO。</lang>
  // <lang en>Optional options only carry serializable simple values (e.g. parent slug), keeping core IO-free.</lang>
  files(theme:Theme,options?:ExportAdapterOptions):VirtualFile[];
}
