/**
 * @lang zh-CN **情感主色独立数据集**（`W-tb-P34`，维护者校正后重做）。
 *
 *   **为什么是独立数据集**：维护者明确要求"情感主色不能关联其它颜色数据"。
 *   早前版本把 24 情感映射到 44 个主色候选库（宝典首色频次 → OKLab 最近邻 → 投票），
 *   结果是语义无关的颜色被最近邻吸到同几个点上（低沉→亮黄、平和→粉红、四个情感挤在同一个粉色），
 *   一望即知是错的。根因不是参数没调好，是**方法本身串了数据源**：候选库是"网站/流行色"的策展集合，
 *   与情感语义没有关系。
 *
 *   本表自带色值，不引用 `primaryCandidates`，也与它零耦合——改候选库不影响本表，反之亦然。
 *
 *   **取色依据**：配色宝典为每个情感提供八种组合形态的具体色号，
 *   其中 **单色色彩组合（单色系）** 只用一个色相做明暗变化，最接近"该情感的色彩主张"；
 *   其余形态（补色/冲突/三元）混入对比色相，取"首色"只会得到组合排列的噪声。
 *   每条的 `anchor` 是该情感单色系里**只用单一色号的那个组合**（即该情感的核本色相），
 *   `secondary` 取该情感单色系中出现频次最高的兄弟色号（同色相不同明暗，天然成对）。
 *
 *   这与宝典的文字描述一致：强烈=离不开红、热情=金橙、平静=蓝、低沉=灰紫、专职=灰黑底衬。
 *
 *   **色名为什么有策展值**：自动命名只有 9 档修饰语 × 13 个色相，同一色系的相邻明暗阶必然撞名
 *   ——`#DF0029` 与 `#E33539` 都会得到"强红"、古典与可靠都会得到"暗蓝"。这在 44 色候选库里无伤大雅
 *   （本来就有分组），但摆在 24 张情感卡上就是明晃晃的重复。故对**撞名的那 8 条**给出策展色名，
 *   其余 16 条仍是自动命名的结果。策展名与色值一一对应，由单测守住（同名即失败）。
 *
 * @lang en **Standalone mood → primary dataset** (`W-tb-P34`, redone after the maintainer's correction).
 *
 *   **Why standalone**: the maintainer required that mood primaries must not be tied to any other colour
 *   dataset. An earlier version mapped the 24 moods onto the 44-candidate primary library (leading-colour
 *   frequency → OKLab nearest neighbour → weighted vote), and semantically unrelated colours collapsed onto
 *   the same few points (低沉→bright yellow, 平静→pink, four moods on one pink). The cause was the method
 *   mixing datasets, not bad tuning: the candidate library is a curated set of site/trending colours and has
 *   nothing to do with mood semantics.
 *
 *   This table carries its own colours, references no `primaryCandidates`, and is fully decoupled from it.
 *
 *   **Colour source**: the colour handbook gives concrete palette numbers for eight combo forms per mood.
 *   **Mono (single-hue) combos** vary one hue's lightness only, which is closest to "this mood's colour
 *   claim"; the other forms mix contrasting hues, so their leading colour is mostly arrangement noise.
 *   Each row's `anchor` is the palette number used alone in that mood's mono set (the mood's core hue), and
 *   `secondary` is the most frequent sibling number in the same set — same hue, different lightness, a natural
 *   pair. This matches the handbook's own prose: 强烈 = red-bound, 热情 = golden orange, 平静 = blue,
 *   低沉 = grey-purple, 专职 = grey/black base under accents.
 */

