import{type WebsiteThemeAnalysisV2,type WebsiteColorSignalsV2,type ColorEvidence,analyzeThemeV2}from'@hia/theme-core';
import{quantizeMedianCut}from'@hia/theme-url-extractor';

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
// 网址探索能力：从目标站点提取主题信号并分析出主副色（V2 报告）。
// <lang zh-CN>实现可来自 Electron 预加载或 Tauri 命令，结果统一为 WebsiteThemeAnalysisV2。</lang>
// <lang en>Backed by Electron preload or a Tauri command; result is always WebsiteThemeAnalysisV2.</lang>
export interface ThemeExplorePort{exploreUrl(url:string):Promise<WebsiteThemeAnalysisV2>;}
// 文本获取能力（`W-tb-P10`）：拉取远程预设源 JSON 等静态文本。
// <lang zh-CN>统一消费层校验（协议白名单/大小/超时）在此端口内执行，调用方拿到即合法文本。</lang>
// <lang en>Consumer-side validation (protocol allowlist/size/timeout) lives inside this port; callers receive validated text.</lang>
export interface FetchTextPort{fetchText(url:string):Promise<string>;}
// 平台聚合：操作台运行时依赖的完整能力集合。
// <lang zh-CN>explorer/fetchText 可选：explorer 仅桌面端存在；fetchText 默认由 WebView fetch 提供。</lang>
// <lang en>explorer/fetchText are optional: explorer only on desktop; fetchText defaults to WebView fetch.</lang>
export interface ThemeManagerPlatform{storage:StoragePort;clipboard:ClipboardPort;now():number;alert(message:string):void;confirm(message:string):boolean;explorer?:ThemeExplorePort;fetchText?:FetchTextPort;}
// 注入式桥：宿主可部分覆盖默认能力，缺省项由适配器补齐。
// <lang zh-CN>用于 Electron/Tauri 通过 window 注入自定义实现而不必全量提供。</lang>
// <lang en>Lets Electron/Tauri inject partial overrides via window without supplying everything.</lang>
export interface InjectedThemeBridge{storage?:StoragePort;clipboard?:ClipboardPort;now?:()=>number;alert?:(message:string)=>void;confirm?:(message:string)=>boolean;explorer?:ThemeExplorePort;fetchText?:FetchTextPort;}

// 旧版 Electron 桥的成功/失败响应形态。
// <lang zh-CN>兼容 window.hia.extractFromUrl 的老协议（ok + result/reason）。</lang>
// <lang en>Supports the legacy window.hia.extractFromUrl protocol (ok + result/reason).</lang>
interface LegacySuccess{ok:true;result:unknown;}
interface LegacyFailure{ok:false;reason?:string;}
interface LegacyHiaBridge{extractFromUrl(url:string):Promise<LegacySuccess|LegacyFailure>;}
// Tauri 信号提取的成功/失败响应形态。
// <lang zh-CN>P4 起 Rust 返回 { evidence, screenshot(base64), finalUrl }，P5 起可选含 darkEvidence（深色双模式复采）。</lang>
// <lang en>P4 onward Rust returns { evidence, screenshot(base64), finalUrl }; P5 adds optional darkEvidence (dark dual-mode rescan).</lang>
interface TauriSignalSuccess{ok:true;signals:{evidence:ColorEvidence[];screenshot:string;finalUrl:string;darkEvidence?:ColorEvidence[];darkWarning?:string};}
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
    // 新版协议（P3 起）response 直接带 analysis 字段（V2 报告）；旧版 V1 协议无此字段，
    // 因 V1 与 V2 报告结构不兼容，旧版桥无法产出 V2，提示升级宿主到 P3+ 协议。
    // <lang zh-CN>有 analysis 直接返回；否则报错引导升级。</lang>
    // <lang en>Return analysis when present; otherwise error to prompt a host upgrade.</lang>
    const maybeAnalysis=(response as {analysis?:WebsiteThemeAnalysisV2}).analysis;
    if(maybeAnalysis)return maybeAnalysis;
    throw new Error('宿主取色桥为旧版（V1），不支持 V2 报告。请升级到 P3+ 协议（extract-from-url 返回 analysis）。');
  }};
}

