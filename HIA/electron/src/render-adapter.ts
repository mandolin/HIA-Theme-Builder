/**
 * @lang zh-CN Electron 真实渲染采集适配器（P2）：用隐藏隔离 BrowserWindow 加载网址，
 *   页面稳定化后注入与 Tauri 同源的 scanner bundle，采集 DOM/CSS/SVG/manifest 证据并截图量化，
 *   组装为 V2 信号契约。失败时回退 fetch-signals 静态降级（degraded-static）。V2 评分（P3）由调用方 analyzeThemeV2 完成。
 * @lang en Electron real-render adapter (P2): hidden isolated BrowserWindow loads URL, stabilizes the page,
 *   injects the same scanner bundle as Tauri, collects DOM/CSS/SVG/manifest evidence and quantizes screenshots into V2 signals.
 *   On failure falls back to fetch-signals static degraded mode (degraded-static). V2 scoring (P3) done by caller via analyzeThemeV2.
 */

import { BrowserWindow } from 'electron';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { readFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { quantizeMedianCut, quantizeCelebi, quantizerDivergence } from '@hia/theme-url-extractor';
import { collectSignals } from './fetch-signals.js';
import { guardUrl, guardUrlDeep, guardRequestUrl } from './ssrf.js';
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
// <lang zh-CN>截图仅在内存短暂存在，分析后释放；normal/ui-only 两张对照分类；可选 logo 区域裁剪单独量化。</lang>
// <lang en>Screenshot lives only briefly in memory; compared normal vs ui-only to classify sources; optional logo crop quantizes separately.</lang>
async function captureAndQuantize(win:BrowserWindow, logos?:{rect:{x:number;y:number;width:number;height:number};kind:string}[]):Promise<{ normal:ColorEvidence[]; uiOnly:ColorEvidence[]; logo:ColorEvidence[]; celebiDivergence:number }>{
  const toRgba=async (rect?:{x:number;y:number;width:number;height:number})=>{
    const img=rect?await win.webContents.capturePage(rect):await win.webContents.capturePage();
    const buf=img.toBitmap(); // BGRA
    const out:{r:number;g:number;b:number;a:number}[]=[];
    for(let i=0;i<buf.length;i+=4){
      out.push({ b:buf[i]!, g:buf[i+1]!, r:buf[i+2]!, a:buf[i+3]! });
    }
    return out;
  };
  const norm=await toRgba();
  const nqRaw=quantizeMedianCut(norm,14);
  const nq=nqRaw.map<ColorEvidence>(c=>({ value:c.hex, hex:c.hex, alpha:1, source:'screenshot-ui', role:'unknown', count:c.count, pixelRatio:c.ratio }));
  // P5 实验性基准：Celebi(lab k-means) 与 median-cut 的偏离度观测，仅写诊断报告，不替换主评分。
  // <lang zh-CN>文档明确不得采用 Celebi 的 seed Score 作为网页品牌色评分，故仅作对比基准；divergence 用原始 QuantizedColor。</lang>
  // <lang en>Spec forbids using Celebi seed Score for brand scoring; baseline-only; divergence uses raw QuantizedColor.</lang>
  const celebiQ=quantizeCelebi(norm,14);
  const celebiDivergence=quantizerDivergence(nqRaw,celebiQ,5);
  await applyUiOnlyMode(win);
  // 等待重绘。
  await new Promise(r=>setTimeout(r,300));
  const ui=await toRgba();
  const uq=quantizeMedianCut(ui,14).map<ColorEvidence>(c=>({ value:c.hex, hex:c.hex, alpha:1, source:'screenshot-ui', role:'unknown', count:c.count, pixelRatio:c.ratio }));
  // logo crop：对每个有有效包围盒的 logo 区域裁剪截图，量化为 logo-raster（标记 isLogo/brand）。
  // <lang zh-CN>P5 logo crop；favicon 包围盒为 0 跳过（无页面像素可裁），仅 brand-image/svg 实体裁剪。</lang>
  // <lang en>P5 logo crop; favicon (zero rect) skipped, only real brand-image/svg rects are cropped.</lang>
  const logo:ColorEvidence[]=[];
  for(const lg of (logos||[])){
    if(lg.rect.width<8||lg.rect.height<8)continue;
    try{
      const px=await toRgba(lg.rect);
      const q=quantizeMedianCut(px,6).map<ColorEvidence>(c=>({ value:c.hex, hex:c.hex, alpha:1, source:'logo-raster', role:'brand', count:c.count, pixelRatio:c.ratio, isLogo:true }));
      logo.push(...q);
    }catch{ /* 裁剪失败忽略 */ }
  }
  return { normal:nq, uiOnly:uq, logo, celebiDivergence };
}

/**
 * @lang zh-CN 真实渲染采集选项：dark 双模式（强制 prefers-color-scheme:dark 复采）与 logo crop 默认开启。
 *   precision 侧车打包固定 chromium 不属于首版默认方案（见 ADR-002），此处仅预留开关位。
 * @lang en Real-render options: dark dual-mode (force prefers-color-scheme:dark recapture) and logo crop default on.
 *   Precision sidecar (bundled fixed chromium) is non-default per ADR-002; switch placeholder only.
 */
export interface RenderCollectOptions{
  emulateDark?:boolean;
  captureLogo?:boolean;
}

// 页面端 DOM 采集脚本：注入 scanner 后预取 manifest 颜色（fetchManifest，遗留问题清理 C9），
//   再以同步 scanDocument 采集；manifest 预取失败静默降级为无 manifest 证据。
// <lang zh-CN>fetchManifest 由 bundle 提供；scanDocument 保持同步无网络等待。</lang>
// <lang en>fetchManifest ships in the bundle; scanDocument stays synchronous with no network wait.</lang>
function scanDomScript(colorScheme:'light'|'dark'):string{
  const schemePart=colorScheme==='dark'?"colorScheme:'dark',":"";
  return `(async function(){
    const mf = (window.__hiaScanner.fetchManifest ? await window.__hiaScanner.fetchManifest(document).catch(function(){ return null; }) : null);
    const ctx={ width:${VIEWPORT.width}, height:${VIEWPORT.height}, dpr:${VIEWPORT.dpr}, ${schemePart} };
    if(mf){ ctx.manifest=mf; }
    const r=window.__hiaScanner.scanDocument(document, ctx);
    return JSON.stringify({ evidence:r.evidence, warnings:r.warnings });
  })()`;
}

/**
 * @lang zh-CN 真实渲染采集主入口：隐藏窗口加载 URL，稳定化后注入 scanner 采集 DOM 证据 + 截图量化，
 *   返回 V2 信号（mode:'render'）。默认开启 dark 双模式、logo crop 与 manifest 颜色预取（P5 增强 + C9）。
 *   任何失败抛错，由调用方决定回退静态采集。
 * @lang en Real-render collection entry: hidden window loads URL, stabilizes, injects scanner for DOM evidence + screenshot quantize,
 *   returns V2 signals (mode:'render'). Dark dual-mode, logo crop and manifest pre-fetch on by default (P5 + C9).
 *   Any failure throws; caller decides static fallback.
 */
export async function renderCollect(rawUrl:string, opts?:RenderCollectOptions):Promise<WebsiteColorSignalsV2>{
  // 深度 SSRF 校验：同步字面量关卡 + 运行时 DNS 解析二次校验（防 DNS rebinding 把公开域名跳私网）。
  // <lang zh-CN>导航前先解析 host 的全部 A/AAAA 并核对私网/元数据，fail-closed。</lang>
  // <lang en>Pre-navigation deep check: resolve all A/AAAA and verify against private/metadata, fail-closed.</lang>
  const guard=await guardUrlDeep(rawUrl);
  if(!guard.ok)throw new Error((guard.reason.startsWith('SSRF:')?guard.reason:'SSRF:'+guard.reason));

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
    //   session 级下载 deny 的回调参数用最小 any 规避声明合并解析问题。</lang>
    // <lang en>Block all side effects and unknown navigations. electron vs DOM lib global types conflict;
    //   the session-level download-deny callback params use minimal any to bypass the declaration-merge gap.</lang>
    win.webContents.session.setPermissionRequestHandler((_req,_perm,cb)=>cb(false));
    // 下载拦截：session 级 will-download 阻止任何下载项（现行 API，非遗留问题 C12 指向的旧式 webContents 事件）。
    // <lang zh-CN>deny 所有下载项，避免副作用。</lang>
    // <lang en>Deny all downloads to avoid side effects.</lang>
    win.webContents.session.on('will-download',(_evt,item)=>{ item.cancel(); });
    // 弹窗拦截：setWindowOpenHandler 阻止一切新窗口（Electron 12+ 现行 API；遗留问题清理 C12，
    //   替换已废弃的 webContents 'new-window' 事件监听）。
    // <lang zh-CN>返回 deny 即阻止一切新窗口/弹窗导航。</lang>
    // <lang en>Returning deny blocks all new-window/popup opens.</lang>
    win.webContents.setWindowOpenHandler(()=>({ action:'deny' }));

    // 请求级 SSRF 重校验（文档十三节第 5/6 条）：每个新请求（含重定向链每一跳与子资源）都过 onBeforeRequest 字面量关卡。
    // <lang zh-CN>域名型 host 的 DNS rebinding 已由导航前 guardUrlDeep 兜底；此处阻断字面量私网/IP 变体与非常规协议，
    //   并阻断 file:/data:/javascript: 等注入面。onBeforeRedirect 仅作观察无法取消，重定向链各 hop 会重新触发 onBeforeRequest。</lang>
    // <lang en>Per-request SSRF recheck (spec §13.5/6): each new request (incl. every redirect hop and subresource) hits onBeforeRequest literal gate.
    //   DNS rebinding for domain hosts is covered pre-navigation by guardUrlDeep; here we block literal private/IP variants and odd schemes.
    //   onBeforeRedirect is observe-only (uncancelable); each redirect hop re-triggers onBeforeRequest.</lang>
    win.webContents.session.webRequest.onBeforeRequest((details, cb)=>{
      const r=guardRequestUrl(details.url);
      if(!r.ok){ cb({ cancel:true }); return; }
      cb({ cancel:false });
    });

    await win.loadURL(rawUrl,{ userAgent:'HIA-Theme-Builder/0.1 (+color-extraction)' });
    await stabilize(win);

    // 注入 scanner 并采集 DOM 证据。
    // <lang zh-CN>页面端解析器用浏览器原生 getComputedStyle 兜底（复杂格式由真实浏览器解析）；
    //   采集前异步预取 manifest 颜色（C9），失败静默为 null。</lang>
    // <lang en>Page parser uses native getComputedStyle as fallback (browser resolves complex formats);
    //   manifest colors pre-fetched async before scanning (C9), silently null on failure.</lang>
    await exec('inject-scanner', scannerSrc);
    // 在页面端完成 JSON 序列化并返回字符串，规避 IPC 结构化克隆对特殊值的限制。
    // <lang zh-CN>主进程收到字符串后 JSON.parse；任何不可序列化字段已在页面端被 JSON 丢弃。</lang>
    // <lang en>Page side serializes to string; main parses. Un-serializable fields dropped at page side.</lang>
    const domEvJson:string=String(await exec('scan-dom', scanDomScript('light')));
    const scanRes=JSON.parse(domEvJson);
    const domEv:ColorEvidence[]=scanRes.evidence||[];
    // 合并 scanner 端 warnings（节点上限/证据上限/同源 frame 跳过等）。
    // <lang zh-CN>scanner 内部已对同源 iframe 递归扫描并标记 frameKind，第三方 frame 自然跳过。</lang>
    // <lang en>Scanner already recurses same-origin iframes and tags frameKind; third-party skipped by SOP.</lang>
    for(const w of (scanRes.warnings||[]))warnings.push({ code:w.code, message:w.message, scope:w.scope||'scanner' });

    // logo 检测：拿到页面 logo 包围盒，供截图裁剪量化（P5 logo crop）。
    // <lang zh-CN>仅当 captureLogo 未显式关闭时检测；favicon 包围盒为 0，后续裁剪会跳过。</lang>
    // <lang en>Detect only when captureLogo not disabled; favicon zero-rect skipped at crop.</lang>
    let logos:{rect:{x:number;y:number;width:number;height:number};kind:string}[]=[];
    if(opts?.captureLogo!==false){
      try{
        const logosJson:string=String(await exec('detect-logos', `JSON.stringify(window.__hiaScanner.detectLogos(document))`));
        logos=JSON.parse(logosJson)||[];
      }catch{ /* 忽略检测失败 */ }
    }

    const shots=await captureAndQuantize(win, logos);
    // normal 与 ui-only 对照：仅 ui-only 出现 → screenshot-ui；仅 normal 出现 → screenshot-artwork（降权由 P3 处理）。
    // <lang zh-CN>此处先统一为 screenshot-ui，artwork 标记留给 P3 评分。</lang>
    // <lang en>Unified to screenshot-ui here; artwork tagging deferred to P3 scoring.</lang>
    const evidence:ColorEvidence[]=[...domEv, ...shots.normal, ...shots.uiOnly, ...shots.logo];

    const title=String(await exec('read-title','document.title').catch(()=> ''));
    const colorScheme=String(await exec('read-scheme',`(function(){ return matchMedia&&matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light'; })()`).catch(()=> 'light'));

    // dark 双模式采集（P5）：强制 prefers-color-scheme:dark 后 reload 复采，得到 dark 套证据。
    // <lang zh-CN>较短的稳定化窗口（4s/8s）控制额外耗时；reload 后需重新注入 scanner bundle；dark 采集同样预取 manifest（C9）。</lang>
    // <lang en>Force dark then reload+rescan; shorter stabilize (4s/8s) bounds extra cost; re-inject scanner after reload; dark scan also pre-fetches manifest (C9).</lang>
    let darkMode:WebsiteColorSignalsV2['darkMode'];
    if(opts?.emulateDark!==false){
      try{
        await (win.webContents as unknown as { setEmulatedMedia:(o:{prefersColorScheme?:'light'|'dark'})=>void }).setEmulatedMedia({ prefersColorScheme:'dark' });
        await win.webContents.reload();
        await stabilize(win,4000,8000);
        await exec('inject-scanner-dark', scannerSrc);
        const darkJson:string=String(await exec('scan-dom-dark', scanDomScript('dark')));
        const dres=JSON.parse(darkJson);
        darkMode={ evidence:dres.evidence||[], colorScheme:'dark', warnings:dres.warnings||[] };
        await (win.webContents as unknown as { setEmulatedMedia:(o:{prefersColorScheme?:'light'|'dark'})=>void }).setEmulatedMedia({ prefersColorScheme:'light' });
      }catch(e){ const m=e instanceof Error?e.message:String(e); warnings.push({ code:'dark-capture', message:`dark 双模式采集失败：${m}`, scope:'adapter' }); }
    }

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
      darkMode,
      warnings,
      diagnostics:{ mode:'render', durationMs:Date.now()-started, notes:['Electron hidden BrowserWindow render', `Celebi baseline divergence=${shots.celebiDivergence.toFixed(3)}`] }
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
 *   静态降级路径现已与渲染路径同口径过 SSRF 深度校验（遗留问题清理 B2）。
 * @lang en Collection entry with fallback: prefer real render; on failure use static fetch tagged degraded-static via toV2Signals.
 *   The static path now applies the same SSRF deep check as the render path (cleanup B2).
 */
export async function collectSignalsV2(rawUrl:string):Promise<WebsiteColorSignalsV2>{
  try{
    // P5 增强默认开启 dark 双模式与 logo crop；后续可由调用方显式关闭（如性能敏感场景）。
    // <lang zh-CN>precision 侧车打包固定 chromium 不在首版默认范围（见 ADR-002）。</lang>
    // <lang en>Precision sidecar is out of default scope (ADR-002).</lang>
    return await renderCollect(rawUrl, { emulateDark:true, captureLogo:true });
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
