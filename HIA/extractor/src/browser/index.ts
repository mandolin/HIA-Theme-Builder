/**
 * @lang zh-CN 浏览器端子路径入口（`./browser`）：页面注入执行的 scanner 与依赖 DOM 的解析器。
 *   仅由 Electron/Tauri 适配器在页面端加载；Node 侧不应 import 本文件。
 * @lang en Browser subpath entry (`./browser`): in-page scanner and DOM-dependent parsers.
 *   Loaded only by Electron/Tauri adapters in-page; Node side must not import this file.
 */

// 页面端 scanner：遍历 DOM 采集并聚合颜色证据。
// <lang zh-CN>注入前需调用 installScanner 设置运行时解析器。</lang>
// <lang en>Call installScanner before injection to set the runtime parser.</lang>
export { scanDocument, installScanner, scanner, MAX_ELEMENTS, MAX_EVIDENCE } from './scanner.js';
export type { ScanContext } from './scanner.js';

// 浏览器端颜色归一化：CSS 颜色 → 不透明 sRGB 十六进制。
// <lang zh-CN>oklab/lch/color()/color-mix 由 injectParseColor 注入的页面端解析器处理。</lang>
// <lang en>oklab/lch/color()/color-mix are handled by the injected in-page parser.</lang>
export { normalizeBrowserColor, injectParseColor } from './color-normalize-browser.js';

// 语义角色识别：从 tag/role/class/data-* 推断颜色角色。
// <lang zh-CN>纯函数，可在 Node 单测。</lang>
// <lang en>Pure function, Node-testable.</lang>
export { resolveSemanticRole, clampExamples, roleFromTag, MAX_CONTEXTS, MAX_SELECTORS } from './semantic-context.js';

// 页面端聚合：逐元素原始记录 → V2 ColorEvidence[]。
// <lang zh-CN>按 颜色+来源+角色+帧 唯一合并，截断示例数量。</lang>
// <lang en>Merges per-element records by color+source+role+frame; caps examples.</lang>
export { aggregateEvidence } from './aggregate.js';
export type { RawEvidence } from './aggregate.js';
