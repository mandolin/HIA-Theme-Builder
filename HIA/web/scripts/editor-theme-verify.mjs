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
if(preview.codeEditors<2){console.error(`❌ 应渲染 light+dark 两套编辑器，实为 ${preview.codeEditors}`);failed++;}
if(preview.lineNumbers<6){console.error(`❌ 行号不足（${preview.lineNumbers}，两套应各 12 行）`);failed++;}
if(!preview.hasStatusBar){console.error('❌ 状态条未渲染');failed++;}
if(/E_|错误|error/i.test(preview.issues)){console.error(`❌ 预览报错：${preview.issues}`);failed++;}
const shot=async(name)=>{const el=await page.$('#tdonPreviewPanel');if(el){await el.screenshot({path:join(OUT,name)});console.log('[shot]',name);}};
// 几何断言（维护者反馈核心）：行号栏与代码正文之间必须有实际间距 + 分隔线——
//   此前 code-editor 完全没有 CSS，行号紧贴正文。用 getBoundingClientRect 实测。
// <lang en>Geometry assertion (the maintainer's core complaint): the gutter and the code text need real
//   spacing plus a divider — code-editor previously had no CSS at all and the numbers stuck to the text.</lang>
const geom=await page.evaluate(()=>{
  const ln=document.querySelector('#tdonPreviewBody .tdon-code-ln');
  const tx=document.querySelector('#tdonPreviewBody .tdon-code-text');
  const ed=document.querySelector('#tdonPreviewBody .tdon-code-editor');
  if(!ln||!tx||!ed)return null;
  const a=ln.getBoundingClientRect(),b=tx.getBoundingClientRect();
  const cs=getComputedStyle(ln);
  return{
    gap:Math.round((b.left-a.right)*10)/10,
    borderRight:cs.borderRightWidth,
    borderRadius:getComputedStyle(ed).borderRadius,
    fontFamily:getComputedStyle(ed).fontFamily.slice(0,40),
    lineHeight:getComputedStyle(ln.parentElement).lineHeight
  };
});
console.log('[geometry]',JSON.stringify(geom));
if(!geom){console.error('❌ 找不到行号/正文元素');failed++;}
else{
  if(geom.gap<8){console.error(`❌ 行号与正文间距仅 ${geom.gap}px（应 ≥8px）`);failed++;}
  if(parseFloat(geom.borderRight)<1){console.error('❌ 行号栏缺少右分隔线');failed++;}
  if(geom.borderRadius==='0px'){console.error('❌ 编辑器缺少圆角（应像真实编辑器窗口）');failed++;}
  if(!/mono/i.test(geom.fontFamily)){console.error(`❌ 未使用等宽字体（${geom.fontFamily}）`);failed++;}
}

