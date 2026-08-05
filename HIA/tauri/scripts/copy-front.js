/**
 * @lang zh-CN 构建辅助：把前端静态资源复制到 src-tauri/dist（Tauri 打包读取目录）。
 * @lang en Build helper: copy front-end static assets into src-tauri/dist (Tauri bundle source dir).
 */

import { cpSync, mkdirSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const src = join(__dirname, '..', 'src', 'front');
const dst = join(__dirname, '..', 'src-tauri', 'dist');

mkdirSync(dst, { recursive: true });
if (existsSync(src)) {
  cpSync(src, dst, { recursive: true });
  console.log('[copy-front] 已复制前端资源到', dst);
} else {
  console.warn('[copy-front] 前端源缺失:', src);
}
