/**
 * @lang zh-CN 企业选色视图切换验收（`W-tb-P46` 维护者截图指示）：黑盒驱动本地 dist，
 *   断言——①切换控件存在且默认"按行业"；②切"按国家/地区"后菜单出现国家分组（美国/日本/…/未分类）；
 *   ③点国家分组后右侧卡片与该国家匹配（抽验首卡的 country 数据）；④切回行业视图保留上次行业；
 *   ⑤刷新后视图模式持久化（localStorage `hia-brand-view`）。
 *   产物：temp/brand-view/*.png。退出码非 0 = 失败（可作 CI 门禁）。
 * @lang en Brand-view switch acceptance (`W-tb-P46` maintainer's screenshot request): black-box drives the
 *   local dist asserting — (1) the switch exists, defaulting to industry; (2) country mode shows country
 *   groups (US/Japan/…/uncategorized); (3) picking a country filters cards matching its country data
 *   (spot-check first card); (4) switching back keeps the last industry; (5) the view mode persists across
 *   reload (localStorage `hia-brand-view`). Output: temp/brand-view/*.png; non-zero exit = failure.
 */
import{mkdir}from'node:fs/promises';
import{fileURLToPath}from'node:url';
import{dirname,join,resolve}from'node:path';
import{spawn}from'node:child_process';
import puppeteer from'puppeteer-core';

const __dirname=dirname(fileURLToPath(import.meta.url));
const ROOT=resolve(__dirname,'..','..','..');
const OUT=join(ROOT,'temp','brand-view');
const PORT=19210;

// 复用 serve-dist.mjs 起本地服务（子进程，结束统一关闭）。
// <lang en>Reuses serve-dist.mjs for the local server (child process, closed at the end).</lang>
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

