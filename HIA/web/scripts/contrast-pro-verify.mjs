#!/usr/bin/env node
/**
 * @lang zh-CN 对比度矩阵与色觉模拟验收（`W-tb-P36`）：无头 Chrome 驱动生产 dist——
 *   ①矩阵渲染完整（行列数一致、无 NaN）；②WCAG/APCA 指标切换生效；
 *   ③目标切换改变达标判定（7.0 的未达标数 ≥ 4.5 的未达标数）；④反推文字色 chips 实测达标；
 *   ⑤CVD 滤镜写 filter 并持久化；⑥语言切换后矩阵重绘为英文。并输出截图供人工核对。
 * @lang en Contrast-matrix & CVD acceptance (`W-tb-P36`): headless Chrome drives the production dist —
 *   (1) matrix renders completely (square, no NaN); (2) WCAG/APCA switch works; (3) raising the target never
 *   lowers the failing-pair count; (4) synthesis chips meet the target; (5) CVD filter applies and persists;
 *   (6) locale switch re-renders in English. Screenshots emitted for human review.
 *
 * 用法 / Usage: node scripts/contrast-pro-verify.mjs
 * 产物 / Output: temp/contrast-pro/*.png
 */
import{createServer}from'node:http';
import{readFile,mkdir}from'node:fs/promises';
import{fileURLToPath}from'node:url';
import{dirname,join,resolve,sep}from'node:path';
import puppeteer from'puppeteer-core';

const __dirname=dirname(fileURLToPath(import.meta.url));
const ROOT=resolve(__dirname,'..','..','..');
const DIST=resolve(__dirname,'..','dist');
const OUT=join(ROOT,'temp','contrast-pro');
const PORT=18997;
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
await page.waitForSelector('#contrastMatrixBox',{timeout:15000});
await page.waitForFunction(()=>document.getElementById('langToggleBtn')?.getAttribute('aria-label')?.includes('EN'),{timeout:10000}).catch(()=>{});
// 等首次主题应用（applyCurrentTheme → refreshContrastPanel）产出矩阵表。
// <lang en>Wait for the first theme application (applyCurrentTheme → refreshContrastPanel) to emit the table.</lang>
await page.waitForFunction(()=>!!document.querySelector('#contrastMatrixWrap table'),{timeout:15000});

let failed=0;
const shot=async(name)=>{
  const el=await page.$('#contrastMatrixBox');
  if(el){await el.screenshot({path:join(OUT,name)});console.log('[shot]',name);}
};

// 1) 矩阵完整性：行列数一致、全部单元格有数值、无 NaN。
// <lang en>Matrix completeness: square, every cell numeric, no NaN.</lang>
const m1=await page.evaluate(()=>{
  const table=document.querySelector('#contrastMatrixWrap table');
  if(!table)return{err:'no table'};
  const headCells=[...table.querySelectorAll('thead th')];
  const rows=[...table.querySelectorAll('tbody tr')];
  const bodyHead=[...rows.map(r=>r.querySelector('th'))].filter(Boolean).length;
  const firstRowCells=rows[0]?.querySelectorAll('td').length??0;
  const text=table.textContent??'';
  return{headCount:headCells.length,rowCount:rows.length,bodyHead,firstRowCells,hasNaN:text.includes('NaN')};
});
console.log('[matrix]',JSON.stringify(m1));
if(m1.err){console.error('❌ 矩阵未渲染');failed++;}
else{
  // 表头=行数=每行单元格数（方阵）；NaN 不允许出现。
  // <lang en>Header count = row count = per-row cell count (square); NaN must never appear.</lang>
  if(m1.headCount-1!==m1.rowCount||m1.firstRowCells!==m1.rowCount){console.error(`❌ 矩阵非方阵 head=${m1.headCount} rows=${m1.rowCount} cells=${m1.firstRowCells}`);failed++;}
  if(m1.hasNaN){console.error('❌ 矩阵出现 NaN');failed++;}
  if(m1.rowCount<6){console.error(`❌ 矩阵条目过少（${m1.rowCount}），应含角色+白/墨+on 色`);failed++;}
}
await shot('01-wcag-4.5.png');

// 2) APCA 切换：出现负值（白 on 深底）且徽标换为 APCA。
// <lang en>APCA switch: negative values appear (light text on dark bg) and the badge flips to APCA.</lang>
await page.evaluate(()=>document.querySelector('#contrastMetricSwitch .seg[data-metric="apca"]')?.click());
await new Promise(r=>setTimeout(r,250));
const m2=await page.evaluate(()=>({
  badge:document.getElementById('contrastMatrixBadge')?.textContent?.trim()??'',
  hasNegative:(document.getElementById('contrastMatrixWrap')?.textContent??'').match(/-\d+/)!==null
}));
console.log('[apca]',JSON.stringify(m2));
if(m2.badge!=='APCA'){console.error('❌ APCA 徽标未切换');failed++;}
if(!m2.hasNegative){console.error('❌ APCA 模式未出现负值（极性信息缺失）');failed++;}
await shot('02-apca.png');

