/**
 * @lang zh-CN 渲染进程逻辑：绑定取色按钮，调用主进程桥接，展示主副色候选与置信度，并写回操作台。
 * @lang en Renderer logic: bind extract button, call main bridge, show primary/secondary candidates with confidence, write back to console.
 */

import { buildTheme } from '@hia/theme-core';
import type { ExtractResult } from '@hia/theme-core';

// <lang zh-CN>桥接类型来自 preload 注入的 window.hia。</lang>
// <lang en>Bridge type from preload-injected window.hia.</lang>
declare global {
  interface Window {
    hia: { extractFromUrl: (url: string) => Promise<unknown> };
  }
}

const $ = <T extends HTMLElement>(id: string) => document.querySelector<T>('#' + id)!;

/** @lang zh-CN 取色按钮交互：调用主进程，渲染结果或错误。 @lang en>Extract button: call main, render result or error. */
function bind(): void {
  const url = $<HTMLInputElement>('url');
  const out = $<HTMLPreElement>('extractOut');
  const result = $<HTMLDivElement>('result');
  const primary = $<HTMLInputElement>('primary');
  const secondary = $<HTMLInputElement>('secondary');

  $<HTMLButtonElement>('extract').addEventListener('click', async () => {
    out.textContent = '取色中…';
    const r = (await window.hia.extractFromUrl(url.value)) as
      | { ok: true; result: ExtractResult }
      | { ok: false; ssrf: boolean; reason: string };
    if (!r.ok) {
      out.textContent = (r.ssrf ? '已拦截（SSRF）:' : '取色失败:') + r.reason;
      return;
    }
    const res = r.result;
    out.textContent = `动作: ${res.action} · 主色置信度: ${res.primaryConfidence.toFixed(2)}`;
    result.innerHTML = `
      <div class="cand"><span class="dot" style="background:${res.primary.hex}"></span> 主色 ${res.primary.hex} (分 ${res.primary.score.toFixed(2)})</div>
      ${res.secondary ? `<div class="cand"><span class="dot" style="background:${res.secondary.hex}"></span> 副色 ${res.secondary.hex}</div>` : '<div>无足够区分度副色</div>'}
      <div class="alts">备选: ${res.alternatives.map((a) => `<span class="dot" style="background:${a.hex}" title="${a.hex}"></span>`).join('')}</div>
    `;
    // <lang zh-CN>写回操作台并刷新预览主题。</lang>
    // <lang en>Write back to console and refresh preview theme.</lang>
    primary.value = res.primary.hex;
    if (res.secondary) secondary.value = res.secondary.hex;
    void buildTheme({ primary: res.primary.hex, secondary: res.secondary?.hex ?? secondary.value });
  });
}

bind();
