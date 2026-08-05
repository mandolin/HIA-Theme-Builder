/**
 * @lang zh-CN HIA 主题构建器 Web 控制台入口：装配左右分栏布局。
 *   左侧 = 主题操作台（主副色选择、候选库、预设、和谐配色）。
 *   右侧 = 主题库管理 + PC/小程序预览 + 渐变设置 + Token 导出。
 *   对齐原始 HIA_theme_manager.html 的完整功能与视觉呈现。
 * @lang en HIA Theme Builder web console entry: assemble left-right split layout.
 *   Left = theme console (primary/secondary pick, candidates, presets, harmony).
 *   Right = library management + PC/MP preview + gradient settings + token export.
 *   Aligned with original HIA_theme_manager.html's full functionality & visuals.
 */

import './style.css';
import { renderConsole } from './console.js';
import { renderLibrary } from './library.js';
import { renderPreview } from './preview.js';
import { renderGradient } from './gradient.js';
import { renderTokenPanel } from './tokenpanel.js';

/** @lang zh-CN 应用挂载点。 @en App mount point. */
const app = document.querySelector<HTMLDivElement>('#app')!;

app.innerHTML = `
  <!-- 顶部品牌栏 / Top brand bar -->
  <header class="topbar">
    <div class="brand-group">
      <h1>HIA DESIGN SYSTEM · THEME MANAGEMENT STUDIO</h1>
      <span class="sub">HIA 主题库管理页</span>
    </div>
    <div class="badges">
      <span class="badge">默认: 钴蓝 #0047AB + 或选择 #00A8D3</span>
      <span class="badge">主色候选: 44</span>
      <span class="badge">内置主题预设: 6</span>
      <span class="badge">保存符合定义主规则本地主题库</span>
    </div>
  </header>

  <!-- 主布局：左操作台 + 右内容区 / Main layout: left console + right content -->
  <div class="app-layout">
    <!-- 左侧操作台 / Left console column -->
    <div class="console-col" id="consoleHost"></div>

    <!-- 右侧主区域 / Right main area -->
    <div class="main-col">
      <div id="libraryHost"></div>
      <div id="previewHost"></div>
      <div id="gradientHost"></div>
      <div id="tokenHost"></div>
    </div>
  </div>
`;

// <lang zh-CN>依次渲染各面板到各自宿主容器。</lang>
// <lang en>Render each panel into its host container.
renderConsole(document.querySelector<HTMLDivElement>('#consoleHost')!);
renderLibrary(document.querySelector<HTMLDivElement>('#libraryHost')!);
renderPreview(document.querySelector<HTMLDivElement>('#previewHost')!);
renderGradient(document.querySelector<HTMLDivElement>('#gradientHost')!);
renderTokenPanel(document.querySelector<HTMLDivElement>('#tokenHost')!);
