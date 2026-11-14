#!/usr/bin/env node
/**
 * @lang zh-CN 布局回归门禁（`W-tb-P37` 维护者反馈引入）：防止"已修复的布局问题随新面板加入而复发"。
 *   两栏模式（>1500px）断言：①侧栏轨宽 = 栅格定义（560px），不被内容撑破；
 *   ②主栏宽度 = 视口剩余（面板不得挤占主栏）；③侧栏无横向裁切（scrollWidth ≤ clientWidth）；
 *   ④宽表格面板（对比度矩阵）在自身容器内滚动，而非撑破容器；
 *   ⑤单栏模式（≤1500px）文档无横向溢出。任何新增面板（侧栏或主栏）都必须过此门禁。
 * @lang en Layout regression gate (introduced on the maintainer's `W-tb-P37` feedback): stops already-fixed
 *   layout breakage from recurring when new panels land. Two-column mode (>1500px) asserts: (1) the sidebar
 *   track stays at its grid definition (560px), not blown out by content; (2) the main column keeps the
 *   remaining width; (3) no horizontal clipping inside the sidebar (scrollWidth ≤ clientWidth); (4) wide-table
 *   panels (the contrast matrix) scroll inside their own wrapper instead of stretching the container;
 *   (5) single-column mode (≤1500px) has no document-level horizontal overflow. Every new panel must pass.
 *
 * 用法 / Usage: node scripts/layout-regression.mjs
 */
import{createServer}from'node:http';
import{readFile}from'node:fs/promises';
import{fileURLToPath}from'node:url';
import{dirname,join,resolve,sep}from'node:path';
import puppeteer from'puppeteer-core';

const __dirname=dirname(fileURLToPath(import.meta.url));
const DIST=resolve(__dirname,'..','dist');
const PORT=19001;
const MIME={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8'};

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
      }catch{resp.writeHead(404);resp.end();}
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
await page.goto(`http://127.0.0.1:${PORT}/`,{waitUntil:'networkidle2',timeout:30000});
await page.waitForSelector('.sidebar',{timeout:15000});
await page.waitForFunction(()=>document.getElementById('langToggleBtn')?.getAttribute('aria-label')?.includes('EN'),{timeout:10000}).catch(()=>{});

let failed=0;

// ===== 两栏模式（1920px）=====
await page.setViewport({width:1920,height:1200,deviceScaleFactor:1});
await new Promise(r=>setTimeout(r,400));
const two=await page.evaluate(()=>{
  const sidebar=document.querySelector('.sidebar');
  const main=document.querySelector('.main');
  const matrixWrap=document.getElementById('contrastMatrixWrap');
  const matrixBox=document.getElementById('contrastMatrixBox');
  const table=matrixWrap?.querySelector('table');
  return{
    sidebarW:Math.round(sidebar?.getBoundingClientRect().width??0),
    mainW:Math.round(main?.getBoundingClientRect().width??0),
    sidebarClip:(sidebar?.scrollWidth??0)-(sidebar?.clientWidth??0),
    // 矩阵表格必须在自己的滚动容器内：容器可滚动而非撑破父级。
    // <lang en>The matrix table must scroll inside its own container instead of stretching its parent.</lang>
    matrixContained:matrixBox?matrixBox.scrollWidth<=matrixBox.clientWidth+1:false,
    // 表格溢出量（有溢出必须被容器收容，见下方断言；宽屏放得下时为 0 属正常）。
    // <lang en>Table overflow amount: any overflow must be contained by the wrapper (asserted below); zero on
    //   wide viewports where everything fits is fine.</lang>
    matrixOverflow:table&&matrixWrap?table.scrollWidth-matrixWrap.clientWidth:0,
    docOverflow:(document.documentElement.scrollWidth??0)-(document.documentElement.clientWidth??0)
  };
});
console.log('[two-col]',JSON.stringify(two));
if(two.sidebarW!==560){console.error(`❌ 侧栏轨宽应为 560px，实为 ${two.sidebarW}px（内容撑破轨道）`);failed++;}
if(two.mainW<1000){console.error(`❌ 主栏过窄 ${two.mainW}px，被侧栏内容挤占`);failed++;}
if(two.sidebarClip>0){console.error(`❌ 侧栏存在横向裁切 ${two.sidebarClip}px（内容超出且被 hidden 裁掉）`);failed++;}
if(!two.matrixContained){console.error('❌ 对比度矩阵撑破了所在面板（应容器内滚动）');failed++;}
if(two.matrixOverflow>0&&!two.matrixContained){console.error('❌ 矩阵溢出未被容器收容');failed++;}

