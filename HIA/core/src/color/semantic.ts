/**
 * @lang zh-CN 语义状态色派生（`W-tb-P37`，ADR-012）：从主色派生 success/info/warning/danger 四组完整
 *   RoleColor（10 阶 + on 色）。**色相按语义固定**（状态语义是约定俗成的，不随主题漂移），
 *   **明度与彩度特征随主色**——低明度主题得到低明度状态色，防止"灰主题配荧光状态色"。
 *   派生值是预填值，用户可逐组覆盖（ADR-012 决策 3）；覆盖后不随主色刷新。
 *
 * @lang en Semantic status token derivation (`W-tb-P37`, ADR-012): derive success/info/warning/danger as full
 *   RoleColors (10 steps + on) from the primary. **Hues are semantically fixed** (status semantics are
 *   conventional and must not drift with the theme), while **lightness/chroma character follows the primary** —
 *   a dim theme gets dim status colours, avoiding neon statuses on muted themes. Derived values are prefills;
 *   users may override per group (ADR-012 decision 3), after which they stop following the primary.
 */
import type { RoleColor, SemanticStatusKey, SemanticTokens } from '../types.js';
import { gamutMapOklch, hexToOklch, clamp } from '../color/convert.js';
import { tonalScale } from '../color/scale.js';
import { bestOnColor } from '../color/contrast.js';

/**
 * @lang zh-CN 语义状态色相锚点（OKLCH 角度，按 2026 主流设计系统约定）：
 *   success 绿 145 / info 蓝 250 / warning 琥珀 70 / danger 红 25。
 *   **不要改动这些色相**——语义色的可辨识度依赖约定；个性化走覆盖机制而非改锚点。
 * @lang en Semantic hue anchors (OKLCH degrees, per 2026 mainstream conventions):
 *   success green 145 / info blue 250 / warning amber 70 / danger red 25.
 *   **Do not change these** — recognisability depends on convention; personalise via overrides, not anchors.
 */
export const SEMANTIC_HUES: Record<SemanticStatusKey, number> = { success: 145, info: 250, warning: 70, danger: 25 };

/** @lang zh-CN 语义状态中英文名（RoleColor.name 消费）。 @lang en Bilingual status names (consumed as RoleColor.name). */
export const SEMANTIC_NAMES: Record<SemanticStatusKey, { zh: string; en: string }> = {
  success: { zh: '成功', en: 'Success' },
  info: { zh: '信息', en: 'Info' },
  warning: { zh: '警告', en: 'Warning' },
  danger: { zh: '危险', en: 'Danger' }
};

/**
 * @lang zh-CN 从主色派生语义状态色组（ADR-012 决策 2）。
 *   继承规则：语义基色的 L = 主色 L 向 0.55（通用可读档）收敛 40%；C = 主色 C 的 85% 并按语义色相
 *   的可显示上限做色域映射（琥珀/绿高彩度可行，蓝红易越域，交给 gamutMap 收敛）。
 *   每组产出与角色色同构的 10 阶 + on 色（bestOnColor）。
 * @lang en Derives the semantic group from the primary (ADR-012 decision 2).
 *   Inheritance: the semantic base L converges 40% from the primary L toward 0.55 (a general readable level);
 *   C = 85% of the primary's C with per-hue gamut mapping (amber/green tolerate high chroma, blue/red clip).
 *   Each group yields the same 10-step scale + on colour as role colours.
 */
export function deriveSemanticTokens(primaryHex: string): SemanticTokens {
  const primary = hexToOklch(primaryHex);
  const out = {} as SemanticTokens;
  // 收敛公式：L_sem = L_primary + (0.55 - L_primary) * 0.4 —— 主色很暗/很亮时语义色仍回到可读区间，
  //   同时保留"暗主题→略暗状态色"的家族感（40% 收敛而非拉平）。
  // <lang en>Convergence: L_sem = L_primary + (0.55 − L_primary) × 0.4 — very dark/bright primaries still land
  //   in the readable band while keeping the family feel (40% convergence, not flattening).</lang>
  const LBase = clamp(primary.L + (0.55 - primary.L) * 0.4, 0.4, 0.72);
  const CBase = Math.max(primary.C * 0.85, 0.09); // 低彩主色也要保证状态色可辨（下限 0.09）。
  for (const key of ['success', 'info', 'warning', 'danger'] as SemanticStatusKey[]) {
    const hue = SEMANTIC_HUES[key];
    // 色域映射：C 可能超出该色相的可显示范围，gamutMap 收敛后再生成色阶。
    // <lang en>Gamut map first: C may exceed the hue's displayable range, then build the scale.</lang>
    const { hex } = gamutMapOklch(LBase, CBase, hue);
    const scale = tonalScale(hex);
    const role: RoleColor = { name: SEMANTIC_NAMES[key].zh, value: hex, scale, on: bestOnColor(hex).hex };
    out[key] = role;
  }
  return out;
}

/**
 * @lang zh-CN 判断语义组是否为派生态（ADR-012 决策 3）：`semanticDerived[key]` 为 true 表示仍随主色刷新；
 *   缺省视为用户值（旧预设/手动填入不跟随主色）。
 * @lang en Whether a semantic group is still derived (ADR-012 decision 3): `semanticDerived[key] === true`
 *   keeps following the primary; absent means user-managed (old presets and manual input do not follow).
 */
export function isSemanticDerived(flags: Record<string, boolean> | undefined, key: SemanticStatusKey): boolean {
  return flags?.[key] === true;
}

/**
 * @lang zh-CN 深拷贝语义组（防调用方后续修改污染已构建主题，与 cloneGradientSettings 同语义）。
 * @lang en Deep-copies a semantic group (prevents external mutation polluting the built theme, same semantics
 *   as cloneGradientSettings).
 */
export function cloneSemanticTokens(tokens: SemanticTokens): SemanticTokens {
  const cloneRole = (r: RoleColor): RoleColor => ({ name: r.name, value: r.value, scale: { ...r.scale }, on: r.on });
  return { success: cloneRole(tokens.success), info: cloneRole(tokens.info), warning: cloneRole(tokens.warning), danger: cloneRole(tokens.danger) };
}
