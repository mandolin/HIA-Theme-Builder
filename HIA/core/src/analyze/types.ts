// 单个 CSS 变量信号：变量名与解析出的色值。
// <lang zh-CN>来自目标站点 :root 或内联样式的自定义属性。</lang>
// <lang en>From the target site's :root or inline custom properties.</lang>
export interface CssVarSignal{name:string;hex:string;}
// 单个 DOM 颜色信号：页面中出现的色值、出现次数与所在区域。
// <lang zh-CN>region 用于加权（品牌/头部/按钮等区域颜色权重更高）。</lang>
// <lang en>region drives weighting (brand/header/button regions score higher).</lang>
export interface DomColorSignal{hex:string;count:number;region:'brand'|'header'|'nav'|'button'|'link'|'banner'|'general';}
// 截图颜色信号：从页面截图聚类出的代表色及其占比。
// <lang zh-CN>ratio 为该类颜色在截图中的覆盖比例（0..1）。</lang>
// <lang en>ratio is the covered proportion (0..1) of that color in the screenshot.</lang>
export interface ScreenshotColorSignal{hex:string;ratio:number;}
// 提取信号聚合：三类来源的合并输入。
// <lang zh-CN>各来源可选，缺失即不参与打分。</lang>
// <lang en>Each source is optional and skipped when absent.</lang>
export interface ExtractSignals{cssVars?:CssVarSignal[];domColors?:DomColorSignal[];screenshotColors?:ScreenshotColorSignal[];}
// 已打分颜色：色值与累计得分及命中来源列表。
// <lang zh-CN>sources 用于结果可解释（展示该色为何被选中）。</lang>
// <lang en>sources explainability (why a color was chosen).</lang>
export interface ScoredColor{hex:string;score:number;sources:string[];}
// 提取结果：主色、可选副色、置信度与建议动作，以及备选列表。
// <lang zh-CN>action 决定 UI 直接套用(auto)/需确认(confirm)/转人工(manual)。</lang>
// <lang en>action tells the UI to auto-apply / require confirm / fall back to manual.</lang>
export interface ExtractResult{primary:ScoredColor;secondary:ScoredColor|null;primaryConfidence:number;secondaryConfidence:number;action:'auto'|'confirm'|'manual';alternatives:ScoredColor[];}
