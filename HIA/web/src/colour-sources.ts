/**
 * @lang zh-CN 大体积选色数据的**懒加载**层（`W-tb-P51` / 构建体积优化）：
 *   传统色（1897 条）、品牌（715 条）、宝典组合包、国旗/自然/社会/情感源合计约 900KB——
 *   此前全部静态打进主 chunk（956KB 单包超 Vite 500KB 警告线）。本模块改为**动态 import**，
 *   由「打开色源弹层」的动作触发预载；数据就绪后同步访问器直接返回缓存，未就绪时返回空数组
 *   并由调用方在加载完成后重渲染（避免阻塞首屏）。
 *
 *   设计要点：
 *   - 数据源仍是 `@hia/theme-core` 的 subpath exports（同源、同一份数据，不复制）；
 *   - `ensureSources()` 幂等：并发调用共享同一 Promise；
 *   - 每个访问器（如 `TRAD()`）返回当前缓存（可能为空），配合 `onSourcesReady` 回调重绘。
 * @lang en Lazy-loading layer for the large colour-source datasets (`W-tb-P51` / bundle-size work):
 *   traditional (1,897), brand (715), Baodian combos, flag/nature/social/mood — about 900 KB total, all
 *   previously inlined into the main chunk (956 KB, over Vite's 500 KB warning). Now loaded via dynamic
 *   import, triggered when the colour-source modal opens; once ready, the synchronous accessors return the
 *   cache. Callers re-render on `onSourcesReady` so the first paint is never blocked.
 *
 *   Design: datasets stay owned by `@hia/theme-core` subpath exports (same data, no copies);
 *   `ensureSources()` is idempotent (concurrent calls share one promise); accessors return the current
 *   cache (possibly empty) and listeners repaint when data lands.
 */
// 类型直接来自 subpath 模块（根导出面冻结在 142，不含这些 entry 类型）。
// <lang en>Types come straight from the subpath modules (the root surface is frozen at 142 exports).</lang>
import type { TraditionalColorEntry } from '@hia/theme-core/data/traditional';
import type { BrandColorEntry } from '@hia/theme-core/data/brand';
import type { FlagEntry } from '@hia/theme-core/data/flags';
import type { NatureColorEntry } from '@hia/theme-core/data/nature';
import type { SocialColorEntry } from '@hia/theme-core/data/social';
import type { MoodPrimaryColor } from '@hia/theme-core/data/mood';

/** @lang zh-CN 数据就绪后的可用形态。 @lang en Shape of the datasets once loaded. */
export interface ColourSources {
  TRADITIONAL_COLORS: readonly TraditionalColorEntry[];
  BRAND_COLORS: readonly BrandColorEntry[];
  FLAG_COLORS: readonly FlagEntry[];
  NATURE_COLORS: readonly NatureColorEntry[];
  SOCIAL_COLORS: readonly SocialColorEntry[];
  MOOD_PRIMARY_COLORS: readonly MoodPrimaryColor[];
  BAODIAN_PALETTE: Record<number, string>;
  BAODIAN_FORM_NAMES: Record<string, string>;
  FORM_PACKS: Record<string, { e: string; n: number[] }[]>;
}

// 缓存：未加载时为空形态（访问器安全返回空数组/空对象）。
// <lang en>Cache: empty shape before loading so accessors stay safe.</lang>
const empty: ColourSources = {
  TRADITIONAL_COLORS: [], BRAND_COLORS: [], FLAG_COLORS: [], NATURE_COLORS: [],
  SOCIAL_COLORS: [], MOOD_PRIMARY_COLORS: [], BAODIAN_PALETTE: {}, BAODIAN_FORM_NAMES: {}, FORM_PACKS: {}
};
let cache: ColourSources = empty;
let pending: Promise<void> | null = null;
const readyListeners: (() => void)[] = [];

/** @lang zh-CN 是否已加载完成。 @lang en Whether the datasets are loaded. */
export function sourcesReady(): boolean { return cache !== empty; }

