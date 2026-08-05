/**
 * @lang zh-CN Token 面板：展示 CSS/JSON 导出，提供复制与下载。
 * @lang en Token panel: show CSS/JSON export with copy and download.
 */

import type { Theme } from '@hia/theme-core';
import { toCss, toJson, copyText, downloadText } from './token.js';
import { subscribe } from './state.js';

/**
 * @lang zh-CN 渲染 Token 导出面板，订阅主题刷新内容。
 * @lang en Render token export panel, subscribe for content refresh.
 */
export function renderTokenPanel(root: HTMLElement): void {
  root.innerHTML = `
    <section class="panel token">
      <h2>Token 导出</h2>
      <div class="tabs">
        <button data-fmt="css" class="active">CSS</button>
        <button data-fmt="json">JSON</button>
        <button id="copyBtn">复制</button>
        <button id="dlBtn">下载</button>
      </div>
      <pre id="out"></pre>
    </section>
  `;

  const out = root.querySelector<HTMLPreElement>('#out')!;
  const tabs = root.querySelectorAll<HTMLButtonElement>('.tabs button[data-fmt]');
  let fmt: 'css' | 'json' = 'css';
  // <lang zh-CN>缓存最新主题，格式切换时立即重渲染。</lang>
  // <lang en>Cache latest theme; re-render immediately on format switch.</lang>
  let latest: Theme | null = null;

  tabs.forEach((b) =>
    b.addEventListener('click', () => {
      fmt = b.dataset.fmt as 'css' | 'json';
      tabs.forEach((x) => x.classList.toggle('active', x === b));
      if (latest) render(latest);
    })
  );

  const render = (theme: Theme) => {
    latest = theme;
    out.textContent = fmt === 'css' ? toCss(theme) : toJson(theme);
  };

  root.querySelector<HTMLButtonElement>('#copyBtn')!.addEventListener('click', async () => {
    const ok = await copyText(out.textContent || '');
    root.querySelector<HTMLButtonElement>('#copyBtn')!.textContent = ok ? '已复制' : '复制失败';
    setTimeout(() => (root.querySelector<HTMLButtonElement>('#copyBtn')!.textContent = '复制'), 1200);
  });
  root.querySelector<HTMLButtonElement>('#dlBtn')!.addEventListener('click', () => {
    if (fmt === 'css') downloadText('hia-theme.css', out.textContent || '', 'text/css');
    else downloadText('hia-theme.json', out.textContent || '', 'application/json');
  });

  subscribe((_s, theme) => render(theme));
}
