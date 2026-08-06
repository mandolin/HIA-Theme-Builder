/**
 * @lang zh-CN @hia/theme-url-extractor 主入口（barrel）。
 *   导出跨端共享的取色原语：确定性截图量化（median-cut）与页面端聚合所需的纯逻辑类型。
 *   浏览器端 scanner 单独走子路径 `./browser`，避免 Node 侧误引入 DOM 依赖。
 * @lang en @hia/theme-url-extractor main entry (barrel).
 *   Exports cross-end extraction primitives: deterministic screenshot quantizer (median-cut) and pure-logic types
 *   for in-page aggregation. The browser scanner lives under the `./browser` subpath to keep Node side DOM-free.
 */

// 确定性截图量化：把 RGBA 像素聚为少量可复现代表色。
// <lang zh-CN>纯算法，无 DOM/Canvas/网络依赖，可在 Node 单测与 fixture 比对。</lang>
// <lang en>Pure algorithm, no DOM/Canvas/network; Node-testable and fixture-comparable.</lang>
export { quantizeMedianCut } from './quantize/median-cut.js';
export type { RgbaPixel, QuantizedColor } from './quantize/median-cut.js';

// 实验性量化基准（Celebi 思想，Lab 空间确定性 k-means）。
// <lang zh-CN>仅作与 median-cut 的对比基准，不接入主评分路径（见 celebi.ts 头部说明）。</lang>
// <lang en>Experimental baseline vs median-cut only; not on the main scoring path (see celebi.ts header).</lang>
export { quantizeCelebi, quantizerDivergence } from './quantize/celebi.js';
