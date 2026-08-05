/**
 * @lang zh-CN 完整预览模块：PC 企业后台预览（侧栏/顶栏/卡片流三种结构模式）
 *   含仪表盘 KPI、数据表格、组件展示、色阶条、渐变应用展示；
 *   小程序示例预览（首页/列表/详情/我的/表单 五页切换 + 手机外框）。
 *   主题色通过 CSS 变量实时注入，所有预览内容随操作台输入同步刷新。
 * @lang en Full preview module: PC admin preview (sidebar/topbar/cards modes)
 *   with dashboard KPI, data table, component showcase, tonal scale, gradient display;
 *   mini-program preview (home/list/detail/profile/form pages + phone frame).
 *   Theme colors injected as CSS vars; all preview content syncs live with console input.
 */

import type { Theme, ColorScale } from '@hia/theme-core';
import { subscribe, setPcMode, setMpPage, type AppState, type PcMode, type MpPage } from './state.js';

/** @lang zh-CN 将主题色注入容器的 CSS 变量。 @en Inject theme colors as CSS vars on container. */
function applyVars(el: HTMLElement, theme: Theme): void {
  const root = el.style;
  // 主副色 / Primary & secondary
  root.setProperty('--c-primary', theme.primary.value);
  root.setProperty('--c-primary-on', theme.primary.on);
  root.setProperty('--c-secondary', theme.secondary.value);
  root.setProperty('--c-secondary-on', theme.secondary.on);
  // 色阶 / Tonal scale
  const ps = theme.primary.scale, ss = theme.secondary.scale;
  for (const k of Object.keys(ps)) root.setProperty(`--c-p-${k}`, ps[k as keyof typeof ps]);
  for (const k of Object.keys(ss)) root.setProperty(`--c-s-${k}`, ss[k as keyof typeof ss]);
}

// ─────────────────────────────────────────────
// PC 预览 HTML 生成 / PC preview markup generators
// ─────────────────────────────────────────────

/**
 * @lang zh-CN 生成侧栏模式的 PC 后台完整 DOM。
 * @en Generate sidebar-mode PC admin full DOM.
 */
function pcSidebarMarkup(): string {
  return `
    <div class="pc-sidebar">
      <aside class="pc-rail">
        <div class="pc-rail-logo">HIA</div>
        <nav class="pc-rail-nav">
          <div class="pc-nav-item active"><span class="pc-nav-icon"></span>控制台概览</div>
          <div class="pc-nav-item"><span class="pc-nav-icon"></span>数据分析</div>
          <div class="pc-nav-item"><span class="pc-nav-icon"></span>内容管理</div>
          <div class="pc-nav-item"><span class="pc-nav-icon"></span>用户权限</div>
          <div class="pc-nav-item"><span class="pc-nav-icon"></span>系统设置</div>
        </nav>
      </aside>
      <div class="pc-main-area">
        ${pcTopbarInner()}
        <div class="pc-content">${pcDashboardContent()}</div>
      </div>
    </div>`;
}

/**
 * @lang zh-CN 生成顶栏模式的 PC 后台完整 DOM。
 * @en Generate topbar-mode PC admin full DOM.
 */
function pcTopbarMarkup(): string {
  return `
    <div class="pc-topbar-mode">
      <header class="pc-topbar-bar">
        <div class="pc-rail-logo">HIA</div>
        <nav class="pc-topbar-nav">
          <div class="pc-nav-item active">控制台</div>
          <div class="pc-nav-item">分析</div>
          <div class="pc-nav-item">内容</div>
          <div class="pc-nav-item">用户</div>
          <div class="pc-nav-item">设置</div>
        </nav>
      </header>
      <div class="pc-content" style="padding:var(--sp-lg)">${pcDashboardContent()}</div>
    </div>`;
}

/**
 * @lang zh-CN PC 顶部工具栏（两种模式共用）。
 * @en PC top toolbar (shared by both modes).
 */
function pcTopbarInner(): string {
  return `
    <div class="pc-topbar-inner">
      <span class="pc-page-title">控制台概览</span>
      <button class="btn sm primary">新建</button>
    </div>`;
}

/**
 * @lang zh-CN PC 仪表盘内容区：KPI 卡片 + 表格 + 组件展示 + 色阶 + 渐变。
 * @en PC dashboard content area: KPI cards + table + component showcase + tonal + gradients.
 */
