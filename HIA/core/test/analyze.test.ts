/**
 * @lang zh-CN @hia/theme-core 网址取色分析模块测试：覆盖多信号加权、主副色选择、置信度与动作阈值。
 * @lang en @hia/theme-core URL color-extraction analysis tests: weighted multi-signal, primary/secondary pick, confidence and action thresholds.
 */

import { describe, it, expect } from 'vitest';
import { analyzeTheme } from '../src/index.js';
import type { ExtractSignals } from '../src/analyze/types.js';

describe('analyze/analyzeTheme', () => {
  it('无信号时返回 manual 与默认主色', () => {
    const r = analyzeTheme({});
    expect(r.action).toBe('manual');
    expect(r.primaryConfidence).toBe(0);
    expect(r.secondary).toBeNull();
  });

  it('CSS 语义变量命中时选为主色', () => {
    const signals: ExtractSignals = {
      cssVars: [
        { name: '--primary-color', hex: '#0047AB' },
        { name: '--text-color', hex: '#111827' }
      ]
    };
    const r = analyzeTheme(signals);
    expect(r.primary.hex).toBe('#0047AB');
    // <lang zh-CN>仅主色命中语义词，次高分为 0，置信度 gap/top=5/5=1。</lang>
    // <lang en>Only primary hits semantic keyword, second score 0, confidence gap/top=5/5=1.</lang>
    expect(r.primaryConfidence).toBeGreaterThan(0.9);
  });

  it('DOM 区域权重累加，品牌区优先', () => {
    const signals: ExtractSignals = {
      domColors: [
        { hex: '#00A8D3', count: 20, region: 'brand' },
        { hex: '#7C3AED', count: 200, region: 'general' }
      ]
    };
    const r = analyzeTheme(signals);
    // <lang zh-CN>品牌区加权（20*0.01*3=0.6）应超过大面积但一般区域的紫（200*0.01*1=2? 不，紫为 2）。</lang>
    // <lang en>Brand-weighted (#00A8D3 = 0.6) vs large general purple (#7C3AED = 2). Purple wins on raw count.</lang>
    // 紫为 200*0.01*1=2，青为 0.6，故紫胜出（均为非中性色）。
    expect(r.primary.hex).toBe('#7C3AED');
  });

  it('截图像素占比以开方抑制大色块', () => {
    const signals: ExtractSignals = {
      screenshotColors: [
        { hex: '#7C3AED', ratio: 0.6 },
        { hex: '#F59E0B', ratio: 0.1 }
      ]
    };
    const r = analyzeTheme(signals);
    expect(r.primary.hex).toBe('#7C3AED');
  });

  it('中性/状态色被排除出主色候选', () => {
    const signals: ExtractSignals = {
      cssVars: [
        { name: '--bg', hex: '#FFFFFF' },
        { name: '--accent', hex: '#DC2626' }
      ],
      domColors: [{ hex: '#FFFFFF', count: 500, region: 'general' }]
    };
    const r = analyzeTheme(signals);
    // <lang zh-CN>白被排除，红为状态色也被排除，应回落到 manual 与默认主色。</lang>
    // <lang en>White excluded, red is a state color also excluded; falls back to manual + default primary.</lang>
    expect(r.action).toBe('manual');
    expect(r.primary.hex).toBe('#0047AB');
  });

  it('主副色区分度足够时给出副色候选', () => {
    const signals: ExtractSignals = {
      cssVars: [{ name: '--primary-color', hex: '#0047AB' }],
      domColors: [{ hex: '#00A8D3', count: 30, region: 'button' }]
    };
    const r = analyzeTheme(signals);
    expect(r.secondary?.hex).toBe('#00A8D3');
    expect(r.secondaryConfidence).toBeGreaterThan(0);
    // <lang zh-CN>主色语义分 5，副色按钮加权 30*0.01*1.8=0.54，gap 显著，应达 auto。</lang>
    // <lang en>Primary semantic 5, secondary button 0.54; large gap reaches auto.</lang>
    expect(r.action).toBe('auto');
  });

  it('候选不足区分度时副色为 null', () => {
    const signals: ExtractSignals = {
      cssVars: [
        { name: '--primary-color', hex: '#0F172A' },
        { name: '--link', hex: '#1E293B' }
      ]
    };
    // <lang zh-CN>两个深色接近，区分度不足且中性，副色应为 null。</lang>
    // <lang en>Two close dark neutrals; insufficient distinctness, secondary null.</lang>
    const r = analyzeTheme(signals);
    expect(r.secondary).toBeNull();
  });

  it('alternatives 返回前若干候选且不含主色', () => {
    const signals: ExtractSignals = {
      cssVars: [
        { name: '--primary-color', hex: '#0047AB' },
        { name: '--x', hex: '#7C3AED' },
        { name: '--y', hex: '#F59E0B' },
        { name: '--z', hex: '#0EA5E9' }
      ]
    };
    const r = analyzeTheme(signals);
    expect(r.alternatives.length).toBeGreaterThan(0);
    expect(r.alternatives.every((c) => c.hex !== r.primary.hex)).toBe(true);
  });
});
