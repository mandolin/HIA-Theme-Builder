/**
 * @lang zh-CN 把浏览器端 scanner 打包为单一自包含 IIFE 脚本，供 Electron/Tauri 注入页面执行。
 *   输出到 dist/browser-scanner.bundle.js，自动挂 window.__hiaScanner，无外部 import。
 *   这是指令五/十二节要求的"两端执行同一份 scanner bundle"。
 * @lang en Bundle the in-page scanner into a single self-contained IIFE for Electron/Tauri injection.
 *   Output dist/browser-scanner.bundle.js, auto-exposes window.__hiaScanner, no external imports.
 *   This is the "same scanner bundle on both ends" required by spec §5/§12.
 */
import { build } from 'esbuild';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const entry = join(__dirname, 'src', 'browser', 'scanner.ts');
const out = join(__dirname, 'dist', 'browser-scanner.bundle.js');

await build({
  entryPoints: [entry],
  bundle: true,
  format: 'iife',
  globalName: '__hiaScannerModule',
  outfile: out,
  platform: 'browser',
  target: ['chrome100'],
  // <lang zh-CN>@hia/theme-core 仅类型导入，bundle 时不应产生运行时依赖。</lang>
  // <lang en>@hia/theme-core is type-only import; bundle must have no runtime dep on it.</lang>
  external: [],
  banner: { js: '/* HIA scanner bundle (auto-generated, do not edit) */' }
});

// 末尾把模块默认导出挂到 window.__hiaScanner，供注入端调用；并以 true 收尾，
// 避免 executeJavaScript 把 scanner 对象（含函数）作为返回值尝试 IPC 克隆而失败。
// <lang zh-CN>赋值表达式的返回值即 scanner 对象，须用 true 覆盖返回值。</lang>
// <lang en>The assignment expression returns the scanner object; must end with true so executeJavaScript has a cloneable return.</lang>
const fs = await import('node:fs');
const cur = fs.readFileSync(out, 'utf8');
fs.writeFileSync(out, cur + '\n;window.__hiaScanner = __hiaScannerModule.scanner; true;\n');

console.log('scanner bundle written:', out);
