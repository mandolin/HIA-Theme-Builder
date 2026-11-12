#!/usr/bin/env node
/**
 * @lang zh-CN WordPress 真机端到端（`W-tb-P27`）：对真实 WordPress（Docker 容器，非 mock）完成
 *   安装向导 → 管理员登录 → 上传 HIA 子主题 ZIP → 激活 → 前台核对（子主题 style.css 被加载、
 *   --hia-* 令牌真实写入、前台截图）。这是"导出产物在真实目标上可用"的生产级证据。
 * @lang en WordPress real-machine e2e (`W-tb-P27`): against a real WordPress (Docker container, not a mock):
 *   install wizard → admin login → upload the HIA child-theme ZIP → activate → front-end verification
 *   (child style.css loaded, --hia-* tokens present, front-page screenshot). Production-grade evidence that
 *   exported artifacts actually work on a real target.
 *
 * 前置 / Prerequisites:
 *   1. Docker：docker network create hia-wpnet && docker run -d --name hia-wpdb --network hia-wpnet \
 *        -e MYSQL_DATABASE=wp -e MYSQL_USER=wp -e MYSQL_PASSWORD=wp -e MYSQL_ROOT_PASSWORD=root mysql:8.0
 *      docker run -d --name hia-wp --network hia-wpnet -p 18991:80 \
 *        -e WORDPRESS_DB_HOST=hia-wpdb -e WORDPRESS_DB_USER=wp -e WORDPRESS_DB_PASSWORD=wp \
 *        -e WORDPRESS_DB_NAME=wp wordpress:6.7-php8.3-apache
 *   2. 主题 ZIP：见仓库 docs（导出器产物），脚本参数传入。
 * 用法 / Usage: node scripts/wp-real-machine.mjs <child-theme.zip> [baseUrl]
 */
import{readFile}from'node:fs/promises';
import{resolve}from'node:path';
import puppeteer from'puppeteer-core';

const zipPath=resolve(process.argv[2]??'');
if(!zipPath)throw new Error('用法：node scripts/wp-real-machine.mjs <child-theme.zip> [baseUrl]');
const BASE=process.argv[3]??'http://127.0.0.1:18991';
const ADMIN_PASS='Hia#RealMachine2026';
const ADMIN_USER='admin';

async function launchBrowser(){
  for(const channel of ['chrome','chrome-beta','msedge']){
    try{return await puppeteer.launch({channel,headless:true,protocolTimeout:180000,args:['--no-sandbox','--disable-dev-shm-usage']});}
    catch{/* 下一个通道 */}
  }
  throw new Error('未找到可用的 Chrome/Edge。');
}

// 文本兜底点击：按可见文本找链接/按钮（WP 的激活链接文案随语言变化）。
async function clickByText(page,selector,text){
  const ok=await page.evaluate((sel,txt)=>{
    const el=[...document.querySelectorAll(sel)].find(e=>e.textContent.trim().includes(txt));
    if(!el)return false;
    el.click();
    return true;
  },selector,text);
  if(!ok)throw new Error(`未找到含「${text}」的 ${selector}`);
}

const browser=await launchBrowser();
const page=await browser.newPage();
await page.setViewport({width:1440,height:960,deviceScaleFactor:2});
page.setDefaultTimeout(30000);

// ---- 1. 安装向导（DB 由容器环境变量自动配置，空库触发 install.php）----
await page.goto(`${BASE}/`,{waitUntil:'networkidle2'});
console.log('初始 URL:',page.url());
// 已装过（复跑）：初始 URL 就是前台；未装：WP 会重定向到安装向导。
const installed=await page.evaluate(()=>!/install\.php|setup-config\.php/.test(location.href));
if(!installed)console.log('站点未安装，走安装向导。');
else console.log('站点已安装，跳过安装向导。');
if(!installed){
// install.php 可能先走一步语言选择（无 #setup 表单）：循环提交直至出现正式安装表单。
for(let hop=0;hop<4;hop++){
  const formInfo=await page.evaluate(()=>{
    // 判别依据：正式安装表单含 weblog_title。语言选择步的表单同样 id=setup（WP 惯例），不能只看 id。
    // <lang en>The language step's form is also id=setup; discriminate by the weblog_title field.</lang>
    const setup=document.querySelector('#setup #weblog_title')?.form;
    if(setup)return{setup:true,fields:Array.from(setup.elements).map(e=>e.name||e.id)};
    const anyForm=document.querySelector('form input[type=submit],form button[type=submit]');
    return{setup:false,hasSubmit:!!anyForm};
  });
  if(formInfo.setup){console.log('安装表单字段:',formInfo.fields.join(', '));break;}
  if(!formInfo.hasSubmit)throw new Error('install.php 无可提交表单');
  await Promise.all([
    page.waitForNavigation({waitUntil:'networkidle2'}).catch(()=>{}),
    page.evaluate(()=>document.querySelector('form input[type=submit],form button[type=submit]')?.click()),
  ]);
}
const needInstall=await page.evaluate(()=>!!document.querySelector('#setup #weblog_title'));
if(needInstall){
  // 字段名随版本略有差异：按存在性逐个填充。
  await page.evaluate((user,pass)=>{
    const set=(sel,val)=>{const el=document.querySelector(sel);if(!el){
      // 诊断：把当前表单实际字段全部列出，便于一次性对准真实 id。
      const all=[...document.querySelectorAll('#setup input,#setup select')].map(e=>`${e.tagName}#${e.id}[${e.name}]`).join(', ');
      throw new Error(`缺少字段 ${sel}；实际字段：${all}`);
    }
    el.value=val;};
    // WP 6.7 实测字段：user_name / admin_password / admin_password2 / admin_email（与旧教程的 user_login 不同）。
    set('#weblog_title','HIA 真机验证站');
    set('#user_login',user);
    set('#pass1',pass);
    set('#pass2',pass);
    set('#admin_email','admin@example.com');
    const pwds=[...document.querySelectorAll('input[type=password]')];
    pwds.forEach(p=>p.dispatchEvent(new Event('input',{bubbles:true})));
    const blogPublic=document.querySelector('#blog_public');
    if(blogPublic)blogPublic.checked=false;
  },ADMIN_USER,ADMIN_PASS);
  await Promise.all([
    page.waitForNavigation({waitUntil:'networkidle2'}).catch(()=>{}),
    page.click('#setup input[type=submit]'),
  ]);
  console.log('安装完成页:',page.url());
}
}
// ---- 2. 登录（安装成功后 WP 自动登录；此时访问 wp-login.php 会被重定向进后台）----
await page.goto(`${BASE}/wp-login.php`,{waitUntil:'networkidle2'});
const alreadyIn=await page.evaluate(()=>!!document.getElementById('wpadminbar'));
if(alreadyIn)console.log('安装后已处于登录态，跳过登录表单。');
if(!alreadyIn){
  await page.type('#user_login',ADMIN_USER);
  await page.type('#user_pass',ADMIN_PASS);
  await Promise.all([
    page.waitForNavigation({waitUntil:'networkidle2'}).catch(()=>{}),
    page.click('#wp-submit'),
  ]);
}
const inAdmin=await page.evaluate(()=>!!document.getElementById('wpadminbar'));
if(!inAdmin)throw new Error('登录失败（未见管理栏）');
console.log('已登录管理后台。');

