/**
 * @lang zh-CN TDON 连接器（`W-tb-P26` / 规范 §8）：把"取回文本"与"解析校验"解耦，连接器只负责
 *   按来源（URL / 本地文件）取回文本并施加大小上限；解析与校验交给 core 的 `parseTdonDocument`。
 *   本模块属于 web 层（有 DOM/网络），core 保持无 IO。
 * @lang en TDON connector (`W-tb-P26` / spec §8): separates "fetch text" from "parse & validate". The connector
 *   only retrieves text per source (URL / local file) under a size cap; parsing and validation are delegated to
 *   core's `parseTdonDocument`. This module lives in the web layer (DOM/network); core stays IO-free.
 */
import{TDON_MAX_BYTES}from'@hia/theme-core';
import type{FetchTextPort}from'./platform.js';

// 连接结果：成功给出原文与来源标签，失败给出可展示的原因。
// <lang zh-CN>不在此处做 JSON 解析——解析失败与取回失败是不同层面的错误，分开表达更易定位。</lang>
// <lang en>JSON parsing does not happen here: fetch failures and parse failures are different layers, and
//   keeping them separate makes diagnosis easier.</lang>
export type TdonFetchResult={ok:true;text:string;source:string}|{ok:false;reason:string;source:string};

// 从 URL 取回 TDON 文本（复用既有 fetchText 端口：http/https 白名单 + 10s 超时 + 512KB 上限）。
// <lang zh-CN>端口自身已做协议与超时校验；这里再按 TDON 的 256KB 上限收紧一次。</lang>
// <lang en>The port already enforces protocol and timeout; this narrows the size cap to TDON's 256 KB.</lang>
export async function fetchTdonFromUrl(url:string,fetchText:FetchTextPort|undefined):Promise<TdonFetchResult>{
  // 端口缺失说明宿主未提供取回能力（理论上浏览器始终有），给出明确提示而非静默失败。
  // <lang zh-CN>用户看到"当前环境不支持"比看到空白更可行动。</lang>
  // <lang en>"Unsupported in this environment" is more actionable than a blank panel.</lang>
  if(!fetchText)return{ok:false,reason:'当前环境不支持远程取回。',source:url};
  try{
    const text=await fetchText.fetchText(url);
    // TDON 上限（TDON-2.3）：字节数按 UTF-8 统计，与规范"256 KB 文件"口径一致。
    // <lang zh-CN>字符数判定会低估多字节文本，故用 TextEncoder 计字节。</lang>
    // <lang en>Character count under-counts multibyte text, so TextEncoder counts bytes.</lang>
    if(new TextEncoder().encode(text).length>TDON_MAX_BYTES){
      return{ok:false,reason:`文件超过 ${Math.round(TDON_MAX_BYTES/1024)} KB 上限。`,source:url};
    }
    return{ok:true,text,source:url};
  }catch(e){
    // 端口抛出的错误已带中文说明（协议/超时/状态码），直接透出。
    // <lang zh-CN>不再包一层通用文案，避免丢失具体原因。</lang>
    // <lang en>No generic wrapper, so the specific cause is preserved.</lang>
    return{ok:false,reason:e instanceof Error?e.message:String(e),source:url};
  }
}

// 从本地文件读取 TDON 文本。
// <lang zh-CN>FileReader 在浏览器/WebView 均可用，无需宿主桥；大小在读取后判定（File.size 先判可省内存）。</lang>
// <lang en>FileReader works in browsers and WebViews without a host bridge; size is checked before reading
//   via File.size to avoid holding oversized content.</lang>
export function readTdonFromFile(file:File):Promise<TdonFetchResult>{
  const source=file.name;
  // 读取前先用 File.size 拦截，避免把超大文件读进内存。
  // <lang zh-CN>提示同时给出实际上限，便于用户裁剪。</lang>
  // <lang en>The message states the actual cap so users can trim.</lang>
  if(file.size>TDON_MAX_BYTES){
    return Promise.resolve({ok:false,reason:`文件 ${(file.size/1024).toFixed(0)} KB 超过 ${Math.round(TDON_MAX_BYTES/1024)} KB 上限。`,source});
  }
  return new Promise(resolve=>{
    const reader=new FileReader();
    // 成功：text 读为 UTF-8 字符串（规范 §2.3 要求 UTF-8）。
    // <lang zh-CN>不尝试猜测其它编码——TDON 只接受 UTF-8。</lang>
    // <lang en>No encoding guessing: TDON accepts UTF-8 only.</lang>
    reader.onload=()=>resolve({ok:true,text:String(reader.result??''),source});
    // 失败：透出浏览器给出的原因。
    // <lang zh-CN>常见原因：权限、文件被占用、编辑器未落盘。</lang>
    // <lang en>Typical causes: permissions, locked file, unsaved buffer.</lang>
    reader.onerror=()=>resolve({ok:false,reason:'本地文件读取失败。',source});
    reader.readAsText(file,'utf-8');
  });
}