function pcDashboardContent(): string {
  return `
    <!-- KPI 统计卡片 / KPI stat cards -->
    <div class="kpi-grid">
      <div class="kpi-card">
        <div class="kpi-card-label">今日访问</div>
        <div class="kpi-card-value">1,284</div>
        <div class="kpi-card-sub">较昨日 +12.4%</div>
      </div>
      <div class="kpi-card">
        <div class="kpi-card-label">订单数</div>
        <div class="kpi-card-value">326</div>
        <div class="kpi-card-sub">较昨日 +5.2%</div>
      </div>
      <div class="kpi-card">
        <div class="kpi-card-label">转化率</div>
        <div class="kpi-card-value">12.4%</div>
        <div class="kpi-card-sub">目标 15%</div>
      </div>
      <div class="kpi-card">
        <div class="kpi-card-label">活跃用户</div>
        <div class="kpi-card-value">8,492</div>
        <div class="kpi-card-sub">在线 1,203</div>
      </div>
    </div>

    <!-- 数据表格 / Data table -->
    <div class="pc-table-wrap">
      <table class="pc-table">
        <thead>
          <tr><th>名称</th><th>状态</th><th>分类</th><th>更新时间</th><th>操作</th></tr>
        </thead>
        <tbody>
          <tr><td>企业后台完整概览</td><td><span class="status-tag success">已发布</span></td><td>模板</td><td>2026-08-05</td><td><button class="btn sm">查看</button></td></tr>
          <tr><td>主题管理系统 v2</td><td><span class="status-tag warning">审核中</span></td><td>功能</td><td>2026-08-04</td><td><button class="btn sm">查看</button></td></tr>
          <tr><td>小程序端适配方案</td><td><span class="status-tag info">草稿</span></td><td>文档</td><td>2026-08-03</td><td><button class="btn sm">查看</button></td></tr>
          <tr><td>Token 导出规范</td><td><span class="status-tag success">已发布</span></td><td>规范</td><td>2026-08-02</td><td><button class="btn sm">查看</button></td></tr>
        </tbody>
      </table>
    </div>

    <!-- 组件展示 / Component showcase -->
    <h3 style="font-size:14px;font-weight:600;margin:20px 0 10px;color:var(--text-secondary)">组件展示</h3>
    <div class="component-showcase">
      <div class="comp-group">
        <div class="comp-group-title">按钮 Buttons</div>
        <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:8px">
          <button class="btn primary">主按钮</button>
          <button class="btn outline">描边按钮</button>
          <button class="btn">默认按钮</button>
          <button class="btn" disabled style="opacity:0.5">禁用</button>
        </div>
      </div>
      <div class="comp-group">
        <div class="comp-group-title">标签 Tags</div>
        <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:8px">
          <span class="status-tag success">成功</span>
          <span class="status-tag warning">警告</span>
          <span class="status-tag danger">危险</span>
          <span class="status-tag info">信息</span>
        </div>
      </div>
      <div class="comp-group">
        <div class="comp-group-title">进度 Progress</div>
        <div style="margin-top:8px">
          <div style="height:8px;background:#e5e7eb;border-radius:4px;overflow:hidden">
            <div style="width:65%;height:100%;background:var(--c-primary,#0047AB);border-radius:4px"></div>
          </div>
          <div style="font-size:11px;color:var(--text-muted);margin-top:4px">完成度 65%</div>
        </div>
      </div>
    </div>

    <!-- 色阶展示 / Tonal scale display -->
    <h3 style="font-size:14px;font-weight:600;margin:20px 0 10px;color:var(--text-secondary)">主色色阶 Tonal Scale</h3>
    <div class="tonal-scale" id="primaryScale"></div>
    <h3 style="font-size:14px;font-weight:600;margin:16px 0 10px;color:var(--text-secondary)">副色色阶 Secondary Scale</h3>
    <div class="tonal-scale" id="secondaryScale"></div>

    <!-- 渐变应用展示 / Gradient application display -->
    <h3 style="font-size:14px;font-weight:600;margin:20px 0 10px;color:var(--text-secondary)">渐变应用预览 Gradient Preview</h3>
    <div id="gradientShowcase"></div>
  `;
}

// ─────────────────────────────────────────────
// 小程序预览 HTML 生成 / MP preview markup generators
// ─────────────────────────────────────────────

