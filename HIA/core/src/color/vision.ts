/**
 * @lang zh-CN 色觉缺陷模拟（`W-tb-P36`）：Machado & Oliveira & Fernandes 2009 模型，三种主型
 *   （红色弱 protan / 绿色弱 deutan / 蓝黄色弱 tritan）取**严重度 1.0** 的全量矩阵。
 *   变换作用于**线性 RGB**（先 gamma 解码、矩阵相乘、再编码回去）——与论文定义及
 *   DaltonLens-Python 参考实现一致；灰阶在行和 ≈1 的性质下保持不变。
 *
 *   来源登记（原则②）：Machado, Oliveira & Fernandes, "A Physiologically-based Model for
 *   Simulation of Color Vision Deficiency", IEEE Computer Graphics and Applications 25(5), 2009。
 *   矩阵转写自 DaltonLens-Python（MIT，`daltonlens/simulate.py` 的 machado_2009_matrices），
 *   该项目又转引自 colour-science 的 machado2010 数据集。本文件为**自研实现**（MIT 主库），
 *   仅复制论文发表的矩阵数值并注明出处。
 *
 *   参考对照副本：`temp/daltonlens-simulate-reference.py`（T-tb-CLEANUP 清理范围）。
 *
 * @lang en Colour-vision-deficiency simulation (`W-tb-P36`): the Machado, Oliveira & Fernandes 2009 model,
 *   three main types (protan / deutan / tritan) at **severity 1.0**. The transform applies to **linear RGB**
 *   (gamma-decode, matrix multiply, re-encode) — matching the paper and the DaltonLens-Python reference;
 *   greys are invariant because each matrix row sums to ≈1.
 *
 *   Source registry (research-first policy): Machado, Oliveira & Fernandes, "A Physiologically-based Model
 *   for Simulation of Color Vision Deficiency", IEEE CG&A 25(5), 2009. Matrix values transcribed from
 *   DaltonLens-Python (MIT, machado_2009_matrices), which in turn cites colour-science's machado2010 dataset.
 *   This file is our own implementation (MIT main repo): only the published paper values are used, credited.
 *
 *   Reference copy kept at temp/daltonlens-simulate-reference.py (T-tb-CLEANUP scope).
 */
import { hexToRgb, linearToSrgb, rgbToHex, srgbToLinear } from './convert.js';

/** @lang zh-CN 色觉模拟类型（三主型，严重度固定 1.0）。 @lang en CVD simulation types (three main ones, severity 1.0). */
export type CvdType = 'protanopia' | 'deuteranopia' | 'tritanopia';

/** @lang zh-CN 类型双语标签，供滤镜下拉直接消费。 @lang en Bilingual type labels, consumed directly by filter dropdowns. */
export const CVD_LABELS: Record<CvdType, { zh: string; en: string }> = {
  protanopia: { zh: '红色弱模拟', en: 'Protanopia preview' },
  deuteranopia: { zh: '绿色弱模拟', en: 'Deuteranopia preview' },
  tritanopia: { zh: '蓝黄色弱模拟', en: 'Tritanopia preview' }
};

/**
 * @lang zh-CN Machado 2009 severity 1.0 的 3×3 矩阵（线性 RGB → 线性 RGB）。
 *   每行和 ≈ 1，故灰阶（R=G=B）映射后仍为灰阶；行为已由单测锁定。
 * @lang en Machado 2009 severity-1.0 3×3 matrices (linear RGB → linear RGB). Rows sum to ≈1, so greys map to
 *   greys — asserted by tests.
 */
export const MACHADO_2009_SEV1: Record<CvdType, readonly [number, number, number, number, number, number, number, number, number]> = {
  protanopia: [0.152286, 1.052583, -0.204868, 0.114503, 0.786281, 0.099216, -0.003882, -0.048116, 1.051998],
  deuteranopia: [0.367322, 0.860646, -0.227968, 0.280085, 0.672501, 0.047413, -0.011820, 0.042940, 0.968881],
  tritanopia: [1.255528, -0.076749, -0.178779, -0.078411, 0.930809, 0.147602, 0.004733, 0.691367, 0.303900]
};

/**
 * @lang zh-CN 对单个 HEX 色做色觉模拟：线性空间应用矩阵后钳制、编码回 HEX。
 *   纯函数；负值钳 0、正值钳 1（矩阵可能把分量推出色域）。
 * @lang en Simulates CVD on one HEX colour: applies the matrix in linear space, clamps, re-encodes to HEX.
 *   Pure; negative channels clamp to 0 and >1 to 1 (matrices can push components out of gamut).
 */
export function simulateCvd(hex: string, type: CvdType): string {
  const [r, g, b] = hexToRgb(hex).map(srgbToLinear) as [number, number, number];
  const m = MACHADO_2009_SEV1[type];
  // 行 × 列：新通道 = 矩阵行与线性 RGB 向量的点积。
  // <lang en>New channel = dot product of a matrix row with the linear RGB vector.</lang>
  const out = [
    m[0]! * r + m[1]! * g + m[2]! * b,
    m[3]! * r + m[4]! * g + m[5]! * b,
    m[6]! * r + m[7]! * g + m[8]! * b
  ];
  return rgbToHex(out.map(linearToSrgb));
}
