#!/usr/bin/env node
/**
 * @lang zh-CN axe 无障碍扫描门禁（`W-tb-P27`）：用 puppeteer-core 驱动**系统已装 Chrome**（零浏览器下载）
 *   对生产 dist 做 axe-core 扫描，light + dark 双模式；结果与 `test/axe-baseline.json` 基线比对——
 *   **新增违规 → 退出码 1**（基线内放行并提示存量）。
 * @lang en axe accessibility gate (`W-tb-P27`): puppeteer-core drives the system Chrome (zero download),
 *   scanning the production dist with axe-core in light and dark modes; results diff against
 *   `test/axe-baseline.json` — **new violations exit 1** (baseline ones pass with a reminder).
 *
 * 用法 / Usage:
 *   node scripts/axe-scan.mjs [--update-baseline] [--url http://…]
 *   --update-baseline  用本次结果覆盖基线（修复后重新登记用）
 *   --url              直接扫描指定 URL（缺省起本地静态服务扫 dist/index.html）
 */
import{createServer}from'node:http';
import{readFile}from'node:fs/promises';
import{fileURLToPath}from'node:url';
import{dirname,join,resolve,sep}from'node:path';
import puppeteer from'puppeteer-core';

const __dirname=dirname(fileURLToPath(import.meta.url));
// axe-core 源码：从 node_modules 直接读取（不用 import attributes——Node 20.9 不支持 `with` 语法）。
// <lang en>Read from node_modules; import attributes (`with`) are unsupported on Node 20.9.</lang>
const AXE_SOURCE=await readFile(resolve(__dirname,'..','node_modules','axe-core','axe.min.js'),'utf8');
const DIST=resolve(__dirname,'..','dist');
const BASELINE=resolve(__dirname,'..','test','axe-baseline.json');
// 双模式扫描：appearanceSwitch 是应用内切换（非系统 prefers-color-scheme），
//   因此 dark 通过点击按钮触发而非 emulateMediaFeatures。
const MODES=['light','dark'];

