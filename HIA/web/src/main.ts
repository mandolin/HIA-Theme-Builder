/**
 * @lang zh-CN web 入口引导（`W-tb-P7` 起含 i18n）：注册双语字典，应用静态 DOM 翻译，
 *   加载样式，构建自适应平台能力，挂载主题操作台。
 *   纯浏览器场景下由本文件启动；Electron/Tauri 可改用各自引导并注入桥。
 * @lang en Web entry bootstrap (i18n since `W-tb-P7`): register bilingual dictionaries, apply static
 *   DOM translations, load styles, build adaptive platform capabilities, then mount the theme studio.
 *   In plain-browser scenarios this file starts the app; Electron/Tauri may use their own bootstrap
 *   with an injected bridge.
 */
import './style.css';
// 字典注册必须在 applyAll 与挂载之前（副作用导入）。
// <lang zh-CN>console/preview-pc/preview-wx 三组字典经 registerStrings 注入。</lang>
// <lang en>console/preview-pc/preview-wx dictionaries injected via registerStrings.</lang>
import './i18n/index.js';
import{applyAll}from'./i18n/index.js';
import{mountThemeManager}from'./app.js';
import{createAdaptivePlatform}from'./platform.js';

// 先应用静态 DOM 翻译（含 <html lang> 同步与演示内容文本节点），
// 再挂载操作台，使动态渲染直接以当前语言产出。
// <lang zh-CN>持久化语言在 i18n 模块加载时已恢复。</lang>
// <lang en>Persisted locale was restored at i18n module load.</lang>
applyAll();

// 用自适应平台能力挂载操作台，立即进入交互态。
// <lang zh-CN>createAdaptivePlatform 已按宿主回退好存储/剪贴板等能力。</lang>
// <lang en>createAdaptivePlatform has already resolved storage/clipboard per host.</lang>
mountThemeManager(createAdaptivePlatform());
