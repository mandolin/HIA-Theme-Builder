# HIA-Theme-Builder · Web

网页版应用（Vite + TypeScript，原生 DOM 组件）。基于 `@hia/theme-core` 实现在线主题构建与预览，发布到 GitHub Pages。

本目录属于公开主库，独立包管理、测试与发布边界。

## 功能（W-tb-P3.1）

- 主题操作台：主/副色选择、主色候选库（44）、主题预设库（6）、一键自动副色。
- PC 企业后台预览（侧栏 / 顶栏 / 卡片流 三模式）与小程序示例预览，主题实时同步。
- 全局渐变设置：8 个渐变角色，仅同色系（主/副）、不均分占比。
- Token 导出：CSS / JSON 复制与下载。

## 开发与发布

- `npm install` 安装（含 `file:../core` 链接）。
- `npm run dev` 本地开发；`npm run build` 产出 `dist/`（相对 base，部署到 Pages 子路径）。
- GitHub Pages 由 `.github/workflows/pages.yml` 自动构建并部署 `HIA/web/dist`。

## 注意

- 受静态托管限制，web 端不实现任意网站抓取；"探索网址"留待桌面端（electron/tauri）。
- 首份源码起已执行 ROP 中英双语文档化注释（见 `src/*.ts`，AGENTS.md）。
