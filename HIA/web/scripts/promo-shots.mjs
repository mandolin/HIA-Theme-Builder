#!/usr/bin/env node
/**
 * @lang zh-CN 发布资产生成器（`W-tb-P28`）：puppeteer 驱动生产 dist 走**确定性场景**，一次产出
 *   ①终态截图组（promo/screenshots/*.png，1440×900）②演示 GIF（promo/demo.gif，800×500、约 5fps）。
 *   全部产物可复跑（同脚本同 dist 必得同序列）；自动生成是维护者 2026-11-13 的定案（非人工录制）。
 * @lang en Promo asset generator (`W-tb-P28`): puppeteer drives the production dist through a **deterministic
 *   scenario**, producing (1) the final screenshot set (promo/screenshots/*.png, 1440×900) and (2) the demo GIF
 *   (promo/demo.gif, 800×500 at ~5fps). Fully re-runnable; auto-generation is the maintainer's decision
 *   (2026-11-13), not a manual recording.
 *
 * 用法 / Usage: node scripts/promo-shots.mjs
 */
import{createServer}from'node:http';
import{readFile}from'node:fs/promises';
import{fileURLToPath}from'node:url';
import{dirname,join,resolve,sep}from'node:path';
import puppeteer from'puppeteer-core';
import gifenc from'gifenc';
const{GIFEncoder,quantize,applyPalette}=gifenc;
import{PNG}from'pngjs';
import{writeFileSync,mkdirSync}from'node:fs';

