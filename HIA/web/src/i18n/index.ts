/**
 * @lang zh-CN i18n 入口（`W-tb-P7`）：注册全部分组字典并导出核心 API。
 *   分组：console（控制台语义键）、preview-pc/preview-wx（演示内容，中文原文键）。
 *   main.ts / app.ts 只需 `import { t, applyAll, setLocale, getLocale } from './i18n/index.js'`。
 * @lang en i18n entry (`W-tb-P7`): registers all dictionary groups and exports the core API.
 *   Groups: console (semantic keys), preview-pc/preview-wx (demo content, Chinese-source keys).
 *   main.ts / app.ts only need `import { t, applyAll, setLocale, getLocale } from './i18n/index.js'`.
 */

// 副作用导入：注册字典（顺序无关，重复键后者覆盖）。
// <lang zh-CN>分组文件仅调用 registerStrings，无其他副作用。</lang>
// <lang en>Group files only call registerStrings; no other side effects.</lang>
import './console.js';
import './preview-pc.js';
import './preview-wx.js';
import './app-dynamic.js';
import './presets.js';
import './p9.js';
import './p10.js';
import './p11.js';
import './candidates.js';
import './tone.js';

export { t, applyAll, applyDomTranslations, translateTextNodes, setLocale, getLocale } from './i18n.js';
export type { Locale, StringEntry } from './i18n.js';
