/**
 * @lang zh-CN V2 取色分析契约：可序列化、可版本化、跨端一致的证据与结果类型。
 *   覆盖指令第四节语义；所有类型纯数据，core 不在此访问 DOM/Canvas/网络。
 * @lang en V2 extraction contract: serializable, versioned, cross-end consistent evidence and result types.
 *   Covers spec §4 semantics; pure data only, core never touches DOM/Canvas/network here.
 */

// 颜色来源：标识某条证据来自页面哪一类通道。
// <lang zh-CN>截图与 DOM 分开，便于后续按来源加权与降级。</lang>
// <lang en>Screenshot vs DOM separated so downstream weighting/degradation can differ.</lang>
export type ColorSource =
  | 'meta-theme'
  | 'manifest-theme'
  | 'css-token'
  | 'computed-background'
  | 'computed-text'
  | 'computed-border'
  | 'svg-fill'
  | 'svg-stroke'
  | 'gradient-stop'
  | 'logo-raster'
  | 'screenshot-ui'
  | 'screenshot-artwork';

// 语义角色：颜色在页面中承担的职责，驱动角色感知评分与候选排除。
// <lang zh-CN>状态色必须靠上下文判定，不凭色相硬分类。</lang>
// <lang en>Status colors are context-derived, never by hue alone.</lang>
export type SemanticRole =
  | 'brand'
  | 'primary'
  | 'secondary'
  | 'accent'
  | 'cta'
  | 'link'
  | 'surface'
  | 'text'
  | 'border'
  | 'icon'
  | 'status'
  | 'unknown';

// 单条颜色证据：聚合后的出现次数，而非重复展开记录。
// <lang zh-CN>areaRatio/aboveFoldRatio/pixelRatio 为相对视口/截图的占比特征。</lang>
// <lang en>areaRatio/aboveFoldRatio/pixelRatio are ratio features vs viewport/screenshot.</lang>
export interface ColorEvidence {
  /** 作者声明值（var(--brand-primary)、oklch(...) 或 #0047ab）。 */
  value: string;
  /** 规范化的不透明 sRGB 十六进制值。 */
  hex: string;
  alpha: number;
  source: ColorSource;
  role: SemanticRole;
  /** 聚合后的出现次数，而非重复展开记录。 */
  count: number;
  /** 元素可见矩形面积占视口/采样区域比例。 */
  areaRatio?: number;
  /** 首屏可见面积比例。 */
  aboveFoldRatio?: number;
  /** 截图像素占比。 */
  pixelRatio?: number;
  tokenNames?: string[];
  contexts?: string[];
  selectors?: string[];
  frameKind?: 'main' | 'same-origin' | 'third-party';
}

// 采集警告：跨域 stylesheet 跳过、节点上限、降级原因等。
// <lang zh-CN>用于 UI 透明展示分析局限。</lang>
// <lang en>Surfaced to UI so analysis limits are transparent.</lang>
export interface CaptureWarning {
  code: string;
  message: string;
  scope?: string;
}

// 采集诊断：耗时、跳过计数、降级模式等可观测指标。
// <lang zh-CN>便于跨端契约测试与性能核对。</lang>
// <lang en>Useful for cross-end contract tests and performance checks.</lang>
export interface CaptureDiagnostics {
  mode: 'render' | 'degraded-static';
  durationMs: number;
  skippedNodes?: number;
  skippedFrames?: number;
  notes?: string[];
}

// V2 信号聚合：页面元信息与证据数组。
// <lang zh-CN>schemaVersion 固定为 2，便于运行时校验与版本路由。</lang>
// <lang en>schemaVersion pinned to 2 for runtime validation and version routing.</lang>
export interface WebsiteColorSignalsV2 {
  schemaVersion: 2;
  page: {
    requestedUrl: string;
    finalUrl: string;
    title: string;
    viewport: { width: number; height: number; dpr: number };
    colorScheme: 'light' | 'dark';
    capturedAt: string;
  };
  evidence: ColorEvidence[];
  warnings: CaptureWarning[];
  diagnostics: CaptureDiagnostics;
}

// V2 已打分颜色：含 OKLCH、置信度、角色、家族与理由摘要。
// <lang zh-CN>reasons 为人可读解释，支持 UI 展示“为何选中”。</lang>
// <lang en>reasons are human-readable explanations for UI display.</lang>
export interface ScoredColorV2 {
  hex: string;
  oklch: { l: number; c: number; h: number };
  score: number;
  confidence: number;
  role: SemanticRole;
  familyId: string;
  derived: boolean;
  origin?: 'observed' | 'harmony-fallback';
  reasons: string[];
  evidenceSummary: {
    sources: ColorSource[];
    sourceFamilies: number;
    count: number;
    areaRatio: number;
    pixelRatio: number;
    tokenNames: string[];
    contexts: string[];
  };
}

// V2 主题分析结果：主副色、强调、表面、文本、备选与整体置信度。
// <lang zh-CN>alternatives 建议 8~12 个供操作台展示。</lang>
// <lang en>alternatives 8~12 for the studio to display.</lang>
export interface WebsiteThemeAnalysisV2 {
  schemaVersion: 2;
  primary: ScoredColorV2 | null;
  secondary: ScoredColorV2 | null;
  accent: ScoredColorV2 | null;
  surfaces: ScoredColorV2[];
  textColors: ScoredColorV2[];
  alternatives: ScoredColorV2[];
  confidence: number;
  warnings: string[];
  diagnostics: CaptureDiagnostics;
}
