/**
 * @lang zh-CN V2 主题分析：把浏览器端采集的 ColorEvidence[] 在 OKLab 空间聚类、做角色感知评分，
 *   选出主色/副色/备选并给出置信度与可解释理由。纯算法，不访问 DOM/Canvas/网络。
 *   评分参数集中到 CONFIG，便于 fixture 调参与解释输出（指令第七、八、九节）。
 * @lang en V2 analysis: clusters ColorEvidence[] in OKLab, role-aware scores, picks primary/secondary/alternatives
 *   with confidence and explainable reasons. Pure algorithm, no DOM/Canvas/network. Scoring params centralized
 *   in CONFIG for fixture tuning and explainable output (spec §7/§8/§9).
 */

import { hexToOklch, oklchToRgb, hexToRgb, rgbToHex, normalizeHex, validHex } from '../color/convert.js';
import { contrast } from '../color/contrast.js';
import { generateSecondarySet } from '../color/harmony.js';
import type {
  ColorEvidence,
  ColorSource,
  SemanticRole,
  WebsiteColorSignalsV2,
  WebsiteThemeAnalysisV2,
  ScoredColorV2,
  CaptureDiagnostics
} from './types-v2.js';

// OKLab 近似聚类阈值（指令七节建议 0.025~0.04，取 0.03 作 fixture 调参锚点）。
// <lang zh-CN>同一品牌色的 hover/active/浅背景属不同候选但共享 familyId。</lang>
// <lang en>Hover/active/light-bg of one brand are distinct candidates but share familyId.</lang>
const CLUSTER_DIST = 0.03;

// 来源基准分（指令八节基线，集中配置）。
// <lang zh-CN>显式 token > logo/CTA > meta/manifest > header > button/link > 背景 > border > 文本。</lang>
// <lang en>Explicit token > logo/CTA > meta/manifest > header > button/link > bg > border > text.</lang>
const SOURCE_BASE: Record<ColorSource, number> = {
  'css-token': 10,
  'svg-fill': 9,
  'svg-stroke': 8,
  'computed-border': 1.5,
  'gradient-stop': 3,
  'meta-theme': 7.5,
  'manifest-theme': 7.5,
  'computed-background': 2.5,
  'computed-text': 0.8,
  'logo-raster': 9,
  'screenshot-ui': 3,
  'screenshot-artwork': 0.75
};

// 语义乘数（指令八节基线）。
// <lang zh-CN>brand/primary 最高，status 强惩罚，surface/text 竞争主色时降权。</lang>
// <lang en>brand/primary highest; status penalized; surface/text down-weighted when competing for primary.</lang>
const SEMANTIC_MULT: Record<SemanticRole, number> = {
  brand: 1.8,
  primary: 1.8,
  cta: 1.6,
  secondary: 1.4,
  accent: 1.4,
  link: 1.2,
  icon: 1.0,
  surface: 0.4,
  text: 0.4,
  border: 1.0,
  status: 0.1,
  unknown: 1.0
};

// 帧权重：主帧 1.0，third-party 0.2（指令八节）。
// <lang zh-CN>同源帧全权，跨域帧仅弱证据。</lang>
// <lang en>Same-origin full weight; third-party weak.</lang>
const FRAME_WEIGHT: Record<'main' | 'same-origin' | 'third-party', number> = {
  'main': 1.0,
  'same-origin': 1.0,
  'third-party': 0.2
};

// 中性/低彩度判定：白/近黑与极低彩度不参与主色评选。
// <lang zh-CN>单色品牌也可能合法，故中性色不硬删除，只在评分中强降权。</lang>
// <lang en>Mono brands are legal; neutrals are strongly down-weighted, not deleted.</lang>
function isNeutral(hex: string): boolean {
  const { C, L } = hexToOklch(hex);
  return C < 0.02 || L > 0.985 || L < 0.015;
}

