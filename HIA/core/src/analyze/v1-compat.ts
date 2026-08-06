/**
 * @lang zh-CN V1→V2 兼容层：把旧版 ExtractSignals 转换为 V2 信号契约。
 *   当前 V1 只有静态 CSS 变量与 DOM 颜色（无真实渲染），故统一标记为 degraded-static 模式。
 *   后续 P1/P3 接入真实渲染后，render 模式将由采集适配器直接产出 V2，不再走此转换。
 * @lang en V1→V2 compatibility: converts legacy ExtractSignals into the V2 signal contract.
 *   V1 only has static CSS vars + DOM colors (no real render), so it is tagged degraded-static.
 *   Once P1/P3 add real rendering, the render adapter emits V2 directly and skips this shim.
 */

import { normalizeHex, validHex } from '../color/convert.js';
import type {
  ColorEvidence,
  ColorSource,
  SemanticRole,
  WebsiteColorSignalsV2
} from './types-v2.js';
import type { ExtractSignals } from './types.js';

// 将 V1 区域名映射到 V2 语义角色。
// <lang zh-CN>V1 区域粒度较粗，这里做最小映射；brand/button 升级为 brand/cta 倾向。</lang>
// <lang en>V1 regions are coarse; minimal mapping, brand/button lean to brand/cta.</lang>
function regionToRole(region: string): SemanticRole {
  switch (region) {
    case 'brand': return 'brand';
    case 'header': return 'primary';
    case 'nav': return 'link';
    case 'button': return 'cta';
    case 'link': return 'link';
    case 'banner': return 'accent';
    default: return 'unknown';
  }
}

// 把含关键词的变量名推断为更具体的角色。
// <lang zh-CN>secondary/accent 等命名升级对应角色，提升 V2 角色感知评分的输入质量。</lang>
// <lang en>Names like secondary/accent upgrade the role, improving V2 role-aware scoring input.</lang>
function refineRoleFromName(name: string, base: SemanticRole): SemanticRole {
  const n = name.toLowerCase();
  if (n.includes('secondary')) return 'secondary';
  if (n.includes('accent')) return 'accent';
  if (n.includes('link')) return 'link';
  if (n.includes('text')) return 'text';
  if (n.includes('bg') || n.includes('background') || n.includes('surface')) return 'surface';
  if (n.includes('border')) return 'border';
  return base;
}

/**
 * @lang zh-CN 将 V1 信号转换为 V2 证据契约（降级静态模式）。
 *   每个 V1 颜色生成一条对应来源的证据，count 沿用频次/权重归纳。
 * @lang en Convert V1 signals to V2 evidence contract (degraded-static mode).
 *   Each V1 color becomes one evidence record of the matching source; count derives from frequency/weight.
 */
export function toV2Signals(v1: ExtractSignals, meta?: Partial<WebsiteColorSignalsV2['page']>): WebsiteColorSignalsV2 {
  const evidence: ColorEvidence[] = [];
  const warnings: WebsiteColorSignalsV2['warnings'] = [];

  // CSS 变量 → css-token 证据。
  // <lang zh-CN>变量名含语义关键词时升级 source 为更具体的 token 角色。</lang>
  // <lang en>Var names with semantic keywords upgrade to a more specific token role.</lang>
  for (const v of v1.cssVars ?? []) {
    const hex = normalizeHex(v.hex);
    if (!validHex(hex)) continue;
    const role = refineRoleFromName(v.name, 'primary');
    evidence.push({
      value: v.name,
      hex,
      alpha: 1,
      source: 'css-token',
      role,
      count: 1,
      tokenNames: [v.name]
    });
  }

  // DOM 颜色 → computed-background 证据（V1 未区分属性，统一记为背景类）。
  // <lang zh-CN>count 沿用 V1 频次；角色由区域推导。</lang>
  // <lang en>count reuses V1 frequency; role derived from region.</lang>
  for (const d of v1.domColors ?? []) {
    const hex = normalizeHex(d.hex);
    if (!validHex(hex)) continue;
    evidence.push({
      value: hex,
      hex,
      alpha: 1,
      source: 'computed-background',
      role: regionToRole(d.region),
      count: d.count,
      contexts: [d.region]
    });
  }

  // 截图颜色 → screenshot-ui 证据（V1 仅占位，无 ui-only/artwork 区分）。
  // <lang zh-CN>pixelRatio 沿用 V1 ratio。</lang>
  // <lang en>pixelRatio reuses V1 ratio.</lang>
  for (const s of v1.screenshotColors ?? []) {
    const hex = normalizeHex(s.hex);
    if (!validHex(hex)) continue;
    evidence.push({
      value: hex,
      hex,
      alpha: 1,
      source: 'screenshot-ui',
      role: 'unknown',
      count: 1,
      pixelRatio: s.ratio
    });
  }

  if (evidence.length === 0) {
    warnings.push({ code: 'empty-signals', message: 'V1 信号为空，已降级为静态占位', scope: 'convert' });
  }

  return {
    schemaVersion: 2,
    page: {
      requestedUrl: meta?.requestedUrl ?? '',
      finalUrl: meta?.finalUrl ?? '',
      title: meta?.title ?? '',
      viewport: meta?.viewport ?? { width: 0, height: 0, dpr: 1 },
      colorScheme: meta?.colorScheme ?? 'light',
      capturedAt: meta?.capturedAt ?? new Date(0).toISOString()
    },
    evidence,
    warnings,
    diagnostics: {
      mode: 'degraded-static',
      durationMs: 0,
      notes: ['V1→V2 转换：仅静态信号，真实渲染证据（`render` 模式）将由 P1/P3 采集适配器产出']
    }
  };
}