/**
 * @lang zh-CN 注册就绪回调（在数据加载完成后触发一次；已就绪则立即调用）。
 *   返回取消函数，供模板重绘链避免泄漏。
 * @lang en Registers a ready callback (fires once after load; immediately if already ready).
 *   Returns an unsubscribe function so re-render chains don't leak.
 */
export function onSourcesReady(cb: () => void): () => void {
  if (cache !== empty) { cb(); return () => {}; }
  readyListeners.push(cb);
  return () => { const i = readyListeners.indexOf(cb); if (i >= 0) readyListeners.splice(i, 1); };
}

/**
 * @lang zh-CN 确保数据已加载（幂等）：并行拉取全部 subpath 模块，填入缓存并通知监听者。
 *   失败时保留空缓存并抛错（调用方 toast/控制台处理，不阻塞其它功能）。
 * @lang en Ensures the datasets are loaded (idempotent): fetches all subpath modules in parallel, fills the
 *   cache and notifies listeners. On failure keeps the empty cache and rethrows (callers surface it).
 */
export function ensureSources(): Promise<void> {
  if (cache !== empty) return Promise.resolve();
  if (pending) return pending;
  // 并行加载：任一失败整体失败（数据源是同一份 core 包，缺一即视为环境异常）。
  // <lang en>Parallel load: any failure fails the batch (they ship together in the same core package).</lang>
  pending = Promise.all([
    import('@hia/theme-core/data/traditional'),
    import('@hia/theme-core/data/brand'),
    import('@hia/theme-core/data/flags'),
    import('@hia/theme-core/data/nature'),
    import('@hia/theme-core/data/social'),
    import('@hia/theme-core/data/mood'),
    import('@hia/theme-core/data/baodian')
  ]).then(([trad, brand, flags, nature, social, mood, baodian]) => {
    cache = {
      TRADITIONAL_COLORS: trad.TRADITIONAL_COLORS,
      BRAND_COLORS: brand.BRAND_COLORS,
      FLAG_COLORS: flags.FLAG_COLORS,
      NATURE_COLORS: nature.NATURE_COLORS,
      SOCIAL_COLORS: social.SOCIAL_COLORS,
      MOOD_PRIMARY_COLORS: mood.MOOD_PRIMARY_COLORS,
      BAODIAN_PALETTE: baodian.BAODIAN_PALETTE,
      BAODIAN_FORM_NAMES: baodian.BAODIAN_FORM_NAMES,
      FORM_PACKS: baodian.FORM_PACKS as ColourSources['FORM_PACKS']
    };
    // 通知后清空监听队列（一次性）。
    // <lang en>Notify then clear the listener queue (one-shot).</lang>
    const ls = readyListeners.splice(0);
    for (const cb of ls) { try { cb(); } catch { /* 单个监听器失败不影响其他 */ } }
  }).catch((e) => {
    pending = null; // 允许重试
    throw e;
  });
  return pending;
}

// 同步访问器：未加载时返回空形态（调用方按 sourcesReady()/onSourcesReady 决定重绘）。
// <lang en>Synchronous accessors: empty shape before load; callers repaint via sourcesReady/onSourcesReady.</lang>
export const TRADITIONAL_COLORS = () => cache.TRADITIONAL_COLORS;
export const BRAND_COLORS = () => cache.BRAND_COLORS;
export const FLAG_COLORS = () => cache.FLAG_COLORS;
export const NATURE_COLORS = () => cache.NATURE_COLORS;
export const SOCIAL_COLORS = () => cache.SOCIAL_COLORS;
export const MOOD_PRIMARY_COLORS = () => cache.MOOD_PRIMARY_COLORS;
export const BAODIAN_PALETTE = () => cache.BAODIAN_PALETTE;
export const BAODIAN_FORM_NAMES = () => cache.BAODIAN_FORM_NAMES;
export const FORM_PACKS = () => cache.FORM_PACKS;