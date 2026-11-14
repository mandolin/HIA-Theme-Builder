/**
 * @lang zh-CN 圆角与阴影令牌（`W-tb-P37`，ADR-006 契约位落地）：档位派生纯函数。
 *   圆角五档由基准值派生；阴影三档由强度派生（可混入主色低透明度做品牌化阴影）。
 *   全部纯函数、无 IO——与色阶/间距同一套生成式令牌管线（ADR-006 决策 2）。
 *
 * @lang en Radius & shadow tokens (`W-tb-P37`, ADR-006 contract slot landed): pure derivation functions.
 *   Five radius steps derive from one base; three shadow levels derive from strength (optionally tinted with
 *   the primary colour). Pure and IO-free — the same generative pipeline as scales/spacing (ADR-006 decision 2).
 */
import type { RadiusTokens, ShadowTokens } from '../types.js';
import { hexToRgb } from '../color/convert.js';

/** @lang zh-CN 圆角档位键。 @lang en Radius step keys. */
export type RadiusStep = 'sm' | 'md' | 'lg' | 'xl' | 'pill';

/** @lang zh-CN 圆角令牌默认值（8px 基准——主流设计系统最常见档）。 @lang en Radius defaults (8px base — the most common design-system step). */
export const RADIUS_DEFAULTS: RadiusTokens = { base: 8 };

/** @lang zh-CN 阴影令牌默认值（soft 档——适合浅色后台）。 @lang en Shadow defaults (soft — suits light consoles). */
export const SHADOW_DEFAULTS: ShadowTokens = { strength: 'soft' };

// 补齐圆角配置：缺省/非法回退默认值（clone 语义，向后兼容 ADR-006 决策 4）。
// <lang en>Normalise radius config: missing/invalid falls back to defaults (clone semantics, ADR-006 decision 4).</lang>
export function cloneRadiusTokens(tokens?: Partial<RadiusTokens> | null): RadiusTokens {
  const base = tokens && Number.isFinite(tokens.base) && (tokens.base as number) >= 0 ? (tokens.base as number) : RADIUS_DEFAULTS.base;
  return { base, overrides: tokens?.overrides ? { ...tokens.overrides } : undefined };
}

// 补齐阴影配置：非法强度回退 soft。
// <lang en>Normalise shadow config: invalid strength falls back to soft.</lang>
export function cloneShadowTokens(tokens?: Partial<ShadowTokens> | null): ShadowTokens {
  const strength = tokens && ['none', 'soft', 'medium', 'strong'].includes(tokens.strength as string) ? tokens.strength! : SHADOW_DEFAULTS.strength;
  return { strength, tintFromPrimary: tokens?.tintFromPrimary ?? false, overrides: tokens?.overrides ? { ...tokens.overrides } : undefined };
}

/**
 * @lang zh-CN 圆角档位序列（px）：sm=base/2、md=base、lg=×1.5、xl=×2、pill=胶囊（999 保证全圆）。
 *   overrides 按 `radius-sm` 等键覆写单档。纯函数。
 * @lang en Radius sequence (px): sm=base/2, md=base, lg=×1.5, xl=×2, pill=999 (guaranteed full round).
 *   Overrides apply per step via keys like `radius-sm`. Pure.
 */
export function radiusSequence(tokens?: Partial<RadiusTokens> | null): Record<RadiusStep, number> {
  const t = cloneRadiusTokens(tokens);
  const pill = 999;
  const seq: Record<RadiusStep, number> = {
    sm: Math.round(t.base / 2),
    md: Math.round(t.base),
    lg: Math.round(t.base * 1.5),
    xl: Math.round(t.base * 2),
    pill
  };
  // 覆写：显式指定某档则用覆写值（pill 覆写同样尊重）。
  // <lang en>Overrides: an explicit step wins (pill overrides respected too).</lang>
  for (const step of Object.keys(seq) as RadiusStep[]) {
    const key = `radius-${step}`;
    const v = t.overrides?.[key];
    if (Number.isFinite(v)) seq[step] = v as number;
  }
  return seq;
}

/** @lang zh-CN 阴影档位键（sm/md/lg）。 @lang en Shadow level keys (sm/md/lg). */
export type ShadowLevel = 'sm' | 'md' | 'lg';

// 各强度的阴影基参数：偏移/模糊/透明度随强度递增。
// <lang en>Shadow base params per strength: offset/blur/alpha grow with strength.</lang>
const SHADOW_PARAMS: Record<ShadowTokens['strength'], { y: number; blur: number; spread: number; alpha: number } | null> = {
  none: null,
  soft: { y: 1, blur: 3, spread: 0, alpha: 0.10 },
  medium: { y: 2, blur: 8, spread: 0, alpha: 0.14 },
  strong: { y: 4, blur: 16, spread: 0, alpha: 0.20 }
};

/**
 * @lang zh-CN 阴影三档 CSS box-shadow 字符串：`x y blur spread color` 双层（环境层 + 贴近层）。
 *   tintFromPrimary 时阴影色向主色色相偏移（低饱和、低透明度）——品牌化但不脏版面。
 *   strength='none' 时全部为 'none'（可读性兜底：调用方不必分支）。overrides 按键 `shadow-sm` 等覆写。
 * @lang en Shadow CSS box-shadow strings for three levels: two-layer `x y blur spread color` (ambient + key).
 *   tintFromPrimary shifts shadow hue toward the primary (low sat/alpha — branded but not muddy);
 *   strength='none' yields 'none' for all levels so callers need no branching. Overrides via keys like
 *   `shadow-sm`.
 */
export function shadowCss(tokens: Partial<ShadowTokens> | null | undefined, primaryHex: string): Record<ShadowLevel, string> {
  const t = cloneShadowTokens(tokens);
  const out = {} as Record<ShadowLevel, string>;
  for (const level of ['sm', 'md', 'lg'] as ShadowLevel[]) {
    const key = `shadow-${level}`;
    const override = t.overrides?.[key];
    if (override) { out[level] = override; continue; }
    const params = SHADOW_PARAMS[t.strength];
    if (!params) { out[level] = 'none'; continue; }
    // 双层阴影：外层环境阴影（大模糊低透明）+ 内层贴近阴影（小偏移）。
    // <lang en>Two layers: outer ambient (large blur, low alpha) + inner key shadow (small offset).</lang>
    const scale = level === 'sm' ? 1 : level === 'md' ? 1.8 : 3.2;
    const alpha = params.alpha * (level === 'sm' ? 1 : level === 'md' ? 1.05 : 1.15);
    if (t.tintFromPrimary) {
      // 染色阴影：主色线性 RGB 与中性暗色按 alpha 混出阴影基色。
      // <lang en>Tinted shadow: mix the primary's linear RGB with a neutral dark at alpha.</lang>
      const [r, g, b] = hexToRgb(primaryHex);
      const mix = (c: number) => Math.round((c * 0.35 + 0.08 * 0.65) * 255);
      const shade = `rgb(${mix(r)} ${mix(g)} ${mix(b)} / ${alpha.toFixed(3)})`;
      out[level] = `0 ${params.y * scale}px ${params.blur * scale}px ${params.spread}px ${shade}, 0 ${params.y}px ${params.blur}px 0 ${shade}`;
    } else {
      out[level] = `0 ${params.y * scale}px ${params.blur * scale}px ${params.spread}px rgb(15 23 42 / ${alpha.toFixed(3)}), 0 ${params.y}px ${params.blur}px 0 rgb(15 23 42 / ${alpha.toFixed(3)})`;
    }
  }
  return out;
}