// 单个聚类（近似颜色合并后的证据家族）。
// <lang zh-CN>汇总来源家族、频次、面积、像素、角色、token、上下文与帧类型。</lang>
// <lang en>Aggregates source families, count, area, pixel, roles, tokens, contexts and frame kinds.</lang>
interface Cluster {
  familyId: string;
  repHex: string;            // 代表色（token 优先或面积加权均值映射回 sRGB）
  repOklch: { L: number; C: number; h: number };
  evidence: ColorEvidence[];
  count: number;
  areaMax: number;
  aboveFoldMax: number;
  pixelSum: number;
  sources: ColorSource[];
  roles: SemanticRole[];
  tokenNames: string[];
  contexts: string[];
  selectors: string[];
  frameKinds: Array<'main' | 'same-origin' | 'third-party'>;
  hasBrandToken: boolean;    // 是否含显式 brand/primary/accent/secondary token
}

// 把一组证据按 OKLab 距离聚成 cluster。
// <lang zh-CN>首次出现建立聚类，后续同簇合并；代表色在聚合结束后按 token 优先/面积加权确定。</lang>
// <lang en>First sight opens a cluster; later near colors merge; representative decided after by token-priority/area.</lang>
export function clusterEvidence(evidence: ColorEvidence[]): Cluster[] {
  const clusters: Cluster[] = [];
  for (const e of evidence) {
    if (!validHex(e.hex)) continue;
    const ok = hexToOklch(e.hex);
    // OKLab 欧氏距离近似（L 直接差，a/b 用 C/h 投影差）。
    // <lang zh-CN>用 L 差 + 彩度差 + 色相环差（按 C 加权）作为近似距离。</lang>
    // <lang en>Approx distance: L diff + chroma diff + hue-ring diff (C-weighted).</lang>
    const dist = (c: Cluster) => {
      const dl = Math.abs(ok.L - c.repOklch.L);
      const dc = Math.abs(ok.C - c.repOklch.C);
      const dh = Math.min(Math.abs(ok.h - c.repOklch.h), 360 - Math.abs(ok.h - c.repOklch.h)) / 180 * Math.max(ok.C, c.repOklch.C);
      return dl + dc + dh;
    };
    let target: Cluster | undefined;
    let bestD = CLUSTER_DIST;
    for (const c of clusters) { const d = dist(c); if (d <= bestD) { bestD = d; target = c; } }
    if (!target) {
      target = {
        familyId: 'f' + clusters.length,
        repHex: e.hex, repOklch: ok, evidence: [],
        count: 0, areaMax: 0, aboveFoldMax: 0, pixelSum: 0,
        sources: [], roles: [], tokenNames: [], contexts: [], selectors: [],
        frameKinds: [], hasBrandToken: false
      };
      clusters.push(target);
    }
    target.evidence.push(e);
    target.count += e.count || 1;
    target.areaMax = Math.max(target.areaMax ?? 0, e.areaRatio ?? 0);
    target.aboveFoldMax = Math.max(target.aboveFoldMax ?? 0, e.aboveFoldRatio ?? 0);
    target.pixelSum += e.pixelRatio ?? 0;
    if (e.source && !target.sources.includes(e.source)) target.sources.push(e.source);
    if (e.role && !target.roles.includes(e.role)) target.roles.push(e.role);
    for (const t of e.tokenNames ?? []) if (!target.tokenNames.includes(t)) target.tokenNames.push(t);
    for (const cx of e.contexts ?? []) if (!target.contexts.includes(cx)) target.contexts.push(cx);
    for (const s of e.selectors ?? []) if (!target.selectors.includes(s)) target.selectors.push(s);
    if (e.frameKind && !target.frameKinds.includes(e.frameKind)) target.frameKinds.push(e.frameKind);
    // 显式品牌 token 命中（变量名含 brand/primary/accent/secondary）。
    // <lang zh-CN>仅当角色为 brand/primary/accent/secondary 或 token 名含关键词时标记。</lang>
    // <lang en>Marked when role is brand/primary/accent/secondary or token name has keywords.</lang>
    if (/brand|primary|accent|secondary/i.test((e.tokenNames ?? []).join(' ')) || ['brand', 'primary', 'accent', 'secondary'].includes(e.role)) {
      target.hasBrandToken = true;
    }
  }
  // 确定代表色：优先取含 brand/primary token 的证据 hex；否则按面积加权均值映射回 sRGB。
  // <lang zh-CN>保证代表色是真实出现过的色值，而非凭空均值。</lang>
  // <lang en>Representative is a real observed value, not an invented mean.</lang>
  for (const c of clusters) {
    const tokenHex = c.evidence.find(e => /brand|primary|accent|secondary/i.test((e.tokenNames ?? []).join(' ')))?.hex;
    if (tokenHex && validHex(tokenHex)) { c.repHex = normalizeHex(tokenHex); c.repOklch = hexToOklch(c.repHex); continue; }
    // 面积加权均值（在 OKLab 空间），再映射回 sRGB 取最接近的有效 hex。
    // <lang zh-CN>避免极端色；加权平均后再量化到有效 sRGB。</lang>
    // <lang en>Avoid extremes; average in OKLab then quantize to valid sRGB.</lang>
    let L = 0, a = 0, b = 0, wsum = 0;
    for (const e of c.evidence) {
      const w = (e.areaRatio ?? 0.01) + (e.count ?? 1) * 0.001;
      const o = hexToOklch(e.hex);
      const rad = o.h * Math.PI / 180;
      L += o.L * w; a += o.C * Math.cos(rad) * w; b += o.C * Math.sin(rad) * w; wsum += w;
    }
    if (wsum > 0) {
      const [r, g, bl] = oklchToRgb(L / wsum, Math.hypot(a, b) / wsum, (Math.atan2(b, a) * 180 / Math.PI + 360) % 360);
      c.repHex = normalizeHex(rgbToHex([Math.max(0, Math.min(1, r)), Math.max(0, Math.min(1, g)), Math.max(0, Math.min(1, bl))]));
      c.repOklch = hexToOklch(c.repHex);
    }
  }
  return clusters;
}

