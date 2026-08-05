/**
 * @lang zh-CN 全局渐变设置面板：8 个渐变角色，仅同色系（主/副），不均分占比。消费 core 渐变定义与默认。
 * @lang en Global gradient settings panel: 8 gradient roles, same-family only (primary/secondary), uneven bias. Consumes core gradient defs/defaults.
 */

import { GRADIENT_DEFS, GRADIENT_DEFAULTS, cloneGradientSettings } from '@hia/theme-core';
import type { Theme, GradientSettings } from '@hia/theme-core';
import { subscribe } from './state.js';

/** @lang zh-CN 面板内渐变设置（初始化自 core 默认）。 @lang en In-panel gradient settings (init from core defaults). */
let settings: GradientSettings = cloneGradientSettings(GRADIENT_DEFAULTS);

/** @lang zh-CN 阶选项（50–900），用于下拉。 @lang en Shade options (50–900) for dropdowns. */
const SHADES = ['50', '100', '200', '300', '400', '500', '600', '700', '800', '900'];

/** @lang zh-CN 由设置与主题生成一条 CSS 渐变字符串（预览用）。 @lang en Build one CSS gradient string from settings + theme (for preview). */
function gradientCss(key: string, theme: Theme): string {
  const cfg = settings[key];
  const fam = cfg.family === 'primary' ? theme.primary.scale : theme.secondary.scale;
  const a = fam[cfg.start as keyof typeof fam];
  const b = fam[cfg.end as keyof typeof fam];
  return `linear-gradient(${cfg.direction}, ${a} 0%, ${a} ${biasStart(cfg.bias)}%, ${b} ${biasStart(cfg.bias)}%, ${b} 100%)`;
}

/** @lang zh-CN 不均分起点：front75→25%；front65→35%；end65→65%；end75→75%。 @lang en Uneven start points: front75→25%; front65→35%; end65→65%; end75→75%. */
function biasStart(bias: string): number {
  return bias === 'front75' ? 25 : bias === 'front65' ? 35 : bias === 'end65' ? 65 : 75;
}

/**
 * @lang zh-CN 渲染渐变设置面板，订阅主题刷新预览条。
 * @lang en Render gradient settings panel, subscribe for preview-bar refresh.
 */
export function renderGradient(root: HTMLElement): void {
  const rows = GRADIENT_DEFS.map((d) => {
    const cfg = settings[d.key];
    const shadeOpts = SHADES.map((s) => `<option ${s === cfg.start ? 'selected' : ''}>${s}</option>`).join('');
    const biasOpts = ['front75', 'front65', 'end65', 'end75']
      .map((b) => `<option value="${b}" ${b === cfg.bias ? 'selected' : ''}>${b}</option>`)
      .join('');
    return `
      <div class="grad-row" data-key="${d.key}">
        <span class="grad-name">${d.label}</span>
        <label><input type="checkbox" class="g-enabled" ${cfg.enabled ? 'checked' : ''}/> 启用</label>
        <select class="g-family">
          <option value="primary" ${cfg.family === 'primary' ? 'selected' : ''}>主色系</option>
          <option value="secondary" ${cfg.family === 'secondary' ? 'selected' : ''}>副色系</option>
        </select>
        <select class="g-start">${shadeOpts}</select>
        <select class="g-end">${SHADES.map((s) => `<option ${s === cfg.end ? 'selected' : ''}>${s}</option>`).join('')}</select>
        <input class="g-dir" value="${cfg.direction}" size="7" />
        <select class="g-bias">${biasOpts}</select>
        <span class="grad-bar"></span>
      </div>`;
  }).join('');

  root.innerHTML = `
    <section class="panel gradient">
      <h2>全局渐变设置</h2>
      <p class="hint">仅同色系渐变（主/副），不均分占比。8 个角色：${GRADIENT_DEFS.length}。</p>
      ${rows}
    </section>
  `;

  // <lang zh-CN>绑定每行控件，写回 settings。</lang>
  // <lang en>Bind each row control, write back to settings.</lang>
  root.querySelectorAll<HTMLDivElement>('.grad-row').forEach((row) => {
    const key = row.dataset.key!;
    const cfg = settings[key];
    row.querySelector<HTMLInputElement>('.g-enabled')!.addEventListener('change', (e) => {
      settings[key] = { ...cfg, enabled: (e.target as HTMLInputElement).checked };
    });
    row.querySelector<HTMLSelectElement>('.g-family')!.addEventListener('change', (e) => {
      settings[key] = { ...settings[key], family: (e.target as HTMLSelectElement).value as 'primary' | 'secondary' };
    });
    row.querySelector<HTMLSelectElement>('.g-start')!.addEventListener('change', (e) => {
      settings[key] = { ...settings[key], start: (e.target as HTMLSelectElement).value };
    });
    row.querySelector<HTMLSelectElement>('.g-end')!.addEventListener('change', (e) => {
      settings[key] = { ...settings[key], end: (e.target as HTMLSelectElement).value };
    });
    row.querySelector<HTMLInputElement>('.g-dir')!.addEventListener('change', (e) => {
      settings[key] = { ...settings[key], direction: (e.target as HTMLInputElement).value };
    });
    row.querySelector<HTMLSelectElement>('.g-bias')!.addEventListener('change', (e) => {
      settings[key] = { ...settings[key], bias: (e.target as HTMLSelectElement).value as typeof cfg.bias };
    });
  });

  subscribe((_s, theme) => {
    root.querySelectorAll<HTMLDivElement>('.grad-row').forEach((row) => {
      const key = row.dataset.key!;
      const bar = row.querySelector<HTMLSpanElement>('.grad-bar')!;
      bar.style.background = settings[key].enabled ? gradientCss(key, theme) : '#e5e7eb';
    });
  });
}
