/**
 * @lang zh-CN 内置主题预设（6 个）：默认、政务、医疗、数据、AI、深色。供主题库快速载入。
 * @lang en Built-in theme presets (6): default, government, medical, data, AI, dark. For quick theme-library loading.
 */

import type { Preset } from '../types.js';

/**
 * @lang zh-CN 内置预设数组，原样移植自单文件工具；gradients 字段在 buildTheme 时若缺失则用全局默认填充。
 * @lang en Built-in preset array, ported as-is from the single-file tool; gradients filled by global defaults in buildTheme if absent.
 */
export const builtinPresets: Preset[] = [
  { id: 'preset-default', name: 'HIA 默认', category: 'default', industry: '通用平台', primary: '#0047AB', secondary: '#00A8D3', primaryName: '钴蓝', secondaryName: '清透青', note: 'HIA 官方默认主题。' },
  { id: 'preset-gov', name: '政务深蓝', category: 'industry', industry: '政务/国企', primary: '#0F52BA', secondary: '#D8B26E', primaryName: '宝石蓝', secondaryName: '砂金', note: '稳重、正式、可信。' },
  { id: 'preset-medical', name: '医疗玉青', category: 'industry', industry: '医疗/服务', primary: '#14B8A6', secondary: '#FB7185', primaryName: '玉石青', secondaryName: '珊瑚粉', note: '亲和、清爽。' },
  { id: 'preset-data', name: '数据祖母绿', category: 'industry', industry: '数据/BI', primary: '#10B981', secondary: '#F59E0B', primaryName: '祖母绿', secondaryName: '琥珀金', note: '增长导向、对比清楚。' },
  { id: 'preset-ai', name: 'AI 未来紫', category: 'industry', industry: 'AI/创意', primary: '#7C3AED', secondary: '#22D3EE', primaryName: '未来紫', secondaryName: '亮青', note: '前沿、醒目。' },
  { id: 'preset-dark', name: '石墨黑夜', category: 'dark', industry: '深色主题', primary: '#111827', secondary: '#EAB308', primaryName: '石墨黑', secondaryName: '皇金', note: '深色主题示例。' }
];
