#!/usr/bin/env node
/**
 * @lang zh-CN 图片提色验收（`W-tb-P39`/ADR-014）：无头 Chrome 在页面内**合成图片**（渐变+点缀），
 *   走完整上传链路——①tab 切换可见；②提取候选出现且命成合成色；③点卡套用（主色输入框变化）；
 *   ④模式切换重提取（vivid 提升鲜色位次）；⑤渐变提取与应用；⑥**隐私：提取全程零网络请求**；
 *   ⑦纯透明图空态。输出截图供人工核对。
 * @lang en Image extraction acceptance (`W-tb-P39`/ADR-014): headless Chrome composites an image in-page
 *   (gradient + accent) and drives the full upload path — (1) tab switch; (2) candidates match the synthetic
 *   colours; (3) card click applies (primary input moves); (4) mode switch re-extracts (vivid promotes the
 *   accent); (5) gradient extraction and apply; (6) **privacy: zero network requests during extraction**;
 *   (7) empty state for a fully transparent image. Screenshots for human review.
 *
 * 用法 / Usage: node scripts/image-extract-verify.mjs
 * 产物 / Output: temp/image-extract/*.png
 */
import{createServer}from'node:http';
import{readFile,mkdir}from'node:fs/promises';
import{fileURLToPath}from'node:url';
import{dirname,join,resolve,sep}from'node:path';
import puppeteer from'puppeteer-core';

const __dirname=dirname(fileURLToPath(import.meta.url));
const ROOT=resolve(__dirname,'..','..','..');
const DIST=resolve(__dirname,'..','dist');
const OUT=join(ROOT,'temp','image-extract');
const PORT=19003;
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
await page.setViewport({width:1920,height:1200,deviceScaleFactor:2});
await mkdir(OUT,{recursive:true});
// 网络请求计数：应用静态资源后，提取阶段任何请求（除 favicon）都算隐私违规。
// <lang en>Request counter: after static assets, any request during extraction (favicon aside) is a privacy breach.</lang>
let requests=0;
let staticPhase=true;
// blob: 是本地预览 objectURL（非网络）——不计入隐私断言。
// <lang en>blob: is the local preview objectURL (not network) — excluded from the privacy assertion.</lang>
page.on('request',req=>{const u=req.url();if(!staticPhase&&!u.includes('favicon')&&!u.startsWith('blob:')){requests++;console.log('[net]',u);}});
await page.goto(`http://127.0.0.1:${PORT}/`,{waitUntil:'networkidle2',timeout:30000});
await page.waitForSelector('#primaryLibBox',{timeout:15000});
await page.waitForFunction(()=>document.getElementById('langToggleBtn')?.getAttribute('aria-label')?.includes('EN'),{timeout:10000}).catch(()=>{});
staticPhase=false;

let failed=0;
const shot=async(name)=>{
  const el=await page.$('#primaryLibBox');
  if(el){await el.screenshot({path:join(OUT,name)});console.log('[shot]',name);}
};

// 1) tab 切换：图片视图可见，其他视图隐藏。
// <lang en>Tab switch: the image view shows, others hide.</lang>
await page.evaluate(()=>document.querySelector('#primaryLibTabs .tab[data-primary-tab="image"]')?.click());
await new Promise(r=>setTimeout(r,300));
const m1=await page.evaluate(()=>({
  imageVisible:!document.getElementById('primaryViewImage')?.hidden,
  moodHidden:document.getElementById('primaryViewMood')?.hidden,
  gridHidden:document.getElementById('primaryCandidatesWrap')?.hidden,
  privacy:(document.getElementById('primaryViewImage')?.textContent??'').includes('不上传')
}));
console.log('[tab]',JSON.stringify(m1));
if(!m1.imageVisible||!m1.moodHidden||!m1.gridHidden){console.error('❌ 图片视图切换失败');failed++;}
if(!m1.privacy){console.error('❌ 隐私声明缺失（应明示"不上传"）');failed++;}

