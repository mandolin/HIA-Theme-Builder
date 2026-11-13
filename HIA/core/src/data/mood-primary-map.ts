/**
 * @lang zh-CN 24 情感 → 主色候选映射（`W-tb-P34`，自动生成，勿手改）。
 *   生成器：`work-zone/tools/gen-mood-primary-map.cjs`。
 *   方法：情感的代表色号（宝典组合首色频次前 5）→ OKLab 最近邻匹配 44 主色候选 → 加权投票。
 *   `weight` 为该映射获得的票数，可用于排序置信度；`alternates` 是次优候选（UI 可作备选）。
 * @lang en Mood → primary-candidate map (`W-tb-P34`, generated, do not hand-edit). Generator:
 *   `work-zone/tools/gen-mood-primary-map.cjs`. Method: representative palette numbers per mood (top 5 by
 *   frequency as a combo's leading colour) → OKLab nearest neighbour among the 44 primaries → weighted vote.
 *   `weight` is the vote count (a confidence proxy); `alternates` are runners-up the UI may offer.
 */

// 单条映射。
// <lang zh-CN>mood 为情感中文名（与 TONE_MOODS 同源）；primaryId 对应 primaryCandidates.id。</lang>
// <lang en>mood matches TONE_MOODS; primaryId refers to primaryCandidates.id.</lang>
export interface MoodPrimaryMapping{
  mood:string;
  primaryId:string;
  weight:number;
  alternates:string[];
  /** @lang zh-CN 以中性色为主（如专职），此时 primaryId 为空串。 @lang en Grey-led mood (e.g. 专职); primaryId is then empty. */
  neutralLed?:boolean;
}

// 完整映射表（顺序与 TONE_MOODS 一致，便于 UI 按情感顺序展示）。
// <lang zh-CN>生成时已按 TONE_MOODS 遍历，缺失情感的映射不会出现（宝典无组合的情感不生成）。</lang>
// <lang en>Built by iterating TONE_MOODS; a mood without combos simply has no row.</lang>
export const MOOD_PRIMARY_MAP:readonly MoodPrimaryMapping[]=[
  {mood:'强烈',primaryId:'award-rey',weight:4,alternates:['award-radaville','award-boba']},
  {mood:'丰富',primaryId:'award-rey',weight:6,alternates:['trend-rose','award-meta-rayban']},
  {mood:'浪漫',primaryId:'award-boba',weight:16,alternates:['award-rey','award-dont-board-me']},
  {mood:'奔放',primaryId:'cobalt',weight:5,alternates:['award-radaville','trend-rose']},
  {mood:'土性',primaryId:'award-radaville',weight:14,alternates:['cobalt','trend-rose']},
  {mood:'友善',primaryId:'award-radaville',weight:4,alternates:['award-mana','award-dont-board-me']},
  {mood:'柔和',primaryId:'award-boba',weight:10,alternates:['hia-bright','award-messenger']},
  {mood:'热情',primaryId:'trend-tangerine',weight:8,alternates:['award-radaville','trend-lime']},
  {mood:'动感',primaryId:'award-sunday',weight:7,alternates:['trend-lime','award-opal-tadpole']},
  {mood:'高雅',primaryId:'award-sunday',weight:8,alternates:['award-boba','trend-sand']},
  {mood:'流行',primaryId:'trend-emerald',weight:11,alternates:['award-radaville','award-boba']},
  {mood:'清新',primaryId:'french-blue',weight:6,alternates:['trend-emerald','award-messenger']},
  {mood:'传统',primaryId:'award-meta-rayban',weight:16,alternates:['french-blue','trend-coral']},
  {mood:'清爽',primaryId:'award-messenger',weight:6,alternates:['trend-jade','hia-bright']},
  {mood:'热带',primaryId:'award-boba',weight:5,alternates:['award-dont-board-me','award-messenger']},
  {mood:'古典',primaryId:'award-radaville',weight:4,alternates:['award-mana','cobalt']},
  {mood:'可靠',primaryId:'cobalt',weight:8,alternates:['trend-sand','award-radaville']},
  {mood:'平静',primaryId:'award-boba',weight:9,alternates:['cobalt','award-wix-pantone']},
  {mood:'堂皇',primaryId:'trend-tangerine',weight:6,alternates:['award-mana','award-radaville']},
  {mood:'神奇',primaryId:'trend-emerald',weight:6,alternates:['french-blue','trend-lime']},
  {mood:'怀旧',primaryId:'award-boba',weight:8,alternates:['trend-tangerine']},
  {mood:'活力',primaryId:'cobalt',weight:7,alternates:['award-meta-rayban','award-rey']},
  {mood:'低沉',primaryId:'award-opal-tadpole',weight:4,alternates:['trend-jade','trend-sand']},
  {mood:'专职',primaryId:'',weight:0,alternates:[''],neutralLed:true},
];

// 按情感查映射（未命中返回 undefined，调用方决定回退策略）。
// <lang zh-CN>线性查找足够：表最多 24 行，建 Map 反而增加初始化成本。</lang>
// <lang en>Linear scan suffices: at most 24 rows, and a Map would only add init cost.</lang>
export function moodPrimaryFor(mood:string):MoodPrimaryMapping|undefined{
  return MOOD_PRIMARY_MAP.find(m=>m.mood===mood);
}
