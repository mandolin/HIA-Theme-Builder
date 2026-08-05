/**
 * @lang zh-CN 预览模块：重建 PC 企业后台预览（多结构模式）与小程序示例预览，主题实时同步。
 * @lang en Preview module: rebuilt PC admin preview (multiple structure modes) and mini-program sample, theme synced live.
 */

import type { Theme } from '@hia/theme-core';
import { subscribe } from './state.js';

/** @lang zh-CN PC 预览的结构模式：sidebar（侧栏）/ topbar（顶栏）/ cards（卡片流）。 @lang en PC preview structure modes: sidebar / topbar / cards. */
type PcMode = 'sidebar' | 'topbar' | 'cards';

/** @lang zh-CN 当前预览模式（模块内局部状态）。 @lang en Current preview mode (module-local state). */
let pcMode: PcMode = 'sidebar';

/** @lang zh-CN 把主题色注入一段 DOM 的根变量，供预览区复用。 @lang en Inject theme colors as CSS vars on a DOM root, reused by preview areas. */
function applyVars(el: HTMLElement, theme: Theme): void {
  el.style.setProperty('--c-primary', theme.primary.value);
  el.style.setProperty('--c-primary-on', theme.primary.on);
  el.style.setProperty('--c-secondary', theme.secondary.value);
  el.style.setProperty('--c-secondary-on', theme.secondary.on);
  el.style.setProperty('--c-p-500', theme.primary.scale['500']);
  el.style.setProperty('--c-p-600', theme.primary.scale['600']);
  el.style.setProperty('--c-p-100', theme.primary.scale['100']);
  el.style.setProperty('--c-s-500', theme.secondary.scale['500']);
}

/** @lang zh-CN 渲染 PC 后台预览的结构骨架，按模式切换布局类。 @lang en Render PC admin preview skeleton; switch layout class by mode. */
function pcMarkup(mode: PcMode): string {
  const layout = mode === 'sidebar' ? 'pc-sidebar' : mode === 'topbar' ? 'pc-topbar' : 'pc-cards';
  return `
    <div class="pc ${layout}">
      ${mode === 'sidebar' ? '<aside class="pc-rail"><div class="pc-logo">HIA</div><nav><span class="active"></span><span></span><span></span><span></span></nav></aside>' : ''}
      <div class="pc-main">
        ${mode === 'topbar' ? '<header class="pc-bar"><span class="pc-logo">HIA</span><span class="pc-nav"></span></header>' : ''}
        <header class="pc-head"><h3>控制台概览</h3><button class="pc-btn">新建</button></header>
        <div class="pc-cards">
          <div class="pc-card"><b>今日访问</b><em>1,284</em></div>
          <div class="pc-card"><b>订单</b><em>326</em></div>
          <div class="pc-card"><b>转化</b><em>12.4%</em></div>
        </div>
        <div class="pc-block">次级内容区，用于展示表格与图表占位。</div>
        <button class="pc-btn ghost">次要操作</button>
      </div>
    </div>
  `;
}

/**
 * @lang zh-CN 渲染预览面板（PC + 小程序），订阅主题刷新。
 * @lang en Render preview panel (PC + mini-program), subscribe for theme refresh.
 */
export function renderPreview(root: HTMLElement): void {
  root.innerHTML = `
    <section class="panel preview">
      <h2>实时预览</h2>
      <div class="tabs">
        <span>PC 模式：</span>
        <button data-mode="sidebar" class="active">侧栏</button>
        <button data-mode="topbar">顶栏</button>
        <button data-mode="cards">卡片流</button>
      </div>
      <div id="pcHost"></div>
      <h3>小程序示例</h3>
      <div id="mpHost" class="mp-shell">
        <div class="mp">
          <header class="mp-head"></header>
          <div class="mp-banner"></div>
          <div class="mp-card"></div>
          <div class="mp-card short"></div>
          <button class="mp-btn">立即体验</button>
        </div>
      </div>
    </section>
  `;

  const pcHost = root.querySelector<HTMLDivElement>('#pcHost')!;
  const mpHost = root.querySelector<HTMLDivElement>('#mpHost')!;
  const tabs = root.querySelectorAll<HTMLButtonElement>('.tabs button');

  // <lang zh-CN>模式切换按钮。</lang>
  // <lang en>Mode switch buttons.</lang>
  tabs.forEach((b) =>
    b.addEventListener('click', () => {
      pcMode = b.dataset.mode as PcMode;
      tabs.forEach((x) => x.classList.toggle('active', x === b));
      pcHost.innerHTML = pcMarkup(pcMode);
    })
  );

  // <lang zh-CN>小程序预览标记样式同步主色（顶栏/按钮/横幅）。</lang>
  // <lang en>Mini-program preview markers sync primary (header/button/banner).</lang>
  const mp = mpHost.querySelector<HTMLDivElement>('.mp')!;
  mp.querySelector<HTMLElement>('.mp-head')!.style.background = 'var(--c-primary)';
  mp.querySelector<HTMLElement>('.mp-banner')!.style.background = 'var(--c-secondary)';
  const mpBtn = mp.querySelector<HTMLButtonElement>('.mp-btn')!;
  mpBtn.style.background = 'var(--c-primary)';
  mpBtn.style.color = 'var(--c-primary-on)';
  mp.querySelector<HTMLElement>('.mp-card')!.style.borderTop = '3px solid var(--c-secondary)';

  subscribe((_s, theme) => {
    applyVars(pcHost, theme);
    applyVars(mpHost, theme);
    if (!pcHost.querySelector('.pc')) pcHost.innerHTML = pcMarkup(pcMode);
  });
}
