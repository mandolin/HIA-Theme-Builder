#!/usr/bin/env node
/**
 * @lang zh-CN 语义状态色与圆角/阴影验收（`W-tb-P37`）：无头 Chrome 驱动生产 dist——
 *   ①默认未派生（旧主题观感不变）；②一键派生出四组；③覆盖拾色器改值并停随主色；
 *   ④跟随开关重算；⑤写入辅助槽位；⑥圆角滑杆与阴影控件实时作用于预览 chips；
 *   ⑦导出 CSS 携带语义变量；⑧导出目标出现 Tailwind v4；⑨语言切换重绘。输出截图供人工核对。
 * @lang en Semantic statuses & radius/shadow acceptance (`W-tb-P37`): headless Chrome drives the production
 *   dist — (1) default is not derived; (2) one-click derives four groups; (3) the picker overrides and stops
 *   following; (4) the follow toggle recomputes; (5) copy to aux slots; (6) radius/shadow controls act on the
 *   preview chips live; (7) exported CSS carries semantic vars; (8) a Tailwind v4 target appears; (9) locale
 *   switch re-renders. Screenshots for human review.
 *
 * 用法 / Usage: node scripts/semantic-tokens-verify.mjs
 * 产物 / Output: temp/semantic-tokens/*.png
 */
import{createServer}from'node:http';
import{readFile,mkdir}from'node:fs/promises';
import{fileURLToPath}from'node:url';
import{dirname,join,resolve,sep}from'node:path';
import puppeteer from'puppeteer-core';

