/**
 * @lang zh-CN 构建辅助：复用 web 共享渲染器（单一 UI 事实来源，见 ADR-001）。
 *   把 web 的 Vite 构建产物（HIA/web/dist，含 index.html 与 assets）复制到 src-tauri/dist，
 *   供 Tauri `generate_context!()` 以相对路径加载，使桌面端与 web 版达到一致呈现与操作。
 * @lang en Build helper: reuse the web shared renderer (single UI source of truth, ADR-001).
 *   Copy web's Vite output (HIA/web/dist, index.html + assets) into src-tauri/dist so Tauri's
 *   generate_context!() loads it by relative path, keeping the desktop UI identical to web.
 */

import { cpSync, mkdirSync, existsSync, rmSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
// <lang zh-CN>源：web 端 Vite 构建产物（相对本脚本向上两级再进 web/dist）。</lang>
// <lang en>Source: web Vite output (two levels up, then into web/dist).</lang>
const src = join(__dirname, '..', '..', 'web', 'dist');
// <lang zh-CN>目标：Tauri 打包读取目录（generate_context! 默认读取 src-tauri/dist/index.html）。</lang>
// <lang en>Destination: Tauri bundle source dir (generate_context! reads src-tauri/dist/index.html by default).</lang>
const dst = join(__dirname, '..', 'src-tauri', 'dist');

if (!existsSync(src)) {
  // <lang zh-CN>web 未构建时提示先构建 web，避免复制空目录。</lang>
  // <lang en>Fail loudly if web wasn't built, so we never copy an empty dir.</lang>
  console.error('[copy-front] 未找到 web 构建产物，请先构建 HIA/web（npm run build）。路径:', src);
  process.exit(1);
}
// 复制前先清空目标目录，避免 web 改 hash 后旧 JS/CSS 产物残留堆积。
// <lang zh-CN>force:true 使目录不存在也不报错。</lang>
// <lang en>force:true keeps it safe when the dir is absent.</lang>
rmSync(dst, { recursive: true, force: true });
mkdirSync(dst, { recursive: true });
// <lang zh-CN>递归复制整个 dist（含 index.html 与 assets），保证相对路径资源一并到位。</lang>
// <lang en>Recursive copy of the whole dist (index.html + assets) so relative-path resources arrive together.</lang>
cpSync(src, dst, { recursive: true });
console.log('[copy-front] 已复用 web 渲染器到', dst);
