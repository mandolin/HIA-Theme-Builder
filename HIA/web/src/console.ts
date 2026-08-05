/**
 * @lang zh-CN 操作台：主/副色输入、主色候选库、主题预设库、自动副色生成。消费 core 数据 API。
 * @lang en Console: primary/secondary input, primary candidate library, preset library, auto secondary generation. Consumes core data API.
 */

import {
  primaryCandidates,
  builtinPresets,
  generateSecondarySet,
  buildTheme
} from '@hia/theme-core';
import type { Theme } from '@hia/theme-core';
import { update, replace, subscribe } from './state.js';

/**
 * @lang zh-CN 渲染操作台面板到给定容器，订阅状态实时刷新。
 * @lang en Render console panel into container, subscribe for live refresh.
 */
export function renderConsole(root: HTMLElement): void {
  root.innerHTML = `
    <section class="panel console">
      <h2>主题操作台</h2>
      <div class="row">
        <label>主色 <input type="color" id="primary" /></label>
        <input type="text" id="primaryHex" maxlength="7" />
        <input type="text" id="primaryName" placeholder="主色名" />
      </div>
      <div class="row">
        <label>副色 <input type="color" id="secondary" /></label>
        <input type="text" id="secondaryHex" maxlength="7" />
        <input type="text" id="secondaryName" placeholder="副色名" />
        <button id="autoSecondary">自动副色</button>
      </div>
      <div class="row">
        <label>主题名 <input type="text" id="themeName" /></label>
      </div>

      <h3>主色候选库（${primaryCandidates.length}）</h3>
      <div class="swatches" id="candidates"></div>

      <h3>主题预设（${builtinPresets.length}）</h3>
      <div class="presets" id="presets"></div>

      <h3>副色和谐候选（基于主色）</h3>
      <div class="swatches" id="secondaries"></div>
    </section>
  `;

  // <lang zh-CN>绑定输入事件，写回状态。</lang>
  // <lang en>Bind input events, write back to state.</lang>
  const $ = <T extends HTMLElement>(id: string) => root.querySelector<T>('#' + id)!;
  const primary = $<HTMLInputElement>('primary');
  const primaryHex = $<HTMLInputElement>('primaryHex');
  const primaryName = $<HTMLInputElement>('primaryName');
  const secondary = $<HTMLInputElement>('secondary');
  const secondaryHex = $<HTMLInputElement>('secondaryHex');
  const secondaryName = $<HTMLInputElement>('secondaryName');
  const themeName = $<HTMLInputElement>('themeName');

  primary.addEventListener('input', () => update({ primary: primary.value }));
  primaryHex.addEventListener('change', () => update({ primary: primaryHex.value }));
  primaryName.addEventListener('input', () => update({ primaryName: primaryName.value }));
  secondary.addEventListener('input', () => update({ secondary: secondary.value }));
  secondaryHex.addEventListener('change', () => update({ secondary: secondaryHex.value }));
  secondaryName.addEventListener('input', () => update({ secondaryName: secondaryName.value }));
  themeName.addEventListener('input', () => update({ themeName: themeName.value }));

  // <lang zh-CN>自动副色：取和谐候选首位。</lang>
  // <lang en>Auto secondary: take first harmony candidate.</lang>
  $<HTMLButtonElement>('autoSecondary').addEventListener('click', () => {
    const theme: Theme = buildTheme({ primary: primary.value, secondary: secondary.value });
    const set = generateSecondarySet(theme.primary.value);
    if (set.length) update({ secondary: set[0].hex });
  });

  // <lang zh-CN>候选库点击即设为主色。</lang>
  // <lang en>Click candidate to set as primary.</lang>
  const candBox = $<HTMLDivElement>('candidates');
  primaryCandidates.forEach((c) => {
    const el = document.createElement('button');
    el.className = 'swatch';
    el.style.background = c.hex;
    el.title = `${c.name} / ${c.en} — ${c.hex}`;
    el.addEventListener('click', () =>
      replace({ primary: c.hex, primaryName: c.name, secondary: c.secondaryHex, secondaryName: c.secondaryName })
    );
    candBox.appendChild(el);
  });

  // <lang zh-CN>预设点击整体替换。</lang>
  // <lang en>Click preset to replace wholesale.</lang>
  const presetBox = $<HTMLDivElement>('presets');
  builtinPresets.forEach((p) => {
    const el = document.createElement('button');
    el.className = 'preset';
    el.innerHTML = `<span class="dot" style="background:${p.primary}"></span><span class="dot" style="background:${p.secondary}"></span> ${p.name}`;
    el.title = `${p.category} · ${p.industry || '—'}`;
    el.addEventListener('click', () =>
      replace({ primary: p.primary, secondary: p.secondary, primaryName: p.primaryName, secondaryName: p.secondaryName, themeName: p.name })
    );
    presetBox.appendChild(el);
  });

  // <lang zh-CN>订阅状态刷新输入框与和谐候选。</lang>
  // <lang en>Subscribe to refresh inputs and harmony candidates.</lang>
  const secBox = $<HTMLDivElement>('secondaries');
  subscribe((s, theme) => {
      primary.value = theme.primary.value;
      primaryHex.value = theme.primary.value;
      primaryName.value = s.primaryName;
      secondary.value = theme.secondary.value;
      secondaryHex.value = theme.secondary.value;
      secondaryName.value = s.secondaryName;
      themeName.value = s.themeName;

      // <lang zh-CN>重新渲染和谐候选（每次主色变化）。</lang>
      // <lang en>Re-render harmony candidates (on primary change).</lang>
      secBox.innerHTML = '';
      const set = generateSecondarySet(theme.primary.value);
      set.forEach((c) => {
        const el = document.createElement('button');
        el.className = 'swatch';
        el.style.background = c.hex;
        el.title = `${c.name} — ${c.hex}`;
        el.addEventListener('click', () => update({ secondary: c.hex, secondaryName: c.name }));
        secBox.appendChild(el);
      });

      // <lang zh-CN>和谐候选已渲染，状态刷新完成。</lang>
      // <lang en>Harmony candidates rendered; state refresh complete.</lang>
    });
}
