/**
 * @lang zh-CN @hia/theme-core 网址取色分析回归测试（node --test 原生 runner）。
 *   覆盖指令第二节的“重复累计评分 bug”修复，以及主副色/置信度/中性排除等核心行为。
 * @lang en @hia/theme-core URL color-extraction regression tests (node --test runner).
 *   Covers the "duplicate-accumulation scoring bug" fix from spec §2 plus primary/secondary/confidence/neutral behavior.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { analyzeTheme } from '../dist/index.js';

describe('analyze/analyzeTheme (P0 regression)', () => {
  it('无信号时返回 manual 与默认主色', () => {
    const r = analyzeTheme({});
    assert.equal(r.action, 'manual');
    assert.equal(r.primaryConfidence, 0);
    assert.equal(r.secondary, null);
  });

  it('CSS 语义变量命中时选为主色', () => {
    const r = analyzeTheme({ cssVars: [
      { name: '--primary-color', hex: '#0047AB' },
      { name: '--text-color', hex: '#111827' }
    ] });
    assert.equal(r.primary.hex, '#0047AB');
    assert.ok(r.primaryConfidence > 0.9);
  });

  it('重复累计回归：同色多条记录分数不应被乘 N', () => {
    // <lang zh-CN>同色两条 DOM 记录（不同区域）。旧实现会重复调用 scoreColor() 全量遍历，
    //   使聚合分被再乘记录数（此处 2x）：200*0.01*1 + 50*0.01*3 被算两次 = 7。
    //   修复后只聚合一次 = 3.5。测试锁定的就是“单次聚合”数值。</lang>
    // <lang en>Same color, two DOM records (different regions). Old code rescanned all signals per record,
    //   multiplying the aggregate by the record count (2x here → 7). Fixed code aggregates once → 3.5.</lang>
    const signals = { domColors: [
      { hex: '#7C3AED', count: 200, region: 'general' },
      { hex: '#7C3AED', count: 50, region: 'brand' }
    ] };
    const r = analyzeTheme(signals);
    // 单次聚合分数：200*0.01*1 + 50*0.01*3 = 2 + 1.5 = 3.5
    assert.equal(r.primary.hex, '#7C3AED');
    assert.equal(r.primary.score, 3.5);
  });

  it('与“每条记录独立计数但未重复全量遍历”结果一致', () => {
    // <lang zh-CN>等价表达：把两条记录合并为单条（count 相加、区域按最高权重）应得同一总分。</lang>
    // <lang en>Equivalent: merging into one record (summed count, highest-weight region) yields same total.</lang>
    const merged = analyzeTheme({ domColors: [
      { hex: '#7C3AED', count: 250, region: 'brand' }
    ] });
    // 250*0.01*3 = 7.5，与上面 3.5 不同（区域权重不同），但本测试聚焦“不乘 N”：
    // 上面 3.5 不是 7，证明没有重复累计。
    const split = analyzeTheme({ domColors: [
      { hex: '#7C3AED', count: 125, region: 'brand' },
      { hex: '#7C3AED', count: 125, region: 'brand' }
    ] });
    // 两条 brand 记录合并，单次聚合 = 250*0.01*3 = 7.5，而非 15。
    assert.equal(split.primary.score, 7.5);
    assert.equal(merged.primary.score, split.primary.score);
  });

  it('中性/状态色被排除出主色候选', () => {
    const r = analyzeTheme({ cssVars: [
      { name: '--bg', hex: '#FFFFFF' },
      { name: '--accent', hex: '#DC2626' }
    ], domColors: [{ hex: '#FFFFFF', count: 500, region: 'general' }] });
    assert.equal(r.action, 'manual');
    assert.equal(r.primary.hex, '#0047AB');
  });

  it('主副色区分度足够时给出副色候选', () => {
    const r = analyzeTheme({ cssVars: [{ name: '--primary-color', hex: '#0047AB' }],
      domColors: [{ hex: '#00A8D3', count: 30, region: 'button' }] });
    assert.equal(r.secondary?.hex, '#00A8D3');
    assert.ok(r.secondaryConfidence > 0);
    assert.equal(r.action, 'auto');
  });

  it('alternatives 返回前若干候选且不含主色', () => {
    const r = analyzeTheme({ cssVars: [
      { name: '--primary-color', hex: '#0047AB' },
      { name: '--x', hex: '#7C3AED' },
      { name: '--y', hex: '#F59E0B' },
      { name: '--z', hex: '#0EA5E9' }
    ] });
    assert.ok(r.alternatives.length > 0);
    assert.ok(r.alternatives.every((c) => c.hex !== r.primary.hex));
  });
});