// 对单个聚类打分（指令八节公式结构）。
// <lang zh-CN>sourceBase × semantic × frame × (1+0.35 log1p count) × (1+0.6√area+0.3√aboveFold) + 互证 - 状态惩罚。</lang>
// <lang en>sourceBase × semantic × frame × (1+0.35 log1p count) × (1+0.6√area+0.3√aboveFold) + corroboration - status penalty.</lang>
function scoreCluster(c: Cluster): { score: number; reasons: string[] } {
  const reasons: string[] = [];
  // 若聚类整体是中性色，强降权（不硬删）。
  // <lang zh-CN>白/黑/灰作为 surface/text 角色降权，而不是硬删除。</lang>
  // <lang en>White/black/gray down-weighted as surface/text, not hard-deleted.</lang>
  if (isNeutral(c.repHex)) {
    reasons.push(`中性/低彩度色 ${c.repHex}，已降权`);
    return { score: 0.05, reasons };
  }
  let total = 0;
  // 零实际使用惩罚：仅 token 声明（无 computed/screenshot 来源，且面积与像素均为 0）的品牌色，
  // 不能仅凭变量名获胜（指令八节/十四节：unused token 不得压过有实际使用的颜色）。
  // <lang zh-CN>此时整体分数强降权，让真实出现在 DOM/截图的颜色胜出。</lang>
  // <lang en>Strongly down-weight so colors actually observed in DOM/screenshot win.</lang>
  const onlyDeclaredToken = c.sources.every(s => s === 'css-token')
    && !c.sources.some(s => s.startsWith('computed') || s.startsWith('screenshot'))
    && c.areaMax <= 0 && c.pixelSum <= 0;
  const declaredPenalty = onlyDeclaredToken ? 0.15 : 1;
  // 同色多来源/多角色分别计贡献（避免只取最高来源而漏掉互证）。
  // <lang zh-CN>每条 evidence 独立计 sourceBase×semantic×frame，再汇总。</lang>
  // <lang en>Each evidence contributes sourceBase×semantic×frame independently, then summed.</lang>
  for (const e of c.evidence) {
    const sb = SOURCE_BASE[e.source] ?? 1;
    const sm = SEMANTIC_MULT[e.role] ?? 1;
    const fw = FRAME_WEIGHT[e.frameKind ?? 'main'] ?? 1;
    const sat = (1 + 0.35 * Math.log1p(e.count ?? 1)) * (1 + 0.6 * Math.sqrt(e.areaRatio ?? 0) + 0.3 * Math.sqrt(e.aboveFoldRatio ?? 0));
    let s = sb * sm * fw * sat;
    if (e.source === 'screenshot-artwork') s *= 0.3; // artwork 显著降权
    total += s;
  }
  // 跨来源互证加分（指令八节）：token+DOM、DOM+screenshot-ui、logo+CTA、多区域。
  // <lang zh-CN>满足互证条件即叠加固定加分，体现证据融合。</lang>
  // <lang en>Corroboration adds fixed bonus when conditions met.</lang>
  const hasToken = c.sources.includes('css-token');
  const hasDom = c.sources.some(s => s.startsWith('computed'));
  const hasUiShot = c.sources.includes('screenshot-ui');
  const hasLogo = c.sources.includes('svg-fill') || c.sources.includes('logo-raster');
  const regions = new Set(c.roles);
  if (hasToken && hasDom) { total += 3; reasons.push('CSS token 与 DOM 实际使用互证'); }
  if (hasDom && hasUiShot) { total += 2; reasons.push('DOM 与 UI-only 截图互证'); }
  if (hasLogo && c.roles.includes('cta')) { total += 2; reasons.push('logo 与 CTA 互证'); }
  if (regions.size >= 3) { total += 1.5; reasons.push(`在 ${regions.size} 个语义区域出现`); }
  // 状态色惩罚：status 角色且非品牌 token 时强惩罚。
  // <lang zh-CN>状态红绿橙不能凭色相胜出。</lang>
  // <lang en>Status red/green/orange must not win by hue.</lang>
  if (c.roles.includes('status') && !c.hasBrandToken) { total *= 0.2; reasons.push('状态色（success/warning/error）已降权，不按色相胜出'); }
  // 主帧多区域覆盖的稳定性加分。
  // <lang zh-CN>主帧出现即视作稳定。</lang>
  // <lang en>Present in main frame counts as stable.</lang>
  if (c.frameKinds.includes('main')) { total += 0.5; }
  // 零实际使用 token 整体强降权（在互证/主帧加分之后统一施加）。
  // <lang zh-CN>仅声明未出现的品牌色，总分乘以 declaredPenalty，避免仅凭变量名胜出。</lang>
  // <lang en>Declared-only brand token gets total×declaredPenalty so it cannot win by name alone.</lang>
  if (declaredPenalty < 1) { total *= declaredPenalty; reasons.push('品牌 token 仅声明未实际使用，已强降权'); }
  reasons.push(`覆盖来源 ${c.sources.join('/')}，频次 ${c.count}，面积 ${(c.areaMax * 100).toFixed(1)}%`);
  return { score: Math.max(0, total), reasons };
}

