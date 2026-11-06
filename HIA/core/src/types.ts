/**
 * @lang zh-CN HIA 跨端共享主题模型。core 只描述数据与纯算法，不依赖 DOM、localStorage、Electron 或 Tauri。
 *   这些类型是所有端（web / electron / tauri）共用的主题契约，是后续颜色算法、渐变渲染与令牌导出的统一输入。
 * @lang en HIA cross-platform theme models. Core is DOM/storage/runtime agnostic.
 *   These types are the shared theme contract reused by every runtime (web / electron / tauri) and the
 *   uniform input for color algorithms, gradient rendering and token export.
 */

// 色阶键顺序：从最浅(50)到最深的(900)，与 Material 风格 tonal scale 对应。
// <lang zh-CN>调色板阶键固定为 10 级，不可运行时变更；作为 ColorScale 的键集合约束。</lang>
// <lang en>Tonal scale keys are fixed at 10 levels and must not change at runtime; they constrain ColorScale keys.</lang>
export const SHADE_KEYS=['50','100','200','300','400','500','600','700','800','900'] as const;
// 单个色阶键类型，取值来自 SHADE_KEYS 的字面量联合。
// <lang zh-CN>由 SHADE_KEYS 推导出的联合类型，保证色阶访问的类型安全。</lang>
// <lang en>Union type derived from SHADE_KEYS, guaranteeing type-safe shade access.</lang>
export type ShadeKey=typeof SHADE_KEYS[number];
// 角色色族：主色或副色，用于区分主题中两套生成色系。
// <lang zh-CN>主题的双色族标记，决定渐变与色阶取自哪一套颜色。</lang>
// <lang en>Theme dual color families, deciding which palette gradients and scales are drawn from.</lang>
export type ColorFamily='primary'|'secondary';
// 渐变占比策略：前色/后色主导的四种常用分段。
// <lang zh-CN>控制渐变起止色在视觉上的占比，影响卡片氛围是偏主色还是偏副色。</lang>
// <lang en>Controls the visual weight of gradient start/end colors, biasing cards toward primary or secondary.</lang>
// 渐变占比：front/end 前缀 + 0-100 整数百分比（ADR-004 数值化）。
// <lang zh-CN>front N 表示前色（start）占 N%；end N 表示后色（end）占 N%；旧 4 枚举值为数值形式的实例。</lang>
// <lang en>'front N' means the start color holds N%; 'end N' the end color; legacy 4 enums are numeric instances.</lang>
export type GradientBias=`front${number}`|`end${number}`;
// 色阶引用：标准 10 档键（ShadeKey）或任意数值位置（ADR-004 任意色阶，整数 0-1000，端点截断）。
// <lang zh-CN>自定义值（如 '650'）经 tonalScaleAt 插值解析，CSS 变量按引用生成。</lang>
// <lang en>Custom values (e.g. '650') resolve via tonalScaleAt interpolation; CSS vars are generated per reference.</lang>
export type ShadeValue=ShadeKey|`${number}`;
// 色阶映射：每个色阶键对应一个已校正的 HEX 色值。
// <lang zh-CN>由主色或副色基色生成的同色系 10 级亮度梯度，键为 ShadeKey。</lang>
// <lang en>Monochrome 10-step lightness ramp generated from a base color, keyed by ShadeKey.</lang>
export type ColorScale=Record<ShadeKey,string>;

