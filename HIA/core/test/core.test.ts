/**
 * @lang zh-CN @hia/theme-core 最小纵切验证：覆盖颜色换算、色阶、副色生成、对比度与 Token 导出闭环。
 * @lang en @hia/theme-core minimal vertical-slice tests: color convert, scale, secondary harmony, contrast and token export loop.
 */

import { describe, it, expect } from 'vitest';
import {
  normalizeHex,
  validHex,
  hexToOklch,
  gamutMapOklch,
  tonalScale,
  generateSecondarySet,
  harmonyCandidate,
  bestOnColor,
  contrast,
  buildTheme,
  exportThemeCss,
  exportThemeJson,
  primaryCandidates,
  builtinPresets,
  GRADIENT_DEFS
} from '../src/index.js';

describe('color/convert', () => {
  it('normalizeHex 统一 # 与前缀', () => {
    // <lang zh-CN>验证大小写与多余 # 被规范化。</lang>
    // <lang en>Verify case and stray # are normalized.</lang>
    expect(normalizeHex('#0047ab')).toBe('#0047AB');
    expect(normalizeHex('0047AB')).toBe('#0047AB');
  });

  it('validHex 仅接受 6 位 HEX', () => {
    expect(validHex('#0047AB')).toBe(true);
    expect(validHex('#fff')).toBe(false);
  });

  it('hexToOklch 往返基本稳定', () => {
    const { L, C, h } = hexToOklch('#0047AB');
    expect(L).toBeGreaterThan(0);
    expect(C).toBeGreaterThan(0);
    expect(h).toBeGreaterThanOrEqual(0);
    expect(h).toBeLessThan(360);
  });

  it('gamutMapOklch 返回可显示 HEX', () => {
    const { hex } = gamutMapOklch(0.7, 0.2, 200);
    expect(validHex(hex)).toBe(true);
  });
});

describe('color/scale', () => {
  it('tonalScale 产出 50–900 且 500 为原色', () => {
    const scale = tonalScale('#0047AB');
    expect(scale['500']).toBe('#0047AB');
    expect(validHex(scale['50'])).toBe(true);
    expect(validHex(scale['900'])).toBe(true);
  });
});

describe('color/harmony', () => {
  it('generateSecondarySet 默认产 9 条', () => {
    const arr = generateSecondarySet('#0047AB');
    expect(arr.length).toBe(9);
  });

  it('提供 preferred 副色时置顶', () => {
    const arr = generateSecondarySet('#0047AB', { hex: '#00A8D3', name: '清透青' });
    expect(arr[0].id).toBe('preferred-secondary');
    expect(arr[0].hex).toBe('#00A8D3');
  });

  it('harmonyCandidate 产出合法 HEX', () => {
    const c = harmonyCandidate('#0047AB', {
      id: 'x',
      name: '测试',
      en: 'Test',
      scheme: 't',
      offset: 180,
      L: 0.68,
      C: 0.145,
      note: ''
    });
    expect(validHex(c.hex)).toBe(true);
  });
});

describe('color/contrast', () => {
  it('bestOnColor 对深蓝返回白', () => {
    expect(bestOnColor('#0047AB').hex).toBe('#FFFFFF');
  });
  it('contrast 自比为 1', () => {
    expect(contrast('#0047AB', '#0047AB')).toBeCloseTo(1, 5);
  });
});

describe('theme + token 闭环', () => {
  it('buildTheme 由最小输入产出完整 Theme', () => {
    const theme = buildTheme({
      primary: '#0047AB',
      secondary: '#00A8D3',
      primaryName: '钴蓝',
      secondaryName: '清透青',
      name: 'HIA 默认'
    });
    expect(theme.primary.value).toBe('#0047AB');
    expect(theme.secondary.on).toBe('#0F172A');
    expect(Object.keys(theme.gradients).length).toBe(GRADIENT_DEFS.length);
  });

  it('exportThemeCss 含主色与渐变变量', () => {
    const theme = buildTheme({ primary: '#0047AB', secondary: '#00A8D3' });
    const css = exportThemeCss(theme);
    expect(css).toContain('--hia-primary: #0047AB');
    expect(css).toContain('--hia-gradient-carousel:');
  });

  it('exportThemeJson 可解析且含色阶', () => {
    const theme = buildTheme({ primary: '#0047AB', secondary: '#00A8D3' });
    const json = JSON.parse(exportThemeJson(theme));
    expect(json.primary.scale['500']).toBe('#0047AB');
    expect(json.secondary.value).toBe('#00A8D3');
  });

  it('内置预设数量为 6', () => {
    expect(builtinPresets.length).toBe(6);
  });

  it('主色候选库为 44', () => {
    expect(primaryCandidates.length).toBe(44);
  });
});