// Tauri 探索器：把 __TAURI_INVOKE__('extract_signals') 适配为 ThemeExplorePort。
// <lang zh-CN>取回 V1 原始信号后，经 core 的 toV2Signals + analyzeThemeV2 产出 V2 报告，失败抛中文错误。</lang>
// <lang en>Pulls V1 signals then runs core's toV2Signals + analyzeThemeV2 for the V2 report; throws a localized error.</lang>
function tauriExplorer():ThemeExplorePort|undefined{
  const invoke=window.__TAURI_INVOKE__;
  if(!invoke)return undefined;
  return{async exploreUrl(url:string){
    const response=await invoke('extract_signals',{url})as TauriSignalSuccess|TauriSignalFailure;
    if(!response.ok)throw new Error(response.reason||'网址主题探索失败。');
    // P4 起 Rust 返回 { evidence, screenshot(base64 PNG), finalUrl }。
    // <lang zh-CN>前端解码截图 → RGBA → median-cut 量化，与 DOM 证据合并构造 V2 信号再评分。</lang>
    // <lang en>Front decodes screenshot → RGBA → median-cut, merges with DOM evidence into V2 signals then scores.</lang>
    const data=response.signals as { evidence:ColorEvidence[]; screenshot:string; finalUrl:string; darkEvidence?:ColorEvidence[]; darkWarning?:string };
    const domEvidence=data.evidence??[];
    let evidence:ColorEvidence[]=domEvidence;
    try{
      const shotEvidence=await decodeAndQuantize(data.screenshot);
      evidence=[...domEvidence,...shotEvidence];
    }catch{ /* 截图量化失败不阻断 DOM 证据分析 */ }
    // 深色双模式证据：Rust 已用 CDP 强制暗色复采并标记 colorScheme:'dark'。
    // <lang zh-CN>缺失或为空时仍构造完整 V2 报告，仅 darkMode 缺位。</lang>
    // <lang en>Absent/empty still yields a full V2 report, just without darkMode.</lang>
    const darkEvidence=data.darkEvidence??[];
    const warnings:import('@hia/theme-core').CaptureWarning[]=[];
    if(data.darkWarning) warnings.push({ code:'dark-rescan-fallback', message:data.darkWarning });
    const v2:WebsiteColorSignalsV2={
      schemaVersion:2,
      page:{ requestedUrl:url, finalUrl:data.finalUrl||url, title:'', viewport:{width:1440,height:900,dpr:1}, colorScheme:'light', capturedAt:new Date().toISOString() },
      evidence,
      warnings,
      diagnostics:{ mode:'render', durationMs:0, notes:['Tauri chromiumoxide real render', ...(darkEvidence.length?['dark dual-mode captured']:[])] },
      // 仅当确有深色证据时提供 darkMode，与 Electron 对称。
      // <lang zh-CN>darkMode.evidence 直接复用 Rust 深色复采结果（已带 colorScheme:'dark'）。</lang>
      // <lang en>darkMode.evidence reuses Rust dark rescan (already tagged colorScheme:'dark').</lang>
      ...(darkEvidence.length?{ darkMode:{ evidence:darkEvidence, colorScheme:'dark' as const } }:{})
    };
    return analyzeThemeV2(v2);
  }};
}

// 解码 base64 PNG 为 RGBA 像素并用 median-cut 量化，产出 screenshot-ui 证据。
// <lang zh-CN>浏览器/WebView 环境可用 createImageBitmap + canvas 解码；量化复用 extractor 纯算法。</lang>
// <lang en>Browser/WebView decode via createImageBitmap + canvas; quantization reuses extractor's pure algorithm.</lang>
async function decodeAndQuantize(b64:string):Promise<ColorEvidence[]>{
  const res=await fetch(`data:image/png;base64,${b64}`);
  const blob=await res.blob();
  const bmp=await createImageBitmap(blob);
  const canvas=document.createElement('canvas');
  canvas.width=bmp.width;canvas.height=bmp.height;
  const ctx=canvas.getContext('2d');
  if(!ctx)return [];
  ctx.drawImage(bmp,0,0);
  const data=ctx.getImageData(0,0,bmp.width,bmp.height).data;
  const pixels:{r:number;g:number;b:number;a:number}[]=[];
  for(let i=0;i<data.length;i+=4)pixels.push({r:data[i]!,g:data[i+1]!,b:data[i+2]!,a:data[i+3]!});
  return quantizeMedianCut(pixels,14).map<ColorEvidence>((c:{hex:string;count:number;ratio:number})=>({ value:c.hex, hex:c.hex, alpha:1, source:'screenshot-ui', role:'unknown', count:c.count, pixelRatio:c.ratio }));
}

