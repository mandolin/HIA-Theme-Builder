/**
 * @lang zh-CN web 端主题状态：保存当前主/副色与全局设置，集中触发重渲染。
 * @lang en Web theme state: holds current primary/secondary and global settings, centralizes re-render.
 */

import type { Theme } from '@hia/theme-core';
import { buildTheme } from '@hia/theme-core';

/** @lang zh-CN 当前会话的主题输入状态（尚未 build 的源数据）。 @lang en Current session theme input state (pre-build source data). */
export interface ConsoleState {
  /** @lang zh-CN 主色 HEX。 @lang en Primary HEX. */
  primary: string;
  /** @lang zh-CN 副色 HEX。 @lang en Secondary HEX. */
  secondary: string;
  /** @lang zh-CN 主色名称。 @lang en Primary name. */
  primaryName: string;
  /** @lang zh-CN 副色名称。 @lang en Secondary name. */
  secondaryName: string;
  /** @lang zh-CN 主题名称。 @lang en Theme name. */
  themeName: string;
}

/** @lang zh-CN 默认起始状态：沿用研究摘要的钴蓝+清透青。 @lang en Default initial state: cobalt + clear cyan from research digest. */
export const defaultState: ConsoleState = {
  primary: '#0047AB',
  secondary: '#00A8D3',
  primaryName: '钴蓝',
  secondaryName: '清透青',
  themeName: 'HIA 默认'
};

/** @lang zh-CN 收集所有重渲染订阅者，状态变更时统一通知。 @lang en Collects re-render subscribers; notified on state change. */
const listeners = new Set<(s: ConsoleState, theme: Theme) => void>();
let current = { ...defaultState };

/**
 * @lang zh-CN 由当前状态构建完整主题对象（消费 core.buildTheme）。
 * @lang en Build full theme from current state (consumes core.buildTheme).
 */
function buildCurrent(): Theme {
  // <lang zh-CN>由当前输入构建完整主题（core.buildTheme 已顶层导入）。</lang>
  // <lang en>Build full theme from current input (core.buildTheme imported at top).</lang>
  return buildTheme({
    primary: current.primary,
    secondary: current.secondary,
    primaryName: current.primaryName,
    secondaryName: current.secondaryName,
    name: current.themeName
  });
}

/**
 * @lang zh-CN 订阅状态变更，立即用当前值回调一次。
 * @lang en Subscribe to state changes; called once immediately with current value.
 */
export function subscribe(fn: (s: ConsoleState, theme: Theme) => void): void {
  listeners.add(fn);
  fn(current, buildCurrent());
}

/**
 * @lang zh-CN 更新部分状态并通知所有订阅者重渲染。
 * @lang en Patch partial state and notify all subscribers to re-render.
 */
export function update(patch: Partial<ConsoleState>): void {
  current = { ...current, ...patch };
  const theme = buildCurrent();
  listeners.forEach((fn) => fn(current, theme));
}

/**
 * @lang zh-CN 用预设/候选一次性替换状态（保留名称缺省）。
 * @lang en Replace state wholesale from a preset/candidate (keeps name defaults).
 */
export function replace(next: Partial<ConsoleState>): void {
  update(next);
}