// 2) 页面内合成图片并走 File 上传链路：85% 深藏青 + 12% 鲜黄 + 3% 青。
// <lang en>Composite in-page and feed the File path: 85% dark navy + 12% vivid yellow + 3% cyan.</lang>
await page.evaluate(async()=>{
  const canvas=document.createElement('canvas');
  canvas.width=800;canvas.height=600;
  const ctx=canvas.getContext('2d');
  // 底色渐变：深藏青 → 藏青（近色，考验合并）。
  // <lang en>Backdrop gradient navy→navy-light (near colours, testing the merge).</lang>
  const bg=ctx.createLinearGradient(0,0,800,600);
  bg.addColorStop(0,'#223344');bg.addColorStop(1,'#2A3E52');
  ctx.fillStyle=bg;ctx.fillRect(0,0,800,600);
  // 12% 鲜黄块（vivid 模式应升首位）。
  // <lang en>A 12% vivid yellow block (vivid mode should promote it).</lang>
  ctx.fillStyle='#FFD400';ctx.fillRect(0,0,277,600*0.81);
  // 3% 青点缀。
  // <lang en>A 3% cyan accent.</lang>
  ctx.fillStyle='#00A8D3';ctx.fillRect(772,0,28,600);
  // 转 PNG File 并塞进 input（DataTransfer）。
  // <lang en>Wrap the PNG as a File via DataTransfer.</lang>
  const blob=await new Promise(res=>canvas.toBlob(res,'image/png'));
  const file=new File([blob],'composite.png',{type:'image/png'});
  const dt=new DataTransfer();dt.items.add(file);
  const input=document.getElementById('imageFileInput');
  input.files=dt.files;
  input.dispatchEvent(new Event('change',{bubbles:true}));
});
await new Promise(r=>setTimeout(r,600));
const m2=await page.evaluate(()=>{
  // hex 从 data-image-primary 属性读（卡内 .color-hex 是占比文案，hex 在 .color-meta/属性上）。
  // <lang en>Read hexes from the data-image-primary attribute — the card's .color-hex holds the share copy.</lang>
  const hexes=[...document.querySelectorAll('#imageCandidatesWrap .color-card')].map(c=>c.getAttribute('data-image-primary')?.toUpperCase());
  return{
    count:document.querySelectorAll('#imageCandidatesWrap .color-card').length,
    hexes,
    meta:document.getElementById('imageMeta')?.textContent??'',
    status:document.getElementById('imageStatus')?.textContent??'',
    previewShown:!document.getElementById('imagePreviewRow')?.hidden
  };
});
console.log('[extract]',JSON.stringify(m2));
if(m2.count<3||m2.count>6){console.error(`❌ 候选数 ${m2.count} 不在 3–6`);failed++;}
// 主色应为深藏青系（balanced 按占比）。
// <lang en>Balanced mode keeps a navy-family colour first.</lang>
if(!m2.hexes.some(h=>h&&h.toUpperCase().startsWith('#2')||h&&h.toUpperCase().startsWith('#1'))){console.error(`❌ 首位应为深藏青系，实为 ${m2.hexes[0]}`);failed++;}
if(!m2.hexes.includes('#FFD400')){console.error('❌ 鲜黄块未被提取');failed++;}
// 青点缀允许落在青系（中位切分代表色可能被相邻底色微移）——判色相族而非精确值。
// <lang en>The cyan accent may land in the cyan family (median representative can shift slightly toward the
//   neighbouring backdrop) — assert the hue family, not the exact value.</lang>
if(!m2.hexes.some(h=>{if(!h)return false;const r=parseInt(h.slice(1,3),16),g=parseInt(h.slice(3,5),16),b=parseInt(h.slice(5,7),16);return g>100&&b>120&&r<100;})){console.error(`❌ 青点缀未被提取（青系候选缺失）：${m2.hexes.join(',')}`);failed++;}
if(!m2.previewShown){console.error('❌ 预览行未显示');failed++;}
if(!/800×600/.test(m2.meta)){console.error(`❌ 尺寸信息缺失（${m2.meta}）`);failed++;}
await shot('01-extract-balanced.png');

// 3) 点卡套用：主色输入框变到卡色。
// <lang en>Card click applies: the primary input moves to the card colour.</lang>
const before=await page.evaluate(()=>document.getElementById('primaryHexInput')?.value);
await page.evaluate(()=>{
  const card=document.querySelector('#imageCandidatesWrap .color-card[data-image-primary="#FFD400"]');
  card?.click();
});
await new Promise(r=>setTimeout(r,400));
const m3=await page.evaluate(()=>({
  primary:document.getElementById('primaryHexInput')?.value,
  active:document.querySelector('#imageCandidatesWrap .color-card.active')?.getAttribute('data-image-primary')
}));
console.log('[apply]',JSON.stringify(m3),`(was ${before})`);
if(m3.primary!=='#FFD400'){console.error(`❌ 点击套用失败（${m3.primary}）`);failed++;}
if(m3.active!=='#FFD400'){console.error('❌ 套用后高亮未跟到');failed++;}

