/**
 * @lang zh-CN web 端完整主题状态管理：操作台输入、主题库、渐变设置、预览模式、Token 导出选项。
 *   集中持有所有可变状态，提供订阅通知机制；各模块通过 subscribe 获取最新状态并重渲染。
 * @lang en Web full theme state management: console input, theme library, gradient settings,
 *   preview modes, token export options. Centralizes all mutable state with subscription notify;
 *   modules subscribe for latest state and re-render.
 */

import type { Theme, GradientSettings, Preset } from '@hia/theme-core';
import {
  buildTheme,
  builtinPresets,
  GRADIENT_DEFAULTS,
  cloneGradientSettings
} from '@hia/theme-core';

// ──────────────────────────────────────────────
// 类型定义 / Type definitions
// ──────────────────────────────────────────────

/** @lang zh-CN 操作台输入状态（用户在左侧面板编辑的原始值）。 @lang en Console input state (raw values edited in left panel). */
export interface ConsoleState {
  /** @lang zh-CN 主色 HEX。 @en Primary HEX. */
  primary: string;
  /** @lang zh-CN 副色 HEX。 @en Secondary HEX. */
  secondary: string;
  /** @lang zh-CN 主色名称。 @en Primary name. */
  primaryName: string;
  /** @lang zh-CN 副色名称。 @en Secondary name. */
  secondaryName: string;
  /** @lang zh-CN 主题名称。 @en Theme name. */
  themeName: string;
}

/** @lang zh-CN PC 预览结构模式：sidebar（左右侧栏）/ topbar（上下顶栏）/ cards（卡片流混合）。 @en PC preview structure mode: sidebar / topbar / cards flow. */
export type PcMode = 'sidebar' | 'topbar' | 'cards';

/** @lang zh-CN 小程序预览页面类型。 @en Mini-program preview page type. */
export type MpPage = 'home' | 'list' | 'detail' | 'profile' | 'form';

/** @lang zh-CN Token 导出格式。 @en Token export format. */
export type TokenFormat = 'css' | 'json';

/** @lang zh-CN 全局应用状态聚合（只读快照，通过 subscribe 分发）。 @en Global app state aggregate (read-only snapshot, distributed via subscribe). */
export interface AppState {
  /** @lang zh-CN 操作台输入。 @en Console input. */
  console: ConsoleState;
  /** @lang zh-CN 由 core 构建的完整主题对象。 @en Full theme object built by core. */
  theme: Theme;
  /** @lang zh-CN 渐变设置（8 个角色的独立配置）。 @en Gradient settings (per-role configs). */
  gradients: GradientSettings;
  /** @lang zh-CN PC 预览当前模式。 @en Current PC preview mode. */
  pcMode: PcMode;
  /** @lang zh-CN 小程序当前预览页。 @en Current mini-program preview page. */
  mpPage: MpPage;
  /** @lang zh-CN Token 导出格式。 @en Token export format. */
  tokenFormat: TokenFormat;
  /** @lang zh-CN 是否在导出中包含渐变 Token。 @en Whether to include gradient tokens in export. */
  includeGradientToken: boolean;
  /** @lang zh-CN 主题库列表（含内置预设 + 用户自定义）。 @en Theme library list (built-in presets + user custom). */
  library: LibraryItem[];
  /** @lang zh-CN 主题库搜索关键词。 @en Theme library search keyword. */
  librarySearch: string;
  /** @lang zh-CN 主题库分类过滤（空=全部分类）。 @en Theme library category filter (empty=all). */
  libraryCategory: string;
}

/** @lang zh-CN 主题库条目（扩展自 Preset，增加自定义标记与时间戳）。 @en Theme library item (extends Preset with custom flag & timestamp). */
export interface LibraryItem extends Preset {
  /** @lang zh-CN 是否为用户自定义（非内置）。 @en Whether user-custom (not built-in). */
  custom: boolean;
  /** @lang zh-CN 创建时间 ISO 字符串。 @en Creation time ISO string. */
  createdAt: string;
  /** @lang zh-CN 唯一 ID。 @en Unique ID. */
  id: string;
}

// ──────────────────────────────────────────────
// 默认值 / Defaults
// ──────────────────────────────────────────────

