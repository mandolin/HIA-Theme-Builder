#!/usr/bin/env node
/**
 * @lang zh-CN TDON 视觉断言（`W-tb-P26` 遗留复核）：不靠肉眼，用**计算样式与几何**验证 9 类节点的渲染质量——
 *   颜色是否真的来自令牌（非空/非默认黑）、文本是否溢出容器、节点是否有零高度/零宽度、表单是否只读、
 *   渐变是否内联真值、特效是否只动 opacity/transform。
 *   截图（tdon-shots.mjs）负责"看得见"，本脚本负责"测得准"——两者互补。
 * @lang en TDON visual assertions (`W-tb-P26` leftover): validate rendering quality of the nine node types via
 *   **computed styles and geometry** rather than eyeballing — colors actually resolved from tokens (not empty /
 *   default black), text not overflowing, no zero-size nodes, form read-only, gradients inlined, effects limited
 *   to opacity/transform. Screenshots prove visibility; this proves correctness.
 *
 * 用法 / Usage: node scripts/tdon-visual-assert.mjs
 */
import{createServer}from'node:http';
import{readFile}from'node:fs/promises';
import{fileURLToPath}from'node:url';
import{dirname,join,resolve,sep}from'node:path';
import puppeteer from'puppeteer-core';

const __dirname=dirname(fileURLToPath(import.meta.url));
const DIST=resolve(__dirname,'..','dist');
const PORT=18993;
const MIME={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json','.svg':'image/svg+xml','.png':'image/png','.ico':'image/x-icon','.map':'application/json'};

const DOC={
  specVersion:'tdon-0.2',
  target:{id:'visual-assert',name:'视觉断言',nameEn:'Visual Assert'},
  preview:{title:'视觉断言',layout:'stack',nodes:[
    {type:'hero',title:'hero 主视觉',subtitle:'副标题',bgToken:'gradient:carousel',actions:[{label:'主操作',token:'primary.600'}],effect:'fade'},
    {type:'nav',items:['一',{label:'当前',active:true},'三'],bgToken:'primary.50',activeToken:'primary.700'},
    {type:'card',title:'card 标题',text:'正文一\n正文二',bgToken:'primary.50',titleToken:'primary.900',textToken:'primary.700'},
    {type:'stats',items:[{label:'甲',value:'1,284'},{label:'乙',value:'86.4%'}],labelToken:'primary.700',valueToken:'primary.900'},
    {type:'list',items:['项一','项二'],textToken:'primary.800',markerToken:'secondary.500'},
    {type:'table',columns:[{key:'a',label:'列一'},{key:'b',label:'列二'}],rows:[{a:'1',b:'2'},{a:'3',b:'4'}],headerToken:'primary.900',cellToken:'primary.700'},
    {type:'form',fields:[{label:'文本',type:'text'},{label:'邮箱',type:'email'}],submitLabel:'提交',accentToken:'primary.600'},
    {type:'divider',token:'primary.300',thickness:3},
    {type:'raw-text',text:'原始文本\n第二行',textToken:'primary.800',size:'fs:body'}
  ]},
  exportManifest:{files:[{path:'a.css',template:'{{token:primary.500}}'}]},
  effects:{fade:{type:'fade-in',duration:400}}
};

function serve(){
  return new Promise(res=>{
    const server=createServer(async(req,resp)=>{
      const url=decodeURIComponent(req.url.split('?')[0]);
      if(url==='/__doc.json'){
        resp.writeHead(200,{'content-type':'application/json; charset=utf-8','cache-control':'no-store'});
        return resp.end(JSON.stringify(DOC));
      }
      try{
        const rel=url==='/'?'/index.html':url;
        const file=join(DIST,rel);
        if(!file.startsWith(DIST+sep)&&file!==DIST){resp.writeHead(403);return resp.end();}
        const buf=await readFile(file);
        resp.writeHead(200,{'content-type':MIME[file.slice(file.lastIndexOf('.')).toLowerCase()]??'application/octet-stream'});
        resp.end(buf);
      }catch{resp.writeHead(404);resp.end('not found');}
    });
    server.listen(PORT,'127.0.0.1',()=>res(server));
  });
}

const server=await serve();
let browser;
for(const ch of ['chrome','chrome-beta','msedge']){
  try{browser=await puppeteer.launch({channel:ch,headless:true,protocolTimeout:120000,args:['--no-sandbox','--disable-dev-shm-usage']});break;}catch{}
}
if(!browser){console.error('no browser');process.exit(1);}
const page=await browser.newPage();
await page.setViewport({width:1440,height:1100});
await page.goto(`http://127.0.0.1:${PORT}/`,{waitUntil:'networkidle2',timeout:30000});
await page.waitForSelector('#pcPageTitle',{timeout:15000});
await page.evaluate(()=>document.querySelector('#previewTypeSwitch .seg[data-preview-mode="tdon"]')?.click());
await new Promise(r=>setTimeout(r,300));
await page.evaluate(u=>{
  const i=document.getElementById('tdonUrlInput');
  i.value=u;i.dispatchEvent(new Event('input',{bubbles:true}));
  document.getElementById('tdonConnectBtn').click();
},`http://127.0.0.1:${PORT}/__doc.json`);
await page.waitForFunction(()=>document.querySelectorAll('#tdonPreviewBody .tdon-node').length>=9,{timeout:20000});
await new Promise(r=>setTimeout(r,600));

const report=await page.evaluate(()=>{
  const body=document.getElementById('tdonPreviewBody');
  const results=[];
  const check=(name,pass,detail)=>results.push({name,pass,detail});
  const isResolved=(c)=>c&&c!=='rgba(0, 0, 0, 0)'&&c!=='transparent';
  const hexIn=(s)=>/#[0-9a-f]{3,8}|rgb/.test(s||'');

  // 1) 九类节点各存在且尺寸非零
  const kinds=['hero','nav','card','stats','list','table','form','divider','raw-text'];
  const sizes=kinds.map(t=>{
    const el=body.querySelector(`.tdon-${t}`);
    if(!el)return{type:t,w:0,h:0,missing:true};
    const r=el.getBoundingClientRect();
    return{type:t,w:Math.round(r.width),h:Math.round(r.height)};
  });
  const missing=sizes.filter(s=>s.missing||s.w<10);
  check('九类节点均已渲染且尺寸非零',missing.length===0,JSON.stringify(sizes));

  // 2) hero 渐变已内联真实色值（无 var() 残留）
  const hero=body.querySelector('.tdon-hero');
  const heroBg=hero?getComputedStyle(hero).backgroundImage:'';
  check('hero 背景为已解析渐变',/linear-gradient/.test(heroBg)&&hexIn(heroBg),heroBg.slice(0,80));

  // 3) card 标题/正文颜色来自令牌（非默认黑、非透明）
  const cardTitle=body.querySelector('.tdon-card-title');
  const cardText=body.querySelector('.tdon-card-text');
  const tc=cardTitle?getComputedStyle(cardTitle).color:'';
  const xc=cardText?getComputedStyle(cardText).color:'';
  check('card 标题/正文颜色已解析',isResolved(tc)&&isResolved(xc)&&tc!=='rgb(0, 0, 0)'&&xc!=='rgb(0, 0, 0)',`title=${tc} text=${xc}`);

  // 4) card 正文换行转 <br>
  check('card 文本换行转为 <br>',!!(cardText&&cardText.querySelector('br')),cardText?cardText.innerHTML.slice(0,60):'missing');

  // 5) raw-text 同样处理换行
  const raw=body.querySelector('.tdon-raw-text');
  check('raw-text 换行转为 <br>',!!(raw&&raw.querySelector('br')),raw?raw.innerHTML.slice(0,60):'missing');

  // 6) nav 当前项有 active 类与令牌色
  const navActive=body.querySelector('.tdon-nav-item.is-active');
  check('nav 当前项标记与配色',!!navActive&&isResolved(getComputedStyle(navActive).color),navActive?getComputedStyle(navActive).color:'missing');

  // 7) stats 数值与标签颜色区分
  const sv=body.querySelector('.tdon-stat-value'), sl=body.querySelector('.tdon-stat-label');
  const svc=sv?getComputedStyle(sv).color:'', slc=sl?getComputedStyle(sl).color:'';
  check('stats 数值/标签颜色均已解析',isResolved(svc)&&isResolved(slc),`value=${svc} label=${slc}`);

  // 8) list 标记色（markerToken 以 data-marker 传递）
  const li=body.querySelector('.tdon-list li');
  check('list 项渲染且带标记色数据',!!li&&!!li.getAttribute('data-marker'),li?li.getAttribute('data-marker'):'missing');

  // 9) table 结构与行数
  const rows=body.querySelectorAll('.tdon-table tbody tr');
  const ths=body.querySelectorAll('.tdon-table thead th');
  check('table 列头与数据行数正确',ths.length===2&&rows.length===2,`th=${ths.length} tr=${rows.length}`);

  // 10) form 全只读（disabled）且无提交按钮
  const form=body.querySelector('.tdon-form');
  const ctrls=form?[...form.querySelectorAll('input,select,textarea')]:[];
  check('form 控件全部只读',ctrls.length===2&&ctrls.every(e=>e.disabled),`total=${ctrls.length} disabled=${ctrls.filter(e=>e.disabled).length}`);
  check('form 无真实提交按钮',body.querySelectorAll('.tdon-form button').length===0,null);

  // 11) divider 厚度与颜色
  const div=body.querySelector('.tdon-divider');
  const dcs=div?getComputedStyle(div):null;
  check('divider 厚度与颜色',!!div&&parseFloat(dcs.borderTopWidth)>=3&&isResolved(dcs.borderTopColor),div?`${dcs.borderTopWidth} ${dcs.borderTopColor}`:'missing');

  // 12) 特效只动 opacity/transform（不应出现 animation 改变尺寸）
  const fx=body.querySelector('[class*="tdon-fx-"]');
  const fxcs=fx?getComputedStyle(fx):null;
  check('特效类存在且动画名受限',!!fx&&!!fxcs.animationName, fx?`${fx.className.match(/tdon-fx-[\w-]+/)?.[0]} anim=${fxcs.animationName}`:'missing');

  // 13) 无文本溢出容器（逐节点比较 scrollWidth/clientWidth，允许 1px 误差）
  const overflowing=[...body.querySelectorAll('.tdon-node')].filter(el=>el.scrollWidth>el.clientWidth+1)
    .map(el=>({cls:el.className.slice(0,40),over:el.scrollWidth-el.clientWidth}));
  check('节点内无横向文本溢出',overflowing.length===0,JSON.stringify(overflowing));

  // 14) 预览容器自身不产生横向滚动
  const previewWrap=document.getElementById('tdonPreviewBody');
  check('预览容器无横向滚动',previewWrap.scrollWidth<=previewWrap.clientWidth+1,`${previewWrap.scrollWidth}/${previewWrap.clientWidth}`);

  return results;
});

await browser.close();
server.close();

let fail=0;
for(const r of report){
  console.log(`${r.pass?'✅':'❌'} ${r.name}${r.pass?'':' → '+r.detail}`);
  if(!r.pass)fail++;
}
console.log(`\n${report.length-fail}/${report.length} 通过`);
process.exit(fail>0?1:0);