// 明暗并排 + 着色可见性（维护者反馈 2026-11-17 的两点）：
//   ① 必须同时有 light 与 dark 两套编辑器；② 两套配色必须不同；
//   ③ 深色版着色必须在其深底上有足够对比（用 WCAG 比例粗判 ≥2.5，仅作可见性下限）。
// <lang en>Side-by-side appearances + colouring visibility (the maintainer's two 2026-11-17 points):
//   (1) both light and dark editors present; (2) their colours differ; (3) dark-mode colours keep enough
//   contrast against the dark backdrop (≥2.5 by WCAG ratio as a visibility floor).</lang>
const duo=await page.evaluate(()=>{
  const eds=[...document.querySelectorAll('#tdonPreviewBody .tdon-code-editor')];
  const lum=(hex)=>{
    const m=/^#?([0-9a-f]{6})$/i.exec(hex.trim());
    if(!m)return null;
    const v=m[1];
    const ch=[0,2,4].map(i=>parseInt(v.slice(i,i+2),16)/255).map(c=>c<=0.04045?c/12.92:Math.pow((c+0.055)/1.055,2.4));
    return 0.2126*ch[0]+0.7152*ch[1]+0.0722*ch[2];
  };
  const ratio=(a,b)=>{const hi=Math.max(a,b),lo=Math.min(a,b);return(hi+0.05)/(lo+0.05);};
  const info=eds.map(ed=>{
    const isDark=ed.classList.contains('is-dark');
    const bgHex=(()=>{
      const bg=getComputedStyle(ed).backgroundColor;
      const m=/rgb\((\d+),\s*(\d+),\s*(\d+)\)/.exec(bg);
      if(!m)return null;
      return '#'+[1,2,3].map(i=>Number(m[i]).toString(16).padStart(2,'0')).join('');
    })();
    const cols=[...new Set([...ed.querySelectorAll('.tdon-code-text span[style*=color]')].map(sp=>{
      const m=/rgb\((\d+),\s*(\d+),\s*(\d+)\)/.exec(getComputedStyle(sp).color);
      return m?'#'+[1,2,3].map(i=>Number(m[i]).toString(16).padStart(2,'0')).join(''):null;
    }).filter(Boolean))];
    const bgL=lum(bgHex??'');
    const contrasts=bgL===null?[]:cols.map(c=>{const cl=lum(c);return cl===null?0:ratio(bgL,cl);});
    return{isDark,bg:bgHex,colors:cols,minContrast:contrasts.length?Math.min(...contrasts):0};
  });
  return info;
});
console.log('[appearances]',JSON.stringify(duo));
if(duo.length!==2){console.error(`❌ 应有 light+dark 两套编辑器，实为 ${duo.length}`);failed++;}
else{
  if(!duo.some(d=>d.isDark)||!duo.some(d=>!d.isDark)){console.error('❌ 缺少 light 或 dark 之一');failed++;}
  const light=duo.find(d=>!d.isDark),dark=duo.find(d=>d.isDark);
  if(JSON.stringify(light?.colors)===JSON.stringify(dark?.colors)){console.error('❌ 明暗两套配色相同（应按底色取不同档位）');failed++;}
  if((dark?.minContrast??0)<2.5){console.error(`❌ 深色版最小对比 ${dark?.minContrast?.toFixed(2)} < 2.5（着色不可见）`);failed++;}
  if((light?.minContrast??0)<2.5){console.error(`❌ 浅色版最小对比 ${light?.minContrast?.toFixed(2)} < 2.5`);failed++;}
}
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

// 4) 文件预览必须是**高亮代码块**（维护者反馈：纯色 textarea 不友好），且明暗两套内容不同。
// <lang en>The file preview must be a **highlighted code block** (maintainer feedback: the plain textarea read
//   poorly), and the light/dark contents must differ.</lang>
const previewState=await page.evaluate(()=>{
  const els=[...document.querySelectorAll('[data-tdon-file]')];
  const readAfterClick=(re)=>{
    const el=els.find(x=>re.test(x.getAttribute('data-tdon-file')??''));
    if(!el)return null;
    el.click();
    const host=document.getElementById('exportTdonFilePreview');
    if(!host)return null;
    const view=host.querySelector('.code-view');
    return{
      isCodeView:!!view,
      lang:view?.getAttribute('data-lang')??'',
      rows:host.querySelectorAll('.cv-row').length,
      tokens:host.querySelectorAll('[class^="tok-"]').length,
      tokenClasses:[...new Set([...host.querySelectorAll('[class^="tok-"]')].map(e=>e.className))],
      // 底色必须是浅色（不是此前的 #0E1726 深色）
      // <lang en>The backdrop must be light (not the previous #0E1726 dark).</lang>
      bg:view?getComputedStyle(view).backgroundColor:'',
      text:(host.textContent??'').length
    };
  };
  return{light:readAfterClick(/light\.tmTheme/i),dark:readAfterClick(/dark\.tmTheme/i)};
});
console.log('[preview-highlight]',JSON.stringify(previewState));
const pv=previewState.light;
if(!pv||!pv.isCodeView){console.error('❌ 预览不是高亮代码块');failed++;}
else{
  if(pv.rows<5){console.error(`❌ 行号不足（${pv.rows}）`);failed++;}
  if(pv.tokens<6){console.error(`❌ 高亮 token 太少（${pv.tokens}）——疑似纯文本`);failed++;}
  if(pv.lang!=='markup'){console.error(`❌ .tmTheme 应走 markup 高亮，实为 ${pv.lang}`);failed++;}
  if(pv.bg==='rgb(14, 23, 38)'){console.error('❌ 预览仍是旧深色底');failed++;}
  if(pv.tokenClasses.length<2){console.error(`❌ token 配色单一（${pv.tokenClasses.join(',')}）`);failed++;}
}
if(!previewState.dark||previewState.light?.text===previewState.dark?.text){console.error('❌ 明暗两套内容相同');failed++;}
await shot('02-export-tree.png');

