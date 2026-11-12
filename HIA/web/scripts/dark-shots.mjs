#!/usr/bin/env node
/**
 * @lang zh-CN dark 深色模式生产复验截图（`W-tb-P27`）：对生产 dist 分别截取 light 与 dark 的关键视图，
 *   供证据归档。截图走 puppeteer（headless），不依赖交互式桌面——此前 IAB 截图面超时即由此绕过。
 * @lang en Dark-mode production re-verification screenshots (`W-tb-P27`): captures light/dark key views of the
 *   production dist via headless puppeteer, bypassing the IAB screenshot-surface timeout.
 *
 * 用法 / Usage: node scripts/dark-shots.mjs
 * 产物 / Output: HIA/web/test/shots/{light,dark}-*.png
 */
import{createServer}from'node:http';
import{readFile,mkdir}from'node:fs/promises';
import{fileURLToPath}from'node:url';
import{dirname,join,resolve,sep}from'node:path';
import puppeteer from'puppeteer-core';

const __dirname=dirname(fileURLToPath(import.meta.url));
const DIST=resolve(__dirname,'..','dist');
const OUT=resolve(__dirname,'..','test','shots');
const MIME={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json','.svg':'image/svg+xml','.png':'image/png','.ico':'image/x-icon','.map':'application/json'};

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

async function launchBrowser(){
  for(const channel of ['chrome','chrome-beta','msedge']){
    try{return await puppeteer.launch({channel,headless:true,protocolTimeout:300000,args:['--no-sandbox','--disable-dev-shm-usage','--hide-scrollbars']});}
    catch{/* 下一个通道 */}
  }
  throw new Error('未找到可用的 Chrome/Edge。');
}

const server=await serveStatic(DIST,18998);
const target='http://127.0.0.1:18998/';
const browser=await launchBrowser();
const page=await browser.newPage();
await page.setViewport({width:1440,height:960,deviceScaleFactor:2});
await page.goto(target,{waitUntil:'networkidle2',timeout:30000});
await page.waitForSelector('#pcPageTitle',{timeout:15000});
await mkdir(OUT,{recursive:true});

// 关键视图序列：切换外观 → 各切一屏（顶部预览 + 经典支持 mock）。
// <lang zh-CN>dark 用真实点击 appearanceSwitch（应用状态而非系统偏好），与手测一致。</lang>
// <lang en>Dark is toggled via the app's own switch (app state, not OS preference), matching manual testing.</lang>
for(const mode of ['light','dark']){
  if(mode==='dark'){
    await page.evaluate(()=>{
      const btn=document.querySelector('#appearanceSwitch .seg[data-appearance="dark"]');
      if(!btn)throw new Error('找不到 dark 切换按钮');
      btn.click();
    });
    await new Promise(r=>setTimeout(r,400));
  }
  // 深浅判定：读运行时注入的预览变量（appearanceModeLabel 文案为辅证）。
  const check=await page.evaluate(()=>{
    const label=document.getElementById('appearanceModeLabel')?.textContent??'';
    return{label,shellClass:document.getElementById('pcShell')?.className??''};
  });
  await page.evaluate(()=>window.scrollTo(0,0));
  await new Promise(r=>setTimeout(r,300));
  // dark 只作用于预览壳（#pcShell 加 .dark），整页顶部两模式可能逐字节相同——
  //   故对预览壳做元素级截图作为核心证据，整页截图仅作上下文。
  // <lang en>Dark only themes the preview shell (#pcShell gains .dark); the element shot is the core evidence,
  //   the full-page shot is context only.</lang>
  const shell=await page.$('#pcShell');
  await shell.screenshot({path:join(OUT,`${mode}-pcshell.png`)});
  await page.screenshot({path:join(OUT,`${mode}-top.png`)});
  // 经典支持视图（WP mock）。
  await page.evaluate(()=>document.querySelector('#previewTypeSwitch .seg[data-preview-mode="classic"]')?.click());
  await new Promise(r=>setTimeout(r,500));
  await page.evaluate(()=>{document.getElementById('classicPreviewPanel')?.scrollIntoView();});
  await new Promise(r=>setTimeout(r,300));
  await page.screenshot({path:join(OUT,`${mode}-classic.png`)});
  // 回到默认预览，供下一模式干净重扫。
  await page.evaluate(()=>document.querySelector('#previewTypeSwitch .seg[data-preview-mode="default"]')?.click());
  console.log(`[${mode}] 已截图：${mode}-top.png / ${mode}-classic.png（appearanceModeLabel="${check.label}"）`);
}
await browser.close();
server?.close();
console.log(`完成。输出目录：${OUT}`);