// ===== 两栏模式（1600px，接近阈值）=====
await page.setViewport({width:1600,height:1200,deviceScaleFactor:1});
await new Promise(r=>setTimeout(r,300));
const near=await page.evaluate(()=>{
  const sidebar=document.querySelector('.sidebar');
  const main=document.querySelector('.main');
  return{
    sidebarW:Math.round(sidebar?.getBoundingClientRect().width??0),
    mainW:Math.round(main?.getBoundingClientRect().width??0),
    sidebarClip:(sidebar?.scrollWidth??0)-(sidebar?.clientWidth??0)
  };
});
console.log('[two-col 1600]',JSON.stringify(near));
if(near.sidebarW!==560){console.error(`❌ 1600px 下侧栏轨宽应为 560px，实为 ${near.sidebarW}px`);failed++;}
if(near.mainW<900){console.error(`❌ 1600px 下主栏过窄 ${near.mainW}px`);failed++;}
if(near.sidebarClip>0){console.error(`❌ 1600px 下侧栏横向裁切 ${near.sidebarClip}px`);failed++;}

// ===== 单栏模式（1440px ≤1500 阈值）=====
await page.setViewport({width:1440,height:1200,deviceScaleFactor:1});
await new Promise(r=>setTimeout(r,300));
const one=await page.evaluate(()=>({
  doc:(document.documentElement.scrollWidth??0)-(document.documentElement.clientWidth??0),
  sidebarW:Math.round(document.querySelector('.sidebar')?.getBoundingClientRect().width??0)
}));
console.log('[one-col]',JSON.stringify(one));
if(one.doc>0){console.error(`❌ 单栏模式页面横向溢出 ${one.doc}px`);failed++;}

// 结构不变量（维护者 2026-11-14 定案的信息架构）：语义色=选色活动 → 侧栏；
//   Token 导出=输出 → 主栏；对比度矩阵/字体操作台=宽分析面板 → 主栏。
// <lang en>Structural invariants (maintainer's IA, 2026-11-14): semantic colours are colour-picking → sidebar;
//   token export is output → main; the contrast matrix and typography console are wide analytical panels → main.</lang>
const structural=await page.evaluate(()=>({
  semanticInSidebar:!!document.querySelector('.sidebar #semanticPanel'),
  tokenInMain:!!document.querySelector('.main section [data-i18n="token.title"]'),
  matrixInMain:!!document.querySelector('.main #contrastMatrixBox'),
  typographyInMain:!!document.querySelector('.main #typographyPanel'),
  matrixInSidebar:!!document.querySelector('.sidebar #contrastMatrixBox'),
  tokenInSidebar:!!document.querySelector('.sidebar [data-i18n="token.title"]'),
  typographyInSidebar:!!document.querySelector('.sidebar #typographyPanel')
}));
console.log('[structure]',JSON.stringify(structural));
if(!structural.semanticInSidebar){console.error('❌ 语义色面板应在侧栏（选色群组）');failed++;}
if(!structural.tokenInMain){console.error('❌ Token 导出应在主栏（输出群组）');failed++;}
if(!structural.matrixInMain||!structural.typographyInMain){console.error('❌ 宽分析面板应在主栏');failed++;}
if(structural.matrixInSidebar||structural.tokenInSidebar||structural.typographyInSidebar){console.error('❌ 宽面板混入侧栏');failed++;}
// 语义色面板进侧栏后必须无横向裁切（卡片栅格已在侧栏收缩为两列）。
// <lang en>With the semantic panel in the sidebar it must not clip horizontally (its grid collapses to two
//   columns in the narrow track).</lang>

await browser.close();
server.close();
console.log(failed===0?'✅ 布局回归门禁通过':`❌ 失败 ${failed} 项`);
process.exit(failed===0?0:1);
