import{analyzeTheme,type ExtractResult,type ExtractSignals}from'@hia/theme-core';

/**
 * @lang zh-CN 跨运行时桥接层：定义操作台所需的最小平台能力（存储/剪贴板/时钟/弹窗/网址探索），
 *   并提供按优先级回退到显式注入桥、旧版 Electron 桥、Tauri invoke 或浏览器原生的适配器。
 * @lang en Cross-runtime bridge: defines the minimal platform capabilities the studio needs (storage/clipboard/clock/dialog/url-explore),
 *   and an adapter that falls back by priority to an injected bridge, legacy Electron bridge, Tauri invoke, or browser natives.
 */

// 存储能力：键值读写与删除，屏蔽 localStorage / 文件等不同实现。
// <lang zh-CN>web 用 localStorage，Electron/Tauri 可注入更安全的实现。</lang>
// <lang en>Web uses localStorage; Electron/Tauri may inject safer implementations.</lang>
export interface StoragePort{getItem(key:string):string|null;setItem(key:string,value:string):void;removeItem(key:string):void;}
// 剪贴板能力：异步写入文本（用于复制 CSS/JSON 令牌）。
// <lang zh-CN>包装 navigator.clipboard 或原生桥，统一 Promise 接口。</lang>
// <lang en>Wraps navigator.clipboard or a native bridge behind a uniform Promise interface.</lang>
export interface ClipboardPort{writeText(value:string):Promise<void>;}
// 网址探索能力：从目标站点提取主题信号并分析出主副色。
// <lang zh-CN>实现可来自 Electron 预加载或 Tauri 命令，结果统一为 ExtractResult。</lang>
// <lang en>Backed by Electron preload or a Tauri command; result is always ExtractResult.</lang>
export interface ThemeExplorePort{exploreUrl(url:string):Promise<ExtractResult>;}
// 平台聚合：操作台运行时依赖的完整能力集合。
// <lang zh-CN>explorer 可选，仅当宿主提供网址探索时存在。</lang>
// <lang en>explorer is optional and present only when the host provides URL exploration.</lang>
export interface ThemeManagerPlatform{storage:StoragePort;clipboard:ClipboardPort;now():number;alert(message:string):void;confirm(message:string):boolean;explorer?:ThemeExplorePort;}
// 注入式桥：宿主可部分覆盖默认能力，缺省项由适配器补齐。
// <lang zh-CN>用于 Electron/Tauri 通过 window 注入自定义实现而不必全量提供。</lang>
// <lang en>Lets Electron/Tauri inject partial overrides via window without supplying everything.</lang>
export interface InjectedThemeBridge{storage?:StoragePort;clipboard?:ClipboardPort;now?:()=>number;alert?:(message:string)=>void;confirm?:(message:string)=>boolean;explorer?:ThemeExplorePort;}

// 旧版 Electron 桥的成功/失败响应形态。
// <lang zh-CN>兼容 window.hia.extractFromUrl 的老协议（ok + result/reason）。</lang>
// <lang en>Supports the legacy window.hia.extractFromUrl protocol (ok + result/reason).</lang>
interface LegacySuccess{ok:true;result:ExtractResult;}
interface LegacyFailure{ok:false;reason?:string;}
interface LegacyHiaBridge{extractFromUrl(url:string):Promise<LegacySuccess|LegacyFailure>;}
// Tauri 信号提取的成功/失败响应形态。
// <lang zh-CN>返回原始信号，由 core 的 analyzeTheme 统一分析。</lang>
// <lang en>Returns raw signals; core's analyzeTheme does the uniform analysis.</lang>
interface TauriSignalSuccess{ok:true;signals:ExtractSignals;}
interface TauriSignalFailure{ok:false;reason?:string;}
// Tauri 命令调用签名（来自 @tauri-apps/api 全局注入）。
// <lang zh-CN>参数为命令名与可选负载，返回未知 Promise。</lang>
// <lang en>Command name plus optional args, returning an unknown Promise.</lang>
type TauriInvoke=(command:string,args?:unknown)=>Promise<unknown>;

// 声明 window 上可能由宿主注入的全局桥。
// <lang zh-CN>保证 TS 在 web 代码中安全访问这些可选全局。</lang>
// <lang en>Ensures TS can safely read these optional globals from web code.</lang>
declare global{
  interface Window{
    hiaThemeBridge?:InjectedThemeBridge;
    hia?:LegacyHiaBridge;
    __TAURI_INVOKE__?:TauriInvoke;
  }
}

