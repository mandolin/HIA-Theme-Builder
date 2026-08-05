/**
 * @lang zh-CN web 包公共 API（barrel）：对外暴露操作台挂载函数、句柄类型与跨运行时平台相关符号。
 *   宿主（web/electron/tauri）从本入口引入，避免直连内部 app/platform 细节。
 * @lang en Web package public API (barrel): exposes the studio mount function, handle type and runtime-platform symbols.
 *   Hosts (web/electron/tauri) import from here, avoiding internal app/platform details.
 */

// 挂载操作台并取回控制句柄（草稿/主题读写与销毁）。
// <lang zh-CN>main.ts 与 Electron/Tauri 桥均通过它启动界面。</lang>
// <lang en>main.ts and Electron/Tauri bridges both start the UI through it.</lang>
export{mountThemeManager}from'./app.js';
// 操作台句柄类型：供宿主在外部读取/应用草稿。
// <lang zh-CN>类型用 export type 保持编译期隔离。</lang>
// <lang en>Type re-exported via `export type` for compile-time isolation.</lang>
export type{ThemeManagerHandle}from'./app.js';
// 自适应平台工厂：按宿主注入回退构建运行时能力集合。
// <lang zh-CN>启动操作台前必须提供一个 ThemeManagerPlatform。</lang>
// <lang en>A ThemeManagerPlatform must be provided before mounting the studio.</lang>
export{createAdaptivePlatform}from'./platform.js';
// 平台相关类型：宿主实现自定义桥时引用。
// <lang zh-CN>类型用 export type 保持编译期隔离。</lang>
// <lang en>Type re-exports via `export type` for compile-time isolation.</lang>
export type{ClipboardPort,InjectedThemeBridge,StoragePort,ThemeExplorePort,ThemeManagerPlatform}from'./platform.js';
