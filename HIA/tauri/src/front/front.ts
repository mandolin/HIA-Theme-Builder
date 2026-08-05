/**
 * @lang zh-CN Tauri 前端逻辑：调用取色桥（collectSignals）+ core.analyze，展示主副色候选并写回操作台。
 * @lang en Tauri front logic: call extraction bridge (collectSignals) + core.analyze, show primary/secondary candidates, write back to console.
 */

import { buildTheme, analyzeTheme } from '@hia/theme-core';
import type { ExtractResult } from '@hia/theme-core';
import { collectSignals } from '../fetch-signals.js';

const $ = <T extends HTMLElement>(id: string) => document.querySelector<T>('#' + id)!;

function bind(): void {
  const url = $<HTMLInputElement>('url');
  const out = $<HTMLPreElement>('extractOut');
  const result = $<HTMLDivElement>('result');
  const primary = $<HTMLInputElement>('primary');
  const secondary = $<HTMLInputElement>('secondary');

  $<HTMLButtonElement>('extract').addEventListener('click', async () => {
    out.textContent = '取色中…';
    try {
      // <lang zh-CN>采集信号（前端 SSRF + Rust 后端双校验）。</lang>
      // <lang en>Collect signals (front SSRF + Rust backend double-check).</lang>
      const signals = await collectSignals(url.value);
      // <lang zh-CN>多信号加权解析出主副色候选。</lang>
      // <lang en>Weighted analysis into primary/secondary candidates.</lang>
      const res: ExtractResult = analyzeTheme(signals);
      out.textContent = `动作: ${res.action} · 主色置信度: ${res.primaryConfidence.toFixed(2)}`;
      result.innerHTML = `
        <div class="cand"><span class="dot" style="background:${res.primary.hex}"></span> 主色 ${res.primary.hex} (分 ${res.primary.score.toFixed(2)})</div>
        ${res.secondary ? `<div class="cand"><span class="dot" style="background:${res.secondary.hex}"></span> 副色 ${res.secondary.hex}</div>` : '<div>无足够区分度副色</div>'}
        <div class="alts">备选: ${res.alternatives.map((a) => `<span class="dot" style="background:${a.hex}" title="${a.hex}"></span>`).join('')}</div>
      `;
      primary.value = res.primary.hex;
      if (res.secondary) secondary.value = res.secondary.hex;
      void buildTheme({ primary: res.primary.hex, secondary: res.secondary?.hex ?? secondary.value });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      out.textContent = (msg.startsWith('SSRF:') ? '已拦截（SSRF）:' : '取色失败:') + msg;
    }
  });
}

bind();
