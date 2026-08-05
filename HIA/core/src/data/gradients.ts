/**
 * @lang zh-CN 全局渐变定义与默认值：描述每个命名渐变角色（轮播/Banner/文字卡片等）的缺省配置。
 * @lang en Global gradient definitions and defaults: default config for each named gradient role (carousel/banner/text card, etc.).
 */

import type { GradientConfig, GradientSettings } from '../types.js';

/** @lang zh-CN 渐变角色定义列表（key + 中文标签 + 说明）。 @lang en Gradient role definitions (key + zh-CN label + description). */
export const GRADIENT_DEFS: Array<{ key: string; label: string; desc: string }> = [
  { key: 'carousel', label: '轮播图卡片渐变设置', desc: 'PC 轮播头图、重点展示区。默认主色深阶占大头。' },
  { key: 'banner', label: 'Banner 卡片渐变设置', desc: '活动 Banner 与次级重点入口。默认副色占大头。' },
  { key: 'textLarge', label: '文字大卡片渐变设置', desc: '欢迎区、重点说明与页面头部文字卡片。' },
  { key: 'textSmall', label: '文字小卡片渐变设置', desc: '轻提示、状态说明与辅助信息。默认浅色占大头。' },
  { key: 'metric', label: '数据强调卡片渐变设置', desc: 'KPI、重点数字与强调统计卡片。默认副色浅阶占大头。' },
  { key: 'image', label: '图片 / 缩略图渐变设置', desc: '无图占位、封面和缩略图视觉区域。' },
  { key: 'profile', label: '个人信息卡片渐变设置', desc: '小程序“我的”、用户摘要与个人中心头部。' },
  { key: 'callout', label: '提示说明卡片渐变设置', desc: '说明、帮助、提示和 Callout 区域。默认浅色占大头。' }
];

/** @lang zh-CN 渐变默认配置，键对应 GRADIENT_DEFS 的 key。 @lang en Default gradient configs keyed by GRADIENT_DEFS keys. */
export const GRADIENT_DEFAULTS: GradientSettings = {
  carousel: { enabled: true, family: 'primary', start: '700', end: '300', direction: '135deg', bias: 'front75' },
  banner: { enabled: true, family: 'secondary', start: '500', end: '200', direction: '120deg', bias: 'front65' },
  textLarge: { enabled: true, family: 'primary', start: '600', end: '200', direction: '110deg', bias: 'front65' },
  textSmall: { enabled: true, family: 'secondary', start: '100', end: '50', direction: '90deg', bias: 'end75' },
  metric: { enabled: true, family: 'secondary', start: '500', end: '200', direction: '135deg', bias: 'front65' },
  image: { enabled: true, family: 'primary', start: '400', end: '100', direction: '135deg', bias: 'front65' },
  profile: { enabled: true, family: 'primary', start: '600', end: '300', direction: '135deg', bias: 'front75' },
  callout: { enabled: true, family: 'primary', start: '50', end: '100', direction: '90deg', bias: 'end75' }
};

/**
 * @lang zh-CN 合并用户渐变设置与默认值：以默认为基础，用用户提供项逐键覆盖；bias 为 balanced 时归一为 front65。
 * @lang en Merge user gradient settings with defaults: start from defaults, override per key with user input; normalize 'balanced' bias to 'front65'.
 */
export function cloneGradientSettings(value?: GradientSettings): GradientSettings {
  // <lang zh-CN>先以默认逐键展开，确保未提供的角色也有完整配置。</lang>
  // <lang en>Expand defaults per key first, ensuring absent roles still have full config.</lang>
  const result: GradientSettings = {};
  GRADIENT_DEFS.forEach((def) => {
    const merged: GradientConfig = {
      ...GRADIENT_DEFAULTS[def.key],
      ...((value && value[def.key]) || {})
    };
    // <lang zh-CN>把历史 'balanced' 值统一映射为 front65，避免下游无对应分支。（用户值可能含非契约字符串，先按字符串比较）</lang>
    // <lang en>Map legacy 'balanced' to front65 to avoid unhandled branch downstream. (User value may carry non-contract strings; compare as string first.)</lang>
    if ((merged.bias as string) === 'balanced') merged.bias = 'front65';
    result[def.key] = merged;
  });
  return result;
}