// 从聚类列表选择主色（brand/primary/cta/accent 优先，非中性且分数最高）。
// <lang zh-CN>不让 surface/text/border/status 与其同池竞争主色。</lang>
// <lang en>Excludes surface/text/border/status from the primary pool.</lang>
function pickPrimary(clusters: Cluster[], scored: Map<Cluster, { score: number; reasons: string[] }>): Cluster | null {
  const pool = clusters.filter(c => {
    const role = c.roles[0] ?? 'unknown';
    const competing = ['surface', 'text', 'border', 'status', 'unknown'].includes(role) && !c.hasBrandToken;
    // 中性色（黑/白/灰）默认排除主色池，但显式品牌 token 的中性色合法（单色品牌）。
    // <lang zh-CN>单色黑白品牌不应被 isNeutral 误杀，故 brand token 例外保留。</lang>
    // <lang en>Mono black/white brands must survive isNeutral; brand token is the exception.</lang>
    const neutralButBrand = isNeutral(c.repHex) && c.hasBrandToken;
    return !competing && (!isNeutral(c.repHex) || neutralButBrand);
  });
  if (!pool.length) return null;
  pool.sort((a, b) => (scored.get(b)?.score ?? 0) - (scored.get(a)?.score ?? 0));
  return pool[0]!;
}

