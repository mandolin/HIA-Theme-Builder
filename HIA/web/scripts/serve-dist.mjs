/**
 * @lang zh-CN 本地 dist 静态服务器（开发/验收辅助，不属于发布面）：
 *   为 `user-journey.mjs` 等验收脚本提供 `JOURNEY_BASE=http://127.0.0.1:<port>/` 的本地目标，
 *   使部署前能用与线上完全相同的 38 步旅程预检 dist。仅服务 `dist/` 内静态文件，
 *   路径归一化后强制限制在 dist 根内（防目录穿越），404 原样返回。
 * @lang en Local static server for `dist/` (dev/acceptance helper, not part of the release surface):
 *   gives acceptance scripts like `user-journey.mjs` a local `JOURNEY_BASE=http://127.0.0.1:<port>/`
 *   target so the exact same 38-step journey can pre-gate the dist before deploy. Serves static files
 *   from `dist/` only; paths are normalized and clamped to the dist root (anti-traversal), 404 otherwise.
 *
 * 用法 / <lang en>Usage:</lang> `node scripts/serve-dist.mjs [port]`（默认 19100 / <lang en>default 19100</lang>）
 */
import{createServer}from'node:http';
import{readFile}from'node:fs/promises';
import{join,resolve,sep,extname}from'node:path';
import{dirname}from'node:path';
import{fileURLToPath}from'node:url';

// dist 根目录：本脚本位于 `scripts/`，上一级即 web 包根，其下 `dist/` 为构建产物。
// <lang en>Dist root: this script lives in `scripts/`, the parent is the web package root, `dist/` below it.</lang>
const DIST=resolve(dirname(fileURLToPath(import.meta.url)),'..','dist');
const port=Number(process.argv[2]??19100);

// MIME 仅覆盖本站实际产出的类型；未知扩展按字节流处理。
// <lang en>MIME covers only types this site actually emits; unknown extensions go out as bytes.</lang>
const MIME={'.html':'text/html','.css':'text/css','.js':'text/javascript','.json':'application/json','.svg':'image/svg+xml','.png':'image/png','.ico':'image/x-icon','.txt':'text/plain','.map':'application/json'};

// 请求处理：URL 解码 → 拼接 dist 路径 → 前缀校验（含分隔符边界）→ 读取返回。
// <lang en>Request handling: decode URL → join dist path → prefix check (with separator boundary) → read & return.</lang>
createServer(async(req,resp)=>{
  try{
    const rel=decodeURIComponent((req.url??'/').split('?')[0]);
    const file=join(DIST,rel==='/'?'index.html':rel);
    // 目录穿越防护：解析结果必须仍在 dist 根内（或恰为根本身）。
    // <lang en>Traversal guard: the resolved path must stay inside the dist root (or be the root itself).</lang>
    if(file!==DIST&&!file.startsWith(DIST+sep)){resp.writeHead(403);resp.end();return;}
    const body=await readFile(file);
    resp.writeHead(200,{'content-type':MIME[extname(file).toLowerCase()]??'application/octet-stream'});
    resp.end(body);
  }catch{
    resp.writeHead(404);resp.end();
  }
}).listen(port,'127.0.0.1',()=>{
  console.log(`dist served at http://127.0.0.1:${port}/  (root: ${DIST})`);
});