// ---- 3. 上传并安装子主题 ----
await page.goto(`${BASE}/wp-admin/theme-install.php?upload`,{waitUntil:'networkidle2'});
const fileInput=await page.$('#themezip');
if(!fileInput)throw new Error('找不到主题上传入口（#themezip）');
await fileInput.uploadFile(zipPath);
await Promise.all([
  page.waitForNavigation({waitUntil:'networkidle2',timeout:60000}).catch(()=>{}),
  // 提交按钮实测 id=install-theme-submit（#upload-form 内 input[type=submit] 命中同一元素，
  //   但显式 id 更稳——避免未来加辅助按钮时点错）。
  page.evaluate(()=>document.querySelector('#install-theme-submit, #upload-form input[type=submit]')?.click()),
]);
console.log('安装后 URL:',page.url());
// ---- 4. 激活（当前主题即子主题时跳过）----
const isActive=await page.evaluate(()=>{
  const el=[...document.querySelectorAll('.theme-name,.theme')].find(e=>e.textContent.includes('HIA'));
  return !!el;
});
if(!isActive){
  // 安装完成页的启用链接文案随语言变化（启用/Activate）；更稳的是主题卡上的 a.activate
  //   （themes.php 的卡片 DOM 常驻，无需 hover）。
  try{
    await clickByText(page,'a','启用');
  }catch{
    try{await clickByText(page,'a','Activate');}
    catch{
      await page.goto(`${BASE}/wp-admin/themes.php`,{waitUntil:'networkidle2'});
      const clicked=await page.evaluate(()=>{
        const card=document.querySelector('.theme[data-slug="hia-child"] a.activate');
        if(!card)return false;
        card.click();
        return true;
      });
      if(!clicked)throw new Error('themes.php 中未找到 hia-child 的激活链接');
    }
  }
  await new Promise(r=>setTimeout(r,1500));
}
// 激活确认：当前主题名含 HIA。
const activeTheme=await page.evaluate(()=>{
  const cur=document.querySelector('.theme.active .theme-name');
  return cur?cur.textContent.trim():'(unknown)';
});
console.log('当前主题:',activeTheme);
if(!activeTheme.includes('HIA'))throw new Error('子主题未激活');
// ---- 5. 前台核对 ----
await page.goto(`${BASE}/`,{waitUntil:'networkidle2'});
await new Promise(r=>setTimeout(r,1000));
const front=await page.evaluate(async()=>{
  // 子主题 style.css 是否被加载：在已加载的样式表中查找 hia-child。
  const sheets=[...document.styleSheets].map(s=>s.href??'');
  const childSheet=sheets.find(h=>h&&h.includes('themes/')&&h.includes('style.css')&&/hia/i.test(h));
  let tokenOk=false;
  if(childSheet){
    const text=await fetch(childSheet).then(r=>r.text());
    tokenOk=/--hia-primary/.test(text)&&/#0047AB/i.test(text);
    window.__childCssLength=text.length;
  }
  return{childSheet,tokenOk,cssLen:window.__childCssLength??0,title:document.title};
});
console.log('前台核对:',JSON.stringify(front));
if(!front.childSheet)throw new Error('前台未加载 HIA 子主题样式表');
if(!front.tokenOk)throw new Error('子主题 CSS 未包含 --hia-primary 令牌');
await page.screenshot({path:resolve('wp-front.png')});
console.log('✅ WordPress 真机端到端通过（安装→上传→激活→前台令牌生效），前台截图：wp-front.png');
await browser.close();
