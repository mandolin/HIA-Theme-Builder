/**
 * @lang zh-CN APCA（Accessible Perceptual Contrast Algorithm）Lc 对比度副指标（`W-tb-P36`）。
 *
 *   **定位（重要）**：仅作为**参考值**并列展示，不替代 WCAG 2.2 AA 合规基线。
 *   截至 2026-11，WCAG 3.0 仍是 W3C Working Draft（最新 2026-09-10），对比度算法未定案，
 *   APCA 已被移出草案探索流程——故本实现输出**不得**用于合规判定，只用于专业参考读数。
 *
 *   **实现与来源**：按 Myndex/apca-w3 **APCA 0.1.9（W3 版，SA98G 常量组）**自研实现，
 *   常量与分支逻辑逐条对照参考实现 `temp/apca-w3-reference.js`（T-tb-CLEANUP 清理范围）。
 *   未复制其代码文件，仅按其公开文档/源码记载的公式与常量重新表达。
 *   许可注意：apca-w3 采用 W3 License（限 WCAG 无障碍语境使用）——本项目仅在
 *   无障碍参考读数语境下使用并署名，不用于其他用途；已登记 WorkZone 台账。
 *
 *   极性约定：正值 = 深色文字在浅色背景（BoW）；**负值 = 浅色文字在深色背景（WoB）**。
 *   这是 APCA 的原设计（极性本身携带信息），UI 展示时取绝对值并标出极性方向。
 *
 * @lang en APCA (Accessible Perceptual Contrast Algorithm) Lc secondary metric (`W-tb-P36`).
 *
 *   **Position (important)**: reference readout only — it never replaces the WCAG 2.2 AA compliance baseline.
 *   As of 2026-11 WCAG 3.0 is still a W3C Working Draft (latest 2026-09-10) with the contrast algorithm
 *   undecided, and APCA was removed from the draft's exploratory process — so this output must not be used
 *   for compliance, only as a professional reference value.
 *
 *   **Implementation & source**: re-implemented from Myndex/apca-w3 **APCA 0.1.9 (W3, SA98G constants)**,
 *   constants and branches cross-checked against the reference copy temp/apca-w3-reference.js
 *   (T-tb-CLEANUP scope). Their code file is not copied; the published formula/constants are re-expressed.
 *   Licence note: apca-w3 ships a W3 Licence (WCAG accessibility context only) — this project uses it solely
 *   as an accessibility reference readout with attribution, registered in the WorkZone ledger.
 *
 *   Polarity: positive = dark text on light background (BoW); **negative = light text on dark (WoB)** —
 *   APCA's own convention; the UI shows the absolute value plus the polarity direction.
 */

// SA98G 常量组（APCA 0.0.98G-4g，W3 版）：与参考实现逐值一致，勿擅自调整——
//   这些是拟合自视觉实验的拟合常数，改动即失去与参考值可比性。
// <lang en>SA98G constant set (APCA 0.0.98G-4g, W3): identical to the reference implementation; do not tweak —
//   these are experiment-fitted constants and changing them breaks comparability with reference values.</lang>
const SA98G = {
  /** @lang zh-CN 显示器感知幂指数。 @lang en Monitor perception exponent. */
  mainTRC: 2.4,
  /** @lang zh-CN sRGB 感知亮度系数（注意与 WCAG 线性权重不同，总和略大于 1，属算法设计）。 @lang en sRGB Y coefficients (deliberately differ from WCAG weights; sum slightly > 1 by design). */
  sRco: 0.2126729, sGco: 0.7151522, sBco: 0.0721750,
  /** @lang zh-CN 正常/反极性幂指数（背景/文字各一）。 @lang en Normal/reverse polarity exponents for bg/text. */
  normBG: 0.56, normTXT: 0.57, revTXT: 0.62, revBG: 0.65,
  /** @lang zh-CN 黑级软钳阈值与指数。 @lang en Black soft-clamp threshold and exponent. */
  blkThrs: 0.022, blkClmp: 1.414,
  /** @lang zh-CN 两种极性的缩放系数。 @lang en Scale factors for both polarities. */
  scaleBoW: 1.14, scaleWoB: 1.14,
  /** @lang zh-CN 低对比滚出偏移。 @lang en Low-contrast rollout offsets. */
  loBoWoffset: 0.027, loWoBoffset: 0.027,
  /** @lang zh-CN 极低 ΔY 早退阈值与低对比裁剪点。 @lang en Minimum ΔY early-return and low-contrast clip. */
  deltaYmin: 0.0005, loClip: 0.1
} as const;