/** @lang zh-CN 一条情感主色记录。 @lang en One mood-primary record. */
export interface MoodPrimaryColor {
  /** @lang zh-CN 情感名（与 `TONE_MOODS` 同源）。 @lang en Mood name (same source as `TONE_MOODS`). */
  mood: string;
  /** @lang zh-CN 宝典色号（可回溯到宝典单色系组合）。 @lang en Handbook palette number (traceable to the mono combo). */
  anchor: number;
  /** @lang zh-CN 主色 HEX（该情感的核本色相）。 @lang en Primary HEX (the mood's core hue). */
  hex: string;
  /** @lang zh-CN 主色中文色名。 @lang en Primary Chinese colour name. */
  zh: string;
  /** @lang zh-CN 主色英文色名。 @lang en Primary English colour name. */
  en: string;
  /** @lang zh-CN 同色系兄弟色号（该情感单色系里频次最高的另一色）。 @lang en Sibling number (most frequent other shade in the mono set). */
  secondaryAnchor: number;
  /** @lang zh-CN 副色 HEX。 @lang en Secondary HEX. */
  secondaryHex: string;
  /** @lang zh-CN 副色中文色名。 @lang en Secondary Chinese colour name. */
  secondaryZh: string;
  /** @lang zh-CN 副色英文色名。 @lang en Secondary English colour name. */
  secondaryEn: string;
}

/**
 * @lang zh-CN 24 情感 → 核本色相与同色系副色（独立数据集，不与主色候选库关联）。
 *   顺序与 `TONE_MOODS` 一致，便于 UI 稳定呈现。
 * @lang en 24 moods → core hue plus its same-hue secondary (standalone; no relation to the candidate library).
 *   Ordered like `TONE_MOODS` so the UI renders stably.
 */