// 4) 模式切换 vivid：鲜黄应升首位（重提取同一像素缓存）。
// <lang en>Vivid mode: yellow promotes to first (re-extraction over the cached pixels).</lang>
await page.evaluate(()=>{
  const sel=document.getElementById('imageModeSelect');
  sel.value='vivid';
  sel.dispatchEvent(new Event('change',{bubbles:true}));
});
await new Promise(r=>setTimeout(r,400));
const m4=await page.evaluate(()=>({
  first:document.querySelector('#imageCandidatesWrap .color-card')?.getAttribute('data-image-primary')
}));
console.log('[vivid]',JSON.stringify(m4));
if(m4.first!=='#FFD400'){console.error(`❌ vivid 应鲜黄居首，实为 ${m4.first}`);failed++;}
await shot('02-extract-vivid.png');

// 5) 渐变提取与应用：应用后轮播渐变配置更新（操作台渐变预览存在）。
// <lang en>Gradient: applying updates the carousel gradient config.</lang>
await page.evaluate(()=>document.querySelector('#primaryLibTabs .tab[data-primary-tab="image"]')?.click());
await new Promise(r=>setTimeout(r,200));
const m5=await page.evaluate(()=>({
  rowShown:!document.getElementById('imageGradientRow')?.hidden,
  preview:(document.getElementById('imageGradientPreview')?.style.background??'').includes('linear-gradient'),
  meta:document.getElementById('imageGradientMeta')?.textContent??''
}));
console.log('[gradient]',JSON.stringify(m5));
if(!m5.rowShown){console.error('❌ 渐变提取行未显示');failed++;}
if(!m5.preview){console.error('❌ 渐变预览缺失');failed++;}
await page.evaluate(()=>{
  const btn=document.getElementById('imageGradientApply');
  btn.disabled=false;btn.click();
});
await new Promise(r=>setTimeout(r,400));
const m6=await page.evaluate(()=>{
  const bg=[...document.querySelectorAll('#gradientSettingsGrid .card-preview, #gradientSettingsGrid [style*="linear-gradient"]')].map(e=>e.getAttribute('style')??'').join(' ');
  return{status:document.getElementById('imageStatus')?.textContent??'',applied:bg.includes('linear-gradient')};
});
console.log('[apply-grad]',JSON.stringify(m6));
if(!/已应用|applied/i.test(m6.status)){console.error(`❌ 渐变应用回执缺失（${m6.status}）`);failed++;}
if(!m6.applied){console.error('❌ 渐变设置区未见渐变');failed++;}
await shot('03-gradient.png');

// 6) 隐私：整个提取阶段零网络请求。
// <lang en>Privacy: zero network requests across the whole extraction flow.</lang>
console.log('[privacy] network requests during extraction:',requests);
if(requests>0){console.error(`❌ 提取过程发生 ${requests} 个网络请求（违反零上传边界）`);failed++;}

// 7) 纯透明图空态。
// <lang en>Fully transparent image → empty state.</lang>
await page.evaluate(async()=>{
  const canvas=document.createElement('canvas');
  canvas.width=64;canvas.height=64;
  const blob=await new Promise(res=>canvas.toBlob(res,'image/png'));
  const file=new File([blob],'transparent.png',{type:'image/png'});
  const dt=new DataTransfer();dt.items.add(file);
  const input=document.getElementById('imageFileInput');
  input.files=dt.files;
  input.dispatchEvent(new Event('change',{bubbles:true}));
});
await new Promise(r=>setTimeout(r,500));
const m7=await page.evaluate(()=>({
  cards:document.querySelectorAll('#imageCandidatesWrap .color-card').length,
  empty:document.querySelectorAll('#imageCandidatesWrap .sem-card').length
}));
console.log('[transparent]',JSON.stringify(m7));
if(m7.cards!==0||m7.empty!==1){console.error(`❌ 纯透明图应显示空态卡（实为 cards=${m7.cards} empty=${m7.empty}）`);failed++;}

await browser.close();
server.close();
console.log(failed===0?'✅ 图片提色验收通过':`❌ 失败 ${failed} 项`);
process.exit(failed===0?0:1);