/**
 * @lang zh-CN 构建自适应平台：优先显式注入桥，其次旧版 Electron 桥，再 Tauri invoke，最后浏览器原生能力。
 *   纯浏览器环境提供原生存储、剪贴板与 fetchText，explorer 不存在。
 * @lang en Build an adaptive platform: prefer the injected bridge, then legacy Electron bridge, then Tauri invoke, finally browser natives.
 *   Plain browsers get native storage/clipboard/fetchText and no explorer.
 */
export function createAdaptivePlatform():ThemeManagerPlatform{
  const bridge=window.hiaThemeBridge;
  // 探索器按注入桥 > 旧 Electron > Tauri 顺序回退，首个非空即采用。
  // <lang zh-CN>保证任一宿主提供即可启用网址探索。</lang>
  // <lang en>Any single host capability enables URL exploration.</lang>
  const explorer=bridge?.explorer??legacyElectronExplorer()??tauriExplorer();
  // fetchText：注入桥优先，否则 WebView 原生 fetch（`W-tb-P10` 定案：三端统一 WebView fetch）。
  // <lang zh-CN>消费层校验：仅 http/https、10s 超时、响应 ≤512KB；失败抛中文错误。</lang>
  // <lang en>Consumer-side validation: http/https only, 10s timeout, response ≤512KB; failures throw localized errors.</lang>
  const fetchText:FetchTextPort=bridge?.fetchText??{
    async fetchText(url:string){
      // 协议白名单：仅 http/https（拦截 file:/data:/javascript: 等注入面）。
      // <lang zh-CN>大小写不敏感；其余协议直接拒绝。</lang>
      // <lang en>Case-insensitive; any other scheme is rejected outright.</lang>
      if(!/^https?:\/\//i.test(url))throw new Error('仅支持 http(s) 链接。');
      let response:Response;
      try{
        // cache:'no-store'：绕过 CDN/HTTP 缓存（raw.githubusercontent 等源会缓存推送前的 404，实测踩坑）。
        // <lang zh-CN>源内容应始终取最新；no-store 同时规避浏览器内存缓存。</lang>
        // <lang en>Sources must always be fresh; no-store also bypasses in-memory caches.</lang>
        response=await fetch(url,{signal:AbortSignal.timeout(10000),cache:'no-store'});
      }catch{
        throw new Error('远程源获取失败（网络/超时/CORS）。桌面端无 CORS 限制，可改用桌面端或本地导入。');
      }
      // 状态与大小校验：非 2xx 或超 512KB 拒绝。
      // <lang zh-CN>Content-Length 缺失时读取后按实际长度校验（读完再查，可接受）。</lang>
      // <lang en>When Content-Length is absent, validate by actual length after reading.</lang>
      if(!response.ok)throw new Error(`远程源返回 ${response.status}。`);
      const declared=response.headers.get('content-length');
      if(declared&&parseInt(declared,10)>512*1024)throw new Error('远程源超过 512KB 上限。');
      const text=await response.text();
      if(text.length>512*1024)throw new Error('远程源超过 512KB 上限。');
      return text;
    }
  };
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
    // fetchText：默认 WebView 实现，注入桥可覆盖。
    // <lang zh-CN>`W-tb-P10`：远程预设源加载通道。</lang>
    // <lang en>`W-tb-P10`: remote preset source channel.</lang>
    fetchText,
    // 仅在存在探索器时附加 explorer 字段。
    // <lang zh-CN>保持接口整洁，纯浏览器不暴露不存在的能力。</lang>
    // <lang en>Keeps the interface tidy; pure browsers don't expose a nonexistent capability.</lang>
    ...(explorer?{explorer}:{})
  };
}
