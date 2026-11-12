/**
 * @lang zh-CN Vite `?raw` 导入的模块声明（`W-tb-P26`）：让 TypeScript 认识"作为字符串导入的静态文件"。
 *   TDON 内置示例以 `?raw` 内联，避免运行时再发网络请求（示例随包分发，离线可用）。
 * @lang en Module declaration for Vite `?raw` imports (`W-tb-P26`): teaches TypeScript about files imported as
 *   strings. TDON's built-in example is inlined via `?raw` so no runtime network request is needed — the
 *   example ships with the bundle and works offline.
 */

// `xxx?raw` 一律解析为默认导出的字符串。
// <lang zh-CN>仅此一种形态；其他 Vite 资源类型（?url/?inline）不在本项目使用。</lang>
// <lang en>Only this form; other Vite asset suffixes (?url/?inline) are unused in this project.</lang>
declare module '*?raw'{
  const content:string;
  export default content;
}