/**
 * @lang zh-CN HEX → APCA 感知亮度 Y：按 2.4 幂指数线性化后以 sRco/sGco/sBco 加权求和。
 *   与 WCAG 亮度（线性加权）不同：APCA 直接对**编码值**取幂，不做 0.04045 分段。
 * @lang en HEX → APCA perceptual Y: power-2.4 per encoded channel, weighted by sRco/sGco/sBco.
 *   Unlike WCAG luminance (linear weights), APCA raises the encoded value directly — no 0.04045分段 branch.
 */
export function apcaY(hex: string): number {
  const value = hex.replace('#', '');
  const chan = (i: number) => Math.pow(parseInt(value.slice(i, i + 2), 16) / 255.0, SA98G.mainTRC);
  return SA98G.sRco * chan(0) + SA98G.sGco * chan(2) + SA98G.sBco * chan(4);
}

/**
 * @lang zh-CN 计算 APCA Lc 对比度（带符号，×100 记法）。参数顺序不可交换：**先文字色后背景色**。
 *   实现逐条对照参考实现：黑级软钳 → ΔY 早退 → 极性分支 → 低对比裁剪 → ×100。
 * @lang en Computes the signed APCA Lc contrast (×100 notation). Argument order matters: **text colour first,
 *   background second**. Mirrors the reference implementation step by step: black soft clamp → ΔY early
 *   return → polarity branch → low-contrast clip → ×100.
 */
export function apcaLc(textHex: string, bgHex: string): number {
  // 黑级软钳：接近黑的 Y 抬回可视范围，避免对纯黑过度惩罚。
  // <lang en>Black soft clamp lifts near-black Y back into range so pure black is not over-penalised.</lang>
  let txtY = apcaY(textHex);
  let bgY = apcaY(bgHex);
  txtY = txtY > SA98G.blkThrs ? txtY : txtY + Math.pow(SA98G.blkThrs - txtY, SA98G.blkClmp);
  bgY = bgY > SA98G.blkThrs ? bgY : bgY + Math.pow(SA98G.blkThrs - bgY, SA98G.blkClmp);
  // ΔY 极小视作不可分辨，返回 0。
  // <lang en>Negligible ΔY reads as indistinguishable — return 0.</lang>
  if (Math.abs(bgY - txtY) < SA98G.deltaYmin) return 0.0;

  if (bgY > txtY) {
    // 正常极性（BoW）：深字浅底。SAPC 低于低对比裁剪点时平滑归零，防止极性翻转噪声。
    // <lang en>Normal polarity (BoW), dark text on light bg; below the low-clip the result rolls off to 0
    //   to prevent polarity-flip noise.</lang>
    const sapc = (Math.pow(bgY, SA98G.normBG) - Math.pow(txtY, SA98G.normTXT)) * SA98G.scaleBoW;
    return (sapc < SA98G.loClip ? 0.0 : sapc - SA98G.loBoWoffset) * 100.0;
  }
  // 反极性（WoB）：浅字深底，结果恒为负值（极性信息）。
  // <lang en>Reverse polarity (WoB), light text on dark bg; always negative — the polarity carries meaning.</lang>
  const sapc = (Math.pow(bgY, SA98G.revBG) - Math.pow(txtY, SA98G.revTXT)) * SA98G.scaleWoB;
  return (sapc > -SA98G.loClip ? 0.0 : sapc + SA98G.loWoBoffset) * 100.0;
}
