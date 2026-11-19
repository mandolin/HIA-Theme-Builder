/**
 * @lang zh-CN 更新通道本地模拟 E2E（`W-tb-P48`）：起本地 HTTP feed（假 1.0.1 latest.yml + 小体积假
 *   安装包，sha512 真实匹配），以 `HIA_UPDATE_FEED` 逃生口启动未打包 Electron 应用，断言
 *   check→available→downloading→downloaded 全链路标记出现（**不执行 quitAndInstall**，无真机副作用；
 *   真实安装路径由维护者在正式新版发布时人工验证）。退出码非 0 = 失败。
 * @lang en Local simulated update-feed E2E (`W-tb-P48`): serves a fake 1.0.1 latest.yml plus a tiny dummy
 *   "installer" (real sha512) and launches the unpackaged Electron app with the `HIA_UPDATE_FEED` escape
 *   hatch, asserting the full check→available→downloading→downloaded marker chain (**no quitAndInstall** —
 *   no side effects; the real install path is verified manually by the maintainer on a real release).
 *   Non-zero exit = failure.
 *
 * 用法 / <lang en>Usage:</lang> `node scripts/update-feed-e2e.mjs`（先 `npm run build`）
 */
import{spawn}from'node:child_process';
import{createServer}from'node:http';
import{createHash}from'node:crypto';
import{readFileSync,writeFileSync,unlinkSync,existsSync}from'node:fs';
import{join,dirname,resolve}from'node:path';
import{fileURLToPath}from'node:url';

const __dirname=dirname(fileURLToPath(import.meta.url));
const electronPkgRoot=resolve(__dirname,'..');
const pkgVersion=JSON.parse(readFileSync(join(electronPkgRoot,'package.json'),'utf8')).version;

// 假"安装包"：小体积内容，sha512 计算后写入 latest.yml（electron-updater 下载后校验）。
// <lang en>Fake "installer": tiny payload whose real sha512 goes into latest.yml (verified after download).</lang>
const dummy=Buffer.from('HIA dummy update payload for local-feed E2E\n'.repeat(64));
const sha512=createHash('sha512').update(dummy).digest('base64');
// 开发态 app.getVersion() 返回 Electron 自身版本（45.x），故假版本须远大于之。
// <lang en>In dev, app.getVersion() returns Electron's own version (45.x) — the fake version must far exceed it.</lang>
const newVersion='99.99.9';
const fileName=`HIA-Theme-Builder-Electron-${newVersion}-setup.exe`;

// 假 latest.yml（generic provider 读取的形态，字段与 electron-builder 产出一致）。
// <lang en>Fake latest.yml in the exact shape electron-builder emits for the generic provider.</lang>
const latestYml=`version: ${newVersion}\npath: ${fileName}\nsha512: ${sha512}\nreleaseDate: '${new Date().toISOString()}'\n`;

let hits=0;
const server=createServer((req,resp)=>{
  hits++;
  const url=(req.url??'').split('?')[0];
  if(url==='/latest.yml'){resp.writeHead(200,{'content-type':'text/yaml'});resp.end(latestYml);return;}
  if(url===`/${fileName}`){resp.writeHead(200,{'content-type':'application/octet-stream','content-length':String(dummy.length)});resp.end(dummy);return;}
  resp.writeHead(404);resp.end();
});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const port=(server.address()||{}).port;
const feed=`http://127.0.0.1:${port}/`;
console.log(`[e2e] feed=${feed} current=${pkgVersion} offered=${newVersion}`);

// 启动未打包 Electron（HIA_UPDATE_FEED 逃生口 + HIA_UPDATE_SILENT 跳过确认框）。
// <lang en>Launch unpackaged Electron with the feed escape hatch and silent dialog skip.</lang>
// Windows 上 .cmd spawn 被 Node EINVAL 拒绝——直接用 electron 二进制。
// <lang en>Node rejects .cmd spawns (EINVAL) on Windows — use the electron binary directly.</lang>
const electronExe=process.platform==='win32'
  ?join(electronPkgRoot,'node_modules','electron','dist','electron.exe')
  :join(electronPkgRoot,'node_modules','.bin','electron');
// 开发态 electron-updater 从 app 路径下的 dev-app-update.yml 读配置（setFeedURL 不覆盖该路径）——
//   E2E 写入指向本地 feed 的配置，退出时清理。
// <lang en>In dev, electron-updater reads dev-app-update.yml from the app path (setFeedURL does not override
//   it) — the E2E writes one pointing at the local feed and cleans up on exit.</lang>
const devYmlPath=join(electronPkgRoot,'dist','dev-app-update.yml');
writeFileSync(devYmlPath,'provider: generic\nurl: '+feed+'\nupdaterCacheDirName: hia-update-e2e-cache\n');
const child=spawn(electronExe,[join(electronPkgRoot,'dist','main.js')],{
  cwd:electronPkgRoot,
  env:{...process.env,HIA_UPDATE_FEED:feed,HIA_UPDATE_SILENT:'1',ELECTRON_ENABLE_LOGGING:'0'},
  stdio:['ignore','pipe','pipe']
});

const seen=new Set();
let done=false;
const timeout=setTimeout(()=>{console.error('[e2e] TIMEOUT — markers seen:',[...seen].join(', '));cleanup(1);},60000);
child.stdout.on('data',(chunk)=>{
  const text=String(chunk);
  for(const line of text.split('\n')){
    const m=line.match(/\[updater-state\]\s+(\w+)/);
    if(m){seen.add(m[1]);console.log('[e2e] state-line:',line.trim().slice(0,220));}
  }
  // 终态：downloaded（下载完成+校验通过）→ 成功退出（不触发 quitAndInstall）。
  // <lang en>Terminal marker: downloaded (download + integrity OK) → success (no quitAndInstall).</lang>
  if(seen.has('downloaded')&&!done){done=true;clearTimeout(timeout);console.log('[e2e] PASS: full chain', [...seen].join(' → '));cleanup(0);}
});
child.stderr.on('data',(c)=>{const t=String(c).trim();if(t)console.error('[e2e][stderr]',t.slice(0,500));});
child.on('exit',(code)=>{if(!done){console.error('[e2e] app exited early (code',code,') markers:',[...seen].join(', '));cleanup(1);}});

function cleanup(code){
  try{if(existsSync(devYmlPath))unlinkSync(devYmlPath);}catch{/* ignore */}
  try{child.kill();}catch{/* ignore */}
  server.close();
  setTimeout(()=>process.exit(code),200);
}