const mpPages: Record<MpPage, () => string> = {
  home: () => `
    <div class="mp-banner-img"></div>
    <div class="mp-section-title">快捷入口</div>
    <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin-bottom:16px">
      ${['数据','报表','设置','消息'].map(n => `<div style="background:var(--bg-panel);border-radius:8px;padding:12px 4px;text-align:center;font-size:11px;box-shadow:var(--sh-sm)">${n}</div>`).join('')}
    </div>
    <div class="mp-section-title">今日推荐</div>
    ${[1,2,3].map(() => `<div class="mp-list-item"><div class="mp-avatar" style="width:40px;height:40px;border-radius:8px"></div><div style="flex:1"><div style="font-size:13px;font-weight:600">推荐内容标题</div><div style="font-size:11px;color:var(--text-muted)">简要描述信息</div></div></div>`).join('')}
    <button class="mp-btn-primary">立即体验</button>
  `,
  list: () => `
    <div class="mp-section-title">全部服务</div>
    <div style="display:flex;gap:6px;margin-bottom:12px;flex-wrap:wrap">
      ${['全部','政务','医疗','科技','教育'].map(t => `<span class="status-tag info" style="cursor:pointer">${t}</span>`).join('')}
    </div>
    ${[1,2,3,4,5].map(i => `<div class="mp-list-item"><div class="mp-avatar" style="background:${i%2?'var(--c-secondary)':'var(--c-primary)'}"></div><div style="flex:1"><div style="font-size:13px;font-weight:600">列表项标题 ${i}</div><div style="font-size:11px;color:var(--text-muted)">副标题描述文字</div></div><span style="font-size:11px;color:var(--text-muted)">&gt;</span></div>`).join('')}
  `,
  detail: () => `
    <div class="mp-banner-img" style="height:140px;border-radius:0 0 16px 16px;margin:-12px -12px 12px"></div>
    <div class="mp-section-title">详情信息</div>
    <div style="background:var(--bg-panel);border-radius:10px;padding:12px;box-shadow:var(--sh-sm);margin-bottom:12px">
      <div style="font-size:15px;font-weight:700;margin-bottom:8px">页面标题详情</div>
      <div style="font-size:12px;color:var(--text-muted);line-height:1.6">这里是详细内容的描述区域，用于展示完整的文章或数据详情信息。支持多行文本和排版。</div>
    </div>
    <div class="mp-btn-primary">确认操作</div>
  `,
  profile: () => `
    <div style="text-align:center;padding:20px 0">
      <div class="mp-avatar" style="width:64px;height:64px;margin:0 auto 10px;border-radius:50%;display:inline-flex;align-items:center;justify-content:center;color:#fff;font-size:22px;font-weight:700">U</div>
      <div style="font-size:16px;font-weight:700">用户昵称</div>
      <div style="font-size:12px;color:var(--text-muted)">user@example.com</div>
    </div>
    <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-bottom:16px;text-align:center">
      ${[['关注','128'],['粉丝','1.2k'],['获赞','3.6k']].map(([l,v]) => `<div style="background:var(--bg-panel);border-radius:8px;padding:10px"><div style="font-size:16px;font-weight:700;color:var(--c-primary)">${v}</div><div style="font-size:11px;color:var(--text-muted)">${l}</div></div>`).join('')}
    </div>
    ${['我的收藏','浏览历史','账号设置','帮助反馈','关于我们'].map(n => `<div class="mp-list-item"><span>${n}</span><span style="margin-left:auto;font-size:11px;color:var(--text-muted)">&gt;</span></div>`).join('')}
  `,
  form: () => `
    <div class="mp-section-title">填写信息</div>
    <div style="background:var(--bg-panel);border-radius:10px;padding:14px;box-shadow:var(--sh-sm)">
      ${[
        ['主题名称','请输入主题名称'],
        ['主色 HEX','#0047AB'],
        ['备注说明','可选填']
      ].map(([label,ph]) => `<div style="margin-bottom:12px"><label style="font-size:12px;font-weight:600;color:var(--text-secondary);display:block;margin-bottom:4px">${label}</label><input type="text" placeholder="${ph}" style="width:100%;padding:8px 10px;border:1px solid var(--border-light);border-radius:6px;font-size:13px;box-sizing:border-box" /></div>`).join('')}
      <label style="display:flex;align-items:center;gap:8px;font-size:13px;margin-bottom:16px;cursor:pointer">
        <input type="checkbox" checked /> 启用渐变效果
      </label>
      <button class="mp-btn-primary" style="margin-top:0">提交保存</button>
    </div>
  `
};

// ─────────────────────────────────────────────
// 主渲染函数 / Main render function
// ─────────────────────────────────────────────

/**
 * @lang zh-CN 渲染完整预览面板（PC + 小程序），订阅状态实时刷新。
 * @en Render full preview panel (PC + mini-program), subscribe for live refresh.
 */
