/**
 * @lang zh-CN 网址信号采集（最小可用版）：HTTP 获取页面 HTML，用正则抽取 CSS 变量与颜色字面量作为提取信号。
 * 设计为可替换层：后续可换无头浏览器（Electron Chromium / Playwright）采集 DOM 最终样式与截图，复用同一信号结构。
 * @lang en Minimal URL signal collector: HTTP fetch HTML, regex-extract CSS variables and color literals as extraction signals. Replaceable layer: later swap to headless (Electron Chromium / Playwright) for DOM resolved styles + screenshot, same signal shape.
 */

import { guardUrl } from './ssrf.js';
import type { ExtractSignals, CssVarSignal, DomColorSignal } from '@hia/theme-core';
import { normalizeHex, validHex } from '@hia/theme-core';

/** @lang zh-CN 6 位 HEX 颜色字面量（含 #）。 @lang en 6-digit HEX color literals (with #). */
const HEX_RE = /#([0-9a-fA-F]{6})\b/g;
/** @lang zh-CN CSS 自定义属性声明，如 --primary-color: #0047AB; @lang en CSS custom property declarations like --primary-color: #0047AB; */
const VAR_RE = /(--[a-zA-Z0-9-]+)\s*:\s*(#[0-9a-fA-F]{6})/g;

/**
 * @lang zh-CN 由 URL 采集颜色信号。先过 SSRF 校验，再抓取并解析；失败抛出带原因的错误。
 * @lang en Collect color signals from a URL. SSRF guard first, then fetch and parse; throws with reason on failure.
 */
export async function collectSignals(rawUrl: string, timeoutMs = 8000): Promise<ExtractSignals> {
  // <lang zh-CN>第一关：SSRF 安全校验。</lang>
  // <lang en>Gate 1: SSRF safety guard.</lang>
  const guard = guardUrl(rawUrl);
  if (!guard.ok) throw new Error('SSRF:' + guard.reason);

  // <lang zh-CN>带超时与 UA 的抓取（Node 18+ 全局 fetch）。</lang>
  // <lang en>Fetch with timeout and UA (Node 18+ global fetch).</lang>
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  let html: string;
  try {
    const res = await fetch(rawUrl, {
      signal: ctrl.signal,
      headers: { 'user-agent': 'HIA-Theme-Builder/0.1 (+color-extraction)' }
    });
    if (!res.ok) throw new Error('HTTP ' + res.status);
    html = await res.text();
  } finally {
    clearTimeout(timer);
  }

  // <lang zh-CN>抽取 CSS 变量语义信号。</lang>
  // <lang en>Extract CSS variable semantic signals.</lang>
  const cssVars: CssVarSignal[] = [];
  for (const m of html.matchAll(VAR_RE)) {
    const hex = normalizeHex(m[2]);
    if (validHex(hex)) cssVars.push({ name: m[1], hex });
  }

  // <lang zh-CN>抽取页面全部 HEX 字面量并按出现频次计数为 DOM 颜色信号（general 区域）。</lang>
  // <lang en>Extract all HEX literals, count frequency as DOM color signal (general region).</lang>
  const freq = new Map<string, number>();
  for (const m of html.matchAll(HEX_RE)) {
    const hex = normalizeHex(m[1]);
    if (!validHex(hex)) continue;
    freq.set(hex, (freq.get(hex) || 0) + 1);
  }
  const domColors: DomColorSignal[] = [...freq.entries()].map(([hex, count]) => ({
    hex,
    count,
    region: 'general'
  }));

  // <lang zh-CN>截图信号留待无头浏览器版本补充（本版返回空）。</lang>
  // <lang en>Screenshot signals deferred to headless version (empty here).</lang>
  return { cssVars, domColors, screenshotColors: [] };
}
