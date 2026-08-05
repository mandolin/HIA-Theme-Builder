/**
 * @lang zh-CN 构建辅助：把渲染进程的静态资源（HTML/CSS）复制到 dist/renderer，供主进程 loadFile 使用。
 * @lang en Build helper: copy renderer static assets (HTML/CSS) into dist/renderer for main process loadFile.
 */

import { cpSync, mkdirSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const src = join(__dirname, '..', 'src', 'renderer');
const dst = join(__dirname, '..', 'dist', 'renderer');

if (!existsSync(src)) {
  console.warn('[copy-renderer] 源目录不存在，跳过:', src);
  process.exit(0);
}
mkdirSync(dst, { recursive: true });
cpSync(src, dst, { recursive: true });
console.log('[copy-renderer] 已复制渲染资源到', dst);