export function renderPreview(root: HTMLElement): void {
  root.innerHTML = `
    <section class="panel preview-panel">
      <div class="panel-header">
        <h2>PC / 小程序联调预览设置</h2>
      </div>

      <!-- PC 预览 / PC preview -->
      <h3>PC 企业后台预览</h3>
      <p class="hint">此区域基于当前主题的配色方案，同时作用于 PC 企业后台和小程序预览。预览包含仪表盘、表格、组件、色阶与渐变；部分设置覆盖色，禁止全局。</p>

      <div class="preview-toolbar">
        <div class="tabs pc-mode-tabs">
          <button class="tab-btn active" data-mode="sidebar">左右结构</button>
          <button class="tab-btn" data-mode="topbar">上下结构</button>
          <button class="tab-btn" data-mode="cards">卡片流混合</button>
        </div>
        <div style="display:flex;gap:6px">
          <button class="btn sm outline" id="globalGradBtn">Global Gradient</button>
          <button class="btn sm" id="resetPcBtn">全部恢复默认</button>
        </div>
      </div>
      <div class="pc-preview" id="pcPreview"></div>

      <!-- 小程序预览 / Mini-program preview -->
      <h3 style="margin-top:24px">小程序示例预览</h3>
      <div class="preview-toolbar">
        <div class="tabs mp-page-tabs">
          <button class="tab-btn active" data-page="home">首页</button>
          <button class="tab-btn" data-page="list">列表</button>
          <button class="tab-btn" data-page="detail">详情</button>
          <button class="tab-btn" data-page="profile">我的</button>
          <button class="tab-btn" data-page="form">表单</button>
        </div>
      </div>
      <div class="mp-preview">
        <div class="mp-phone">
          <div class="mp-phone-notch">HIA Mini Program</div>
          <div class="mp-phone-screen" id="mpScreen"></div>
        </div>
      </div>
    </section>
  `;

  const $ = <T extends HTMLElement>(id: string) => root.querySelector<T>('#' + id)!;
  const pcPreview = $<HTMLDivElement>('pcPreview');
  const mpScreen = $<HTMLDivElement>('mpScreen');
  const pcTabs = root.querySelectorAll<HTMLButtonElement>('.pc-mode-tabs .tab-btn');
  const mpTabs = root.querySelectorAll<HTMLButtonElement>('.mp-page-tabs .tab-btn');

  // 当前模式缓存 / Current mode cache
  let currentPcMode: PcMode = 'sidebar';
  let currentMpPage: MpPage = 'home';

  // PC 模式切换 / PC mode switch
  pcTabs.forEach((b) =>
    b.addEventListener('click', () => {
      currentPcMode = b.dataset.mode as PcMode;
      pcTabs.forEach((x) => x.classList.toggle('active', x === b));
      setPcMode(currentPcMode);
    })
  );

  // 小程序页面切换 / MP page switch
  mpTabs.forEach((b) =>
    b.addEventListener('click', () => {
      currentMpPage = b.dataset.page as MpPage;
      mpTabs.forEach((x) => x.classList.toggle('active', x === b));
      setMpPage(currentMpPage);
    })
  );

  // 订阅状态刷新 / Subscribe for state refresh
  subscribe((s: AppState) => {
    const { theme } = s;

    // 注入 CSS 变量到两个预览容器 / Inject CSS vars to both preview containers
    applyVars(pcPreview, theme);
    applyVars(mpScreen, theme);

    // PC 预览渲染 / PC preview render
    if (!pcPreview.querySelector('.pc-sidebar') && !pcPreview.querySelector('.pc-topbar-mode')) {
      pcPreview.innerHTML = currentPcMode === 'sidebar' ? pcSidebarMarkup() : pcTopbarMarkup();
    }

    // 色阶填充 / Fill tonal scales
    const priScaleEl = pcPreview.querySelector<HTMLElement>('#primaryScale');
    const secScaleEl = pcPreview.querySelector<HTMLElement>('#secondaryScale');
    if (priScaleEl) fillTonalScale(priScaleEl, theme.primary.scale);
    if (secScaleEl) fillTonalScale(secScaleEl, theme.secondary.scale);

    // 小程序页面渲染 / MP page render
    mpScreen.innerHTML = mpPages[s.mpPage]();

    // 同步小程序壳内主题色 / Sync theme colors in MP shell
    const notch = root.querySelector<HTMLElement>('.mp-phone-notch');
    if (notch) notch.style.background = theme.primary.value;
  });
}

/**
 * @lang zh-CN 填充色阶 DOM 条：从 50 到 900 每个色阶一个色块。
 * @en Fill tonal scale DOM bar: one color block per shade from 50 to 900.
 */
function fillTonalScale(container: HTMLElement, scale: ColorScale): void {
  container.innerHTML = '';
  const shades = (['50','100','200','300','400','500','600','700','800','900'] as const);
  shades.forEach((k) => {
    const el = document.createElement('div');
    el.className = 'tonal-step';
    el.style.background = scale[k] || '#ccc';
    el.title = `${k}: ${scale[k]}`;
    el.textContent = k;
    container.appendChild(el);
  });
}