/** @lang zh-CN 默认操作台状态：钴蓝 + 清透青，沿用研究摘要的起始配色方案。 @en Default console state: cobalt + clear cyan from research digest. */
export const defaultConsole: ConsoleState = {
  primary: '#0047AB',
  secondary: '#00A8D3',
  primaryName: '钴蓝',
  secondaryName: '清透青',
  themeName: 'HIA 默认'
};

// ──────────────────────────────────────────────
// 内部状态 / Internal state
// ──────────────────────────────────────────────

/** @lang zh-CN 当前操作台输入（可变）。 @en Current console input (mutable). */
let consoleState: ConsoleState = { ...defaultConsole };

/** @lang zh-CN 当前渐变设置（可变，初始化自 core 默认值）。 @en Current gradient settings (mutable, init from core defaults). */
let gradState: GradientSettings = cloneGradientSettings(GRADIENT_DEFAULTS);

/** @lang zh-CN PC 预览模式（可变）。 @en PC preview mode (mutable). */
let _pcMode: PcMode = 'sidebar';

/** @lang zh-CN 小程序预览页（可变）。 @en Mini-program preview page (mutable). */
let _mpPage: MpPage = 'home';

/** @lang zh-CN Token 导出格式（可变）。 @en Token export format (mutable). */
let _tokenFormat: TokenFormat = 'css';

/** @lang zh-CN 是否包含渐变 Token（可变）。 @en Include gradient tokens flag (mutable). */
let _includeGradient: boolean = true;

/** @lang zh-CN 主题库列表（可变，初始化时把内置 preset 转为 LibraryItem）。 @en Theme library list (mutable, init from built-in presets). */
let libState: LibraryItem[] = builtinPresets.map((p, i) => ({
  ...p,
  custom: false,
  createdAt: new Date(0).toISOString(),
  id: `builtin-${i}`
}));

/** @lang zh-CN 主题库搜索词（可变）。 @en Library search keyword (mutable). */
let _libSearch: string = '';

/** @lang zh-CN 主题库分类过滤（可变）。 @en Library category filter (mutable). */
let _libCategory: string = '';

/** @lang zh-CN 订阅者集合。 @en Subscriber set. */
const listeners = new Set<(s: AppState) => void>();

/** @lang zh-CN 自增 ID 计数器（用于用户自定义主题库条目）。 @en Auto-increment ID counter (for user custom library items). */
let idCounter = builtinPresets.length;

// ──────────────────────────────────────────────
// 核心方法 / Core methods
// ──────────────────────────────────────────────

/**
 * @lang zh-CN 由当前操作台输入构建完整 Theme 对象。
 * @en Build full Theme from current console input.
 */
function buildCurrent(): Theme {
  return buildTheme({
    primary: consoleState.primary,
    secondary: consoleState.secondary,
    primaryName: consoleState.primaryName,
    secondaryName: consoleState.secondaryName,
    name: consoleState.themeName
  });
}

/**
 * @lang zh-CN 汇总所有状态为只读快照。
 * @en Aggregate all state into a read-only snapshot.
 */
function snapshot(): AppState {
  return {
    console: { ...consoleState },
    theme: buildCurrent(),
    gradients: cloneGradientSettings(gradState),
    pcMode: _pcMode,
    mpPage: _mpPage,
    tokenFormat: _tokenFormat,
    includeGradientToken: _includeGradient,
    library: [...libState],
    librarySearch: _libSearch,
    libraryCategory: _libCategory
  };
}

/**
 * @lang zh-CN 通知所有订阅者（传入最新快照）。
 * @en Notify all subscribers with latest snapshot.
 */
function emit(): void {
  const s = snapshot();
  listeners.forEach((fn) => fn(s));
}

// ──────────────────────────────────────────────
// 公共 API / Public API
// ──────────────────────────────────────────────

/**
 * @lang zh-CN 订阅状态变更；立即用当前值回调一次。
 * @en Subscribe to state changes; called immediately with current value.
 */
export function subscribe(fn: (s: AppState) => void): void {
  listeners.add(fn);
  fn(snapshot());
}

/**
 * @lang zh-CN 取消订阅。
 * @en Unsubscribe.
 */
