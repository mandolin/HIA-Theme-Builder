/**
 * @lang zh-CN 色阶生成模式验收（`W-tb-P47` / `ADR-018`）：黑盒驱动本地 dist——
 *   ①默认模式=设计锚点（classic）；②切"等差栅格"后运行时变量 --p100 变化；
 *   ③曲线强度 0 时与栅格一致、100 时可见偏移；④刷新后模式与强度持久化；⑤classic 切回后
 *   恢复 1.0.0 基线色值。产物：temp/scale-mode/*.png。退出码非 0 = 失败。
 * @lang en Scale-mode acceptance (`W-tb-P47` / `ADR-018`): black-box drives the local dist — (1) default
 *   is classic; (2) switching to grid changes the runtime var --p100; (3) curve at strength 0
 *   matches grid and at 100 visibly shifts; (4) mode/strength persist across reload; (5) switching back to
 *   classic restores the 1.0.0 baseline colour. Output: temp/scale-mode/*.png; non-zero exit = failure.
 */
import{mkdir}from'node:fs/promises';
import{fileURLToPath}from'node:url';
import{dirname,join,resolve}from'node:path';
import{spawn}from'node:child_process';
import puppeteer from'puppeteer-core';

const __dirname=dirname(fileURLToPath(import.meta.url));
const ROOT=resolve(__dirname,'..','..','..');
const OUT=join(ROOT,'temp','scale-mode');
const PORT=19220;

const server=spawn(process.execPath,[join(__dirname,'serve-dist.mjs'),String(PORT)],{stdio:'pipe'});
await new Promise(r=>setTimeout(r,1200));

let pass=0,fail=0;
const ok=(n,d='')=>{pass++;console.log(`✅ ${n}${d?' — '+d:''}`);};
const bad=(n,d='')=>{fail++;console.error(`❌ ${n}${d?' — '+d:''}`);};

async function launch(){
  for(const channel of ['chrome','chrome-beta','msedge']){
    try{return await puppeteer.launch({channel,headless:true,protocolTimeout:120000,args:['--no-sandbox','--disable-dev-shm-usage']});}
    catch{/* next */}
  }
  throw new Error('未找到可用的 Chrome/Edge。');
}

const browser=await launch();
const page=await browser.newPage();
await page.setViewport({width:1600,height:1100});
await mkdir(OUT,{recursive:true});
const shot=async n=>{const el=await page.$('body');if(el)await el.screenshot({path:join(OUT,n)});};
// 读运行时色阶变量（主色 100 档）。
// <lang en>Reads the runtime scale variable (primary step 100).</lang>
const readVar=()=>page.evaluate(()=>getComputedStyle(document.documentElement).getPropertyValue('--p100').trim());
const setMode=async(mode,strength)=>{
  await page.evaluate((m,s)=>{
    const sel=document.getElementById('scaleModeSelect');
    sel.value=m;
    sel.dispatchEvent(new Event('change',{bubbles:true}));
    const sl=document.getElementById('curveStrengthInput');
    sl.value=String(s);
    sl.dispatchEvent(new Event('input',{bubbles:true}));
  },mode,strength);
  await new Promise(r=>setTimeout(r,450));
};

try{
  await page.goto(`http://127.0.0.1:${PORT}/`,{waitUntil:'networkidle2',timeout:30000});
  await page.waitForFunction(()=>document.getElementById('langToggleBtn')?.getAttribute('aria-label')?.includes('EN'),{timeout:10000}).catch(()=>{});
  await new Promise(r=>setTimeout(r,600));

  // ① 默认 classic：控件态 + 变量与 1.0.0 基线一致（钴蓝主色 100 = #D6E6FF）。
  const s1=await page.evaluate(()=>({
    mode:document.getElementById('scaleModeSelect')?.value,
    v:getComputedStyle(document.documentElement).getPropertyValue('--p100').trim(),
  }));
  s1.mode==='classic'&&s1.v.toUpperCase()==='#D6E6FF'
    ?ok('默认 classic 且变量=1.0.0 基线',s1.v)
    :bad('默认态异常',JSON.stringify(s1));

  // ② 切等差栅格 → 变量变化
  const before=s1.v;
  await setMode('grid',50);
  const gridV=await readVar();
  gridV&&gridV.toUpperCase()!==before.toUpperCase()
    ?ok('栅格模式变量变化',`${before} → ${gridV}`)
    :bad('栅格模式变量未变化',`${before} → ${gridV}`);

  // ③ 曲线：强度 0 应等于栅格值；强度 100 应可见偏移
  await setMode('curve',0);
  const curve0=await readVar();
  curve0&&curve0.toUpperCase()===gridV.toUpperCase()
    ?ok('曲线强度 0 = 栅格',curve0)
    :bad('曲线强度 0 ≠ 栅格',`${gridV} vs ${curve0}`);
  await setMode('curve',100);
  const curve100=await readVar();
  curve100&&curve100.toUpperCase()!==gridV.toUpperCase()
    ?ok('曲线强度 100 可见偏移',`${gridV} → ${curve100}`)
    :bad('曲线强度 100 无偏移',`${gridV} vs ${curve100}`);
  await shot('01-curve-100.png');

  // ④ 刷新持久化：模式=curve、强度=100
  await page.reload({waitUntil:'networkidle2'});
  await page.waitForFunction(()=>document.getElementById('langToggleBtn')?.getAttribute('aria-label')?.includes('EN'),{timeout:10000}).catch(()=>{});
  await new Promise(r=>setTimeout(r,700));
  const s4=await page.evaluate(()=>({
    mode:document.getElementById('scaleModeSelect')?.value,
    strength:document.getElementById('curveStrengthInput')?.value,
    v:getComputedStyle(document.documentElement).getPropertyValue('--p100').trim(),
  }));
  s4.mode==='curve'&&s4.strength==='100'&&s4.v.toUpperCase()===curve100.toUpperCase()
    ?ok('刷新后模式/强度/变量持久化',`${s4.mode}@${s4.strength}`)
    :bad('刷新持久化异常',JSON.stringify(s4));

  // ⑤ 切回 classic：恢复基线
  await setMode('classic',50);
  const back=await readVar();
  back&&back.toUpperCase()==='#D6E6FF'
    ?ok('切回 classic 恢复 1.0.0 基线',back)
    :bad('classic 恢复异常',`${back}`);
  await shot('02-back-to-classic.png');

  console.log(`\n=== 色阶生成模式验收：✅ 通过 ${pass}  ❌ 失败 ${fail} ===`);
  process.exitCode=fail>0?1:0;
}catch(e){
  console.error('脚本异常:',e.message);
  process.exitCode=1;
}finally{
  await browser.close();
  server.kill();
}
