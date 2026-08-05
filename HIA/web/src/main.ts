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
  <!-- 顶部 Hero 头部区域（严格复刻原 HTML 结构） / Top hero header (exact replica of original HTML) -->
  <header class="hero-header">
    <div class="hero-inner">
      <!-- 左侧：标题 + 副标题 + 描述 + 标签 / Left: title + subtitle + description + tags -->
      <div class="hero-left">
        <h1 class="hero-title">HIA DESIGN SYSTEM · THEME MANAGEMENT STUDIO</h1>
        <div class="hero-subtitle">HIA 主题库管理页</div>
        <p class="hero-desc">
          这是一个可打开式主题库、多业项目、多示例项目主题和皮肤管理的工具台。你可以从主配色库合法选择或生成主主题预设，导入主副色，并一键切换到
          PC 端企业后台完整概览 与 小程序示例预览。支持任何格式模式、深色/浅色规范、主题级联管理、CSS/JSON Token 导出等。
        </p>
        <div class="hero-tags">
          <span class="hero-tag">默认: 钴蓝 #0047AB + 或选择 #00A8D3</span>
          <span class="hero-tag">主色候选: 44</span>
          <span class="hero-tag">内置主题预设: 6</span>
          <span class="hero-tag">保存符合定义主规则本地主题库</span>
        </div>
      </div>
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
