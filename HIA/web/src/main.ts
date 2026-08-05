/**
 * @lang zh-CN web 控制台入口：装配操作台、预览、渐变设置、Token 面板四个区域。
 * @lang en Web console entry: wire console, preview, gradient settings and token panel regions.
 */

import './style.css';
import { renderConsole } from './console.js';
import { renderPreview } from './preview.js';
import { renderGradient } from './gradient.js';
import { renderTokenPanel } from './tokenpanel.js';

/** @lang zh-CN 应用挂载点。 @lang en App mount point. */
const app = document.querySelector<HTMLDivElement>('#app')!;

app.innerHTML = `
  <header class="topbar">
    <h1>HIA 主题构建器</h1>
    <span class="sub">Web 控制台 · 基于 @hia/theme-core</span>
  </header>
  <main class="grid">
    <div id="consoleHost"></div>
    <div id="previewHost"></div>
    <div id="gradientHost"></div>
    <div id="tokenHost"></div>
  </main>
`;

// <lang zh-CN>依次渲染四个面板到各自宿主。</lang>
// <lang en>Render the four panels into their hosts.</lang>
renderConsole(document.querySelector<HTMLDivElement>('#consoleHost')!);
renderPreview(document.querySelector<HTMLDivElement>('#previewHost')!);
renderGradient(document.querySelector<HTMLDivElement>('#gradientHost')!);
renderTokenPanel(document.querySelector<HTMLDivElement>('#tokenHost')!);