export function unsubscribe(fn: (s: AppState) => void): void {
  listeners.delete(fn);
}

/**
 * @lang zh-CN 更新操作台部分字段并通知。
 * @en Patch console fields and notify.
 */
export function updateConsole(patch: Partial<ConsoleState>): void {
  consoleState = { ...consoleState, ...patch };
  emit();
}

/**
 * @lang zh-CN 用预设/候选一次性替换操作台状态。
 * @en Replace console state wholesale from preset/candidate.
 */
export function replaceConsole(next: Partial<ConsoleState>): void {
  updateConsole(next);
}

/**
 * @lang zh-CN 设置 PC 预览模式。
 * @en Set PC preview mode.
 */
export function setPcMode(mode: PcMode): void {
  _pcMode = mode;
  emit();
}

/**
 * @lang zh-CN 设置小程序预览页。
 * @en Set mini-program preview page.
 */
export function setMpPage(page: MpPage): void {
  _mpPage = page;
  emit();
}

/**
 * @lang zh-CN 设置 Token 导出格式。
 * @en Set token export format.
 */
export function setTokenFormat(fmt: TokenFormat): void {
  _tokenFormat = fmt;
  emit();
}

/**
 * @lang zh-CN 切换是否包含渐变 Token。
 * @en Toggle gradient token inclusion.
 */
export function toggleIncludeGradient(): void {
  _includeGradient = !_includeGradient;
  emit();
}

/**
 * @lang zh-CN 更新单个渐变角色的配置。
 * @en Update single gradient role config.
 */
export function updateGradient(key: string, patch: Partial<GradientSettings[string]>): void {
  gradState[key] = { ...gradState[key], ...patch };
  emit();
}

/**
 * @lang zh-CN 重置所有渐变设置为默认值。
 * @en Reset all gradient settings to defaults.
 */
export function resetGradients(): void {
  gradState = cloneGradientSettings(GRADIENT_DEFAULTS);
  emit();
}

/**
 * @lang zh-CN 设置主题库搜索词。
 * @en Set library search keyword.
 */
export function setLibrarySearch(q: string): void {
  _libSearch = q;
  emit();
}

/**
 * @lang zh-CN 设置主题库分类过滤。
 * @en Set library category filter.
 */
export function setLibraryCategory(cat: string): void {
  _libCategory = cat;
  emit();
}

/**
 * @lang zh-CN 将当前操作台状态保存到主题库（用户自定义条目）。
 * @en Save current console state to theme library (user custom item).
 */
export function saveToLibrary(): void {
  const item: LibraryItem = {
    id: `custom-${++idCounter}`,
    name: consoleState.themeName || '未命名主题',
    category: '自定义',
    industry: '',
    primary: consoleState.primary,
    secondary: consoleState.secondary,
    primaryName: consoleState.primaryName,
    secondaryName: consoleState.secondaryName,
    note: `主色 ${consoleState.primary} / 副色 ${consoleState.secondary}`,
    custom: true,
    createdAt: new Date().toISOString()
  };
  libState = [item, ...libState];
  emit();
}

/**
 * @lang zh-CN 从主题库应用主题（设为当前操作台状态，不进入编辑）。
 * @en Apply theme from library (set as current console state, no edit).
 */
export function applyFromLibrary(id: string): void {
  const item = libState.find((l) => l.id === id);
  if (!item) return;
  replaceConsole({
    primary: item.primary,
    secondary: item.secondary,
    primaryName: item.primaryName,
    secondaryName: item.secondaryName,
    themeName: item.name
  });
}

/**
 * @lang zh-CN 从主题库载入主题到操作台（设为当前并标记已加载）。
 * @en Load theme from library into console (set as current and mark loaded).
 */
export function loadToConsole(id: string): void {
  applyFromLibrary(id);
}

/**
 * @lang zh-CN 从主题库删除条目（仅限用户自定义）。
 * @en Delete item from library (user custom only).
 */
export function deleteFromLibrary(id: string): void {
  const item = libState.find((l) => l.id === id);
  if (!item || !item.custom) return; // <lang zh-CN>不允许删除内置预设。</lang> // <en>Built-in presets cannot be deleted.</en>
  libState = libState.filter((l) => l.id !== id);
  emit();
}