// ---- MIME 表（静态服务用；与构建产物一致即可）----
const MIME={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json','.svg':'image/svg+xml','.png':'image/png','.ico':'image/x-icon','.map':'application/json','.woff':'font/woff','.woff2':'font/woff2'};

// 起本地静态服务：仅回环地址，进程退出即关闭（无状态、无写操作）。
// <lang zh-CN>路径越界防护：解析后必须仍在 dist 内。</lang>
// <lang en>Path-traversal guard: resolved paths must stay inside dist.</lang>
function serveStatic(root,port){
  return new Promise(resolveFn=>{
    const server=createServer(async(req,res)=>{
      try{
        const url=decodeURIComponent(req.url.split('?')[0]);
        const rel=url==='/'?'/index.html':url;
        const file=join(root,rel);
        if(!file.startsWith(root+sep)&&file!==root){res.writeHead(403);return res.end();}
        const buf=await readFile(file);
        res.writeHead(200,{'content-type':MIME[file.slice(file.lastIndexOf('.')).toLowerCase()]??'application/octet-stream','cache-control':'no-store'});
        res.end(buf);
      }catch{res.writeHead(404);res.end('not found');}
    });
    server.listen(port,'127.0.0.1',()=>resolveFn(server));
  });
}

// ---- Chrome 可执行文件定位 ----
// <lang zh-CN>puppeteer-core 的 channel:'chrome' 在 Windows/macOS/Linux 按各自惯例查系统 Chrome；
//   GitHub ubuntu-latest 预装 google-chrome-stable，Windows runner 预装 Chrome——CI 与本地同一逻辑。</lang>
// <lang en>channel:'chrome' resolves the system Chrome per-platform; GitHub runners ship Chrome preinstalled,
//   so CI and local share one code path.</lang>
async function launchBrowser(){
  for(const channel of ['chrome','chrome-beta','msedge']){
    try{return await puppeteer.launch({channel,headless:true,protocolTimeout:300000,args:['--no-sandbox','--disable-dev-shm-usage']});}
    catch(e){/* 换下一个候选通道 */}
  }
  throw new Error('未找到可用的 Chrome/Edge。请安装 Chrome 或设置 PUPPETEER_EXECUTABLE_PATH。/ No Chrome or Edge found.');
}

// ---- 扫描单页 ----
// <lang zh-CN>waitFor#body 等应用挂载完成；切 dark 用真实点击（appearanceSwitch 是应用状态而非系统偏好）。</lang>
// <lang en>Wait for app mount; dark is toggled via a real click (the switch is app state, not OS preference).</lang>
async function scanMode(page,mode){
  if(mode==='dark'){
    await page.evaluate(()=>{
      const btn=document.querySelector('#appearanceSwitch .seg[data-appearance="dark"]');
      if(!btn)throw new Error('找不到 dark 切换按钮');
      btn.click();
    });
    await new Promise(r=>setTimeout(r,300));
  }
  // 执行 axe：注入源码并跑全规则（resultTypes 只收 violations，减小回传体积）。
  // <lang zh-CN>内联 script（无 src）是**同步执行**且不触发 onload/error 事件——
  //   曾因等待永不触发的 onload 导致 evaluate 挂死直到协议超时；改为同步追加后直接检查 window.axe。</lang>
  // <lang en>Inline scripts (no src) execute synchronously and never fire onload/error — waiting for onload
  //   hung evaluate until the protocol timeout. Append synchronously and check window.axe instead.</lang>
  const results=await page.evaluate((src)=>{
    const script=document.createElement('script');
    script.textContent=src;
    document.head.appendChild(script);
    if(!window.axe||typeof window.axe.run!=='function')throw new Error('axe 注入失败（window.axe 不可用）');
    return window.axe.run(document,{resultTypes:['violations']}).then(r=>r.violations);
  },AXE_SOURCE);
  // 归一化为可序列化摘要：id + 影响节点选择器（截断），供基线比对与人工定位。
  return results.map(v=>({
    id:v.id,
    impact:v.impact,
    nodes:v.nodes.map(n=>n.target.join(' ')).sort(),
  }));
}

// ---- 主流程 ----
const argv=process.argv.slice(2);
const updateBaseline=argv.includes('--update-baseline');
const urlArg=argv.includes('--url')?argv[argv.indexOf('--url')+1]:null;

let server=null;
let target=urlArg;
if(!target){
  server=await serveStatic(DIST,18999);
  target='http://127.0.0.1:18999/';
}

const browser=await launchBrowser();
const page=await browser.newPage();
// 视口对齐主流桌面（与 e2e 手测一致）；窄屏另有响应式断点，不在本门禁范围。
await page.setViewportSize?.({width:1280,height:900}).catch?.(()=>{});
try{await page.setViewport({width:1280,height:900});}catch{/* 老接口兜底 */}
await page.goto(target,{waitUntil:'networkidle2',timeout:30000});
// 应用模式等应用挂载（#pcPageTitle）；--url 模式扫任意页面，等 body 即可。
// <lang en>App mode waits for the app mount; --url mode scans arbitrary pages and only needs body.</lang>
await page.waitForSelector(urlArg?'body':'#pcPageTitle',{timeout:15000});

// --url 诊断模式扫任意页面：无应用的 dark 切换按钮，只扫一遍。
// <lang en>Diagnostic --url mode scans arbitrary pages: no app dark toggle, single pass.</lang>
const modes=urlArg?['light']:MODES;
const all={};
for(const mode of modes){
  // 每个模式独立重载：light 基线从干净状态起扫，避免 dark 残留。
  await page.goto(target,{waitUntil:'networkidle2'});
  await page.waitForSelector(urlArg?'body':'#pcPageTitle',{timeout:15000});
  const t1=Date.now();
  all[mode]=await scanMode(page,mode);
  // 耗时日志：操作台 DOM 很大，axe 全规则扫描耗时属正常信息（CI 排查超时时有用）。
  // <lang en>Timing log: the studio DOM is large, so full-rule scan duration is normal CI diagnostics.</lang>
  console.log(`[${mode}] axe 扫描耗时 ${((Date.now()-t1)/1000).toFixed(1)}s`);
}
await browser.close();
server?.close();

// ---- 基线比对 ----
// 违规指纹：规则 id + 影响节点选择器集合。节点顺序无关（sort 后比较）。
const fingerprint=v=>`${v.id}::${v.nodes.join('|')}`;
const baseline=updateBaseline?null:JSON.parse(await readFile(BASELINE,'utf8'));
// 基线结构 {light:{指纹:true},dark:{…}}；指纹集合取两模式并集。
// <lang zh-CN>曾误取顶层 mode 键当指纹——新违规永远判"新增"，基线形同虚设；并集修正后基线才真正生效。</lang>
// <lang en>Fingerprints come from the union of both mode maps — using top-level keys made every violation "new".</lang>
const baselineKeys=new Set(baseline?[...Object.keys(baseline.light??{}),...Object.keys(baseline.dark??{})]:[]);

const report={};
let newIssues=0;
for(const mode of modes){
  report[mode]={};
  for(const v of all[mode]??[]){
    const key=fingerprint(v);
    report[mode][key]=true;
    if(!baselineKeys.has(key)){newIssues++;console.error(`[NEW][${mode}] ${v.id} (${v.impact}) → ${v.nodes.slice(0,3).join(' , ')}`);}
  }
}
const baselineOnly=[...baselineKeys].filter(k=>!modes.some(m=>report[m]&&report[m][k]));

if(updateBaseline){
  await import('node:fs').then(fs=>fs.writeFileSync(BASELINE,JSON.stringify(report,null,2)+'\n'));
  console.log(`基线已更新：${modes.map(m=>`${m} ${Object.keys(report[m]??{}).length} 条`).join(' / ')}`);
}else{
  const counts=modes.map(m=>`${m} ${Object.keys(report[m]??{}).length} 条`).join(' / ');
  console.log(`axe 扫描完成：${counts}；新增违规 ${newIssues}；基线已失效 ${baselineOnly.length}`);
  if(baselineOnly.length)console.log(`[STALE] 基线中已不再出现（可用 --update-baseline 清理）：\n  ${baselineOnly.slice(0,10).join('\n  ')}`);
  if(newIssues>0){
    console.error(`✗ 存在 ${newIssues} 条新增违规——修复或用 --update-baseline 登记（须附理由）。`);
    process.exit(1);
  }
  console.log('✅ 无新增违规（基线内放行）。');
}
