/**
 * @lang zh-CN 页面端证据聚合：把 scanner 逐元素采集的原始记录按 颜色+来源+角色 唯一聚合。
 *   频次、面积、像素占比在聚合时合并；selectors/contexts 截断到上限。纯函数，可在 Node 单测。
 * @lang en In-page evidence aggregation: merges per-element raw records by color+source+role.
 *   count/area/pixel merge at aggregation; selectors/contexts capped. Pure, Node-testable.
 */

import type { ColorEvidence, ColorSource, SemanticRole } from '@hia/theme-core';
import { clampExamples, MAX_SELECTORS } from './semantic-context.js';

// scanner 单条原始采集记录（未聚合）。
// <lang zh-CN>authorValue 保留作者声明（var(--x)/oklch(...)），hex 为归一化不透明值。</lang>
// <lang en>authorValue keeps the declared form; hex is normalized opaque.</lang>
export interface RawEvidence{
  authorValue:string;
  hex:string;
  alpha:number;
  source:ColorSource;
  role:SemanticRole;
  count?:number;
  areaRatio?:number;
  aboveFoldRatio?:number;
  pixelRatio?:number;
  tokenName?:string;
  context?:string;
  selector?:string;
  frameKind?:'main'|'same-origin'|'third-party';
}

// 聚合键：颜色+来源+角色+帧类型，四元组唯一标识一条证据。
// <lang zh-CN>同色同来源同角色跨多元素合并为一条，避免记录爆炸。</lang>
// <lang en>Same color+source+role across elements merges to one record, avoiding record explosion.</lang>
function keyOf(e:RawEvidence):string{
  return [e.hex,e.source,e.role,e.frameKind??'main'].join('|');
}

// tokenName 上限，防止 CSS 变量名集合无限膨胀。
// <lang zh-CN>指令要求对 tokenNames 设上限，与 contexts/selectors 一致。</lang>
// <lang en>Spec caps tokenNames like contexts/selectors.</lang>
const MAX_TOKENS=8;

// 去重追加 token 名到数组，超上限截断。
// <lang zh-CN>保留首次出现顺序。</lang>
// <lang en>Keep first-seen order.</lang>
function pushToken(arr:string[]|undefined,name:string):string[]|undefined{
  const base=arr??[];
  if(base.includes(name))return base;
  const next=[...base,name];
  return next.length>MAX_TOKENS?next.slice(0,MAX_TOKENS):next;
}

/**
 * @lang zh-CN 聚合原始证据为 V2 ColorEvidence[]。
 *   合并规则：count 求和；areaRatio/aboveFoldRatio/pixelRatio 取最大值（最能代表显著性）；
 *   tokenName 去重收集（上限 MAX_TOKENS）；context/selector 截断到上限。
 * @lang en Aggregate raw evidence into V2 ColorEvidence[]. count sums; area/aboveFold/pixel take max;
 *   tokenNames deduped (cap MAX_TOKENS); context/selector capped.
 */
export function aggregateEvidence(raw:RawEvidence[]):ColorEvidence[]{
  const map=new Map<string,ColorEvidence>();
  for(const r of raw){
    const k=keyOf(r);
    const existing=map.get(k);
    if(existing){
      existing.count+=(r.count??1);
      if(r.areaRatio!=null)existing.areaRatio=Math.max(existing.areaRatio??0,r.areaRatio);
      if(r.aboveFoldRatio!=null)existing.aboveFoldRatio=Math.max(existing.aboveFoldRatio??0,r.aboveFoldRatio);
      if(r.pixelRatio!=null)existing.pixelRatio=Math.max(existing.pixelRatio??0,r.pixelRatio);
      if(r.tokenName)existing.tokenNames=pushToken(existing.tokenNames,r.tokenName);
      if(r.context)existing.contexts=clampExamples([...(existing.contexts??[]),r.context]);
      if(r.selector)existing.selectors=clampExamples([...(existing.selectors??[]),r.selector]);
      continue;
    }
    map.set(k,{
      value:r.authorValue,
      hex:r.hex,
      alpha:r.alpha,
      source:r.source,
      role:r.role,
      count:r.count??1,
      areaRatio:r.areaRatio,
      aboveFoldRatio:r.aboveFoldRatio,
      pixelRatio:r.pixelRatio,
      tokenNames:r.tokenName?[r.tokenName]:undefined,
      contexts:r.context?[r.context]:undefined,
      selectors:r.selector?[r.selector].slice(0,MAX_SELECTORS):undefined,
      frameKind:r.frameKind
    });
  }
  return [...map.values()];
}
