#!/usr/bin/env node
/**
 * @lang zh-CN TDON 视觉复核截图（`W-tb-P26` 遗留项）：无头 Chrome 驱动生产 dist，走完整 TDON 链路并截图——
 *   空态 → 示例预览 → 9 类节点全覆盖 → 导出文件树 → 错误态问题清单。
 *   绕过 IAB 截图面超时（`W-tb-P26`/`W-tb-P27` 均被此阻塞）。
 * @lang en TDON visual re-verification shots (`W-tb-P26` leftover): headless Chrome drives the production dist
 *   through the full TDON path — empty state → example preview → all nine node types → export tree → error state.
 *   Bypasses the IAB screenshot-surface timeout that blocked `W-tb-P26` and `W-tb-P27`.
 *
 * 用法 / Usage: node scripts/tdon-shots.mjs
 * 产物 / Output: temp/tdon-shots/*.png
 */
import{createServer}from'node:http';
import{readFile,mkdir}from'node:fs/promises';
import{fileURLToPath}from'node:url';
import{dirname,join,resolve,sep}from'node:path';
import puppeteer from'puppeteer-core';

const __dirname=dirname(fileURLToPath(import.meta.url));
const ROOT=resolve(__dirname,'..','..','..');
const DIST=resolve(__dirname,'..','dist');
const OUT=join(ROOT,'temp','tdon-shots');
const PORT=18994;
const MIME={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json','.svg':'image/svg+xml','.png':'image/png','.ico':'image/x-icon','.map':'application/json'};

// 9 类节点全覆盖文档（作为虚拟静态端点提供，不改动 dist）。
// <lang en>A document covering all nine node types, served as a virtual endpoint without touching dist.</lang>
const ALL_NODES={
  specVersion:'tdon-0.2',
  target:{id:'all-nodes-demo',name:'九类节点全覆盖',nameEn:'All Nine Node Types'},
  preview:{
    title:'九类节点视觉复核',
    layout:'stack',
    nodes:[
      {type:'hero',title:'hero 主视觉',subtitle:'标题 + 副标题 + 渐变底 + 动作按钮',bgToken:'gradient:carousel',actions:[{label:'主操作',token:'primary.600'},{label:'次操作',token:'primary.100'}],effect:'fade'},
      {type:'nav',items:['导航一',{label:'当前项',active:true},'导航三'],bgToken:'primary.50',activeToken:'primary.700'},
      {type:'card',title:'card 内容卡',text:'第二行文本\n第三行文本',bgToken:'primary.50',titleToken:'primary.900',textToken:'primary.700'},
      {type:'stats',items:[{label:'指标甲',value:'1,284'},{label:'指标乙',value:'86.4%'},{label:'指标丙',value:'¥67.3'}],labelToken:'primary.700',valueToken:'primary.900'},
      {type:'list',items:['列表项一','列表项二','列表项三'],textToken:'primary.800',markerToken:'secondary.500'},
      {type:'table',columns:[{key:'name',label:'名称'},{key:'value',label:'数值'},{key:'state',label:'状态'}],
        rows:[{name:'甲',value:'100',state:'正常'},{name:'乙',value:'250',state:'警告'},{name:'丙',value:'380',state:'异常'}],
        headerToken:'primary.900',cellToken:'primary.700'},
      {type:'form',fields:[{label:'文本输入',type:'text'},{label:'邮箱',type:'email'},{label:'下拉',type:'select'},{label:'多行文本',type:'textarea'}],submitLabel:'提交（只读展示）',accentToken:'primary.600'},
      {type:'divider',token:'primary.300',thickness:2},
      {type:'raw-text',text:'raw-text 纯文本段：换行由 \\n 转换为 <br>。\n第二行。',textToken:'primary.800',size:'fs:body'}
    ]
  },
  exportManifest:{
    files:[
      {path:'styles/tokens.css',template:':root{--brand:{{token:primary.500}};}'},
      {path:'docs/all.css',templateRef:'builtin:hia-tokens-css'}
    ]
  },
  effects:{fade:{type:'fade-in',duration:400}}
};

// 本地静态服务 + 两个虚拟端点（9 类节点文档 / 用于触发错误态的缺失路径）。
function serve(){
  return new Promise(res=>{
    const server=createServer(async(req,resp)=>{
      const url=decodeURIComponent(req.url.split('?')[0]);
      if(url==='/__all-nodes.tdon.json'){
        resp.writeHead(200,{'content-type':'application/json; charset=utf-8','cache-control':'no-store'});
        return resp.end(JSON.stringify(ALL_NODES,null,2));
      }
      if(url==='/__missing.tdon.json'){
        resp.writeHead(404,{'content-type':'text/plain; charset=utf-8'});
        return resp.end('not found');
      }
      try{
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
await page.setViewport({width:1440,height:1100,deviceScaleFactor:2});
await mkdir(OUT,{recursive:true});

const shotEl=async(sel,name)=>{
  const el=await page.$(sel);
  if(!el){console.error('[MISS]',sel,name);return false;}
  await el.screenshot({path:join(OUT,name)});
  console.log('[shot]',name);
  return true;
};
const connectTdon=async(url)=>{
  await page.evaluate(u=>{
    const input=document.getElementById('tdonUrlInput');
    input.value=u;
    input.dispatchEvent(new Event('input',{bubbles:true}));
    document.getElementById('tdonConnectBtn').click();
  },url);
};

await page.goto(`http://127.0.0.1:${PORT}/`,{waitUntil:'networkidle2',timeout:30000});
await page.waitForSelector('#pcPageTitle',{timeout:15000});
// 等到 bind() 挂完事件（用 langToggle 的可访问名做探针，避免点击落空）。
await page.waitForFunction(()=>document.getElementById('langToggleBtn')?.getAttribute('aria-label')?.includes('EN'),{timeout:10000}).catch(()=>{});
await page.evaluate(()=>document.querySelector('#previewTypeSwitch .seg[data-preview-mode="tdon"]')?.click());
await new Promise(r=>setTimeout(r,400));

// 1. 空态
await shotEl('#tdonPreviewPanel','01-tdon-empty.png');

// 2. 示例预览（内置示例）
await page.evaluate(()=>document.getElementById('tdonLoadExampleBtn')?.click());
await page.waitForFunction(()=>document.querySelectorAll('#tdonPreviewBody .tdon-node').length>=5,{timeout:15000});
await new Promise(r=>setTimeout(r,500));
await shotEl('#tdonPreviewPanel','02-tdon-preview-example.png');

// 3. 9 类节点全覆盖
await connectTdon(`http://127.0.0.1:${PORT}/__all-nodes.tdon.json`);
await page.waitForFunction(()=>document.querySelectorAll('#tdonPreviewBody .tdon-node').length>=9,{timeout:20000});
await new Promise(r=>setTimeout(r,600));
await shotEl('#tdonPreviewPanel','03-tdon-nine-nodes.png');
const nodeKinds=await page.evaluate(()=>['hero','nav','card','stats','list','table','form','divider','raw-text']
  .map(t=>({type:t,count:document.querySelectorAll(`#tdonPreviewBody .tdon-${t}`).length})));
console.log('[nodes]',JSON.stringify(nodeKinds));
// 同时校验只读表单与非交互语义
const a11yCheck=await page.evaluate(()=>{
  const form=document.querySelector('#tdonPreviewBody .tdon-form');
  return {
    disabledControls: form?form.querySelectorAll('[disabled]').length:0,
    enabledControls: form?[...form.querySelectorAll('input,select,textarea')].filter(e=>!e.disabled).length:null,
    allButtons: document.querySelectorAll('#tdonPreviewBody button').length,
    effectClasses: [...document.querySelectorAll('#tdonPreviewBody [class*="tdon-fx-"]')].map(e=>(e.className.match(/tdon-fx-[\w-]+/)||[''])[0]),
  };
});
console.log('[a11y]',JSON.stringify(a11yCheck));

// 4. 导出文件树
await page.evaluate(()=>document.querySelector('#exportTypeTabs .tab[data-export-mode="tdon"]')?.click());
await new Promise(r=>setTimeout(r,700));
await shotEl('#exportViewTdon','04-tdon-export-tree.png');

// 5. 错误态（404 → E_JSON）
await page.evaluate(()=>document.querySelector('#previewTypeSwitch .seg[data-preview-mode="tdon"]')?.click());
await new Promise(r=>setTimeout(r,300));
await connectTdon(`http://127.0.0.1:${PORT}/__missing.tdon.json`);
await page.waitForFunction(()=>document.querySelectorAll('.tdon-issue').length>0,{timeout:15000});
await new Promise(r=>setTimeout(r,400));
await shotEl('#tdonPreviewPanel','05-tdon-error-state.png');
const issues=await page.evaluate(()=>[...document.querySelectorAll('.tdon-issue-code')].map(e=>e.textContent));
console.log('[issues]',JSON.stringify(issues));
const errState=await page.evaluate(()=>({
  exportRows: document.querySelectorAll('#exportTdonFileTree [data-tdon-file]').length,
  zipDisabled: document.getElementById('exportTdonZipBtn')?.disabled,
  emptyShown: !document.getElementById('tdonExportEmpty')?.hidden,
}));
console.log('[errorState]',JSON.stringify(errState));

await browser.close();
server.close();
console.log('完成。输出：',OUT);
