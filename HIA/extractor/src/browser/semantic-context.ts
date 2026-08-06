/**
 * @lang zh-CN 语义上下文识别：从元素的 tag/role/aria/class/data-* 推断其颜色应承担的角色。
 *   纯函数，无 DOM 依赖，可在 Node 单测；真实 scanner 在页面端调用本模块后聚合。
 * @lang en Semantic context recognition: infer a color's role from tag/role/aria/class/data-*.
 *   Pure, DOM-free, Node-testable; the real scanner calls this in-page then aggregates.
 */

import type { SemanticRole } from '@hia/theme-core';

// 语义关键词 → 角色映射（按优先级匹配，后匹配不覆盖更高优先级的命中）。
// <lang zh-CN>status 必须靠上下文判定，不凭色相；这里只处理类名/属性中的语义词。</lang>
// <lang en>Status is context-derived, never by hue; we only read semantic words in names/attrs.</lang>
const ROLE_KEYWORDS:Array<[RegExp,SemanticRole]>=[
  [/\b(brand|logo)\b/i,'brand'],
  [/\bprimary\b/i,'primary'],
  [/\bsecondary\b/i,'secondary'],
  [/\baccent\b/i,'accent'],
  [/\bcta\b/i,'cta'],
  [/\b(button|btn)\b/i,'cta'],
  [/\b(link|anchor|a-)\b/i,'link'],
  [/\b(header|hero|nav|topbar|navbar)\b/i,'primary'],
  [/\b(card|panel)\b/i,'surface'],
  [/\b(border|divider|rule)\b/i,'border'],
  [/\b(icon|avatar)\b/i,'icon'],
  [/\b(text|title|heading|paragraph|body)\b/i,'text'],
  // status 仅当类名显式含状态词，且需配合上下文，不作为默认。
  [/\b(success|ok|valid|passed)\b/i,'status'],
  [/\b(warning|warn|alert|caution)\b/i,'status'],
  [/\b(error|danger|danger|fail|invalid|critical)\b/i,'status'],
  [/\b(info|notice)\b/i,'status']
];

// 从标签名得到基础角色倾向（在无语义类名时作为兜底）。
// <lang zh-CN>a → link；button → cta；header → primary；img/svg 相关 → 可能 logo。</lang>
// <lang en>a → link; button → cta; header → primary; img/svg-ish → possible logo.</lang>
export function roleFromTag(tag:string):SemanticRole{
  switch(tag.toLowerCase()){
    case 'a': return 'link';
    case 'button': return 'cta';
    case 'header': case 'nav': return 'primary';
    case 'img': case 'svg': return 'icon';
    case 'input': case 'textarea': return 'text';
    default: return 'unknown';
  }
}

/**
 * @lang zh-CN 综合推断角色：类名/属性优先，其次标签兜底，最后 unknown。
 *   输入为元素的可读上下文（小写化后的 class、id、role、tag、若干 data-* 值拼接）。
 * @lang en Resolve role: class/attr first, tag fallback, else unknown.
 *   Input is a lowercased concatenation of class/id/role/tag/data-* values.
 */
export function resolveSemanticRole(contextText:string, tag:string):SemanticRole{
  for(const [re,role] of ROLE_KEYWORDS){
    if(re.test(contextText))return role;
  }
  return roleFromTag(tag);
}

// 限制上下文示例数量，防止跨进程数据膨胀。
// <lang zh-CN>指令要求 selectors/contexts 设上限；这里统一为常数。</lang>
// <lang en>Spec caps selectors/contexts; shared constant here.</lang>
export const MAX_CONTEXTS=5;
export const MAX_SELECTORS=3;

// 截取上下文示例到上限，去重并保留顺序。
// <lang zh-CN>同色同来源同角色先在页面端聚合，最多保留少量示例。</lang>
// <lang en>Same color/source/role aggregated in-page first; keep only a few examples.</lang>
export function clampExamples(items:string[]):string[]{
  const seen=new Set<string>();
  const out:string[]=[];
  for(const it of items){
    const k=it.slice(0,80);
    if(seen.has(k))continue;
    seen.add(k);
    out.push(k);
    if(out.length>=MAX_CONTEXTS)break;
  }
  return out;
}
