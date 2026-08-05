/**
 * @lang zh-CN web 入口引导：加载样式，构建自适应平台能力，挂载主题操作台。
 *   纯浏览器场景下由本文件启动；Electron/Tauri 可改用各自引导并注入桥。
 * @lang en Web entry bootstrap: load styles, build adaptive platform capabilities, then mount the theme studio.
 *   In plain-browser scenarios this file starts the app; Electron/Tauri may use their own bootstrap with an injected bridge.
 */
import './style.css';
import{mountThemeManager}from'./app.js';
import{createAdaptivePlatform}from'./platform.js';

// 用自适应平台能力挂载操作台，立即进入交互态。
// <lang zh-CN>createAdaptivePlatform 已按宿主回退好存储/剪贴板等能力。</lang>
// <lang en>createAdaptivePlatform has already resolved storage/clipboard per host.</lang>
mountThemeManager(createAdaptivePlatform());