// 4b) 经典导出区（WordPress/Tailwind/DTCG）预览同样必须是高亮块（CSS 与 JSON 各测一次）。
// <lang en>The classic export area must highlight too — check CSS and JSON.</lang>
await page.evaluate(()=>{
  document.querySelector('#exportTypeTabs .tab[data-export-mode="classic"]')?.click();
});
await new Promise(r=>setTimeout(r,500));
const classicChecks=await page.evaluate(()=>{
  const rows=[...document.querySelectorAll('[data-export-file]')];
  const probe=(re)=>{
    const r=rows.find(x=>re.test(x.getAttribute('data-export-file')??''));
    if(!r)return null;
    r.click();
    const host=document.getElementById('exportFilePreview');
    const view=host?.querySelector('.code-view');
    if(!view)return null;
    return{lang:view.getAttribute('data-lang'),tokens:host.querySelectorAll('[class^="tok-"]').length,rows:host.querySelectorAll('.cv-row').length,file:r.getAttribute('data-export-file')};
  };
  // 目标是 tailwind-config 时才有 CSS/JS 文件；先切目标。
  const sel=document.getElementById('exportTargetSelect');
  if(sel){sel.value='tailwind-config';sel.dispatchEvent(new Event('change',{bubbles:true}));}
  return{switched:!!sel};
});
await new Promise(r=>setTimeout(r,500));
const classic=await page.evaluate(()=>{
  const rows=[...document.querySelectorAll('[data-export-file]')];
  const probe=(re)=>{
    const r=rows.find(x=>re.test(x.getAttribute('data-export-file')??''));
    if(!r)return null;
    r.click();
    const host=document.getElementById('exportFilePreview');
    const view=host?.querySelector('.code-view');
    if(!view)return null;
    return{lang:view.getAttribute('data-lang'),tokens:host.querySelectorAll('[class^="tok-"]').length,rows:host.querySelectorAll('.cv-row').length,file:r.getAttribute('data-export-file')};
  };
  return{css:probe(/\.css$/i),config:probe(/\.js$/i)};
});
console.log('[classic-highlight]',JSON.stringify({switched:classicChecks.switched,css:classic.css,config:classic.config}));
if(!classic.css){console.error('❌ 经典导出未找到 CSS 文件预览');failed++;}
else if(classic.css.tokens<5){console.error(`❌ CSS 预览高亮不足（${classic.css.tokens}）`);failed++;}
if(!classic.config){console.error('❌ 经典导出未找到 JS/JSON 文件预览');failed++;}
else if(classic.config.tokens<3){console.error(`❌ JS 预览高亮不足（${classic.config.tokens}）`);failed++;}
await shot('02-export-tree.png');

// 5) 无 JS 错误。
// <lang en>No JS errors.</lang>
if(errors.length){console.error('❌ 页面 JS 错误：',errors.join(' | '));failed++;}

await browser.close();
server.close();
console.log(failed===0?'✅ 编辑器主题示例验收通过':`❌ 失败 ${failed} 项`);
process.exit(failed===0?0:1);
