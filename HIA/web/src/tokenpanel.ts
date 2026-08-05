/**
 * @lang zh-CN Token 导出面板：CSS / JSON 格式切换、代码展示（深色背景）、
 *   一键复制（含成功反馈）、浏览器下载、Global Gradient Token 包含开关。
 * @lang en Token export panel: CSS/JSON format toggle, code display (dark background),
 *   one-click copy (with success feedback), browser download, Global Gradient token include toggle.
 */

import type { Theme } from '@hia/theme-core';
import { toCss, toJson, copyText, downloadText } from './token.js';
import { subscribe, setTokenFormat, toggleIncludeGradient, type AppState } from './state.js';

/**
 * @lang zh-CN 渲染 Token 导出面板，订阅主题刷新导出内容。
 * @en Render token export panel; subscribe for content refresh.
 */
export function renderTokenPanel(root: HTMLElement): void {
  root.innerHTML = `
    <section class="panel token-panel">
      <div class="panel-header">
        <h2>Token 导出</h2>
        <div style="display:flex;gap:6px;align-items:center">
          <label style="display:flex;align-items:center;gap:5px;font-size:12px;cursor:pointer;font-weight:500;color:var(--text-secondary)">
            <input type="checkbox" id="gradToggle" checked /> Global Gradient
          </label>
        </div>
      </div>

      <!-- 格式切换 / Format tabs -->
      <div class="tabs token-tabs">
        <button class="tab-btn active" data-fmt="css">CSS</button>
        <button class="tab-btn" data-fmt="json">JSON</button>
        <span style="flex:1"></span>
        <button class="btn sm primary" id="copyBtn">复制</button>
        <button class="btn sm outline" id="dlBtn">下载</button>
      </div>

      <!-- 代码输出区 / Code output area -->
      <pre class="token-output" id="tokenOutput"></pre>
    </section>
  `;

  const $ = <T extends HTMLElement>(id: string) => root.querySelector<T>('#' + id)!;
  const output = $<HTMLPreElement>('tokenOutput');
  const fmtTabs = root.querySelectorAll<HTMLButtonElement>('.token-tabs .tab-btn');

  // 当前格式缓存 / Current format cache
  let currentFmt: 'css' | 'json' = 'css';
  // 最新主题缓存 / Latest theme cache
  let latestTheme: Theme | null = null;

  // 格式切换 / Format switch
  fmtTabs.forEach((b) =>
    b.addEventListener('click', () => {
      currentFmt = b.dataset.fmt as 'css' | 'json';
      fmtTabs.forEach((x) => x.classList.toggle('active', x === b));
      setTokenFormat(currentFmt);
      if (latestTheme) renderOutput(latestTheme);
    })
  );

  // Global Gradient 开关 / Gradient toggle
  const gradToggle = $<HTMLInputElement>('gradToggle');
  gradToggle.addEventListener('change', () => toggleIncludeGradient());

  /**
   * @lang zh-CN 渲染导出内容到代码区。 @en Render export content to code area.
   */
  function renderOutput(theme: Theme): void {
    latestTheme = theme;
    output.textContent = currentFmt === 'css' ? toCss(theme) : toJson(theme);
  }

  // 复制按钮 / Copy button
  $<HTMLButtonElement>('copyBtn').addEventListener('click', async () => {
    const text = output.textContent || '';
    const ok = await copyText(text);
    const btn = $<HTMLButtonElement>('copyBtn');
    btn.textContent = ok ? '已复制' : '复制失败';
    btn.classList.toggle('primary', !ok);
    setTimeout(() => { btn.textContent = '复制'; btn.classList.add('primary'); }, 1500);
  });

  // 下载按钮 / Download button
  $<HTMLButtonElement>('dlBtn').addEventListener('click', () => {
    const text = output.textContent || '';
    if (currentFmt === 'css') downloadText('hia-theme.css', text, 'text/css');
    else downloadText('hia-theme.json', text, 'application/json');
  });

  // 订阅主题刷新 / Subscribe for theme refresh
  subscribe((s: AppState) => {
    renderOutput(s.theme);
    // 同步 gradient 开关状态 / Sync gradient toggle state
    gradToggle.checked = s.includeGradientToken;
  });
}
