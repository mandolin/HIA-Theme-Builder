/**
 * @lang zh-CN 副色和谐生成：基于主色 OKLCH 色相偏移，产出一组协调的副色候选。
 * @lang en Secondary harmony generation: from the primary OKLCH hue offset, produce a set of harmonious secondary candidates.
 */

import { hexToOklch, gamutMapOklch, normalizeHex, clamp } from './convert.js';
import type { HarmonyDef } from '../types.js';

/**
 * @lang zh-CN 副色和谐方案库：类比/互补/分裂互补/三角/单色扩展等，决定色相偏移与彩度目标。
 * @lang en Secondary harmony scheme library: analogous/complementary/split-complementary/triad/mono-extension, defining hue offset and chroma target.
 */
export const HARMONY_DEFS: HarmonyDef[] = [
  { id: 'analog-cyan', name: '清透青', en: 'Clear Cyan', scheme: '类比青', offset: -35, L: 0.68, C: 0.145, note: '协调统一、科技感强；适合作为默认副色思路。' },
  { id: 'analog-violet', name: '柔紫', en: 'Soft Violet', scheme: '类比色', offset: 35, L: 0.68, C: 0.145, note: '更偏创意与前沿。' },
  { id: 'complement-gold', name: '暖琥珀', en: 'Warm Amber', scheme: '互补暖金', offset: 180, L: 0.68, C: 0.145, note: '冷暖对比清晰。' },
  { id: 'split-orange', name: '活力橙', en: 'Vivid Orange', scheme: '分裂互补', offset: 150, L: 0.67, C: 0.16, note: '活跃、适合营销入口。' },
  { id: 'split-olive', name: '橄榄金', en: 'Olive Gold', scheme: '分裂互补', offset: 210, L: 0.66, C: 0.13, note: '更克制、自然。' },
  { id: 'triad-coral', name: '珊瑚红', en: 'Coral Red', scheme: '三角色', offset: 120, L: 0.68, C: 0.155, note: '暖色强调明显。' },
  { id: 'triad-green', name: '草木绿', en: 'Botanical Green', scheme: '三角色', offset: -120, L: 0.67, C: 0.145, note: '自然、正向。' },
  { id: 'mono-blue', name: '雾霭蓝', en: 'Misty Blue', scheme: '单色扩展', offset: 0, L: 0.7, C: 0.085, note: '稳妥但区分度较弱。' },
  { id: 'muted-gold', name: '低彩金棕', en: 'Muted Gold', scheme: '互补低彩', offset: 180, L: 0.62, C: 0.095, note: '成熟、耐看。' }
];

/** @lang zh-CN 单条副色候选结果。 @lang en One secondary candidate result. */
export interface SecondaryCandidate {
  id: string;
  name: string;
  en: string;
  scheme: string;
  hex: string;
  note: string;
  offset: number;
}

/**
 * @lang zh-CN 由主色与一个和谐方案定义，推导一个副色候选（色相偏移 + 目标亮度/彩度 + 色域映射）。
 * @lang en From a primary and a harmony def, derive one secondary candidate (hue offset + target L/C + gamut map).
 */
export function harmonyCandidate(base: string, def: HarmonyDef): SecondaryCandidate {
  // <lang zh-CN>取主色 OKLCH 作为色相锚点与基准。</lang>
  // <lang en>Take primary OKLCH as hue anchor and base.</lang>
  const p = hexToOklch(base);
  // <lang zh-CN>目标亮度默认在主色基础上提亮到约 0.62–0.72，目标彩度默认略低于主色。</lang>
  // <lang en>Target L defaults to lightening the primary to ~0.62–0.72; target C defaults slightly below primary.</lang>
  const targetL = def.L ?? clamp(p.L + 0.24, 0.62, 0.72);
  const targetC = def.C ?? clamp(p.C * 0.92, 0.105, 0.17);
  // <lang zh-CN>色相按方案偏移并归一化到 0–360。</lang>
  // <lang en>Rotate hue by scheme offset, normalized to 0–360.</lang>
  const h = (p.h + def.offset + 360) % 360;
  // <lang zh-CN>色域映射得到可显示 HEX。</lang>
  // <lang en>Gamut-map to a displayable HEX.</lang>
  const mapped = gamutMapOklch(targetL, targetC, h);
  return {
    id: def.id,
    name: def.name,
    en: def.en,
    scheme: def.scheme,
    hex: mapped.hex,
    note: def.note,
    offset: def.offset
  };
}

/**
 * @lang zh-CN 生成副色候选集合；若提供 preferred（主题预设副色），则优先置顶或合并。
 * @lang en Generate the secondary candidate set; if a preferred (preset secondary) is given, prioritize or merge it to the top.
 */
export function generateSecondarySet(
  primaryHex: string,
  preferred: { hex: string; name?: string; scheme?: string } | null = null
): SecondaryCandidate[] {
  // <lang zh-CN>先按所有方案定义逐条推导候选。</lang>
  // <lang en>Derive candidates from every scheme def first.</lang>
  let arr: SecondaryCandidate[] = HARMONY_DEFS.map((d) => harmonyCandidate(primaryHex, d));
  // <lang zh-CN>若给定预设副色，则构建一条置顶候选；若已存在同色则就地升级并前移。</lang>
  // <lang en>If a preset secondary is given, build a top candidate; if an equal color exists, upgrade it in place and move to front.</lang>
  if (preferred && preferred.hex) {
    const preferItem: SecondaryCandidate = {
      id: 'preferred-secondary',
      name: preferred.name || '推荐副色',
      en: 'Recommended Secondary',
      scheme: (preferred.scheme || '主题配对') + ' · 预设',
      hex: normalizeHex(preferred.hex),
      note: '该主色对应的预设副色，用于形成完整主题色系。',
      offset: 0
    };
    const hit = arr.findIndex((x) => normalizeHex(x.hex) === preferItem.hex);
    if (hit >= 0) {
      // <lang zh-CN>命中同色：用预设信息覆盖并移到数组首位。</lang>
      // <lang en>On hit: overwrite with preset info and move to first position.</lang>
      arr[hit] = { ...arr[hit], ...preferItem };
      const t = arr.splice(hit, 1)[0];
      arr.unshift(t);
    } else {
      // <lang zh-CN>未命中：直接插入首位。</lang>
      // <lang en>If no match: insert at front directly.</lang>
      arr.unshift(preferItem);
    }
  }
  return arr;
}