const __dirname=dirname(fileURLToPath(import.meta.url));
const ROOT=resolve(__dirname,'..','..','..');
const DIST=resolve(__dirname,'..','dist');
const OUT=join(ROOT,'temp','semantic-tokens');
const PORT=18998;
const MIME={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json','.svg':'image/svg+xml','.png':'image/png','.ico':'image/x-icon','.map':'application/json'};

function serve(){
  return new Promise(res=>{
    const server=createServer(async(req,resp)=>{
      try{
        const url=decodeURIComponent(req.url.split('?')[0]);
        const rel=url==='/'?'/index.html':url;
        const file=join(DIST,rel);
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
await page.setViewport({width:1440,height:1200,deviceScaleFactor:2});
await mkdir(OUT,{recursive:true});
await page.goto(`http://127.0.0.1:${PORT}/`,{waitUntil:'networkidle2',timeout:30000});
await page.waitForSelector('#semanticPanel',{timeout:15000});
await page.waitForFunction(()=>document.getElementById('langToggleBtn')?.getAttribute('aria-label')?.includes('EN'),{timeout:10000}).catch(()=>{});

let failed=0;
const shot=async(name)=>{
  const el=await page.$('#semanticPanel');
  if(el){await el.screenshot({path:join(OUT,name)});console.log('[shot]',name);}
};

// 1) 默认未派生：四张卡显示"未派生"徽标（旧主题观感不变，ADR-012 决策 6）。
// <lang en>Default: four placeholder cards — legacy themes keep their look (ADR-012 decision 6).</lang>
const m1=await page.evaluate(()=>({
  placeholders:document.querySelectorAll('#semanticBody .sem-card .badge').length,
  cards:document.querySelectorAll('#semanticBody .sem-card').length
}));
console.log('[initial]',JSON.stringify(m1));
if(m1.cards!==4||m1.placeholders!==4){console.error(`❌ 初始应为 4 张未派生卡，实为 ${JSON.stringify(m1)}`);failed++;}
await shot('01-initial.png');

// 2) 一键派生：四卡出现基色与明暗两套示例。
// <lang en>Derive: four cards appear with base colours and light/dark samples.</lang>
await page.evaluate(()=>document.getElementById('deriveSemanticBtn')?.click());
await new Promise(r=>setTimeout(r,350));
const m2=await page.evaluate(()=>({
  pickers:document.querySelectorAll('#semanticBody [data-semantic-pick]').length,
  samples:document.querySelectorAll('#semanticBody .sem-sample').length,
  hexes:[...document.querySelectorAll('#semanticBody .sem-hex')].map(e=>e.textContent.trim()),
  derivedChecked:document.querySelectorAll('#semanticBody [data-semantic-derived]:checked').length,
  cssVars:(document.getElementById('cssTokenOutput')?.value??'').includes('--hia-success:')
}));
console.log('[derive]',JSON.stringify(m2));
if(m2.pickers!==4||m2.samples!==4){console.error('❌ 派生后应出现 4 组拾色器与示例');failed++;}
if(m2.derivedChecked!==4){console.error('❌ 派生后跟随开关应全勾');failed++;}
if(!m2.cssVars){console.error('❌ 导出 CSS 未携带语义变量');failed++;}
if(new Set(m2.hexes).size!==4){console.error(`❌ 四组基色应互不相同，实为 ${m2.hexes.join(',')}`);failed++;}
await shot('02-derived.png');

// 3) 覆盖拾色器：改 danger 色值 → 停随主色 + CSS 更新。
// <lang en>Override: change danger's colour → stops following and CSS updates.</lang>
await page.evaluate(()=>{
  const input=document.querySelector('#semanticBody [data-semantic-pick="danger"]');
  input.value='#7C2D12';
  input.dispatchEvent(new Event('input',{bubbles:true}));
});
await new Promise(r=>setTimeout(r,400));
const m3=await page.evaluate(()=>({
  value:document.querySelector('[data-semantic-pick="danger"]')?.value,
  unchecked:!document.querySelector('[data-semantic-derived="danger"]')?.checked,
  inCss:(document.getElementById('cssTokenOutput')?.value??'').includes('--hia-danger: #7C2D12'),
  statusText:document.getElementById('semanticStatus')?.textContent??''
}));
console.log('[override]',JSON.stringify(m3));
if(m3.value!=='#7c2d12'){console.error(`❌ 覆盖值未生效（${m3.value}）`);failed++;}
if(!m3.unchecked){console.error('❌ 覆盖后应停随主色');failed++;}
if(!m3.inCss){console.error('❌ 覆盖未传导到导出 CSS');failed++;}
// 状态行语义：派生态计数 3/4 + 覆盖提示（实现的语义比断言初稿更准确——覆盖组不算派生）。
// <lang en>Status-line semantics: 3/4 derived plus the override hint — the implementation's wording is the
//   more accurate one, so the assertion matches it.</lang>
if(!/3\/4|3 of 4/.test(m3.statusText)||!/停随|stop/.test(m3.statusText)){console.error(`❌ 状态行应显示 3/4 派生+覆盖提示，实为 "${m3.statusText}"`);failed++;}

// 4) 跟随开关：勾回 danger → 立即按主色重算（不再是 #7C2D12）。
// <lang en>Follow toggle: re-checking danger recomputes from the primary immediately.</lang>
await page.evaluate(()=>{
  const cb=document.querySelector('[data-semantic-derived="danger"]');
  cb.checked=true;
  cb.dispatchEvent(new Event('input',{bubbles:true}));
});
await new Promise(r=>setTimeout(r,400));
const m4=await page.evaluate(()=>({
  checked:document.querySelector('[data-semantic-derived="danger"]')?.checked,
  changed:document.querySelector('[data-semantic-pick="danger"]')?.value!=='#7c2d12'
}));
console.log('[follow]',JSON.stringify(m4));
if(!m4.changed){console.error('❌ 勾回派生未按主色重算');failed++;}

// 5) 写入辅助槽位：4 组进入辅助槽（操作台可见 / aux 变量生成）。
// <lang en>Copy to slots: the four groups enter auxiliary slots (vars emitted).</lang>
await page.evaluate(()=>document.getElementById('semanticToAuxBtn')?.click());
await new Promise(r=>setTimeout(r,400));
const m5=await page.evaluate(()=>({
  status:document.getElementById('semanticStatus')?.textContent??'',
  auxVar:(document.getElementById('cssTokenOutput')?.value??'').includes('--hia-aux0:'),
  statusText:document.getElementById('semanticStatus')?.textContent?.match(/\d/)?.[0]
}));
console.log('[toaux]',JSON.stringify(m5));
if(!/4/.test(m5.status)){console.error(`❌ 状态行应显示写入 4 组，实为 "${m5.status}"`);failed++;}
if(!m5.auxVar){console.error('❌ 辅助槽未出现在导出 CSS');failed++;}
await shot('05-toaux.png');

// 6) 圆角滑杆 + 阴影控件：实时作用于预览 chips（所见即导出）。
// <lang en>Radius/shadow controls act on preview chips live.</lang>
const r0=await page.evaluate(()=>document.querySelector('.rs-chip[data-rs="md"]')?.style.borderRadius);
await page.evaluate(()=>{
  const input=document.getElementById('radiusBaseInput');
  input.value='20';
  input.dispatchEvent(new Event('input',{bubbles:true}));
});
await new Promise(r=>setTimeout(r,300));
const m6=await page.evaluate(()=>({
  radius:document.querySelector('.rs-chip[data-rs="md"]')?.style.borderRadius,
  label:document.getElementById('radiusValue')?.textContent,
  exported:(document.getElementById('cssTokenOutput')?.value??'').includes('--hia-radius-md: 20px')
}));
console.log('[radius]',JSON.stringify(m6),`(was ${r0})`);
if(m6.radius!=='20px'||m6.label!=='20'){console.error(`❌ 圆角滑杆未生效（${m6.radius}/${m6.label}）`);failed++;}
if(!m6.exported){console.error('❌ 圆角未传导到导出 CSS');failed++;}
await page.evaluate(()=>{
  const sel=document.getElementById('shadowStrengthSelect');
  sel.value='strong';
  sel.dispatchEvent(new Event('change',{bubbles:true}));
  const tint=document.getElementById('shadowTintToggle');
  tint.checked=true;
  tint.dispatchEvent(new Event('change',{bubbles:true}));
});
await new Promise(r=>setTimeout(r,300));
const m7=await page.evaluate(()=>({
  chipShadow:document.querySelector('.rs-chip[data-rs="md"]')?.style.boxShadow??'',
  exported:(document.getElementById('cssTokenOutput')?.value??'').includes('--hia-shadow-md:')
}));
console.log('[shadow] chip starts:',m7.chipShadow.slice(0,34),'| exported:',m7.exported);
if(!m7.chipShadow){console.error('❌ 阴影未作用到预览 chips');failed++;}
if(!m7.exported){console.error('❌ 阴影未传导到导出 CSS');failed++;}
await shot('06-radius-shadow.png');

// 7) 导出目标出现 Tailwind v4：切换后文件树显示 app.css。
// <lang en>The export target list gains Tailwind v4; the tree shows app.css.</lang>
await page.evaluate(()=>{
  const sel=document.getElementById('exportTargetSelect');
  sel.value='tailwind-v4';
  sel.dispatchEvent(new Event('change',{bubbles:true}));
});
await new Promise(r=>setTimeout(r,400));
const m8=await page.evaluate(()=>({
  tree:document.getElementById('exportFileTree')?.textContent??'',
  targetExists:[...document.querySelectorAll('#exportTargetSelect option')].some(o=>o.value==='tailwind-v4')
}));
console.log('[v4]',JSON.stringify({targetExists:m8.targetExists,hasApp:m8.tree.includes('app.css')}));
if(!m8.targetExists){console.error('❌ 导出目标缺 tailwind-v4');failed++;}
if(!m8.tree.includes('app.css')){console.error('❌ 文件树未显示 app.css');failed++;}

// 8) 语言切换：语义面板重绘为英文。
// <lang en>Locale switch: the semantic panel re-renders in English.</lang>
await page.evaluate(()=>document.getElementById('langToggleBtn')?.click());
await new Promise(r=>setTimeout(r,450));
const m9=await page.evaluate(()=>({
  en:document.getElementById('semanticPanel')?.textContent?.includes('Semantic status colours')??false,
  zh:document.getElementById('semanticPanel')?.textContent?.includes('语义状态色')??false
}));
console.log('[locale]',JSON.stringify(m9));
if(!m9.en||m9.zh){console.error('❌ 语言切换后语义面板未重绘');failed++;}
await shot('07-en.png');

await browser.close();
server.close();
console.log(failed===0?'✅ 语义状态色与圆角阴影验收通过':`❌ 失败 ${failed} 项`);
process.exit(failed===0?0:1);
