/**
 * @lang zh-CN 主色候选库（44 色）：含 HIA 默认、蓝色基准、获奖网站主色与通用流行主题色。
 * @lang en Primary color candidate library (44 colors): HIA defaults, blue bases, award-site primaries and popular theme colors.
 */

import type { PrimaryCandidate } from '../types.js';

/**
 * @lang zh-CN 主色候选数组，原样移植自单文件工具；每项附预设副色，用于一键套用主题配对。
 * @lang en Primary candidate array, ported as-is from the single-file tool; each carries a preset secondary for one-click theme pairing.
 */
export const primaryCandidates: PrimaryCandidate[] = [
  { id: 'cobalt', name: '钴蓝', en: 'Cobalt Blue', hex: '#0047AB', tag: '默认主题', group: 'HIA 默认与蓝色基准', desc: 'HIA 默认主题主色。', secondaryName: '清透青', secondaryHex: '#00A8D3', secondaryScheme: '类比青 · 定稿', category: 'default' },
  { id: 'sapphire', name: '宝石蓝', en: 'Sapphire Blue', hex: '#0F52BA', tag: '蓝色基准', group: 'HIA 默认与蓝色基准', desc: '柔和、品牌感强。', secondaryName: '晨雾青', secondaryHex: '#3EC6D3', secondaryScheme: '类比青', category: 'business' },
  { id: 'hia-bright', name: 'HIA 亮蔚蓝', en: 'HIA Bright Cerulean', hex: '#147BD1', tag: '蓝色基准', group: 'HIA 默认与蓝色基准', desc: '现代、清快。', secondaryName: '海沫青', secondaryHex: '#35C6D8', secondaryScheme: '类比青', category: 'saas' },
  { id: 'clear-sky', name: '澄空蓝', en: 'Clear Sky Blue', hex: '#1976D2', tag: '蓝色基准', group: 'HIA 默认与蓝色基准', desc: '通用产品蓝。', secondaryName: '清风青', secondaryHex: '#2FC6D1', secondaryScheme: '类比青', category: 'saas' },
  { id: 'digital-blue', name: '数字蓝', en: 'Digital Blue', hex: '#1677FF', tag: '蓝色基准', group: 'HIA 默认与蓝色基准', desc: '抓力强。', secondaryName: '电光青', secondaryHex: '#00C2E0', secondaryScheme: '类比青', category: 'creative' },
  { id: 'azure', name: '天青蓝', en: 'Azure', hex: '#007FFF', tag: '蓝色基准', group: 'HIA 默认与蓝色基准', desc: '通透高亮。', secondaryName: '薄荷青', secondaryHex: '#23D3CF', secondaryScheme: '类比青', category: 'creative' },
  { id: 'french-blue', name: '法兰西蓝', en: 'French Blue', hex: '#0072BB', tag: '蓝色基准', group: 'HIA 默认与蓝色基准', desc: '冷静、专业。', secondaryName: '孔雀青', secondaryHex: '#1CB7B1', secondaryScheme: '类比青', category: 'enterprise' },
  { id: 'royal-blue', name: '皇家蓝', en: 'Royal Blue', hex: '#4169E1', tag: '蓝色基准', group: 'HIA 默认与蓝色基准', desc: '偏紫蓝，张力更强。', secondaryName: '柔紫青', secondaryHex: '#5ED0FF', secondaryScheme: '分裂互补', category: 'creative' },
  { id: 'c2-blue', name: 'C2 高亮蓝', en: 'C2 Montréal Blue', hex: '#177AEE', tag: '获奖蓝', group: 'HIA 默认与蓝色基准', desc: 'Awwwards 参考。', secondaryName: '活力青', secondaryHex: '#19C7FF', secondaryScheme: '类比青', category: 'award' },
  { id: 'lusion-blue', name: 'Lusion 电光蓝', en: 'Lusion Electric Blue', hex: '#1A2FFB', tag: '获奖蓝', group: 'HIA 默认与蓝色基准', desc: '电光感强。', secondaryName: '霓虹青', secondaryHex: '#38D8FF', secondaryScheme: '分裂互补', category: 'award' },
  { id: 'permian-blue', name: 'Permian 蓝', en: 'Permian Blue', hex: '#1F35F9', tag: '获奖蓝', group: 'HIA 默认与蓝色基准', desc: '前沿时尚。', secondaryName: '亮湖青', secondaryHex: '#4FD5FF', secondaryScheme: '分裂互补', category: 'award' },
  { id: 'deep-azure', name: '深天蓝', en: 'Deep Azure', hex: '#005BBB', tag: '蓝色基准', group: 'HIA 默认与蓝色基准', desc: '稳健、通用。', secondaryName: '远海青', secondaryHex: '#22B8D6', secondaryScheme: '类比青', category: 'enterprise' },
  { id: 'award-lando-norris', name: 'Lando Norris', en: 'Awwwards SOTY 2025', hex: '#D2FF00', tag: '获奖网站', group: '获奖网站主色', desc: '荧光黄绿。', secondaryName: '深碳蓝', secondaryHex: '#122033', secondaryScheme: '高对比深辅色', category: 'award' },
  { id: 'award-messenger', name: 'Messenger', en: 'Awwwards SOTY 2025', hex: '#81BFBC', tag: '获奖网站', group: '获奖网站主色', desc: '柔和水绿。', secondaryName: '雾海军蓝', secondaryHex: '#446179', secondaryScheme: '低彩互补', category: 'award' },
  { id: 'award-igloo-inc', name: 'Igloo Inc', en: 'Awwwards SOTY 2024', hex: '#383E4E', tag: '获奖网站', group: '获奖网站主色', desc: '冷灰深蓝。', secondaryName: '冰川青', secondaryHex: '#A9D6E5', secondaryScheme: '冷暖平衡', category: 'award' },
  { id: 'award-dont-board-me', name: "Don't Board Me", en: 'Awwwards SOTY 2024', hex: '#E33529', tag: '获奖网站', group: '获奖网站主色', desc: '强烈红橙。', secondaryName: '粉雾蓝', secondaryHex: '#AFD8FB', secondaryScheme: '互补配对', category: 'award' },
  { id: 'award-opal-tadpole', name: 'Opal Tadpole', en: 'Awwwards SOTY 2024', hex: '#FFDB01', tag: '获奖网站', group: '获奖网站主色', desc: '高亮黄。', secondaryName: '墨蓝黑', secondaryHex: '#1F2937', secondaryScheme: '高对比深辅色', category: 'award' },
  { id: 'award-lusion-v3', name: 'Lusion v3', en: 'Awwwards SOTY 2023', hex: '#1A2FFB', tag: '获奖网站', group: '获奖网站主色', desc: '高饱和电光蓝。', secondaryName: '冰电青', secondaryHex: '#66E3FF', secondaryScheme: '类比青', category: 'award' },
  { id: 'award-noomo-agency', name: 'Noomo Agency', en: 'Awwwards SOTY 2023', hex: '#DEE7F1', tag: '获奖网站', group: '获奖网站主色', desc: '极浅冷蓝灰。', secondaryName: '雾靛蓝', secondaryHex: '#6B7DAE', secondaryScheme: '低彩配对', category: 'award' },
  { id: 'award-mana', name: 'Mana Yerba Mate', en: 'Awwwards SOTY 2023', hex: '#F15B40', tag: '获奖网站', group: '获奖网站主色', desc: '珊瑚橙红。', secondaryName: '柠檬黄', secondaryHex: '#FFD372', secondaryScheme: '类比暖色', category: 'award' },
  { id: 'award-atoll', name: 'Atoll Digital', en: 'Awwwards SOTD 2025', hex: '#091423', tag: '获奖网站', group: '获奖网站主色', desc: '深墨蓝。', secondaryName: '工业天青', secondaryHex: '#5BC0EB', secondaryScheme: '高对比冷辅色', category: 'award' },
  { id: 'award-wix-pantone', name: 'Wix × Pantone', en: 'Awwwards SOTD 2025', hex: '#A47864', tag: '获奖网站', group: '获奖网站主色', desc: '摩卡棕。', secondaryName: '鼠尾草绿', secondaryHex: '#B8C1A0', secondaryScheme: '自然互补', category: 'award' },
  { id: 'award-permian', name: 'Permian', en: 'Awwwards SOTD 2025', hex: '#1F35F9', tag: '获奖网站', group: '获奖网站主色', desc: '高饱和蓝。', secondaryName: '流光青', secondaryHex: '#59D4FF', secondaryScheme: '类比青', category: 'award' },
  { id: 'award-radaville', name: 'Radaville', en: 'Awwwards SOTD 2025', hex: '#995536', tag: '获奖网站', group: '获奖网站主色', desc: '陶土棕。', secondaryName: '暖沙米', secondaryHex: '#E4C9A0', secondaryScheme: '同调延展', category: 'award' },
  { id: 'award-untold', name: 'Untold', en: 'Awwwards SOTD 2025', hex: '#FF5623', tag: '获奖网站', group: '获奖网站主色', desc: '亮橙。', secondaryName: '海湾青', secondaryHex: '#2EC4B6', secondaryScheme: '互补配对', category: 'award' },
  { id: 'award-sunday', name: 'Sunday', en: 'Awwwards SOTD 2025', hex: '#F7E731', tag: '获奖网站', group: '获奖网站主色', desc: '鲜亮黄。', secondaryName: '近黑灰', secondaryHex: '#1A1A1A', secondaryScheme: '高对比深辅色', category: 'award' },
  { id: 'award-kaleida', name: 'Kaleida', en: 'Awwwards SOTD 2025', hex: '#4B00FF', tag: '获奖网站', group: '获奖网站主色', desc: '高饱和紫蓝。', secondaryName: '电光青', secondaryHex: '#00D9FF', secondaryScheme: '分裂互补', category: 'award' },
  { id: 'award-meta-rayban', name: 'Meta Ray-Ban Display', en: 'Awwwards HM 2025', hex: '#49687C', tag: '获奖网站', group: '获奖网站主色', desc: '蓝灰。', secondaryName: '砂金', secondaryHex: '#D8B26E', secondaryScheme: '互补低彩', category: 'award' },
  { id: 'award-rey', name: 'Rey Del Istmo', en: 'Awwwards HM 2025', hex: '#5D0C0E', tag: '获奖网站', group: '获奖网站主色', desc: '深酒红。', secondaryName: '陈年金', secondaryHex: '#B78E5E', secondaryScheme: '类比暖金', category: 'award' },
  { id: 'award-c2', name: 'C2 Montréal', en: 'Awwwards SOTD 2023', hex: '#177AEE', tag: '获奖网站', group: '获奖网站主色', desc: '高亮蓝。', secondaryName: '赛博青', secondaryHex: '#00C2FF', secondaryScheme: '类比青', category: 'award' },
  { id: 'award-kommo', name: 'Kommo', en: 'Awwwards HM 2023', hex: '#6043D0', tag: '获奖网站', group: '获奖网站主色', desc: '紫蓝。', secondaryName: '薄荷水绿', secondaryHex: '#7FDBCA', secondaryScheme: '分裂互补', category: 'award' },
  { id: 'award-boba', name: 'Boba Ice Cream', en: 'Awwwards SOTD 2023', hex: '#F4B9C8', tag: '获奖网站', group: '获奖网站主色', desc: '柔粉。', secondaryName: '蜂蜜黄', secondaryHex: '#FFD864', secondaryScheme: '类比暖色', category: 'award' },
  { id: 'trend-emerald', name: '祖母绿', en: 'Emerald', hex: '#10B981', tag: '流行色', group: '通用流行主题色', desc: '常见 SaaS / 数据平台色。', secondaryName: '琥珀金', secondaryHex: '#F59E0B', secondaryScheme: '三角色', category: 'industry' },
  { id: 'trend-violet', name: '未来紫', en: 'Future Violet', hex: '#7C3AED', tag: '流行色', group: '通用流行主题色', desc: 'AI / 创意产品常用。', secondaryName: '亮青', secondaryHex: '#22D3EE', secondaryScheme: '分裂互补', category: 'industry' },
  { id: 'trend-fuchsia', name: '品红紫', en: 'Fuchsia', hex: '#D946EF', tag: '流行色', group: '通用流行主题色', desc: '高辨识度的创意主题。', secondaryName: '亮靛蓝', secondaryHex: '#2563EB', secondaryScheme: '类比延展', category: 'industry' },
  { id: 'trend-coral', name: '珊瑚红', en: 'Coral', hex: '#FF6B6B', tag: '流行色', group: '通用流行主题色', desc: '亲和、内容型和消费类产品常用。', secondaryName: '海盐青', secondaryHex: '#14B8A6', secondaryScheme: '互补配对', category: 'industry' },
  { id: 'trend-tangerine', name: '橘焰橙', en: 'Tangerine', hex: '#F97316', tag: '流行色', group: '通用流行主题色', desc: '热烈、行动感强。', secondaryName: '湖蓝', secondaryHex: '#06B6D4', secondaryScheme: '互补配对', category: 'industry' },
  { id: 'trend-rose', name: '玫瑰洋红', en: 'Rose', hex: '#E11D48', tag: '流行色', group: '通用流行主题色', desc: '适合品牌感和情绪化界面。', secondaryName: '玉青', secondaryHex: '#10B981', secondaryScheme: '分裂互补', category: 'industry' },
  { id: 'trend-jade', name: '玉石青', en: 'Jade', hex: '#14B8A6', tag: '流行色', group: '通用流行主题色', desc: '医疗、服务、数据产品友好。', secondaryName: '珊瑚粉', secondaryHex: '#FB7185', secondaryScheme: '分裂互补', category: 'industry' },
  { id: 'trend-indigo', name: '靛青', en: 'Indigo', hex: '#6366F1', tag: '流行色', group: '通用流行主题色', desc: '通用、轻快。', secondaryName: '琥珀金', secondaryHex: '#F59E0B', secondaryScheme: '互补配对', category: 'industry' },
  { id: 'trend-slate', name: '石板灰蓝', en: 'Slate', hex: '#334155', tag: '流行色', group: '通用流行主题色', desc: '稳重企业风。', secondaryName: '亮天青', secondaryHex: '#22D3EE', secondaryScheme: '高对比冷辅色', category: 'industry' },
  { id: 'trend-graphite', name: '石墨黑', en: 'Graphite', hex: '#111827', tag: '流行色', group: '通用流行主题色', desc: '高端深色主题常用。', secondaryName: '皇金', secondaryHex: '#EAB308', secondaryScheme: '高对比暖辅色', category: 'dark' },
  { id: 'trend-lime', name: '青柠绿', en: 'Lime', hex: '#84CC16', tag: '流行色', group: '通用流行主题色', desc: '活跃、增长导向。', secondaryName: '深海青', secondaryHex: '#0F766E', secondaryScheme: '类比深辅色', category: 'industry' },
  { id: 'trend-sand', name: '砂岩褐', en: 'Sand', hex: '#C19A6B', tag: '流行色', group: '通用流行主题色', desc: '自然、内容、生活方式类常见。', secondaryName: '汽油蓝', secondaryHex: '#0F4C5C', secondaryScheme: '互补低彩', category: 'industry' }
];