// 选择副色（指令九节顺序）：显式 secondary/accent token 且使用 → 高置信次级 → 与主色区分 → derived fallback。
// <lang zh-CN>derived 必须标记 origin:'harmony-fallback'。</lang>
// <lang en>derived must be tagged origin:'harmony-fallback'.</lang>
function pickSecondary(primary: Cluster | null, clusters: Cluster[], scored: Map<Cluster, { score: number; reasons: string[] }>): { cluster: Cluster | null; derived: boolean } {
  if (!primary) return { cluster: null, derived: false };
  const pOk = primary.repOklch;
  // 候选：非主色、非中性、与主色有足够区分。
  // <lang zh-CN>区分度用色相环差或亮度差 + 对比度阈值。</lang>
  // <lang en>Distinctness via hue-ring or lightness gap + contrast threshold.</lang>
  const candidates = clusters.filter(c => {
    if (c.repHex === primary.repHex || isNeutral(c.repHex)) return false;
    const o = c.repOklch;
    const dh = Math.min(Math.abs(o.h - pOk.h), 360 - Math.abs(o.h - pOk.h));
    return (dh > 25 || Math.abs(o.L - pOk.L) > 0.12) && contrast(primary.repHex, c.repHex) > 1.6;
  });
  // 1) 显式 secondary/accent token 且实际使用（有 computed 来源）。
  // <lang zh-CN>变量名含 secondary/accent 即优先。</lang>
  // <lang en>Token name containing secondary/accent wins first.</lang>
  const explicit = candidates.find(c => /secondary|accent/i.test((c.tokenNames ?? []).join(' ')) && c.sources.some(s => s.startsWith('computed') || s === 'css-token'));
  if (explicit) return { cluster: explicit, derived: false };
  // 2) 高置信次级 CTA/品牌候选（分数较高）。
  // <lang zh-CN>取候选中分数最高者，若显著则采用。</lang>
  // <lang en>Highest-scored candidate if meaningful.</lang>
  const ranked = candidates.filter(c => (scored.get(c)?.score ?? 0) > 0).sort((a, b) => (scored.get(b)?.score ?? 0) - (scored.get(a)?.score ?? 0));
  if (ranked.length && (scored.get(ranked[0]!)?.score ?? 0) >= (scored.get(primary)?.score ?? 1) * 0.3) {
    return { cluster: ranked[0]!, derived: false };
  }
  // 3) 无真实副色 → 由主色协调生成（derived fallback）。
  // <lang zh-CN>明确标记非网页原始颜色。</lang>
  // <lang en>Clearly tagged as not from the page.</lang>
  return { cluster: null, derived: true };
}

// 把聚类转为 ScoredColorV2（含 OKLCH、置信度、reasons、evidenceSummary）。
// <lang zh-CN>origin 默认 observed；derived 由调用方覆盖。</lang>
// <lang en>origin defaults observed; derived overridden by caller.</lang>
function toScored(c: Cluster, score: number, reasons: string[], origin: 'observed' | 'harmony-fallback' = 'observed'): ScoredColorV2 {
  const ok = c.repOklch;
  return {
    hex: c.repHex,
    oklch: { l: ok.L, c: ok.C, h: ok.h },
    score,
    confidence: 0, // 由 analyzeV2 统算
    role: c.roles[0] ?? 'unknown',
    familyId: c.familyId,
    derived: origin === 'harmony-fallback',
    origin,
    reasons,
    evidenceSummary: {
      sources: c.sources,
      sourceFamilies: new Set(c.sources).size,
      count: c.count,
      areaRatio: c.areaMax,
      pixelRatio: c.pixelSum,
      tokenNames: c.tokenNames,
      contexts: c.contexts
    }
  };
}

// 置信度合成（指令九节结构）：0.35 证据强度 + 0.25 来源多样 + 0.25 分数差 + 0.15 稳定性。
// <lang zh-CN>稳定化指主色在主帧出现且多区域覆盖。</lang>
// <lang en>Stability = primary present in main frame with multi-region coverage.</lang>
function calcConfidence(primary: Cluster, scored: Map<Cluster, { score: number; reasons: string[] }>, top: number, second: number): number {
  const evidenceStrength = Math.min(1, primary.count / 20 + primary.areaMax);
  const sourceDiversity = Math.min(1, new Set(primary.sources).size / 3);
  const scoreMargin = top > 0 ? Math.max(0, Math.min(1, (top - second) / top)) : 0;
  const stability = (primary.frameKinds.includes('main') ? 0.6 : 0) + Math.min(0.4, primary.roles.length / 5);
  return Math.max(0, Math.min(1, 0.35 * evidenceStrength + 0.25 * sourceDiversity + 0.25 * scoreMargin + 0.15 * stability));
}

