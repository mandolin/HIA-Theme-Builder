/**
 * @lang zh-CN 导出目标注册表（`ADR-005` / `W-tb-P9`）：内置适配器按 id 检索；TDON 运行时后续以同一
 *   ExportTarget 形态注册自定义目标（同构）。注册表不可变（frozen），防止运行时被意外改写。
 * @lang en Export-target registry (`ADR-005` / `W-tb-P9`): built-in adapters looked up by id; the future TDON
 *   runtime registers custom targets in the same ExportTarget shape (isomorphic). The registry is frozen
 *   against accidental runtime mutation.
 */
import type{ExportTarget}from'./types.js';
import{wordpressChildTarget}from'./wordpress.js';
import{tailwindConfigTarget}from'./tailwind.js';
import{injectTemplateTarget}from'./inject-template.js';

// 内置导出目标清单（顺序即 UI 展示顺序：WP → Tailwind → 通用注入）。
// <lang zh-CN>与 `W-tb-P9` 计划 §3.2-3.4 的首批栈对应；深冻结保证清单与条目均不可变。</lang>
// <lang en>Matches the first batch stacks in the `W-tb-P9` plan §3.2-3.4; deep-frozen so neither list nor entries mutate.</lang>
export const EXPORT_TARGETS:readonly ExportTarget[]=[
  wordpressChildTarget,
  tailwindConfigTarget,
  injectTemplateTarget
].map(t=>Object.freeze({...t}) as ExportTarget);

// 按 id 检索导出目标。
// <lang zh-CN>未命中返回 undefined，由 UI 层决定报错方式；id 精确匹配（大小写敏感）。</lang>
// <lang en>Returns undefined when missing (UI decides how to report); ids match exactly (case-sensitive).</lang>
export function getExportTarget(id:string):ExportTarget|undefined{
  return EXPORT_TARGETS.find(t=>t.id===id);
}

// 列出全部内置导出目标（UI 目标选择器数据源）。
// <lang zh-CN>返回 frozen 数组本身（只读视图），不做复制以避免额外分配。</lang>
// <lang en>Returns the frozen array itself (read-only view) without copying.</lang>
export function listExportTargets():readonly ExportTarget[]{
  return EXPORT_TARGETS;
}
