/**
 * @lang zh-CN 主题库管理区：搜索过滤、分类下拉、主题卡片网格（内置+自定义）、
 *   应用/载入操作台/删除操作。展示每个主题的主副色、名称、标签、描述。
 * @lang en Theme library management: search filter, category dropdown, theme card grid
 *   (built-in + custom), apply/load-to-console/delete actions. Shows primary/secondary,
 *   name, tags, description per theme.
 */

import { subscribe, type AppState } from './state.js';

/**
 * @lang zh-CN 渲染主题库管理面板，订阅状态实时刷新列表。
 * @en Render theme library panel; subscribe for live list refresh.
 */
export function renderLibrary(root: HTMLElement): void {
  root.innerHTML = `
    <section class="panel library-panel">
      <div class="panel-header">
        <h2>主题库管理</h2>
        <button class="btn sm" id="themeLibBtn">Theme Library</button>
      </div>

      <!-- 搜索与过滤 / Search & filter -->
      <div class="library-search-bar">
        <input type="text" id="libSearch" placeholder="搜索主题名称 / 主色 / 副色" />
        <select id="libCategory">
          <option value="">全部分类</option>
          <option value="默认">默认</option>
          <option value="政务">政务</option>
          <option value="医疗">医疗</option>
          <option value="科技">科技</option>
          <option value="金融">金融</option>
          <option value="教育">教育</option>
          <option value="自定义">自定义</option>
        </select>
      </div>

      <!-- 主题卡片网格 / Theme card grid -->
      <div class="library-grid" id="libGrid"></div>
    </section>
  `;

  const $ = <T extends HTMLElement>(id: string) => root.querySelector<T>('#' + id)!;
  const searchInput = $<HTMLInputElement>('libSearch');
  const catSelect = $<HTMLSelectElement>('libCategory');
  const grid = $<HTMLDivElement>('libGrid');

  // 搜索输入防抖 / Search input debounce
  let searchTimer: ReturnType<typeof setTimeout>;
  searchInput.addEventListener('input', () => {
    clearTimeout(searchTimer);
    // <lang zh-CN>通过全局状态间接触发重渲染（subscribe 会响应）。</lang>
    // <lang en>Indirectly trigger re-render via global state (subscribe responds).</lang>
    searchTimer = setTimeout(() => {
      /* searchInput 的值在渲染时从 state.librarySearch 读取；
         这里我们用 DOM 直接过滤以避免引入额外的 state 更新 API */
      renderCards();
    }, 150);
  });

  catSelect.addEventListener('change', () => renderCards());

  /**
   * @lang zh-CN 根据当前搜索词和分类过滤并渲染主题卡片。
   * @en Filter and render theme cards by current search term and category.
   */
  function renderCards(): void {
    const q = searchInput.value.trim().toLowerCase();
    const cat = catSelect.value;
    // <lang zh-CN>从最新快照获取库数据。</lang>
    // <lang en>Get library data from latest snapshot.</lang>
    /* 注意：这里我们用一个闭包变量缓存最新的 library 数据，
       在 subscribe 回调中更新它，避免每次都重新查询 DOM */
    grid.innerHTML = '';
    const filtered = currentLib.filter((item) => {
      const matchQ = !q ||
        item.name.toLowerCase().includes(q) ||
        item.primary.toLowerCase().includes(q) ||
        item.secondary.toLowerCase().includes(q) ||
        (item.primaryName || '').toLowerCase().includes(q);
      const matchC = !cat || item.category === cat || (cat === '自定义' && item.custom);
      return matchQ && matchC;
    });
    if (filtered.length === 0) {
      grid.innerHTML = '<p class="hint" style="text-align:center;padding:24px">无匹配主题</p>';
      return;
    }
    filtered.forEach((item) => {
      const card = document.createElement('div');
      card.className = 'lib-card';
      card.innerHTML = `
        <div class="lib-header">
          <span class="lib-title">${item.name}</span>
          ${item.custom ? '<span class="lib-tag" style="background:#fef3c7;color:#92400e">自定义</span>' : `<span class="lib-tag">${item.category}</span>`}
        </div>
        <div class="lib-colors">
          <span class="lib-color-block" style="background:${item.primary}"></span>
          <span class="lib-hex">${item.primary} / ${item.secondary}</span>
        </div>
        <div class="lib-desc">${item.note || `${item.industry || ''}`}</div>
        <div class="lib-actions">
          <button class="btn sm primary lib-apply" data-id="${item.id}">应用</button>
          <button class="btn sm outline lib-load" data-id="${item.id}">载入操作台</button>
          ${item.custom ? `<button class="btn sm lib-del" data-id="${item.id}" style="color:#dc2626;border-color:#fecaca">删除</button>` : ''}
        </div>
      `;
      grid.appendChild(card);
    });

    // 绑定卡片内按钮事件 / Bind card button events
    grid.querySelectorAll<HTMLButtonElement>('.lib-apply').forEach((btn) =>
      btn.addEventListener('click', () => onApply(btn.dataset.id!))
    );
    grid.querySelectorAll<HTMLButtonElement>('.lib-load').forEach((btn) =>
      btn.addEventListener('click', () => onLoad(btn.dataset.id!))
    );
    grid.querySelectorAll<HTMLButtonElement>('.lib-del').forEach((btn) =>
      btn.addEventListener('click', () => onDelete(btn.dataset.id!))
    );
  }

  /** @lang zh-CN 应用主题回调占位（由外部注入）。 @en Apply theme callback stub (injected from outside). */
  let onApply = (_id: string) => {};
  /** @lang zh-CN 载入操作台回调占位。 @en Load to console callback stub. */
  let onLoad = (_id: string) => {};
  /** @lang zh-CN 删除回调占位。 @en Delete callback stub. */
  let onDelete = (_id: string) => {};

  // <lang zh-CN>缓存最新库数据供过滤使用。</lang>
  // <lang en>Cache latest library data for filtering.</lang>
  let currentLib: AppState['library'] = [];

  subscribe((s: AppState) => {
    currentLib = s.library;
    // 注入操作回调 / Inject action callbacks
    onApply = (_id) => { /* 通过 import 循环避免；直接调用 state 方法 */ };
    onLoad = (_id) => {};
    onDelete = (_id) => {};

    // 重新绑定到当前 subscribe 上下文中的最新 state 操作
    /* 由于 ES module 的限制，我们在这里重新绑定按钮事件，
       使用闭包捕获最新的 state 操作函数引用 */
    renderCards();

    // 重新绑定操作按钮（每次状态变化后重新绑定以确保引用正确）
    grid.querySelectorAll<HTMLButtonElement>('.lib-apply').forEach((btn) => {
      btn.onclick = () => {
        const id = btn.dataset.id!;
        const item = currentLib.find((l) => l.id === id);
        if (!item) return;
        replaceConsole({
          primary: item.primary,
          secondary: item.secondary,
          primaryName: item.primaryName,
          secondaryName: item.secondaryName,
          themeName: item.name
        });
      };
    });
    grid.querySelectorAll<HTMLButtonElement>('.lib-load').forEach((btn) => {
      btn.onclick = () => {
        const id = btn.dataset.id!;
        const item = currentLib.find((l) => l.id === id);
        if (!item) return;
        replaceConsole({
          primary: item.primary,
          secondary: item.secondary,
          primaryName: item.primaryName,
          secondaryName: item.secondaryName,
          themeName: item.name
        });
      };
    });
    grid.querySelectorAll<HTMLButtonElement>('.lib-del').forEach((btn) => {
      btn.onclick = () => deleteFromLibrary(btn.dataset.id!);
    });
  });
}

// 延迟导入避免循环依赖 / Lazy import to avoid circular dependency
import { replaceConsole, deleteFromLibrary } from './state.js';