/**
 * @lang zh-CN V2 分析主入口：聚类 → 评分 → 选主副色 → 置信度/理由 → alternatives。
 *   纯函数，输入 V2 信号，输出可读分析报告；降级模式（degraded-static）封顶置信度 0.45。
 * @lang en V2 analysis entry: cluster → score → pick primary/secondary → confidence/reasons → alternatives.
 *   Pure; degraded-static mode caps confidence at 0.45.
 */
// 内部：对一组证据评出主副色、排序与评分映射（light/dark 双模式复用，避免重复实现）。
// <lang zh-CN>降级封顶、主副色选择、置信度合成逻辑统一；dark 模式复用同一套评分保证跨模式一致。</lang>
// <lang en>Degrade cap, primary/secondary pick, confidence synthesis unified; dark mode reuses the same scoring for cross-mode consistency.</lang>
function analyzeColors(evidence: ColorEvidence[], degraded: boolean): {
  primary: Cluster | null; primaryScored: ScoredColorV2 | null; secondaryScored: ScoredColorV2 | null;
  top: number; second: number; sorted: Cluster[]; scored: Map<Cluster, { score: number; reasons: string[] }>;
} {
  const cap = degraded ? 0.45 : 1;
  const clusters = clusterEvidence(evidence);
  const scored = new Map<Cluster, { score: number; reasons: string[] }>();
  for (const c of clusters) scored.set(c, scoreCluster(c));
  const sorted = [...clusters].sort((a, b) => (scored.get(b)?.score ?? 0) - (scored.get(a)?.score ?? 0));
  const primary = pickPrimary(clusters, scored);
  const secondaryPick = pickSecondary(primary, clusters, scored);
  const top = primary ? scored.get(primary)?.score ?? 0 : 0;
  const second = sorted[1] ? scored.get(sorted[1]!)?.score ?? 0 : 0;

  const primaryScored: ScoredColorV2 | null = primary
    ? (() => {
        const s = scored.get(primary)!;
        const sc = toScored(primary, s.score, s.reasons);
        sc.confidence = Math.min(cap, calcConfidence(primary, scored, top, second));
        return sc;
      })()
    : null;

  let secondaryScored: ScoredColorV2 | null = null;
  if (secondaryPick.cluster) {
    const c = secondaryPick.cluster;
    const s = scored.get(c)!;
    const sc = toScored(c, s.score, s.reasons);
    sc.confidence = Math.min(cap, calcConfidence(c, scored, top, second) * 0.9);
    secondaryScored = sc;
  } else if (secondaryPick.derived && primaryScored) {
    // 由主色协调生成副色候选集，取首项作为 derived 副色（明确标记非网页原始颜色）。
    // <lang zh-CN>generateSecondarySet 返回按和谐方案推导的候选数组，首项即默认推荐。</lang>
    // <lang en>generateSecondarySet returns harmony-derived candidates; first is the default pick.</lang>
    const derived = generateSecondarySet(primaryScored.hex);
    const dHex = derived[0]?.hex ?? primaryScored.hex;
    const ok = hexToOklch(dHex);
    secondaryScored = {
      hex: dHex, oklch: { l: ok.L, c: ok.C, h: ok.h },
      score: 0, confidence: Math.min(cap, 0.3), role: 'secondary',
      familyId: primaryScored.familyId + '-d', derived: true, origin: 'harmony-fallback',
      reasons: ['网页无真实副色，由主色协调生成（非网页原始颜色）'],
      evidenceSummary: { sources: [], sourceFamilies: 0, count: 0, areaRatio: 0, pixelRatio: 0, tokenNames: [], contexts: [] }
    };
  }
  return { primary, primaryScored, secondaryScored, top, second, sorted, scored };
}

