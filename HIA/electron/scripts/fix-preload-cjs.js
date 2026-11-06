// 将 dist/preload.js 从 ESM 转为 CJS（Electron preload 沙箱上下文不支持 ESM import）。
// <lang zh-CN>tsc 输出 ESM（因 package.json "type":"module"），preload 需 require 格式。</lang>
// <lang en>tsc outputs ESM (package.json "type":"module"); preload requires CommonJS.</lang>
// 遗留问题清理 C10：CHANNEL 不再在此硬编码，改为从编译产物 dist/main.js 提取，
// 源码与脚本漂移时构建直接失败，而不是静默写死旧通道名。
// <lang zh-CN>通道名单一事实来源是 src/main.ts 的 CHANNEL 常量；本脚本只做提取与替换。</lang>
// <lang en>The channel's single source of truth is the CHANNEL constant in src/main.ts; this script only extracts and substitutes.</lang>
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const distDir = join(__dirname, '..', 'dist');

// 从 dist/main.js 提取 CHANNEL 字面量（tsc 输出形如 var CHANNEL = 'extract-from-url';）。
// <lang zh-CN>取第一个赋值；找不到视为构建产物异常，直接失败。</lang>
// <lang en>Take the first assignment; missing means the build output is unexpected — fail loudly.</lang>
const mainCode = readFileSync(join(distDir, 'main.js'), 'utf8');
const m = mainCode.match(/CHANNEL\s*=\s*['"]([^'"]+)['"]/);
if (!m || !m[1]) {
  console.error('fix-preload-cjs: 无法从 dist/main.js 提取 CHANNEL（Cannot extract CHANNEL from dist/main.js）');
  process.exit(1);
}
const channel = m[1];

const src = join(distDir, 'preload.js');
let code = readFileSync(src, 'utf8');
// 替换 ESM import 为 CJS require。
// <lang zh-CN>仅处理 preload 特有的两行 import，不影响其他文件；CHANNEL 用提取值内联。</lang>
// <lang en>Only transform the two preload-specific imports; other files untouched; inline the extracted CHANNEL.</lang>
code = code.replace(
  /import\s*\{\s*contextBridge,\s*ipcRenderer\s*\}\s*from\s*['"]electron['"];?/,
  "const { contextBridge, ipcRenderer } = require('electron');"
);
code = code.replace(
  /import\s*\{\s*CHANNEL\s*\}\s*from\s*['"]\.\/main\.js['"];?/,
  `const CHANNEL = ${JSON.stringify(channel)};`
);
writeFileSync(src, code, 'utf8');
console.log(`preload converted to CJS (channel=${channel})`);
