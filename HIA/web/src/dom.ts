/**
 * @lang zh-CN 轻量 DOM 访问助手：按 id 取元素、按选择器批量取、读写输入值与文本。
 *   全部为同步助手，便于操作台在挂载后安全地操作文档，缺失元素即时抛错以暴露结构问题。
 * @lang en Lightweight DOM accessors: get by id, query-all by selector, read/write input value and text.
 *   Synchronous helpers so the studio can safely manipulate the document after mount; missing elements throw to surface structural issues.
 */

// 按 id 取元素并断言存在（缺失即抛错，便于尽早发现模板与脚本不一致）。
// <lang zh-CN>类型参数 T 让调用方直接拿到具体元素类型，免去重复断言。</lang>
// <lang en>Type param T gives the caller a concrete element type, avoiding repeated casts.</lang>
export function byId<T extends HTMLElement>(id:string):T{
  const element=document.getElementById(id);
  if(!element)throw new Error(`Missing required element #${id}`);
  return element as T;
}

// 按 CSS 选择器在 root 内批量取元素，结果转为数组便于链式处理。
// <lang zh-CN>root 缺省为 document；用于在容器内（如候选列表）批量绑定事件。</lang>
// <lang en>root defaults to document; used to bind events inside containers like candidate lists.</lang>
export function all<T extends Element>(selector:string,root:ParentNode=document):T[]{
  return Array.from(root.querySelectorAll<T>(selector));
}

// 读取某输入/选择/文本域的当前值。
// <lang zh-CN>统一入口，避免各处重复 byId + 类型断言。</lang>
// <lang en>Single entry point, avoiding repeated byId + casts at call sites.</lang>
export function inputValue(id:string):string{return byId<HTMLInputElement|HTMLSelectElement|HTMLTextAreaElement>(id).value;}

// 设置某输入/选择/文本域的值。
// <lang zh-CN>与 inputValue 对称，保持操作台读写一致性。</lang>
// <lang en>Symmetric with inputValue, keeping studio read/write consistent.</lang>
export function setInputValue(id:string,value:string):void{byId<HTMLInputElement|HTMLSelectElement|HTMLTextAreaElement>(id).value=value;}

// 设置某元素的文本节点内容（用于状态/元信息展示）。
// <lang zh-CN>仅改 textContent，避免 HTML 注入风险。</lang>
// <lang en>Only sets textContent, avoiding HTML injection risk.</lang>
export function setText(id:string,value:string):void{byId<HTMLElement>(id).textContent=value;}