export const MOOD_PRIMARY_COLORS: readonly MoodPrimaryColor[] = [
  { mood: '强烈', anchor: 4, hex: '#DF0029', zh: '烈红', en: 'Fiery Red', secondaryAnchor: 2, secondaryHex: '#B2001F', secondaryZh: '深红', secondaryEn: 'Deep Red' },
  { mood: '丰富', anchor: 1, hex: '#8B0016', zh: '深棕', en: 'Deep Brown', secondaryAnchor: 2, secondaryHex: '#B2001F', secondaryZh: '深红', secondaryEn: 'Deep Red' },
  { mood: '浪漫', anchor: 7, hex: '#F5A89A', zh: '浅红', en: 'Light Red', secondaryAnchor: 6, secondaryHex: '#EE7C6B', secondaryZh: '中红', secondaryEn: 'Moderate Red' },
  { mood: '奔放', anchor: 12, hex: '#E33539', zh: '焰红', en: 'Flame Red', secondaryAnchor: 10, secondaryHex: '#B6292B', secondaryZh: '深红', secondaryEn: 'Deep Red' },
  { mood: '土性', anchor: 10, hex: '#B6292B', zh: '深红', en: 'Deep Red', secondaryAnchor: 9, secondaryHex: '#8E1E20', secondaryZh: '深棕', secondaryEn: 'Deep Brown' },
  { mood: '友善', anchor: 20, hex: '#EC870E', zh: '强橙', en: 'Strong Orange', secondaryAnchor: 18, secondaryHex: '#BD6B09', secondaryZh: '中橙', secondaryEn: 'Moderate Orange' },
  { mood: '柔和', anchor: 22, hex: '#F5B16D', zh: '浅橙', en: 'Light Orange', secondaryAnchor: 19, secondaryHex: '#D0770B', secondaryZh: '中橙', secondaryEn: 'Moderate Orange' },
  { mood: '热情', anchor: 28, hex: '#F1AF00', zh: '鲜橙', en: 'Vivid Orange', secondaryAnchor: 27, secondaryHex: '#D59B00', secondaryZh: '鲜橙', secondaryEn: 'Vivid Orange' },
  { mood: '动感', anchor: 36, hex: '#F9F400', zh: '亮黄', en: 'Brilliant Yellow', secondaryAnchor: 34, secondaryHex: '#C7C300', secondaryZh: '鲜黄', secondaryEn: 'Vivid Yellow' },
  { mood: '高雅', anchor: 39, hex: '#FFFAB3', zh: '淡黄', en: 'Pale Yellow', secondaryAnchor: 35, secondaryHex: '#DCD800', secondaryZh: '鲜黄', secondaryEn: 'Vivid Yellow' },
  { mood: '流行', anchor: 44, hex: '#5BBD2B', zh: '强绿', en: 'Strong Green', secondaryAnchor: 42, secondaryHex: '#489620', secondaryZh: '强绿', secondaryEn: 'Strong Green' },
  { mood: '清新', anchor: 52, hex: '#00A06B', zh: '中绿', en: 'Moderate Green', secondaryAnchor: 49, secondaryHex: '#006241', secondaryZh: '暗绿', secondaryEn: 'Dark Green' },
  { mood: '传统', anchor: 49, hex: '#006241', zh: '暗绿', en: 'Dark Green', secondaryAnchor: 51, secondaryHex: '#008C5E', secondaryZh: '中绿', secondaryEn: 'Moderate Green' },
  { mood: '清爽', anchor: 60, hex: '#00A6AD', zh: '中青', en: 'Moderate Cyan', secondaryAnchor: 59, secondaryHex: '#009298', secondaryZh: '中青', secondaryEn: 'Moderate Cyan' },
  { mood: '热带', anchor: 62, hex: '#6EC3C9', zh: '浅青', en: 'Light Cyan', secondaryAnchor: 59, secondaryHex: '#009298', secondaryZh: '中青', secondaryEn: 'Moderate Cyan' },
  { mood: '古典', anchor: 68, hex: '#205AA7', zh: '宝蓝', en: 'Sapphire Blue', secondaryAnchor: 69, secondaryHex: '#426EB4', secondaryZh: '中蓝', secondaryEn: 'Moderate Blue' },
  { mood: '可靠', anchor: 65, hex: '#103667', zh: '藏青', en: 'Navy Blue', secondaryAnchor: 67, secondaryHex: '#1B4F93', secondaryZh: '暗蓝', secondaryEn: 'Dark Blue' },
  { mood: '平静', anchor: 70, hex: '#7388C1', zh: '中蓝', en: 'Moderate Blue', secondaryAnchor: 72, secondaryHex: '#BFCAE6', secondaryZh: '浅蓝', secondaryEn: 'Light Blue' },
  { mood: '堂皇', anchor: 76, hex: '#3A2885', zh: '深紫', en: 'Deep Purple', secondaryAnchor: 73, secondaryHex: '#211551', secondaryZh: '暗紫', secondaryEn: 'Dark Purple' },
  { mood: '神奇', anchor: 84, hex: '#5D0C7B', zh: '茄紫', en: 'Eggplant', secondaryAnchor: 86, secondaryHex: '#8C63A4', secondaryZh: '中品红', secondaryEn: 'Moderate Magenta' },
  { mood: '怀旧', anchor: 86, hex: '#8C63A4', zh: '暮紫', en: 'Dusk Purple', secondaryAnchor: 83, secondaryHex: '#52096C', secondaryZh: '深品红', secondaryEn: 'Deep Magenta' },
  { mood: '活力', anchor: 92, hex: '#A2007C', zh: '洋红', en: 'Carmine', secondaryAnchor: 90, secondaryHex: '#780062', secondaryZh: '深品红', secondaryEn: 'Deep Magenta' },
  { mood: '低沉', anchor: 94, hex: '#C57CAC', zh: '灰紫', en: 'Ash Purple', secondaryAnchor: 92, secondaryHex: '#A2007C', secondaryZh: '深品红', secondaryEn: 'Deep Magenta' },
  { mood: '专职', anchor: 102, hex: '#898989', zh: '中灰', en: 'Moderate Grey', secondaryAnchor: 99, secondaryHex: '#C2C2C2', secondaryZh: '浅灰', secondaryEn: 'Light Grey' }
];

/**
 * @lang zh-CN 按情感名取主色记录；未知情感返回 `undefined`（不编造默认值）。
 * @lang en Looks up a mood record by name; returns `undefined` for unknown moods (never fabricates a default).
 */
export function moodPrimaryColorFor(mood: string): MoodPrimaryColor | undefined {
  return MOOD_PRIMARY_COLORS.find(m => m.mood === mood);
}
