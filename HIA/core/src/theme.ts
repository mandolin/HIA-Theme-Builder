/**
 * @lang zh-CN 主题整合：将最小输入 buildTheme 为完整 Theme 对象，派生色阶、前景色并合并渐变默认。
 * @lang en Theme assembly: buildTheme turns minimal input into a full Theme, deriving scales, foregrounds and merging gradient defaults.
 */

import type { Theme, ThemeInput, RoleColor } from './types.js';
import { tonalScale } from './color/scale.js';
import { bestOnColor } from './color/contrast.js';
import { normalizeHex } from './color/convert.js';
import { cloneGradientSettings } from './data/gradients.js';

/**
 * @lang zh-CN 由原始 HEX 与名称构造一个 RoleColor：派生色阶并选择最佳前景色。
 * @lang en Build a RoleColor from raw HEX and name: derive the scale and choose the best foreground.
 */
function buildRoleColor(value: string, name: string): RoleColor {
  // <lang zh-CN>先规范化输入色，再生成 50–900 色阶。</lang>
  // <lang en>Normalize the input first, then generate the 50–900 scale.</lang>
  const hex = normalizeHex(value);
  const scale = tonalScale(hex);
  // <lang zh-CN>依据色阶可读性选择前景（白或深蓝灰）。</lang>
  // <lang en>Pick foreground (white or dark slate) by scale readability.</lang>
  const on = bestOnColor(hex).hex;
  return { name: name || '主色', value: hex, scale, on };
}

/**
 * @lang zh-CN 由最小输入构建完整 Theme：主副色角色、自动命名、渐变合并。
 * @lang en Build a full Theme from minimal input: primary/secondary roles, auto name, gradient merge.
 */
export function buildTheme(input: ThemeInput): Theme {
  // <lang zh-CN>构造主色与副色角色对象。</lang>
  // <lang en>Construct primary and secondary role objects.</lang>
  const primary = buildRoleColor(input.primary, input.primaryName || '主色');
  const secondary = buildRoleColor(input.secondary, input.secondaryName || '副色');
  // <lang zh-CN>主题名缺省时，由“主色名·副色名”合成（与原始工具一致）。</lang>
  // <lang en>When name is omitted, synthesize "主色名·副色名" (matching the original tool).</lang>
  const name = input.name || `${primary.name}·${secondary.name}`;
  // <lang zh-CN>合并渐变设置：用户未提供则用全局默认。</lang>
  // <lang en>Merge gradient settings: use global defaults when user omits them.</lang>
  const gradients = cloneGradientSettings(input.gradients);
  return {
    name,
    category: input.category || 'custom',
    industry: input.industry || '',
    primary,
    secondary,
    gradients,
    note: input.note
  };
}
