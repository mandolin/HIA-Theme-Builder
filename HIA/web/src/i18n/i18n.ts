/**
 * @lang zh-CN i18n 基础设施（`W-tb-P7`）：零依赖的轻量双语模块。
 *   设计：① 字典按语义键组织，每条含 zh/en 双语文本（`strings.ts` 及其分组文件）；
 *   ② `t(key, params)` 取词 + `{name}` 参数插值；③ `setLocale`/`getLocale` 切换并持久化到
 *   localStorage（键 `hia-locale`）；④ `applyDomTranslations` 处理静态 DOM（`data-i18n` 系列属性）；
 *   ⑤ `translateTextNodes` 遍历文本节点，按"中文原文键"翻译演示内容（PC/小程序预览），
 *   首次遍历时把原文存入 WeakMap，保证中英往返无损。
 * @lang en i18n infrastructure (`W-tb-P7`): zero-dependency lightweight bilingual module.
 *   Design: (1) dictionaries organized by semantic keys, each entry carries zh/en text;
 *   (2) `t(key, params)` lookup with `{name}` interpolation; (3) `setLocale`/`getLocale`
 *   persists to localStorage (key `hia-locale`); (4) `applyDomTranslations` handles static DOM
 *   via `data-i18n` attributes; (5) `translateTextNodes` walks text nodes and translates demo
 *   content (PC/Mini-Program previews) keyed by exact Chinese source text, storing originals
 *   in a WeakMap on first walk so zh/en round-trips are lossless.
 */

/** @lang zh-CN 支持的语言。 @lang en Supported locales. */
export type Locale = 'zh-CN' | 'en';

/** @lang zh-CN localStorage 持久化键。 @lang en localStorage persistence key. */
const STORAGE_KEY = 'hia-locale';

/** @lang zh-CN 双语文本条目。 @lang en Bilingual string entry. */
export interface StringEntry {
  /** @lang zh-CN 中文文本（同时作为演示内容的字典键）。 @lang en Chinese text (also the dictionary key for demo content). */
  zh: string;
  /** @lang en 英文文本。 @lang en English text. */
  en: string;
}

/**
 * @lang zh-CN 语言 → 条目字段名映射：Locale 是对外 API 概念，字段名是存储概念。
 * @lang en Locale → entry field mapping: Locale is the API concept; field names are the storage concept.
 */
function fieldFor(locale: Locale): 'zh' | 'en' {
  return locale === 'zh-CN' ? 'zh' : 'en';
}

/** @lang zh-CN 当前激活语言（模块级单例，默认中文）。 @lang en Active locale (module-level singleton, defaults to Chinese). */
let currentLocale: Locale = 'zh-CN';

/** @lang zh-CN 演示内容文本节点的中文原文存档：翻译往返无损的关键。 @lang en Original Chinese text of demo text nodes: key to lossless round-trips. */
const originalTexts = new WeakMap<Text, string>();

/**
 * @lang zh-CN 从 localStorage 读取持久化语言并应用（无效值静默回退 zh-CN）。模块加载即调用。
 * @lang en Read persisted locale from localStorage and apply it (invalid values silently fall back to zh-CN). Invoked at module load.
 */
function restoreLocale(): void {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved === 'zh-CN' || saved === 'en') currentLocale = saved;
  } catch {
    // <lang zh-CN>localStorage 不可用（隐私模式等）时保持默认。</lang>
    // <lang en>Keep default when localStorage is unavailable (private mode etc.).</lang>
  }
}
restoreLocale();

/**
 * @lang zh-CN 取当前语言。
 * @lang en Get the active locale.
 */
export function getLocale(): Locale {
  return currentLocale;
}

/**
 * @lang zh-CN 设置语言并持久化；返回是否发生变化（调用方据此决定是否重渲染）。
 * @lang en Set locale and persist; returns whether it changed (callers re-render on change).
 */
export function setLocale(locale: Locale): boolean {
  if (locale === currentLocale) return false;
  currentLocale = locale;
  try {
    localStorage.setItem(STORAGE_KEY, locale);
  } catch {
    // <lang zh-CN>持久化失败不阻断切换（会话内仍生效）。</lang>
    // <lang en>Persistence failure does not block switching (still effective in-session).</lang>
  }
  return true;
}

/**
 * @lang zh-CN 注册字典：合并传入条目到全局表（重复键后者覆盖，分组文件按序注册即可）。
 * @lang en Register dictionary: merge entries into the global table (later registration wins on duplicate keys).
 */
export function registerStrings(entries: Record<string, StringEntry>): void {
  for (const key of Object.keys(entries)) strings[key] = entries[key]!;
}

/** @lang zh-CN 全局字典表（由各分组文件经 registerStrings 注入）。 @lang en Global dictionary table (populated by group files via registerStrings). */
const strings: Record<string, StringEntry> = {};

/**
 * @lang zh-CN 取词：优先按语义键查字典；查不到时回退为"把 key 当中文原文"（演示内容键即中文），
 *   仍查不到则原样返回 key 并在控制台警告（开发期可见漏翻）。
 * @lang en Lookup: semantic key first; fall back to treating key as Chinese source text (demo keys are
 *   the Chinese text); if still missing, return key as-is with a console warning (visible during development).
 */