export function analyzeThemeV2(signals: WebsiteColorSignalsV2): WebsiteThemeAnalysisV2 {
  const baseDiag: CaptureDiagnostics = signals.diagnostics;
  // 降级模式封顶置信度。
  // <lang zh-CN>静态降级（无真实渲染）证据不完整，置信度上限 0.45。</lang>
  // <lang en>Static degraded (no real render) has incomplete evidence; confidence capped at 0.45.</lang>
  const degraded = baseDiag.mode === 'degraded-static';
  const cap = degraded ? 0.45 : 1;
  // 主（light）证据评分；dark 双模式复用同一评分逻辑评出 dark 主副色。
  // <lang zh-CN>darkMode 由适配器强制 prefers-color-scheme:dark 复采得到。</lang>
  // <lang en>darkMode comes from adapter forcing prefers-color-scheme:dark recapture.</lang>
  const main = analyzeColors(signals.evidence, degraded);
  const { primary, primaryScored, secondaryScored, top, second, sorted, scored } = main;
  const dark = signals.darkMode ? analyzeColors(signals.darkMode.evidence, degraded) : null;
  // logo 色板：由 logo 区域裁剪量化识别的颜色（P5 logo crop）。
  // <lang zh-CN>供 UI 在候选中标注 logo 来源。</lang>
  // <lang en>Surfaced to UI so logo-origin candidates are tagged.</lang>
  const logoHexes = [...new Set(signals.evidence.filter(e => e.isLogo).map(e => e.hex))];

  // 备选：取主色之外分数最高的 8~12 个，跳过中性与状态竞争主色者。
  // <lang zh-CN>覆盖主副色之外的可辨识候选，供操作台展示。</lang>
  // <lang en>Up to 8~12 distinguishable candidates beyond primary/secondary for the studio.</lang>
  const altList: ScoredColorV2[] = [];
  for (const c of sorted) {
    if (altList.length >= 12) break;
    if (primary && c.repHex === primary.repHex) continue;
    if (secondaryScored && c.repHex === secondaryScored.hex) continue;
    if (isNeutral(c.repHex)) continue;
    const s = scored.get(c)!;
    if (s.score <= 0) continue;
    const sc = toScored(c, s.score, s.reasons);
    sc.confidence = Math.min(cap, calcConfidence(c, scored, top, second));
    altList.push(sc);
  }

  const confidence = primaryScored?.confidence ?? 0;
  const warnings: string[] = [
    ...signals.warnings.map(w => w.message)
  ];
  if (degraded) warnings.push('页面未真实渲染，动态样式/CSS 变量/截图证据缺失，置信度已封顶 0.45');

  return {
    schemaVersion: 2,
    primary: primaryScored,
    secondary: secondaryScored,
    // surfaces/textColors 取自对应角色聚类（前若干）。
    // <lang zh-CN>surface/text 角色单独列出便于 UI 区分配色。</lang>
    // <lang en>surface/text roles listed separately for UI pairing.</lang>
    surfaces: sorted.filter(c => c.roles.includes('surface') && !isNeutral(c.repHex)).slice(0, 4).map(c => { const s = scored.get(c)!; const sc = toScored(c, s.score, s.reasons); sc.confidence = Math.min(cap, calcConfidence(c, scored, top, second)); return sc; }),
    textColors: sorted.filter(c => c.roles.includes('text')).slice(0, 4).map(c => { const s = scored.get(c)!; const sc = toScored(c, s.score, s.reasons); sc.confidence = Math.min(cap, calcConfidence(c, scored, top, second)); return sc; }),
    accent: (() => { const c = sorted.find(c => c.roles.includes('accent') && !isNeutral(c.repHex)); if (!c) return null; const s = scored.get(c)!; const sc = toScored(c, s.score, s.reasons); sc.confidence = Math.min(cap, calcConfidence(c, scored, top, second)); return sc; })(),
    alternatives: altList,
    confidence,
    warnings,
    diagnostics: baseDiag,
    darkPrimary: dark?.primaryScored ?? null,
    darkSecondary: dark?.secondaryScored ?? null,
    logoHexes
  };
}
