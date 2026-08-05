/**
 * @lang zh-CN 主题 Token 的 JSON 导出：把 Theme 序列化为结构化 JSON 字符串，供程序化消费。
 * @lang en JSON export of theme tokens: serialize a Theme to structured JSON string for programmatic consumption.
 */

import type { Theme } from '../types.js';

/**
 * @lang zh-CN 将 Theme 导出为带缩进的 JSON 字符串，含角色色阶、前景色与渐变设置。
 * @lang en Export a Theme to an indented JSON string with role scales, foreground colors and gradient settings.
 */
export function exportThemeJson(theme: Theme): string {
  // <lang zh-CN>构造与原始工具一致的 JSON 结构，便于下游平滑迁移。</lang>
  // <lang en>Build the same JSON shape as the original tool for smooth downstream migration.</lang>
  return JSON.stringify(
    {
      name: theme.name,
      category: theme.category,
      industry: theme.industry || '',
      primary: {
        name: theme.primary.name,
        value: theme.primary.value,
        scale: theme.primary.scale,
        on: theme.primary.on
      },
      secondary: {
        name: theme.secondary.name,
        value: theme.secondary.value,
        scale: theme.secondary.scale,
        on: theme.secondary.on
      },
      gradients: theme.gradients
    },
    null,
    2
  );
}