export function t(key: string, params?: Record<string, string | number>): string {
  const entry = strings[key];
  let out: string;
  if (entry) {
    out = entry[fieldFor(currentLocale)];
  } else if (/[\u4e00-\u9fa5]/.test(key)) {
    // <lang zh-CN>key 本身是中文：作为演示内容键处理，en 语言下查翻译，zh 语言下原样。</lang>
    // <lang en>Key itself is Chinese: treat as demo key; look up translation for en, verbatim for zh.</lang>
    const hit = strings[key];
    out = hit ? hit[fieldFor(currentLocale)] : key;
  } else {
    console.warn(`[i18n] missing key: ${key}`);
    out = key;
  }
  // 参数插值：{name} 形式。
  // <lang zh-CN>替换 {name} 占位符。</lang>
  // <lang en>Substitute {name} placeholders.</lang>
  if (params) {
    for (const name of Object.keys(params)) out = out.replace(`{${name}}`, String(params[name]!));
  }
  return out;
}

/**
 * @lang zh-CN 静态 DOM 翻译：处理 `data-i18n`（textContent）、`data-i18n-placeholder`、
 *   `data-i18n-title`、`data-i18n-value`（input 初值）、`data-i18n-aria`（aria-label）。
 *   幂等：可随每次全量重渲染重复调用。
 * @lang en Static DOM translation: handles `data-i18n` (textContent), `data-i18n-placeholder`,
 *   `data-i18n-title`, `data-i18n-value` (input initial values), `data-i18n-aria` (aria-label).
 *   Idempotent: safe to call on every full re-render.
 */
export function applyDomTranslations(root: Document | Element = document): void {
  const scope = root as Document;
  const q = (sel: string): Element[] => Array.from(scope.querySelectorAll(sel));
  for (const el of q('[data-i18n]')) el.textContent = t(el.getAttribute('data-i18n')!);
  // data-i18n-html：译文含可信标记（如 <b>）时用 innerHTML；字典为项目自有内容，非用户输入。
  // <lang zh-CN>仅用于字典侧标注了标记的条目；用户数据一律走 escapeHtml 路径，不经此通道。</lang>
  // <lang en>Only for dictionary entries that carry markup; user data always goes through escapeHtml, never this path.</lang>
  for (const el of q('[data-i18n-html]')) el.innerHTML = t(el.getAttribute('data-i18n-html')!);
  for (const el of q('[data-i18n-placeholder]')) el.setAttribute('placeholder', t(el.getAttribute('data-i18n-placeholder')!));
  for (const el of q('[data-i18n-title]')) el.setAttribute('title', t(el.getAttribute('data-i18n-title')!));
  for (const el of q('[data-i18n-aria]')) el.setAttribute('aria-label', t(el.getAttribute('data-i18n-aria')!));
  for (const el of q('[data-i18n-value]')) (el as HTMLInputElement).value = t(el.getAttribute('data-i18n-value')!);
}

/**
 * @lang zh-CN 演示内容翻译：遍历文本节点，把"中文原文键"命中的节点替换为目标语言文本。
 *   首次遇到节点时记录中文原文（WeakMap），此后始终从原文出发翻译，保证中英切换往返无损。
 *   只处理非空、含中文、且命中字典的节点；元素内含子元素时跳过（避免破坏结构）。
 * @lang en Demo content translation: walk text nodes and replace those hit by "Chinese source keys"
 *   with target-language text. Original Chinese is recorded in a WeakMap on first encounter; translation
 *   always starts from the stored original so zh/en switching round-trips losslessly. Only non-empty,
 *   Chinese-containing, dictionary-hit nodes are processed; nodes with element children are skipped.
 */
export function translateTextNodes(root: Document | Element = document): void {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  // 先收集再修改，避免遍历中 DOM 变动。
  // <lang zh-CN>TreeWalker 遍历期间修改文本是安全的，但收集后统一处理更稳。</lang>
  // <lang en>Mutating text during TreeWalker walk is safe, but collect-then-apply is more robust.</lang>
  const nodes: Text[] = [];
  let node = walker.nextNode();
  while (node) {
    nodes.push(node as Text);
    node = walker.nextNode();
  }
  for (const textNode of nodes) {
    const original = originalTexts.get(textNode) ?? textNode.nodeValue ?? '';
    if (!originalTexts.has(textNode)) originalTexts.set(textNode, original);
    if (!original.trim() || !/[\u4e00-\u9fa5]/.test(original)) continue;
    // 精确命中（trim 后）才翻译；保留原节点的前后空白结构。
    // <lang zh-CN>演示内容均为整段文本，trim 后精确匹配即可覆盖。</lang>
    // <lang en>Demo content is whole-segment text; trimmed exact match suffices.</lang>
    const trimmed = original.trim();
    const entry = strings[trimmed];
    if (!entry) continue;
    const target = entry[fieldFor(currentLocale)];
    if (target === trimmed) continue;
    textNode.nodeValue = original.replace(trimmed, target);
  }
}

/**
 * @lang zh-CN 全量应用：静态 DOM 翻译 + 演示内容文本节点翻译 + `<html lang>` 同步。切换语言与首次挂载都调它。
 * @lang en Full application: static DOM translation + demo text-node translation + `<html lang>` sync.
 *   Called on locale switch and first mount.
 */
export function applyAll(root: Document | Element = document): void {
  applyDomTranslations(root);
  translateTextNodes(root);
  if (root === document) document.documentElement.lang = currentLocale;
}
