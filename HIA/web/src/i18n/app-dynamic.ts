/**
 * @lang zh-CN app.ts 动态文案字典（`W-tb-P7`）：键 = 中文原文（与 core 数据 label/desc 精确一致）。
 *   core 的 GRADIENT_DEFS label/desc、方向/占比标签、预设操作词、取色阶段文案等在渲染时经 `t()` 取词；
 *   采用"中文原文即键"策略，core 数据结构零改动（V1 契约不受影响）。
 * @lang en app.ts dynamic-text dictionary (`W-tb-P7`): keys = exact Chinese source (matching core
 *   data label/desc verbatim). Core GRADIENT_DEFS labels/descs, direction/bias labels, preset actions
 *   and exploration stage texts go through `t()` at render time; the "Chinese-as-key" strategy keeps
 *   core data structures untouched (V1 contract unaffected).
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

/** @lang zh-CN app 动态文案字典。 @lang en app dynamic-text dictionary. */
const APP_DYNAMIC = make({
  // ---- 渐变定义（与 core GRADIENT_DEFS label 精确一致） ----
  '轮播图卡片渐变设置': 'Carousel Card Gradient',
  'PC 轮播头图、重点展示区。默认主色深阶占大头。': 'PC carousel hero and showcase areas. Dominant dark primary shades by default.',
  'Banner 卡片渐变设置': 'Banner Card Gradient',
  '活动 Banner 与次级重点入口。默认副色占大头。': 'Campaign banners and secondary key entries. Dominant secondary shades by default.',
  '文字大卡片渐变设置': 'Large Text Card Gradient',
  '欢迎区、重点说明与页面头部文字卡片。': 'Welcome areas, key notes and page-header text cards.',
  '文字小卡片渐变设置': 'Small Text Card Gradient',
  '轻提示、状态说明与辅助信息。默认浅色占大头。': 'Light notes, status captions and auxiliary info. Dominant light shades by default.',
  '数据强调卡片渐变设置': 'Metric Emphasis Card Gradient',
  'KPI、重点数字与强调统计卡片。默认副色浅阶占大头。': 'KPIs, key figures and emphasis stat cards. Dominant light secondary shades by default.',
  '图片 / 缩略图渐变设置': 'Image / Thumbnail Gradient',
  '无图占位、封面和缩略图视觉区域。': 'Image placeholders, covers and thumbnail visuals.',
  '个人信息卡片渐变设置': 'Profile Card Gradient',
  '小程序“我的”、用户摘要与个人中心头部。': 'Mini-Program profile, user summaries and personal-center headers.',
  '提示说明卡片渐变设置': 'Callout Card Gradient',
  '说明、帮助、提示和 Callout 区域。默认浅色占大头。': 'Notes, help, tips and callout areas. Dominant light shades by default.',
  // ---- 渐变配置面板词 ----
  '启用': 'Enabled',
  '色系': 'Family',
  '方向': 'Direction',
  '起始色阶': 'Start Shade',
  '结束色阶': 'End Shade',
  '渐变占比': 'Gradient Bias',
  '交换': 'Swap',
  '重置': 'Reset',
  '主色系': 'Primary family',
  '副色系': 'Secondary family',
  '主色': 'Primary',
  '副色': 'Secondary',
  // ---- 方向标签（与 app.ts directionLabels 一致） ----
  '向右': 'To right',
  '向左': 'To left',
  '向下': 'Downward',
  '向上': 'Upward',
  '右下对角': 'Diagonal to bottom-right',
  '左上对角': 'Diagonal to top-left',
  // ---- 占比标签（与 app.ts biasLabels 精确一致） ----
  '前色占 75%': 'First color 75%',
  '前色占 65%': 'First color 65%',
  '后色占 65%': 'Second color 65%',
  '后色占 75%': 'Second color 75%',
  // ---- 预设卡片 ----
  '应用': 'Apply',
  '载入操作台': 'Load to Console',
  '删除': 'Delete',
  '当前': 'Current',
  '未分类': 'Uncategorized',
  // ---- 操作反馈 ----
  '已复制 CSS Token 到剪贴板': 'CSS tokens copied to clipboard',
  '已复制 JSON Token 到剪贴板': 'JSON tokens copied to clipboard',
  '复制失败，请手动选择文本复制': 'Copy failed; please select and copy manually',
  '已应用主题预设': 'Theme preset applied',
  '已载入预设到操作台（未应用）': 'Preset loaded to console (not applied)',
  '已删除自定义预设': 'Custom preset deleted',
  '已生成并导入主题库': 'Generated and imported into the library',
  '已更新预设': 'Preset updated',
  '已生成自动命名': 'Auto name generated',
  '已生成副色候选，可在副色候选区挑选': 'Secondary candidates generated; pick one in the secondary area',
  // ---- 副色生成状态 ----
  '将基于当前主色生成一组副色候选；若当前主色在候选库中，则优先给出其预设副色。': 'Generates secondary candidates from the current primary; if the primary exists in the candidate library, its preset secondary comes first.',
  '正在基于主色生成副色候选…': 'Generating secondary candidates from the primary…',
  // ---- 取色探索阶段（与 app.ts stageText 精确一致） ----
  '等待输入网址': 'Waiting for a URL',
  '正在渲染与分析…': 'Rendering & analyzing…',
  '已生成推荐主题': 'Recommended theme generated',
  '已生成（静态降级，置信度受限）': 'Generated (static degraded; confidence capped)',
  '探索失败': 'Exploration failed',
  // ---- 取色面板 ----
  '协调生成': 'Harmony-derived',
  '由主色协调生成，非网页原始颜色': 'Derived via color harmony, not an original page color',
  '推荐主色': 'Recommended Primary',
  '推荐副色': 'Recommended Secondary',
  '置信度': 'Confidence',
  '分析理由': 'Reasons',
  '警告': 'Warnings',
  '候选色': 'Candidates',
  '应用主副色': 'Apply Primary & Secondary',
  '深色模式主色': 'Dark-mode Primary',
  'logo 颜色': 'Logo Colors',
  '未检测到 logo': 'No logo detected',
  '探索失败：': 'Exploration failed: ',
  // ---- 布局/外观标签（updatePreviewMeta） ----
  '左右结构': 'Sidebar Layout',
  '上下结构': 'Top-Nav Layout',
  '混合工作台': 'Mixed Workbench',
  '浅色模式': 'Light Mode',
  '深色模式': 'Dark Mode',
  // ---- 确认对话框（原生 alert/confirm 文案） ----
  '确认删除自定义预设？': 'Delete this custom preset?',
  '确认恢复全部渐变为默认？': 'Reset all gradients to defaults?'
});

registerStrings(APP_DYNAMIC);
