// @lang zh-CN 图片提色（`W-tb-P39`/ADR-014）：tab 文案、模式标签、隐私声明与状态行。
// <lang en>Image extraction (`W-tb-P39`/ADR-014): tab copy, mode labels, privacy note and status lines.</lang>
import{registerStrings}from'./i18n.js';

registerStrings({
  'p39.tab': { zh: '图片提色', en: 'From image' },
  'p39.badge': { zh: 'Image', en: 'Image' },
  'p39.pick': { zh: '选择图片…', en: 'Pick an image…' },
  'p39.mode.aria': { zh: '提取模式', en: 'Extraction mode' },
  'p39.mode.balanced': { zh: '均衡（按占比）', en: 'Balanced (by share)' },
  'p39.mode.vivid': { zh: '鲜色优先', en: 'Vivid first' },
  'p39.mode.bright': { zh: '明亮优先', en: 'Bright first' },
  'p39.mode.dark': { zh: '深色优先', en: 'Dark first' },
  'p39.privacy': { zh: '🔒 图片仅在本机解析与计算，不上传。', en: '🔒 Images are decoded and computed locally — never uploaded.' },
  'p39.empty': { zh: '未能从该图提取到颜色（全透明或纯透明图）。', en: 'No colours could be extracted (fully transparent image).' },
  'p39.badfile': { zh: '图片无法解码——请换 PNG/JPEG/WebP 等常见格式。', en: 'The image could not be decoded — try a common format like PNG/JPEG/WebP.' },
  'p39.done': { zh: '已提取 {n} 个候选——点击色卡套用主题。', en: 'Extracted {n} candidates — click a card to apply.' },
  'p39.card.title': { zh: '{name} · 像素计票 {pop}', en: '{name} · {pop} pixels' },
  'p39.card.share': { zh: '占比 {p}%', en: '{p}% share' },
  'p39.gradient.title': { zh: '渐变提取', en: 'Gradient extraction' },
  'p39.gradient.apply': { zh: '应用为轮播渐变', en: 'Apply as carousel gradient' },
  'p39.gradient.applied': { zh: '渐变已应用到轮播（可在渐变设置区继续调整）。', en: 'Gradient applied to the carousel (tweak it in Gradient Settings).' }
});
