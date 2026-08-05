/**
 * @lang zh-CN 主题操作台面板：主/副色颜色选择器、HEX 输入与命名、44 色候选库网格、
 *   6 个内置主题预设卡片、基于主色的和谐副色候选、快捷操作（应用/保存/导入/自动命名）。
 *   消费 core 的 primaryCandidates / builtinPresets / generateSecondarySet / buildTheme。
 * @lang en Theme console panel: primary/secondary color pickers, HEX input & naming,
 *   44-color candidate grid, 6 built-in preset cards, harmony secondary candidates,
 *   quick actions (apply/save/import/auto-name). Consumes core APIs.
 */

import {
  primaryCandidates,
  builtinPresets,
  generateSecondarySet
} from '@hia/theme-core';
import { subscribe, updateConsole, replaceConsole, saveToLibrary, type AppState } from './state.js';

/**
 * @lang zh-CN 渲染操作台面板到指定容器，订阅状态实时刷新所有输入和动态内容。
 * @en Render console panel into container; subscribe for live refresh of all inputs and dynamic content.
 */
export function renderConsole(root: HTMLElement): void {
  // ── 面板 HTML 结构 / Panel HTML structure ──
  root.innerHTML = `
    <section class="panel console-panel">
      <div class="panel-header">
        <h2>当前主题操作台</h2>
        <button class="btn sm" id="autoNameBtn">自动命名</button>
      </div>

      <!-- 主色 / Primary -->
      <div class="form-row">
        <label>主题名称</label>
        <input type="text" id="themeName" placeholder="HIA 默认" style="flex:2" />
      </div>
      <div class="form-row">
        <div class="form-group">
          <label>主色 / HEX</label>
          <div style="display:flex;gap:6px;align-items:center">
            <input type="color" id="primaryColor" />
            <input type="text" id="primaryHex" maxlength="7" placeholder="#0047AB" style="width:90px" />
          </div>
        </div>
        <div class="form-group">
          <label>钻蓝</label>
          <input type="text" id="primaryName" placeholder="主色名" />
        </div>
      </div>

      <!-- 副色 / Secondary -->
      <div class="form-row">
        <div class="form-group">
          <label>副色 / HEX</label>
          <div style="display:flex;gap:6px;align-items:center">
            <input type="color" id="secondaryColor" />
            <input type="text" id="secondaryHex" maxlength="7" placeholder="#00A8D3" style="width:90px" />
          </div>
        </div>
        <div class="form-group">
          <label>清透青</label>
          <input type="text" id="secondaryName" placeholder="副色名" />
        </div>
        <button class="btn sm outline" id="autoSecondaryBtn">自动副色</button>
      </div>

      <!-- 快捷操作 / Quick actions -->
      <div class="btn-group" style="margin:14px 0">
        <button class="btn primary lg" id="applyBtn">应用到当前主题</button>
        <button class="btn lg" id="savePresetBtn">生成并导入主题库</button>
        <button class="btn outline lg" id="updatePresetBtn">更新当前选中预设</button>
      </div>

      <!-- 色候选项库 / Color candidates -->
      <h3>色候选项库（<span id="candidateCount">${primaryCandidates.length}</span> 色）</h3>
      <p class="hint">仅展示主色，每次选中将自动推荐匹配副色。以第一组选出您想要的颜色。</p>
      <div class="swatch-grid" id="candidateGrid"></div>

      <!-- 主题预设 / Presets (紧凑列表式) -->
      <h3>主题预设（<span id="presetCount">${builtinPresets.length}</span> 套）</h3>
      <div class="preset-list" id="presetGrid"></div>

      <!-- 和谐副色候选 / Harmony secondaries -->
      <h3>颜色和谐候选（基于主色）</h3>
      <div class="swatch-grid" id="harmonyGrid"></div>
    </section>
  `;

  // ── DOM 引用缓存 / DOM ref cache ──
  const $ = <T extends HTMLElement>(id: string) => root.querySelector<T>('#' + id)!;
  const priColor = $<HTMLInputElement>('primaryColor');
  const priHex = $<HTMLInputElement>('primaryHex');
  const priName = $<HTMLInputElement>('primaryName');
  const secColor = $<HTMLInputElement>('secondaryColor');
  const secHex = $<HTMLInputElement>('secondaryHex');
  const secName = $<HTMLInputElement>('secondaryName');
  const themeName = $<HTMLInputElement>('themeName');
  const candGrid = $<HTMLDivElement>('candidateGrid');
  const presetGrid = $<HTMLDivElement>('presetGrid');
  const harmGrid = $<HTMLDivElement>('harmonyGrid');

  // ── 输入事件绑定：写回状态 / Input events → state ──
  priColor.addEventListener('input', () => updateConsole({ primary: priColor.value }));
  priHex.addEventListener('change', () => {
    if (/^#[0-9A-Fa-f]{6}$/.test(priHex.value)) updateConsole({ primary: priHex.value });
  });
  priName.addEventListener('input', () => updateConsole({ primaryName: priName.value }));
  secColor.addEventListener('input', () => updateConsole({ secondary: secColor.value }));
  secHex.addEventListener('change', () => {
    if (/^#[0-9A-Fa-f]{6}$/.test(secHex.value)) updateConsole({ secondary: secHex.value });
  });
  secName.addEventListener('input', () => updateConsole({ secondaryName: secName.value }));
  themeName.addEventListener('input', () => updateConsole({ themeName: themeName.value }));

  // ── 自动副色：取和谐候选首位 / Auto secondary → first harmony candidate ──
  $<HTMLButtonElement>('autoSecondaryBtn').addEventListener('click', () => {
    const set = generateSecondarySet(priColor.value);
    if (set.length) updateConsole({ secondary: set[0].hex, secondaryName: set[0].name || '' });
  });

  // ── 自动命名 / Auto name ──
  $<HTMLButtonElement>('autoNameBtn').addEventListener('click', () => {
    const name = `${priName.value || '自定义'}${secName.value ? ' + ' + secName.value : ''}`;
    updateConsole({ themeName: name || '未命名主题' });
  });

  // ── 快捷操作 / Quick actions ──
  $<HTMLButtonElement>('applyBtn').addEventListener('click', () => {
    /* 应用即刷新全部预览，已通过 subscribe 自动完成 */
  });
  $<HTMLButtonElement>('savePresetBtn').addEventListener('click', () => saveToLibrary());
  $<HTMLButtonElement>('updatePresetBtn').addEventListener('click', () => {
    saveToLibrary();
  });

  // ── 渲染 44 色候选库 / Render 44 color candidates ──
  primaryCandidates.forEach((c) => {
    const el = document.createElement('button');
    el.className = 'swatch swatch-lg';
    el.style.background = c.hex;
    el.title = `${c.name} (${c.en}) — ${c.hex}\n推荐副色: ${c.secondaryHex || '自动'}`;
    el.addEventListener('click', () =>
      replaceConsole({
        primary: c.hex,
        primaryName: c.name,
        secondary: c.secondaryHex || '#00A8D3',
        secondaryName: c.secondaryName || ''
      })
    );
    candGrid.appendChild(el);
  });

  // ── 渲染 6 个内置预设（紧凑列表式，对齐原 HTML 左侧预设区） / Render 6 built-in presets (compact list) ──
  builtinPresets.forEach((p) => {
    const row = document.createElement('div');
    row.className = 'preset-row';
    row.innerHTML = `
      <span class="preset-dots-inline">
        <span class="preset-dot" style="background:${p.primary}"></span>
        <span class="preset-dot" style="background:${p.secondary}"></span>
      </span>
      <div class="preset-info">
        <span class="preset-name">${p.name}</span>
        <span class="preset-meta">${p.category}${p.industry ? ' · ' + p.industry : ''}</span>
      </div>
      <div class="preset-actions">
        <button class="btn sm primary apply-preset">应用</button>
        <button class="btn sm outline load-preset">载入操作台</button>
      </div>
    `;
    row.querySelector('.apply-preset')!.addEventListener('click', () =>
      replaceConsole({
        primary: p.primary,
        secondary: p.secondary,
        primaryName: p.primaryName,
        secondaryName: p.secondaryName,
        themeName: p.name
      })
    );
    row.querySelector('.load-preset')!.addEventListener('click', () =>
      replaceConsole({
        primary: p.primary,
        secondary: p.secondary,
        primaryName: p.primaryName,
        secondaryName: p.secondaryName,
        themeName: p.name
      })
    );
    presetGrid.appendChild(row);
  });

  // ── 订阅状态刷新 / Subscribe for state refresh ──
  subscribe((s: AppState) => {
    const { console: cs, theme } = s;
    // 同步输入框 / Sync inputs
    priColor.value = theme.primary.value;
    priHex.value = theme.primary.value;
    priName.value = cs.primaryName;
    secColor.value = theme.secondary.value;
    secHex.value = theme.secondary.value;
    secName.value = cs.secondaryName;
    themeName.value = cs.themeName;

    // 刷新和谐副色候选 / Refresh harmony secondaries
    harmGrid.innerHTML = '';
    const set = generateSecondarySet(theme.primary.value);
    set.forEach((c) => {
      const el = document.createElement('button');
      el.className = 'swatch swatch-lg';
      el.style.background = c.hex;
      el.title = `${c.name || '和谐'} — ${c.hex}`;
      el.addEventListener('click', () =>
        updateConsole({ secondary: c.hex, secondaryName: c.name || '' })
      );
      harmGrid.appendChild(el);
    });
  });
}