// 3) 目标提高 → 未达标对数不降（4.5 → 7.0）。
// <lang en>Raising the target must never lower the failing-pair count (4.5 → 7.0).</lang>
await page.evaluate(()=>document.querySelector('#contrastMetricSwitch .seg[data-metric="wcag"]')?.click());
await new Promise(r=>setTimeout(r,200));
const failText=async()=>await page.evaluate(()=>{
  const m=(document.querySelector('#contrastMatrixWrap')?.textContent??'').match(/(\d+)\s*(?:对未达标|pairs? below target)/);
  return m?Number(m[1]):-1;
});
await page.evaluate(()=>{const sel=document.getElementById('contrastTargetSelect');sel.value='4.5';sel.dispatchEvent(new Event('change',{bubbles:true}));});
await new Promise(r=>setTimeout(r,200));
const fail45=await failText();
await page.evaluate(()=>{const sel=document.getElementById('contrastTargetSelect');sel.value='7';sel.dispatchEvent(new Event('change',{bubbles:true}));});
await new Promise(r=>setTimeout(r,200));
const fail70=await failText();
console.log(`[target] fail@4.5=${fail45} fail@7.0=${fail70}`);
if(!(fail70>=fail45)){console.error('❌ 提高目标后未达标对数反而下降');failed++;}
await shot('03-wcag-7.0.png');

// 4) 反推文字色：chips 存在且"达标"（默认 4.5 下所有生成对都应可命中）。
// <lang en>Synthesis: chips exist and meet the 4.5 target for the default theme.</lang>
await page.evaluate(()=>{const sel=document.getElementById('contrastTargetSelect');sel.value='4.5';sel.dispatchEvent(new Event('change',{bubbles:true}));});
await page.evaluate(()=>document.getElementById('contrastSynthBtn')?.click());
await new Promise(r=>setTimeout(r,300));
const synth=await page.evaluate(()=>{
  const chips=[...document.querySelectorAll('#contrastSynthOut .cm-chip')];
  return{count:chips.length,okCount:chips.filter(c=>c.classList.contains('pass')).length,text:chips.slice(0,2).map(c=>c.textContent?.trim()).join(' | ')};
});
console.log('[synth]',JSON.stringify(synth));
if(synth.count===0){console.error('❌ 反推结果为空');failed++;}
if(synth.okCount!==synth.count){console.error(`❌ 默认主题 4.5 目标下存在未命中 chip（${synth.okCount}/${synth.count}）`);failed++;}
await shot('04-synth.png');

// 5) CVD 滤镜：选中后容器 filter 生效且持久化。
// <lang en>CVD filter: selecting applies the filter to preview containers and persists.</lang>
await page.evaluate(()=>{const sel=document.getElementById('previewFilterSelect');sel.value='cvdDeutan';sel.dispatchEvent(new Event('change',{bubbles:true}));});
await new Promise(r=>setTimeout(r,300));
const cvd=await page.evaluate(()=>({
  applied:document.getElementById('pcShell')?.style.filter??'',
  stored:localStorage.getItem('hia-preview-filter')??'',
  restored:(document.getElementById('previewFilterSelect')??{}).value
}));
console.log('[cvd]',JSON.stringify(cvd));
if(!/url\(['\"]#hia-cvd-deutan['\"]\)/.test(cvd.applied)){console.error(`❌ CVD 滤镜未应用（${cvd.applied}）`);failed++;}
if(cvd.stored!=='cvdDeutan'){console.error('❌ CVD 滤镜未持久化');failed++;}
// 截整页 PC 预览（滤镜作用于整壳）。
// <lang en>Screenshot the whole PC preview — the filter applies to the entire shell.</lang>
const shell=await page.$('#pcPreviewPanel');
if(shell)await shell.screenshot({path:join(OUT,'05-cvd-deutan.png')});
console.log('[shot] 05-cvd-deutan.png');
// 还原滤镜，避免影响后续截图。
// <lang en>Reset the filter so later captures are unaffected.</lang>
await page.evaluate(()=>{const sel=document.getElementById('previewFilterSelect');sel.value='none';sel.dispatchEvent(new Event('change',{bubbles:true}));});

// 6) 语言切换：矩阵键名重绘为英文。
// <lang en>Locale switch: matrix keys re-render in English.</lang>
await page.evaluate(()=>document.getElementById('langToggleBtn')?.click());
await new Promise(r=>setTimeout(r,450));
const loc=await page.evaluate(()=>({
  hasPrimary:document.querySelector('#contrastMatrixWrap')?.textContent?.includes('Primary')??false,
  hasZh:document.querySelector('#contrastMatrixWrap')?.textContent?.includes('主色')??false
}));
console.log('[locale]',JSON.stringify(loc));
if(!loc.hasPrimary||loc.hasZh){console.error('❌ 语言切换后矩阵未重绘为英文');failed++;}
await shot('06-en.png');

await browser.close();
server.close();
console.log(failed===0?'✅ 对比度矩阵与 CVD 验收通过':`❌ 失败 ${failed} 项`);
process.exit(failed===0?0:1);
