/**
 * @lang zh-CN HIA/web 的 Vite 配置：站点基路径适配 GitHub Pages（仓库名子路径）。
 * @lang en Vite config for HIA/web: base path adapted for GitHub Pages (repo sub-path).
 */

import { defineConfig } from 'vite';

// <lang zh-CN>GitHub Pages 以 /<repo>/ 为根部署，故 base 设为仓库名；本地 dev 仍可用 /。</lang>
// <lang en>GitHub Pages serves under /<repo>/, so base is the repo name; local dev still uses /.</lang>
export default defineConfig({
  base: process.env.GITHUB_PAGES ? '/HIA-Theme-Builder/' : './',
  build: {
    outDir: 'dist',
    sourcemap: true
  }
});
