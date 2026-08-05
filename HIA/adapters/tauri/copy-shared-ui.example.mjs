/** Copy the canonical web build into Tauri's configured distDir. */
import { cpSync, existsSync, mkdirSync, rmSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const source = join(here, '..', '..', 'web', 'dist');
const target = join(here, '..', 'src-tauri', 'dist');
if (!existsSync(source)) throw new Error(`请先构建 HIA/web：${source}`);
rmSync(target, { recursive: true, force: true });
mkdirSync(target, { recursive: true });
cpSync(source, target, { recursive: true });
console.log('[HIA Tauri] shared UI copied to', target);
