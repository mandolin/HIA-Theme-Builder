/**
 * @lang zh-CN 全局渐变设置面板：8 个渐变角色（轮播/Banner/文字大卡/文字小卡/数据KPI/
 *   图片缩略/个人名片/提示说明），每个角色独立控制启用、色系、起止色阶、方向角度、
 *   不均分占比。消费 core 的 GRADIENT_DEFS / GRADIENT_DEFAULTS / cloneGradientSettings。
 * @lang en Global gradient settings panel: 8 gradient roles (carousel/banner/text-large/text-small/
 *   data-kpi/image-thumb/profile-card/hint-card), each with independent enable, color family,
 *   start/end shade, direction angle, uneven bias. Consumes core gradient defs & defaults.
 */

import { GRADIENT_DEFS } from '@hia/theme-core';
import type { GradientSettings } from '@hia/theme-core';
import { subscribe, updateGradient, resetGradients, type AppState } from './state.js';

/** @lang zh-CN 色阶选项列表（50–900）。 @en Shade option list (50–900). */
const SHADES = ['50','100','200','300','400','500','600','700','800','900'];

/** @lang zh-CN 不均分选项列表。 @en Uneven bias options. */
const BIAS_OPTIONS = [
  { value: 'front75', label: '前75%' },
  { value: 'front65', label: '前65%' },
  { value: 'end65', label: '后65%' },
  { value: 'end75', label: '后75%' }
];

/**
 * @lang zh-CN 渲染渐变设置面板，订阅主题刷新预览条。
 * @en Render gradient settings panel; subscribe for preview bar refresh.
 */
export function renderGradient(root: HTMLElement): void {
  // 生成所有角色行 / Generate all role rows
  const rows = GRADIENT_DEFS.map((d) => {
    return `
      <div class="grad-role-row" data-key="${d.key}">
        <span class="grad-role-name">${d.label}</span>
        <label title="启用/禁用"><input type="checkbox" class="grad-toggle g-enabled" /></label>
        <select class="grad-select g-family" title="色系">
          <option value="primary">主色系</option>
          <option value="secondary">副色系</option>
        </select>
        <select class="grad-select g-start" title="起始色阶">
          ${SHADES.map(s => `<option value="${s}">${s}</option>`).join('')}
        </select>
        <select class="grad-select g-end" title="结束色阶">
          ${SHADES.map(s => `<option value="${s}">${s}</option>`).join('')}
        </select>
        <input class="grad-input g-dir" placeholder="角度" title="方向(如 135deg)" />
        <select class="grad-select g-bias" title="不均分占比">
          ${BIAS_OPTIONS.map(b => `<option value="${b.value}">${b.label}</option>`).join('')}
        </select>
        <input class="grad-input g-height" placeholder="高度" title="高度(px)" style="width:52px" />
        <span class="grad-preview-strip g-preview"></span>
      </div>`;
  }).join('');

  root.innerHTML = `
    <section class="panel gradient-panel">
      <div class="panel-header">
        <h2>全局渐变设置</h2>
        <button class="btn sm outline" id="resetGradBtn">全部恢复默认</button>
      </div>
      <p class="hint">此区域基于当前主题的配色方案，同时作用于 PC 企业后台和小程序预览。预览包含仪表盘、表格、组件、色阶与渐变；部分设置覆盖色，禁止全局。</p>

      <!-- 核心横幅卡片类 / Core banner card types -->
      <h3>核心横幅卡片类设置</h3>
      ${rows}

      <!-- 全局操作 / Global actions -->
      <div class="btn-group" style="margin-top:14px">
        <button class="btn primary" id="applyGradBtn">全部保存应用</button>
      </div>
    </section>
  `;

  // 绑定每行控件事件 / Bind per-row control events
  root.querySelectorAll<HTMLDivElement>('.grad-role-row').forEach((row) => {
    const key = row.dataset.key!;

    row.querySelector<HTMLInputElement>('.g-enabled')!.addEventListener('change', (e) => {
      updateGradient(key, { enabled: (e.target as HTMLInputElement).checked });
    });
    row.querySelector<HTMLSelectElement>('.g-family')!.addEventListener('change', (e) => {
      updateGradient(key, { family: (e.target as HTMLSelectElement).value as 'primary' | 'secondary' });
    });
    row.querySelector<HTMLSelectElement>('.g-start')!.addEventListener('change', (e) => {
      updateGradient(key, { start: (e.target as HTMLSelectElement).value });
    });
    row.querySelector<HTMLSelectElement>('.g-end')!.addEventListener('change', (e) => {
      updateGradient(key, { end: (e.target as HTMLSelectElement).value });
    });
    row.querySelector<HTMLInputElement>('.g-dir')!.addEventListener('change', (e) => {
      updateGradient(key, { direction: (e.target as HTMLInputElement).value || '135deg' });
    });
    row.querySelector<HTMLSelectElement>('.g-bias')!.addEventListener('change', (e) => {
      updateGradient(key, { bias: (e.target as HTMLSelectElement).value as GradientSettings[string]['bias'] });
    });
    row.querySelector<HTMLInputElement>('.g-height')!.addEventListener('change', (e) => {
      const v = parseInt((e.target as HTMLInputElement).value);
      if (!isNaN(v)) updateGradient(key, { height: v } as Partial<GradientSettings[string]>);
    });
  });

  // 重置按钮 / Reset button
  root.querySelector<HTMLButtonElement>('#resetGradBtn')?.addEventListener('click', () => resetGradients());

  // 订阅刷新预览条与控件值 / Subscribe to refresh preview bars and control values
  subscribe((s: AppState) => {
    const { gradients, theme } = s;
    root.querySelectorAll<HTMLDivElement>('.grad-role-row').forEach((row) => {
      const key = row.dataset.key!;
      const cfg = gradients[key];
      if (!cfg) return;

      // 同步控件值 / Sync control values
      const setChecked = (sel: string, val: boolean) => {
        const el = row.querySelector<HTMLInputElement>(sel); if (el) el.checked = val;
      };
      const setVal = (sel: string, val: string) => {
        const el = row.querySelector<HTMLInputElement | HTMLSelectElement>(sel);
        if (el) el.value = val;
      };
      setChecked('.g-enabled', cfg.enabled);
      setVal('.g-family', cfg.family);
      setVal('.g-start', cfg.start);
      setVal('.g-end', cfg.end);
      setVal('.g-dir', cfg.direction);
      setVal('.g-bias', cfg.bias);

      // 更新预览条 / Update preview strip
      const bar = row.querySelector<HTMLElement>('.g-preview');
      if (bar) {
        if (!cfg.enabled) {
          bar.style.background = '#e5e7eb';
        } else {
          const fam = cfg.family === 'primary' ? theme.primary.scale : theme.secondary.scale;
          const a = fam[cfg.start as keyof typeof fam] || '#ccc';
          const b = fam[cfg.end as keyof typeof fam] || '#999';
          bar.style.background = `linear-gradient(${cfg.direction || '135deg'}, ${a} 0%, ${b} 100%)`;
        }
      }
    });
  });
}