const __dirname=dirname(fileURLToPath(import.meta.url));
const ROOT=resolve(__dirname,'..','..','..');          // 仓库根
const DIST=resolve(__dirname,'..','dist');
const OUT_SHOTS=join(ROOT,'promo','screenshots');
const OUT_GIF=join(ROOT,'promo','demo.gif');
const MIME={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json','.svg':'image/svg+xml','.png':'image/png','.ico':'image/x-icon','.map':'application/json','.woff':'font/woff','.woff2':'font/woff2'};

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

// 页内操作封装：所有交互走真实点击（与手测同一路径），失败即抛错终止。
const ui={
  click:(page,sel)=>page.evaluate(s=>{const el=document.querySelector(s);if(!el)throw new Error('缺少元素 '+s);el.click();},sel),
  setSelect:(page,sel,val)=>page.evaluate((s,v)=>{const el=document.querySelector(s);if(!el)throw new Error('缺少元素 '+s);el.value=v;el.dispatchEvent(new Event('change',{bubbles:true}));},sel,val),
};

// 场景步骤：每步 {name, run(page), hold(ms)}；hold 供 GIF 帧采样驻留。
// <lang zh-CN>顺序即 GIF 叙事：应用主色 → 生成副色 → 宝典弹层 → 六源下拉/传统色 → EN 界面 → 滤镜 → 深色 → 导出。</lang>
// <lang en>Step order is the GIF narrative: apply primary → generate secondary → baodian modal →
//   color sources → EN UI → filters → dark → export.</lang>
const STEPS=[
  {name:'boot',hold:1200,run:()=>{}},
  // 滚动定位：GIF 与终态截图都会拍到"改动所在的区域"，而不是永远拍页顶。
  // <lang en>Scroll hooks make frames and shots show the region that actually changes.</lang>
  {name:'preview-scroll',hold:400,run:()=>{},scroll:'#pcPreviewPanel'},
  {name:'apply-primary',hold:1400,run:p=>ui.click(p,'.color-card[data-primary="cobalt"] .card-apply')},
  {name:'secondary',hold:1400,run:p=>ui.click(p,'#generateSecondaryBtn')},
  {name:'baodian-open',hold:1600,run:p=>ui.click(p,'#baodianPickBtn')},
  {name:'baodian-close',hold:900,run:p=>ui.click(p,'#baodianCloseBtn')},
  {name:'source-menu',hold:1200,run:p=>ui.click(p,'#sourceDdCaret')},
  {name:'traditional-open',hold:1800,run:p=>ui.click(p,'#sourceMenu button[data-source="traditional"]')},
  {name:'source-close',hold:900,run:p=>ui.click(p,'#baodianCloseBtn')},
  {name:'lang-en',hold:1600,run:p=>ui.click(p,'#langToggleBtn')},
  {name:'lang-back',hold:900,run:p=>ui.click(p,'#langToggleBtn')},
  {name:'filter-gray',hold:1400,run:p=>ui.setSelect(p,'#previewFilterSelect','gray100'),scroll:'#pcPreviewPanel'},
  {name:'filter-reset',hold:900,run:p=>ui.setSelect(p,'#previewFilterSelect','none'),scroll:'#pcPreviewPanel'},
  {name:'dark-on',hold:1600,run:p=>ui.click(p,'#appearanceSwitch .seg[data-appearance="dark"]'),scroll:'#pcPreviewPanel'},
  {name:'dark-off',hold:900,run:p=>ui.click(p,'#appearanceSwitch .seg[data-appearance="light"]'),scroll:'#pcPreviewPanel'},
  {name:'export-classic',hold:1400,run:p=>ui.click(p,'#exportTypeTabs .tab[data-export-mode="classic"]'),scroll:'#exportTypeTabs'},
  {name:'export-tdon',hold:1800,run:p=>ui.click(p,'#exportTypeTabs .tab[data-export-mode="tdon"]'),scroll:'#exportTypeTabs'},
  {name:'back-default',hold:1000,run:p=>ui.click(p,'#exportTypeTabs .tab[data-export-mode="default"]'),scroll:'body'},
];

// 终态截图映射：步骤名 → 截图文件名（1440×900 命名集，7 类全覆盖）。
const SHOTS={
  'boot':'01-default-light.png',
  'baodian-open':'02-baodian-modal.png',
  'source-menu':'03-source-menu.png',
  'traditional-open':'04-traditional-colors.png',
  'lang-en':'05-interface-en.png',
  'filter-gray':'06-filter-gray100.png',
  'dark-on':'07-dark-mode.png',
  'export-tdon':'08-export-tdon.png',
};

async function runPass(page,viewport){
  await page.setViewport(viewport);
  await page.goto('http://127.0.0.1:18996/',{waitUntil:'networkidle2',timeout:30000});
  await page.waitForSelector('#pcPageTitle',{timeout:15000});
  const frames=[];
  for(const step of STEPS){
    // 滚动定位先行：改动区域进入视口，截图与 GIF 帧才有信息量。
    // <lang en>Scroll first so the changing region is in the viewport.</lang>
    if(step.scroll)await page.evaluate(sel=>{document.querySelector(sel)?.scrollIntoView({block:'center'});},step.scroll);
    await step.run(page);
    // 驻留采样：hold 期间按 ~5fps 取帧（GIF 用）；驻留保证过渡动画完成。
    const framesFor=Math.max(1,Math.round(step.hold/200));
    for(let i=0;i<framesFor;i++){
      await new Promise(r=>setTimeout(r,step.hold/framesFor));
      const shot=await page.screenshot({type:'png'});
      frames.push(shot);
    }
    const shotName=SHOTS[step.name];
    if(shotName&&viewport.width>1200){
      mkdirSync(OUT_SHOTS,{recursive:true});
      writeFileSync(join(OUT_SHOTS,shotName),await page.screenshot({type:'png'}));
      console.log(`[shot] ${shotName}`);
    }
  }
  return frames;
}

// PNG → 降采样 RGBA → gifenc 帧。降采样用最近邻（演示 GIF 对锯齿不敏感，换取速度与零依赖）。
function frameToGif(pngBuf,width,height){
  // puppeteer v23 的截图返回 Uint8Array；pngjs 需要 Buffer。
// <lang en>puppeteer v23 returns Uint8Array; pngjs expects a Buffer.</lang>
  const png=PNG.sync.read(Buffer.from(pngBuf));
  const rw=width,rh=height;
  const data=new Uint8Array(rw*rh*4);
  for(let y=0;y<rh;y++){
    const sy=Math.min(png.height-1,Math.round(y*png.height/rh));
    for(let x=0;x<rw;x++){
      const sx=Math.min(png.width-1,Math.round(x*png.width/rw));
      const si=(sy*png.width+sx)*4,di=(y*rw+x)*4;
      data[di]=png.data[si];data[di+1]=png.data[si+1];data[di+2]=png.data[si+2];data[di+3]=255;
    }
  }
  const palette=quantize(data,256);
  const index=applyPalette(data,palette);
  return{index,palette};
}

const server=await serveStatic(DIST,18996);
const browser=await launchBrowser();

// Pass A：终态截图（1440×900）。
const pageA=await browser.newPage();
await runPass(pageA,{width:1440,height:900,deviceScaleFactor:1});
await pageA.close();

// Pass B：GIF 帧（800×500，确定同序列）。
const pageB=await browser.newPage();
const frames=await runPass(pageB,{width:800,height:500,deviceScaleFactor:1});
await pageB.close();

await browser.close();
server?.close();

// 编码：每帧独立量化（主题色随场景变化，全局调色板会串色）；delay 200ms ≈ 5fps。
mkdirSync(join(ROOT,'promo'),{recursive:true});
const gif=GIFEncoder();
let totalBytes=0;
for(const buf of frames){
  const{index,palette}=frameToGif(buf,800,500);
  gif.writeFrame(index,800,500,{palette,delay:200});
  totalBytes+=index.length;
}
gif.finish();
const out=gif.bytes();
writeFileSync(OUT_GIF,out);
console.log(`GIF：${frames.length} 帧 / ${(frames.length*0.2).toFixed(1)}s / ${(out.length/1024/1024).toFixed(2)} MB → ${OUT_GIF}`);
if(out.length>8*1024*1024)console.error('⚠ GIF 超过 8MB 目标——考虑降帧或缩尺寸。');