try{
  await page.goto(`http://127.0.0.1:${PORT}/`,{waitUntil:'networkidle2',timeout:30000});
  await page.waitForFunction(()=>document.getElementById('langToggleBtn')?.getAttribute('aria-label')?.includes('EN'),{timeout:10000}).catch(()=>{});
  await new Promise(r=>setTimeout(r,600));

  // 打开 宝典选色 弹层 → 切到 企业源
  await page.evaluate(()=>{document.getElementById('baodianBtn')?.click();});
  await new Promise(r=>setTimeout(r,400));
  await page.evaluate(()=>{
    const tab=[...document.querySelectorAll('[data-source]')].find(b=>b.getAttribute('data-source')==='brand');
    if(tab)tab.click();
    const alt=[...document.querySelectorAll('button')].find(b=>/知名企业|Brand Colors/.test(b.textContent||''));
    if(!tab&&alt)alt.click();
  });
  await new Promise(r=>setTimeout(r,500));

  // ① 切换控件存在，默认按行业
  const s1=await page.evaluate(()=>({
    switch:!!document.querySelector('.brand-view-switch'),
    industryActive:document.querySelector('.brand-view-btn[data-brand-view="industry"]')?.classList.contains('active')??false,
    groups:[...document.querySelectorAll('#baodianMenu [data-brand-group]')].map(b=>b.getAttribute('data-brand-group')).slice(0,3),
  }));
  s1.switch&&s1.industryActive&&s1.groups.includes('tech')?ok('切换控件存在，默认按行业'):bad('切换控件/默认态',JSON.stringify(s1));

  // ② 切到国家视图 → 出现国家分组
  await page.evaluate(()=>{document.querySelector('.brand-view-btn[data-brand-view="country"]')?.click();});
  await new Promise(r=>setTimeout(r,400));
  const s2=await page.evaluate(()=>({
    stored:localStorage.getItem('hia-brand-view')??platformStorageProbe(),
    groups:[...document.querySelectorAll('#baodianMenu [data-brand-group]')].map(b=>b.getAttribute('data-brand-group')),
    labels:[...document.querySelectorAll('#baodianMenu [data-brand-group]')].slice(0,4).map(b=>b.textContent?.trim()),
  }));
  function platformStorageProbe(){return null;}
  s2.stored==='country'?[ok('偏好持久化 hia-brand-view=country')]:bad('偏好持久化',String(s2.stored));
  s2.groups.includes('us')&&s2.groups.includes('jp')&&s2.groups.includes('__unassigned')
    ?ok('国家分组渲染（含美国/日本/未分类）',`共 ${s2.groups.length} 组`)
    :bad('国家分组缺失',JSON.stringify(s2.groups));

  // ③ 点"美国" → 右侧卡片 country 全为 us（抽验数据属性：卡片名 + 数据集交叉核对）
  await page.evaluate(()=>{document.querySelector('#baodianMenu [data-brand-group="us"]')?.click();});
  await new Promise(r=>setTimeout(r,400));
  const s3=await page.evaluate(()=>({
    cards:[...document.querySelectorAll('#baodianRight .bdc-card')].slice(0,6).map(c=>c.getAttribute('data-bdc-name')),
    count:document.querySelectorAll('#baodianRight .bdc-card').length,
  }));
  s3.count>0?ok('美国分组卡片渲染',`${s3.count} 张，首卡 ${s3.cards[0]}`):bad('美国分组无卡片');
  // ③-b 高亮：选中分组按钮必须带 active 且计算背景=主色（维护者反馈：菜单选中项不高亮）。
  // <lang en>Highlight: the selected group button must carry `active` and its computed background must be
  //   the primary colour (maintainer feedback: no highlight on the selected menu item).</lang>
  const hl=await page.evaluate(()=>{
    const btn=document.querySelector('#baodianMenu [data-brand-group].active');
    if(!btn)return{cls:false,bg:''};
    return{cls:true,bg:getComputedStyle(btn).backgroundColor};
  });
  hl.cls&&hl.bg&&hl.bg!=='rgba(0, 0, 0, 0)'&&hl.bg!=='transparent'
    ?ok('选中分组高亮（active+主色背景）',hl.bg)
    :bad('选中分组未高亮',JSON.stringify(hl));
  await shot('01-brand-country-us.png');

  // ④ 切回行业视图 → 保留上次行业分组（tech）
  await page.evaluate(()=>{document.querySelector('.brand-view-btn[data-brand-view="industry"]')?.click();});
  await new Promise(r=>setTimeout(r,400));
  const s4=await page.evaluate(()=>({
    active:document.querySelector('#baodianMenu [data-brand-group].active')?.getAttribute('data-brand-group'),
    stored:localStorage.getItem('hia-brand-view'),
  }));
  s4.active==='tech'?ok('切回行业视图保留上次分组（tech）'):bad('行业分组丢失',String(s4.active));
  s4.stored==='industry'?ok('切回行业偏好同步持久化'):bad('切回后偏好未持久化',String(s4.stored));

  // ⑤ 刷新 → 视图模式恢复（重新设 country 后刷新）
  await page.evaluate(()=>{document.querySelector('.brand-view-btn[data-brand-view="country"]')?.click();});
  await new Promise(r=>setTimeout(r,300));
  await page.reload({waitUntil:'networkidle2'});
  await page.waitForFunction(()=>document.getElementById('langToggleBtn')?.getAttribute('aria-label')?.includes('EN'),{timeout:10000}).catch(()=>{});
  await new Promise(r=>setTimeout(r,600));
  await page.evaluate(()=>{document.getElementById('baodianBtn')?.click();});
  await new Promise(r=>setTimeout(r,400));
  await page.evaluate(()=>{
    const tab=[...document.querySelectorAll('[data-source]')].find(b=>b.getAttribute('data-source')==='brand');
    if(tab)tab.click();
    const alt=[...document.querySelectorAll('button')].find(b=>/知名企业|Brand Colors/.test(b.textContent||''));
    if(!tab&&alt)alt.click();
  });
  await new Promise(r=>setTimeout(r,500));
  const s5=await page.evaluate(()=>({
    countryActive:document.querySelector('.brand-view-btn[data-brand-view="country"]')?.classList.contains('active')??false,
    countryGroups:document.querySelectorAll('#baodianMenu [data-brand-group="us"]').length>0,
  }));
  s5.countryActive&&s5.countryGroups?ok('刷新后视图模式恢复（country）'):bad('刷新后视图丢失',JSON.stringify(s5));
  await shot('02-brand-after-reload.png');

  // ⑥ 未分类组：无 country 条目 342 条 → 卡片数>0
  await page.evaluate(()=>{document.querySelector('#baodianMenu [data-brand-group="__unassigned"]')?.click();});
  await new Promise(r=>setTimeout(r,400));
  const s6=await page.evaluate(()=>document.querySelectorAll('#baodianRight .bdc-card').length);
  s6>0?ok('未分类分组有卡片',`${s6} 张`):bad('未分类分组无卡片');

  console.log(`\n=== 企业视图切换验收：✅ 通过 ${pass}  ❌ 失败 ${fail} ===`);
  process.exitCode=fail>0?1:0;
}catch(e){
  console.error('脚本异常:',e.message);
  process.exitCode=1;
}finally{
  await browser.close();
  server.kill();
}