// 旧版 Electron 探索器：把 window.hia.extractFromUrl 适配为 ThemeExplorePort。
// <lang zh-CN>无该桥时返回 undefined，交给后续回退；失败时抛出中文错误。</lang>
// <lang en>Returns undefined when absent for later fallback; throws a localized error on failure.</lang>
function legacyElectronExplorer():ThemeExplorePort|undefined{
  if(!window.hia?.extractFromUrl)return undefined;
  return{async exploreUrl(url:string){
    const response=await window.hia!.extractFromUrl(url);
    if(!response.ok)throw new Error(response.reason||'网址主题探索失败。');
    return response.result;
  }};
}

// Tauri 探索器：把 __TAURI_INVOKE__('extract_signals') 适配为 ThemeExplorePort。
// <lang zh-CN>取回原始信号后调用 core.analyzeTheme 得到结果，失败抛中文错误。</lang>
// <lang en>Pulls raw signals then calls core.analyzeTheme; throws a localized error on failure.</lang>
function tauriExplorer():ThemeExplorePort|undefined{
  const invoke=window.__TAURI_INVOKE__;
  if(!invoke)return undefined;
  return{async exploreUrl(url:string){
    const response=await invoke('extract_signals',{url})as TauriSignalSuccess|TauriSignalFailure;
    if(!response.ok)throw new Error(response.reason||'网址主题探索失败。');
    return analyzeTheme(response.signals);
  }};
}

/**
 * @lang zh-CN 构建自适应平台：优先显式注入桥，其次旧版 Electron 桥，再 Tauri invoke，最后浏览器原生能力。
 *   纯浏览器环境仅提供原生存储与剪贴板，explorer 不存在。
 * @lang en Build an adaptive platform: prefer the injected bridge, then legacy Electron bridge, then Tauri invoke, finally browser natives.
 *   Plain browsers get only native storage/clipboard and no explorer.
 */
export function createAdaptivePlatform():ThemeManagerPlatform{
  const bridge=window.hiaThemeBridge;
  // 探索器按注入桥 > 旧 Electron > Tauri 顺序回退，首个非空即采用。
  // <lang zh-CN>保证任一宿主提供即可启用网址探索。</lang>
  // <lang en>Any single host capability enables URL exploration.</lang>
  const explorer=bridge?.explorer??legacyElectronExplorer()??tauriExplorer();
  return{
    // 存储：注入桥优先，否则浏览器 localStorage。
    // <lang zh-CN>localStorage 为纯浏览器唯一持久化手段。</lang>
    // <lang en>localStorage is the only browser persistence.</lang>
    storage:bridge?.storage??window.localStorage,
    // 剪贴板：注入桥优先，否则 navigator.clipboard。
    // <lang zh-CN>需安全上下文（https/localhost）才可用。</lang>
    // <lang en>Requires a secure context (https/localhost).</lang>
    clipboard:bridge?.clipboard??{writeText:async value=>navigator.clipboard.writeText(value)},
    // 时钟：注入桥优先，否则 Date.now。
    // <lang zh-CN>用于预设 id 与时间戳。</lang>
    // <lang en>Used for preset ids and timestamps.</lang>
    now:bridge?.now??(()=>Date.now()),
    // 弹窗：注入桥优先，否则 window.alert。
    // <lang zh-CN>统一校验/错误提示入口。</lang>
    // <lang en>Unified validation/error prompt entry.</lang>
    alert:bridge?.alert??(message=>window.alert(message)),
    // 确认框：注入桥优先，否则 window.confirm。
    // <lang zh-CN>覆盖内置预设前用于二次确认。</lang>
    // <lang en>Used to confirm before overwriting built-ins.</lang>
    confirm:bridge?.confirm??(message=>window.confirm(message)),
    // 仅在存在探索器时附加 explorer 字段。
    // <lang zh-CN>保持接口整洁，纯浏览器不暴露不存在的能力。</lang>
    // <lang en>Keeps the interface tidy; pure browsers don't expose a nonexistent capability.</lang>
    ...(explorer?{explorer}:{})
  };
}