// 角色色：一套完整色族（命名、基色、色阶、最佳前景色）。
// <lang zh-CN>主色或副色在主题中的完整表达，on 为自动选取的可读前景色（白/深）。</lang>
// <lang en>Full representation of primary/secondary color; `on` is the auto-picked readable foreground (white/dark).</lang>
export interface RoleColor{name:string;value:string;scale:ColorScale;on:string;}
// 单条渐变配置：是否启用、色族、起止色阶、方向与占比。
// <lang zh-CN>描述一个具名渐变角色（如轮播/Banner）的渲染参数。</lang>
// <lang en>Describes render parameters of one named gradient role (e.g. carousel / banner).</lang>
export interface GradientConfig{enabled:boolean;family:ColorFamily;start:ShadeValue;end:ShadeValue;direction:string;bias:GradientBias;}
// 渐变配置集合：以渐变角色键索引。
// <lang zh-CN>所有渐变角色的聚合配置，键为 GRADIENT_DEFS 中定义的固定角色。</lang>
// <lang en>Aggregated gradient configs keyed by the fixed roles defined in GRADIENT_DEFS.</lang>
export type GradientSettings=Record<string,GradientConfig>;
// 已构建主题：包含两套角色色与渐变配置，可直接用于渲染与导出。
// <lang zh-CN>由 ThemeInput 构建出的完整主题对象，色阶与前景色均已计算。</lang>
// <lang en>Complete theme built from ThemeInput with scales and foregrounds already computed.</lang>
export interface Theme{name:string;category:string;industry:string;primary:RoleColor;secondary:RoleColor;gradients:GradientSettings;note?:string;}
// 主题输入：原始用户/程序提供的基色与可选元信息。
// <lang zh-CN>构建主题的轻量入参，基色未校验、色阶未生成，便于序列化传输。</lang>
// <lang en>Lightweight input to build a theme; base colors unvalidated and scales not yet generated, easy to serialize.</lang>
export interface ThemeInput{name?:string;category?:string;industry?:string;primary:string;secondary:string;primaryName?:string;secondaryName?:string;gradients?:GradientSettings;note?:string;}
// 主色候选：候选库中的一条主色及其推荐副色配对。
// <lang zh-CN>用于主色选择面板的单条目，附带推荐副色与来源标签。</lang>
// <lang en>Single entry for the primary picker, carrying a recommended secondary pairing and provenance tags.</lang>
export interface PrimaryCandidate{id:string;name:string;en:string;hex:string;tag:string;group:string;desc:string;secondaryName:string;secondaryHex:string;secondaryScheme:string;category:string;}
// 预设主题：可应用/保存的具名主题方案。
// <lang zh-CN>已定稿的主题方案，可序列化进库或直接应用。</lang>
// <lang en>A finalized theme scheme, serializable into the library or applied directly.</lang>
export interface Preset{id:string;name:string;category:string;industry:string;primary:string;secondary:string;primaryName:string;secondaryName:string;note:string;gradients?:GradientSettings;}
// 和谐配色定义：副色生成的色彩理论依据。
// <lang zh-CN>描述由主色推导副色的配色方案（类比/互补/三角等）与目标 L/C。</lang>
// <lang en>Describes the color-harmony scheme (analogous/complementary/triadic) and target L/C for deriving a secondary.</lang>
export interface HarmonyDef{id:string;name:string;en:string;scheme:string;offset:number;L?:number;C?:number;note:string;}
// 主题草稿：操作台中持续编辑的工作态（基色为 HEX 字符串，未生成色阶）。
// <lang zh-CN>操作台实时编辑态，序列化友好，是持久化与构建 Theme 的中间形态。</lang>
// <lang en>Live editing state of the studio; serialization-friendly intermediate form before building a Theme.</lang>
export interface ThemeDraft{id?:string;name:string;category:string;industry:string;primary:string;secondary:string;primaryName:string;secondaryName:string;note:string;gradients:GradientSettings;}
// 主题库文档：带 schema 版本的可持久化根结构。
// <lang zh-CN>用于本地存储/导入导出的顶层文档，含 schemaVersion 以便未来迁移。</lang>
// <lang en>Top-level document for storage / import-export, carrying schemaVersion for future migration.</lang>
export interface ThemeLibraryDocument{schemaVersion:1;presets:Preset[];}
// CSS 变量映射：键为自定义属性名，值为色值。
// <lang zh-CN>运行时注入到 :root 的 CSS 变量集合，是所有端共用的一致接口。</lang>
// <lang en>CSS custom properties injected on :root, the consistent interface shared across runtimes.</lang>
export type CssVariableMap=Record<string,string>;
