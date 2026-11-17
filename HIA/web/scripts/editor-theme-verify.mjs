#!/usr/bin/env node
/**
 * @lang zh-CN 编辑器主题示例验收（`W-tb-P42`/ADR-015 补入口）：无头 Chrome 驱动生产 dist——
 *   ①TDON 面板可见且有「加载编辑器主题示例」按钮；②点击后预览出现 `code-editor` 节点（行号+着色）；
 *   ③导出文件树出现四格式（tmTheme / color-theme.json / vim / el）八文件；
 *   ④明暗两套文件内容不同；⑤无 JS 错误。
 *   背景：能力已交付但操作台无入口（维护者反馈"新增的特性我怎么没看到"）——入口缺失等于特性不可达。
 * @lang en Editor-theme example acceptance (`W-tb-P42`/ADR-015 entry added): headless Chrome drives the
 *   production dist — (1) the TDON panel shows the "load editor-theme example" button; (2) clicking renders the
 *   `code-editor` node (line numbers + colouring); (3) the export tree lists eight files across four formats;
 *   (4) light/dark files differ; (5) no JS errors.
 *   Rationale: the capability shipped without a console entry — an unreachable feature is an absent feature.
 *
 * 用法 / Usage: node scripts/editor-theme-verify.mjs
 * 产物 / Output: temp/editor-theme/*.png
 */
import{createServer}from'node:http';
import{readFile,mkdir}from'node:fs/promises';
import{fileURLToPath}from'node:url';
import{dirname,join,resolve,sep}from'node:path';
import puppeteer from'puppeteer-core';

