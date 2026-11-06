/**
 * @lang zh-CN 内置预设数据字典（`W-tb-P7`）：键 = 中文原文（预设名/行业/色名/备注）。
 *   仅内置预设经 t() 翻译；用户自定义预设保持用户输入原样（isBuiltinPresetId 区分）。
 *   core 数据结构零改动（"中文原文即键"策略）。
 * @lang en Built-in preset data dictionary (`W-tb-P7`): keys = exact Chinese source
 *   (preset names/industries/color names/notes). Only built-in presets go through t();
 *   user-defined presets stay verbatim (distinguished via isBuiltinPresetId).
 *   Core data structures untouched ("Chinese-as-key" strategy).
 */

import { registerStrings } from './i18n.js';
import type { StringEntry } from './i18n.js';

/**
 * @lang zh-CN 条目构造器：键即中文，zh 回填原文。
 * @lang en Entry builder: key is the Chinese text; zh mirrors it.
 */
function make(entries: Record<string, string>): Record<string, StringEntry> {
  const out: Record<string, StringEntry> = {};
  for (const key of Object.keys(entries)) out[key] = { zh: key, en: entries[key]! };
  return out;
}

/** @lang zh-CN 内置预设字典。 @lang en Built-in preset dictionary. */
const PRESETS = make({
  // ---- 预设名 ----
  'HIA 默认': 'HIA Default',
  '政务深蓝': 'Government Deep Blue',
  '医疗玉青': 'Healthcare Jade',
  '数据祖母绿': 'Data Emerald',
  'AI 未来紫': 'AI Future Purple',
  '石墨黑夜': 'Graphite Night',
  // ---- 行业 ----
  '通用平台': 'General Platform',
  '政务/国企': 'Government / SOE',
  '医疗/服务': 'Healthcare / Services',
  '数据/BI': 'Data / BI',
  'AI/创意': 'AI / Creative',
  '深色主题': 'Dark Theme',
  // ---- 色名 ----
  '钴蓝': 'Cobalt',
  '清透青': 'Clear Cyan',
  '宝石蓝': 'Sapphire',
  '砂金': 'Sand Gold',
  '玉石青': 'Jade Cyan',
  '珊瑚粉': 'Coral Pink',
  '祖母绿': 'Emerald',
  '琥珀金': 'Amber Gold',
  '未来紫': 'Future Purple',
  '亮青': 'Bright Cyan',
  '石墨黑': 'Graphite Black',
  '皇金': 'Royal Gold',
  // ---- 备注 ----
  'HIA 官方默认主题。': 'The official HIA default theme.',
  '稳重、正式、可信。': 'Steady, formal, trustworthy.',
  '亲和、清爽。': 'Friendly and fresh.',
  '增长导向、对比清楚。': 'Growth-oriented with clear contrast.',
  '前沿、醒目。': 'Cutting-edge and striking.',
  '深色主题示例。': 'Dark theme sample.'
});

registerStrings(PRESETS);
