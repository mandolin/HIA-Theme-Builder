/**
 * @lang zh-CN Electron 真实渲染采集适配器（P2）：用隐藏隔离 BrowserWindow 加载网址，
 *   页面稳定化后注入与 Tauri 同源的 scanner bundle，采集 DOM/CSS/SVG 证据并截图量化，
 *   组装为 V2 信号契约。失败时回退 fetch-signals 静态降级（degraded-static）。V2 评分（P3）由调用方 analyzeThemeV2 完成。
 * @lang en Electron real-render adapter (P2): hidden isolated BrowserWindow loads URL, stabilizes the page,
 *   injects the same scanner bundle as Tauri, collects DOM/CSS/SVG evidence and quantizes screenshots into V2 signals.
 *   On failure falls back to fetch-signals static degraded mode (degraded-static). V2 scoring (P3) done by caller via analyzeThemeV2.
 */

import { BrowserWindow } from 'electron';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { readFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { quantizeMedianCut } from '@hia/theme-url-extractor';
import { collectSignals } from './fetch-signals.js';
import { guardUrl } from './ssrf.js';
import type { WebsiteColorSignalsV2, ColorEvidence, CaptureWarning } from '@hia/theme-core';

const __dirname = dirname(fileURLToPath(import.meta.url));

// scanner bundle 文本：由 extractor 编译产物读取，注入页面执行。
// <lang zh-CN>与 Tauri 同一份自包含 IIFE（dist/browser-scanner.bundle.js），确保两端算法一致。</lang>
// <lang en>Same self-contained IIFE bundle as Tauri (dist/browser-scanner.bundle.js) for algorithm parity.</lang>
function loadScannerSource():string{
  const p=join(__dirname,'..','node_modules','@hia','theme-url-extractor','dist','browser-scanner.bundle.js');
  return readFileSync(p,'utf8');
}

// 固定分析视口（指令六节默认 1440×900 DPR 1）。
// <lang zh-CN>与 Tauri/跨端契约测试保持一致。</lang>
// <lang en>Aligned with Tauri and cross-end contract tests.</lang>
const VIEWPORT={ width:1440, height:900, dpr:1 };

// 页面稳定化：等待 load、字体、DOM 静默并滚动触发懒加载。
// <lang zh-CN>软等待上限内尽力等待；超时不等也不抛错。</lang>
// <lang en>Best-effort wait within soft limit; timeout does not throw.</lang>
async function stabilize(win:BrowserWindow, softMs=10000, hardMs=20000):Promise<void>{
  const started=Date.now();
  try{ await win.webContents.executeJavaScript(`new Promise(res=>{
    const done=()=>res(true);
    if(document.readyState==='complete'){ done(); }
    else { window.addEventListener('load',()=>done()); }
    const t=setTimeout(done,${softMs});
    // 字体就绪仅作触发，显式 resolve(true) 避免 Promise.race 解析出 FontFaceSet 导致 IPC 克隆失败。
    // <lang zh-CN>字体 ready 解析值为 FontFaceSet（不可克隆），必须忽略其解析值。</lang>
    // <lang en>fonts.ready resolves to FontFaceSet (non-cloneable); ignore its value.</lang>
    Promise.race([document.fonts?document.fonts.ready.then(()=>true):Promise.resolve(true), new Promise(r=>setTimeout(r,${softMs}))]).then(()=>done());
  })`); }catch{ /* ignore */ }
  // 滚动触发懒加载后回顶。
  // <lang zh-CN>分段滚动到页面底部再回顶部，激活 lazy content。</lang>
  // <lang en>Scroll through the page then back to top to trigger lazy content.</lang>
  try{
    await win.webContents.executeJavaScript(`new Promise(res=>{
      const h=document.body.scrollHeight||${VIEWPORT.height};
      let y=0; const step=Math.max(300,h/10);
      const tick=()=>{ y+=step; window.scrollTo(0,y); if(y<h&&Date.now()-${started}<${hardMs}){ setTimeout(tick,120); } else { window.scrollTo(0,0); res(true); } };
      tick();
    })`);
  }catch{ /* ignore */ }
}

// 注入 CSS 禁用动画/过渡/光标，并临时隐藏 artwork 元素做 ui-only 截图。
// <lang zh-CN>完成后由调用方负责恢复（navigate 或销毁窗口）。</lang>
// <lang en>Caller restores by navigation/destroy afterward.</lang>
async function applyUiOnlyMode(win:BrowserWindow):Promise<void>{
  await win.webContents.executeJavaScript(`(function(){
    const s=document.createElement('style'); s.id='__hiaUiOnly';
    s.textContent='*,*::before,*::after{animation:none!important;transition:none!important;caret-color:transparent!important}';
    document.head.appendChild(s);
    document.querySelectorAll('img,picture,video,canvas,iframe[src*="://"]').forEach(e=>{ e.style.visibility='hidden'; });
    document.querySelectorAll('*').forEach(e=>{ const bg=getComputedStyle(e).backgroundImage||''; if(/url\\(/.test(bg)){ e.style.backgroundImage=bg.replace(/url\\([^)]*\\)/gi,'')||'none'; } });
  })()`);
}

// 截图并转 RGBA 像素交给 extractor 量化。
// <lang zh-CN>截图仅在内存短暂存在，分析后释放；normal/ui-only 两张对照分类。</lang>
// <lang en>Screenshot lives only briefly in memory; compared normal vs ui-only to classify sources.</lang>
async function captureAndQuantize(win:BrowserWindow):Promise<{ normal:ColorEvidence[]; uiOnly:ColorEvidence[] }>{
  const toRgba=async ():Promise<{r:number;g:number;b:number;a:number}[]>=>{
    const img=await win.webContents.capturePage();
    const { width, height }=img.getSize();
    const buf=img.toBitmap(); // BGRA
    const out:{r:number;g:number;b:number;a:number}[]=[];
    for(let i=0;i<buf.length;i+=4){
      out.push({ b:buf[i]!, g:buf[i+1]!, r:buf[i+2]!, a:buf[i+3]! });
    }
    return out;
  };
  const norm=await toRgba();
  const nq=quantizeMedianCut(norm,14).map<ColorEvidence>(c=>({ value:c.hex, hex:c.hex, alpha:1, source:'screenshot-ui', role:'unknown', count:c.count, pixelRatio:c.ratio }));
  await applyUiOnlyMode(win);
  // 等待重绘。
  await new Promise(r=>setTimeout(r,300));
  const ui=await toRgba();
  const uq=quantizeMedianCut(ui,14).map<ColorEvidence>(c=>({ value:c.hex, hex:c.hex, alpha:1, source:'screenshot-ui', role:'unknown', count:c.count, pixelRatio:c.ratio }));
  return { normal:nq, uiOnly:uq };
}

/**
 * @lang zh-CN 真实渲染采集主入口：隐藏窗口加载 URL，稳定化后注入 scanner 采集 DOM 证据 + 截图量化，
 *   返回 V2 信号（mode:'render'）。任何失败抛错，由调用方决定回退静态采集。
 * @lang en Real-render collection entry: hidden window loads URL, stabilizes, injects scanner for DOM evidence + screenshot quantize,
 *   returns V2 signals (mode:'render'). Any failure throws; caller decides static fallback.
 */
export async function renderCollect(rawUrl:string):Promise<WebsiteColorSignalsV2>{
  const guard=guardUrl(rawUrl);
  if(!guard.ok)throw new Error('SSRF:'+guard.reason);

  const scannerSrc=loadScannerSource();
  const win=new BrowserWindow({
    show:false,
    width:VIEWPORT.width, height:VIEWPORT.height,
    webPreferences:{
      nodeIntegration:false,
      contextIsolation:true,
      sandbox:true,
      webSecurity:true,
      webviewTag:false,
      partition:`hia-url-color-${randomUUID()}` // <lang zh-CN>临时 profile，不带 persist:</lang> // <lang en>temp profile, no persist:</lang>
    }
  });
  const warnings:CaptureWarning[]=[];
  const started=Date.now();
  // 临时诊断包装：标注阶段，便于定位 IPC 克隆失败来源。
  // <lang zh-CN>定位后可移除或降级为调试日志。</lang>
  // <lang en>Remove or downgrade to debug log after locating the clone failure.</lang>
  const exec=async (stage:string,code:string):Promise<unknown>=>{
    try{ return await win.webContents.executeJavaScript(code); }
    catch(e){ const m=e instanceof Error?e.message:String(e); throw new Error(`[${stage}] ${m}`); }
  };
  try{
    // 安全策略：deny 权限/下载/外部协议/弹窗。
    // <lang zh-CN>阻止一切副作用与未知导航请求。electron 与 DOM lib 全局类型存在已知冲突，
    //   这两处方法在运行时存在，用最小 any 规避声明合并解析问题。</lang>
    // <lang en>Block all side effects and unknown navigations. electron vs DOM lib global types conflict;
    //   these methods exist at runtime; minimal any bypasses the declaration-merge resolution gap.</lang>
    win.webContents.session.setPermissionRequestHandler((_req,_perm,cb)=>cb(false));
    // 下载拦截：will-download 事件阻止任何下载项（setDownloadBehavior 在某些 electron 版本 session 上不存在）。
    // <lang zh-CN>deny 所有下载项，避免副作用。</lang>
    // <lang en>Deny all downloads to avoid side effects.</lang>
    win.webContents.session.on('will-download',(_evt,item)=>{ item.cancel(); });
    // 弹窗拦截：new-window 事件阻止未知窗口打开（setWindowOpenHandler 在部分构建上不可用）。
    // <lang zh-CN>阻止一切新窗口/弹窗导航。</lang>
    // <lang en>Block all new-window/popup navigations.</lang>
    (win.webContents as unknown as { on:(ev:string,cb:(e:{preventDefault:()=>void})=>void)=>void }).on('new-window',(e)=>{ e.preventDefault(); });

    await win.loadURL(rawUrl,{ userAgent:'HIA-Theme-Builder/0.1 (+color-extraction)' });
    await stabilize(win);

    // 注入 scanner 并采集 DOM 证据。
    // <lang zh-CN>页面端解析器用浏览器原生 getComputedStyle 兜底（复杂格式由真实浏览器解析）。</lang>
    // <lang en>Page parser uses native getComputedStyle as fallback (browser resolves complex formats).</lang>
    await exec('inject-scanner', scannerSrc);
    // 在页面端完成 JSON 序列化并返回字符串，规避 IPC 结构化克隆对特殊值的限制。
    // <lang zh-CN>主进程收到字符串后 JSON.parse；任何不可序列化字段已在页面端被 JSON 丢弃。</lang>
    // <lang en>Page side serializes to string; main parses. Un-serializable fields dropped at page side.</lang>
    const domEvJson:string=String(await exec('scan-dom', `(function(){
      const ctx={ width:${VIEWPORT.width}, height:${VIEWPORT.height}, dpr:${VIEWPORT.dpr} };
      const { evidence } = window.__hiaScanner.scanDocument(document, ctx);
      return JSON.stringify(evidence);
    })()`));
    const domEv:ColorEvidence[]=JSON.parse(domEvJson);

    const shots=await captureAndQuantize(win);
    // normal 与 ui-only 对照：仅 ui-only 出现 → screenshot-ui；仅 normal 出现 → screenshot-artwork（降权由 P3 处理）。
    // <lang zh-CN>此处先统一为 screenshot-ui，artwork 标记留给 P3 评分。</lang>
    // <lang en>Unified to screenshot-ui here; artwork tagging deferred to P3 scoring.</lang>
    const evidence:ColorEvidence[]=[...domEv, ...shots.normal, ...shots.uiOnly];

    const title=String(await exec('read-title','document.title').catch(()=> ''));
    const colorScheme=String(await exec('read-scheme',`(function(){ return matchMedia&&matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light'; })()`).catch(()=> 'light'));

    return {
      schemaVersion:2,
      page:{
        requestedUrl:rawUrl,
        finalUrl:win.webContents.getURL(),
        title:String(title),
        viewport:VIEWPORT,
        colorScheme:colorScheme==='dark'?'dark':'light',
        capturedAt:new Date().toISOString()
      },
      evidence,
      warnings,
      diagnostics:{ mode:'render', durationMs:Date.now()-started, notes:['Electron hidden BrowserWindow render'] }
    };
  } finally {
    // 无论成败销毁窗口并释放 session 引用。
    // <lang zh-CN>临时 partition 随窗口关闭被清理，不留 profile/cookie。</lang>
    // <lang en>Temp partition cleared on close; no profile/cookie lingers.</lang>
    try{ win.destroy(); }catch{ /* ignore */ }
  }
}

/**
 * @lang zh-CN 采集入口（带降级）：优先真实渲染，失败回退静态 fetch 并用 toV2Signals 标记 degraded-static。
 * @lang en Collection entry with fallback: prefer real render; on failure use static fetch tagged degraded-static via toV2Signals.
 */
export async function collectSignalsV2(rawUrl:string):Promise<WebsiteColorSignalsV2>{
  try{
    return await renderCollect(rawUrl);
  }catch(e){
    const msg=e instanceof Error?e.message:String(e);
    // 静态降级：保留现有 fetch-signals，转 V2 并封顶置信度。
    // <lang zh-CN>回退不代表页面渲染成功，UI 须提示未真实渲染。</lang>
    // <lang en>Fallback does not mean real render succeeded; UI must flag degraded.</lang>
    const v1=await collectSignals(rawUrl);
    const { toV2Signals }=await import('@hia/theme-core');
    const v2=toV2Signals(v1,{ requestedUrl:rawUrl, finalUrl:rawUrl, title:'', viewport:VIEWPORT, colorScheme:'light', capturedAt:new Date().toISOString() });
    v2.warnings.push({ code:'render-fallback', message:`真实渲染失败，已降级静态采集：${msg}`, scope:'adapter' });
    v2.diagnostics.mode='degraded-static';
    v2.diagnostics.notes=['真实渲染失败，回退 fetch + regex 静态分析；动态样式/CSS 变量/截图证据缺失'];
    return v2;
  }
}
