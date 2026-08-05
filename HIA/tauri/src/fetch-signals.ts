/**
 * @lang zh-CN Tauri 前端侧信号采集（最小可用版）：通过 Tauri 命令桥（invoke）交由 Rust 后端抓取，避免浏览器 CORS/私网限制。
 * 返回 core.analyze 所需的信号结构；SSRF 已在前端与 Rust 两侧校验。
 * @lang en Tauri front-end signal collector (minimal): delegates fetch to Rust backend via Tauri invoke, avoiding browser CORS/private-net limits. Returns signals for core.analyze; SSRF checked on both sides.
 */

import { guardUrl } from './ssrf.js';
import type { ExtractSignals } from '@hia/theme-core';
import { normalizeHex, validHex } from '@hia/theme-core';

// <lang zh-CN>声明 Tauri 注入的全局 invoke（类型桩；实际由 @tauri-apps/api 提供）。</lang>
// <lang en>Declare Tauri-injected global invoke (type stub; real one from @tauri-apps/api).</lang>
declare global {
  interface Window {
    __TAURI_INVOKE__?: (cmd: string, args?: unknown) => Promise<unknown>;
  }
}

/**
 * @lang zh-CN 通过 Tauri 命令抓取 URL 信号。前端先过 SSRF 校验，再 invoke Rust 后端取色命令。
 * @lang en Fetch URL signals via Tauri command. Front guards SSRF first, then invokes Rust backend extraction command.
 */
export async function collectSignals(rawUrl: string): Promise<ExtractSignals> {
  const guard = guardUrl(rawUrl);
  if (!guard.ok) throw new Error('SSRF:' + guard.reason);

  // <lang zh-CN>优先用 Tauri 桥；非 Tauri 环境（纯前端预览）退回 fetch 正则采集。</lang>
  // <lang en>Prefer Tauri bridge; fall back to fetch+regex in non-Tauri (pure front preview).</lang>
  if (window.__TAURI_INVOKE__) {
    const r = (await window.__TAURI_INVOKE__('extract_signals', { url: rawUrl })) as
      | { ok: true; signals: ExtractSignals }
      | { ok: false; reason: string };
    if (!r.ok) throw new Error(r.reason);
    return r.signals;
  }
  return fallbackCollect(rawUrl);
}

/**
 * @lang zh-CN 无 Tauri 时的回退采集：fetch + 正则抽取 CSS 变量与 HEX 字面量。
 * @lang en Fallback collect without Tauri: fetch + regex CSS vars and HEX literals.
 */
async function fallbackCollect(rawUrl: string): Promise<ExtractSignals> {
  const res = await fetch(rawUrl, { headers: { 'user-agent': 'HIA-Theme-Builder/0.1' } });
  if (!res.ok) throw new Error('HTTP ' + res.status);
  const html = await res.text();
  const cssVars: ExtractSignals['cssVars'] = [];
  const VAR_RE = /(--[a-zA-Z0-9-]+)\s*:\s*(#[0-9a-fA-F]{6})/g;
  for (const m of html.matchAll(VAR_RE)) {
    const hex = normalizeHex(m[2]);
    if (validHex(hex)) cssVars.push({ name: m[1], hex });
  }
  const freq = new Map<string, number>();
  const HEX_RE = /#([0-9a-fA-F]{6})\b/g;
  for (const m of html.matchAll(HEX_RE)) {
    const hex = normalizeHex(m[1]);
    if (validHex(hex)) freq.set(hex, (freq.get(hex) || 0) + 1);
  }
  const domColors = [...freq.entries()].map(([hex, count]) => ({ hex, count, region: 'general' as const }));
  return { cssVars, domColors, screenshotColors: [] };
}
