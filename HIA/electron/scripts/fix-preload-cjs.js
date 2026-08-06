// 将 dist/preload.js 从 ESM 转为 CJS（Electron preload 沙箱上下文不支持 ESM import）。
// <lang zh-CN>tsc 输出 ESM（因 package.json "type":"module"），preload 需 require 格式。</lang>
// <lang en>tsc outputs ESM (package.json "type":"module"); preload requires CommonJS.</lang>
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const src = join(__dirname, '..', 'dist', 'preload.js');
let code = readFileSync(src, 'utf8');
// 替换 ESM import 为 CJS require。
// <lang zh-CN>仅处理 preload 特有的两行 import，不影响其他文件。</lang>
// <lang en>Only transform the two preload-specific imports; other files untouched.</lang>
code = code.replace(
  /import\s*\{\s*contextBridge,\s*ipcRenderer\s*\}\s*from\s*['"]electron['"];?/,
  "const { contextBridge, ipcRenderer } = require('electron');"
);
code = code.replace(
  /import\s*\{\s*CHANNEL\s*\}\s*from\s*['"].\/main\.js['"];?/,
  "const CHANNEL = 'extract-from-url';"
);
writeFileSync(src, code, 'utf8');
console.log('preload converted to CJS');
