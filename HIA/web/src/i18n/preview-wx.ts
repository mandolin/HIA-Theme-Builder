/**
 * @lang zh-CN 小程序示例预览演示内容字典（`W-tb-P7`）：键 = 中文原文（精确匹配，trim 后）。
 *   由 `translateTextNodes` 按文本节点遍历翻译；结构与 preview-pc.ts 一致。
 * @lang en Mini-Program sample preview demo dictionary (`W-tb-P7`): keys = exact Chinese source text
 *   (trimmed). Translated per text node by `translateTextNodes`; same structure as preview-pc.ts.
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

/** @lang zh-CN 小程序演示内容字典。 @lang en Mini-Program demo content dictionary. */
const PREVIEW_WX = make({
  'HIA 小程序示例': 'HIA Mini-Program Sample',
  '欢迎回来': 'Welcome Back',
  '当前主题已同步到小程序示例首页。': 'The current theme is synced to the Mini-Program home page.',
  '搜索项目、商品、文章、活动…': 'Search projects, products, articles, events…',
  '张三': 'Zhang San',
  '项目': 'Projects',
  '报表': 'Reports',
  '订单': 'Orders',
  '我的': 'Profile',
  '主题活动 Banner': 'Campaign Banner',
  '推荐内容': 'Recommended',
  '更多 >': 'More >',
  '业务主题示例项目': 'Business Theme Sample Project',
  '包含卡片、标签、按钮、进度等组件。': 'Cards, tags, buttons, progress and more.',
  '查看': 'View',
  '收藏': 'Favorite',
  '企业小程序模版': 'Enterprise Mini-Program Template',
  '包含首页、列表、详情、我的等页面。': 'Home, list, detail, profile and more pages.',
  '体验': 'Try It',
  '分享': 'Share',
  '128 条': '128 items',
  '全部': 'All',
  '已上架': 'Published',
  '已归档': 'Archived',
  '课题招募项目 A': 'Research Program A',
  '支持筛选、状态标识、卡片按钮。': 'Filters, status tags and card buttons.',
  '课题招募项目 B': 'Research Program B',
  '适合展示活动、服务、产品或文章列表。': 'For events, services, products or article lists.',
  '课题招募项目 C': 'Research Program C',
  '主题切换时主副色会同步刷新。': 'Primary/secondary refresh on theme switch.',
  '详情主视觉': 'Detail Hero Visual',
  '主题详情展示模块': 'Theme Detail Showcase',
  '用于观察标题、图文、状态标签、操作按钮和说明文字在不同主题下的表现。': 'Observe titles, imagery, status tags, action buttons and notes across themes.',
  '立即预约': 'Book Now',
  '咨询客服': 'Contact Support',
  '详情参数': 'Detail Parameters',
  '开放时间': 'Opening Hours',
  '周一 ~ 周五': 'Mon – Fri',
  '当前主题': 'Current Theme',
  '副色用途': 'Secondary Usage',
  '关键按钮 / 标签 / 数据强调': 'Key buttons / tags / data emphasis',
  '高级会员 · 已认证': 'Premium Member · Verified',
  '优惠券': 'Coupons',
  '消息': 'Messages',
  '待办': 'To-dos',
  '我的订单': 'My Orders',
  '主题设置': 'Theme Settings',
  '帮助与反馈': 'Help & Feedback',
  '关于我们': 'About Us',
  '预约 / 提交': 'Booking / Submit',
  '姓名': 'Name',
  '手机号': 'Phone',
  '服务类型': 'Service Type',
  '企业系统咨询': 'Enterprise System Consulting',
  '主题定制': 'Theme Customization',
  '课题报名': 'Program Enrollment',
  '预约时间': 'Booking Time',
  '留言': 'Message',
  '这里用于覆盖输入框、下拉框、文本域和提交按钮等表单组件。': 'Covers inputs, selects, textareas and submit buttons.',
  '提交': 'Submit',
  '保存草稿': 'Save Draft',
  '重置': 'Reset',
  '分类': 'Categories',
  '发布': 'Post',
  '首页': 'Home',
  '表单页': 'Form',
  '详情页': 'Detail',
  '列表页': 'List',
  '进行中': 'In Progress'
});

registerStrings(PREVIEW_WX);