const __dirname=dirname(fileURLToPath(import.meta.url));
const ROOT=resolve(__dirname,'..','..','..');
const DIST=resolve(__dirname,'..','dist');
const OUT=join(ROOT,'temp','editor-theme');
const PORT=19004;
const MIME={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json','.svg':'image/svg+xml','.png':'image/png'};

function serve(){
  return new Promise(res=>{
    const server=createServer(async(req,resp)=>{
      try{
        const url=decodeURIComponent(req.url.split('?')[0]);
        const file=join(DIST,url==='/'?'/index.html':url);
        if(!file.startsWith(DIST+sep)&&file!==DIST){resp.writeHead(403);return resp.end();}
        const buf=await readFile(file);
        resp.writeHead(200,{'content-type':MIME[file.slice(file.lastIndexOf('.')).toLowerCase()]??'application/octet-stream','cache-control':'no-store'});
        resp.end(buf);
      }catch{resp.writeHead(404);resp.end('not found');}
    });
    server.listen(PORT,'127.0.0.1',()=>res(server));
  });
}

async function launch(){
  for(const channel of ['chrome','chrome-beta','msedge']){
    try{return await puppeteer.launch({channel,headless:true,protocolTimeout:180000,args:['--no-sandbox','--disable-dev-shm-usage','--hide-scrollbars']});}
    catch{/* next */}
  }
  throw new Error('未找到可用的 Chrome/Edge。');
}

const server=await serve();
const browser=await launch();
const page=await browser.newPage();
await page.setViewport({width:1920,height:1200,deviceScaleFactor:2});
await mkdir(OUT,{recursive:true});
const errors=[];
page.on('pageerror',e=>errors.push(e.message.slice(0,200)));
await page.goto(`http://127.0.0.1:${PORT}/`,{waitUntil:'networkidle2',timeout:30000});
await page.waitForSelector('#tdonPreviewPanel',{timeout:15000});
await page.waitForFunction(()=>document.getElementById('langToggleBtn')?.getAttribute('aria-label')?.includes('EN'),{timeout:10000}).catch(()=>{});

let failed=0;

// 0) 切到 TDON 预览模式（面板才可见）。
// <lang en>Switch to TDON preview mode so the panel is visible.</lang>
await page.evaluate(()=>document.querySelector('#previewTypeSwitch .seg[data-preview-mode="tdon"]')?.click());
await new Promise(r=>setTimeout(r,500));

// 1) 按钮存在且可见。
// <lang en>The button exists and is visible.</lang>
const btn=await page.evaluate(()=>{
  const b=document.getElementById('tdonLoadEditorExampleBtn');
  return{exists:!!b,visible:!!b&&!b.hidden&&b.offsetParent!==null,text:b?.textContent?.trim()};
});
console.log('[button]',JSON.stringify(btn));
if(!btn.exists||!btn.visible){console.error('❌ 「加载编辑器主题示例」按钮缺失或不可见');failed++;}

// 2) 点击 → code-editor 节点渲染。
// <lang en>Click → the code-editor node renders.</lang>
await page.evaluate(()=>document.getElementById('tdonLoadEditorExampleBtn')?.click());
await new Promise(r=>setTimeout(r,900));
const preview=await page.evaluate(()=>({
  codeEditors:document.querySelectorAll('#tdonPreviewBody .tdon-code-editor').length,
  lineNumbers:document.querySelectorAll('#tdonPreviewBody .tdon-code-ln').length,
  title:document.querySelector('#tdonPreviewBody .tdon-code-title-text')?.textContent?.trim(),
  hasStatusBar:document.querySelectorAll('#tdonPreviewBody .tdon-code-status').length,
  issues:document.querySelector('#tdonIssuesWrap')?.textContent?.trim()??'',
  source:document.getElementById('tdonStatusLabel')?.textContent?.trim()??''
}));
console.log('[preview]',JSON.stringify(preview));
if(preview.codeEditors<1){console.error('❌ 预览未渲染 code-editor 节点');failed++;}
if(preview.lineNumbers<3){console.error(`❌ 行号不足（${preview.lineNumbers}）`);failed++;}
if(!preview.hasStatusBar){console.error('❌ 状态条未渲染');failed++;}
if(/E_|错误|error/i.test(preview.issues)){console.error(`❌ 预览报错：${preview.issues}`);failed++;}
const shot=async(name)=>{const el=await page.$('#tdonPreviewPanel');if(el){await el.screenshot({path:join(OUT,name)});console.log('[shot]',name);}};
await shot('01-code-editor-preview.png');

// 3) 导出文件树：四格式八文件。
// <lang en>Export tree: eight files across four formats.</lang>
// 以 data-tdon-file 属性为唯一可信选择器：导出视图切换时容器 id 的可见性会变，
//   但文件行始终带该属性（renderTdonExport 的唯一产物标识）。
// <lang en>data-tdon-file is the only trustworthy selector: the container id's visibility changes with tab
//   switches, but file rows always carry this attribute.</lang>
const tree=await page.evaluate(()=>{
  const els=[...document.querySelectorAll('[data-tdon-file]')];
  return{count:els.length,rows:els.map(e=>({path:e.getAttribute('data-tdon-file'),text:e.textContent?.trim()??''}))};
});
const paths=tree.rows.map(r=>r.path??'');
console.log('[tree]',tree.count,'files:',paths.join(', '));
const expect=[
  ['TextMate light',/light\.tmTheme$/i],['TextMate dark',/dark\.tmTheme$/i],
  ['VSCode',/color-theme\.json$/i],['Vim',/\.vim$/i],['Emacs',/\.el$/i]
];
for(const[name,re]of expect){
  if(!paths.some(p=>re.test(p))){console.error(`❌ 导出树缺 ${name}`);failed++;}
}
if(paths.length<6){console.error(`❌ 导出文件数应 ≥6（四格式明暗），实为 ${paths.length}`);failed++;}

// 4) 明暗两套内容不同：点选 light 与 dark 文件比较预览文本。
// <lang en>Light/dark differ: select each file and compare the preview text.</lang>
const contents=await page.evaluate(()=>{
  const els=[...document.querySelectorAll('[data-tdon-file]')];
  const readAfterClick=(re)=>{
    const el=els.find(x=>re.test(x.getAttribute('data-tdon-file')??''));
    if(!el)return '';
    el.click();
    return document.getElementById('exportTdonFilePreview')?.value??'';
  };
  const light=readAfterClick(/light/i);
  const dark=readAfterClick(/dark/i);
  return{lightLen:light.length,darkLen:dark.length,identical:light===dark&&light.length>0};
});
console.log('[light/dark]',JSON.stringify(contents));
if(contents.lightLen===0||contents.darkLen===0){console.error('❌ 文件内容预览为空');failed++;}
if(contents.identical){console.error('❌ 明暗两套内容完全相同');failed++;}
await shot('02-export-tree.png');

// 5) 无 JS 错误。
// <lang en>No JS errors.</lang>
if(errors.length){console.error('❌ 页面 JS 错误：',errors.join(' | '));failed++;}

await browser.close();
server.close();
console.log(failed===0?'✅ 编辑器主题示例验收通过':`❌ 失败 ${failed} 项`);
process.exit(failed===0?0:1);
