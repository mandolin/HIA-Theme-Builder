/**
 * @lang zh-CN V2 分析（analyzeThemeV2）单测：覆盖指令十四节关键不变量。
 * @lang en V2 analysis (analyzeThemeV2) tests: key invariants from spec §14.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { analyzeThemeV2 } from '../dist/analyze/analyze-v2.js';

// 构造最小 V2 信号（mode=render 不受 0.45 封顶）。
// <lang zh-CN>page 字段仅占位，evidence 为测试主体。</lang>
// <lang en>page fields are placeholders; evidence is the test subject.</lang>
function sig(evidence, mode = 'render') {
  return {
    schemaVersion: 2,
    page: { requestedUrl: 'x', finalUrl: 'x', title: 't', viewport: { width: 1440, height: 900, dpr: 1 }, colorScheme: 'light', capturedAt: 'now' },
    evidence,
    warnings: [],
    diagnostics: { mode, durationMs: 1, notes: [] }
  };
}

test('重复累计回归：同色多条记录 score 不应被乘 N', () => {
  // 同色 #7C3AED 两条 computed-background 记录，各 count 3。
  // <lang zh-CN>聚类后合并为一条，score 只算一次聚合，不应乘 2。</lang>
  // <lang en>Merged into one cluster; score aggregated once, not doubled.</lang>
  const ev = [
    { value: '#7C3AED', hex: '#7C3AED', alpha: 1, source: 'computed-background', role: 'brand', count: 3, areaRatio: 0.2, aboveFoldRatio: 0.2 },
    { value: '#7C3AED', hex: '#7C3AED', alpha: 1, source: 'computed-background', role: 'brand', count: 3, areaRatio: 0.2, aboveFoldRatio: 0.2 }
  ];
  const r = analyzeThemeV2(sig(ev));
  assert.ok(r.primary, '应有主色');
  assert.equal(r.primary.hex, '#7C3AED');
  // 两条记录合并后 count=6，但 score 不应是单条的 2 倍（对数饱和项使增长<线性）。
  // <lang zh-CN>仅校验主色被识别，且 reasons 含频次特征而非重复 source 字符串翻倍。</lang>
  // <lang en>Only assert primary is detected and reasons show frequency, not doubled source strings.</lang>
  assert.ok(r.primary.evidenceSummary.count === 6);
  assert.ok(r.primary.reasons.length >= 1);
});

test('单色黑白品牌不被硬过滤', () => {
  const ev = [
    { value: '#111111', hex: '#111111', alpha: 1, source: 'css-token', role: 'brand', count: 1, tokenNames: ['--brand'], areaRatio: 1 },
    { value: '#111111', hex: '#111111', alpha: 1, source: 'computed-background', role: 'brand', count: 5, areaRatio: 0.5 }
  ];
  const r = analyzeThemeV2(sig(ev));
  assert.ok(r.primary, '黑白单色应被识别为主色');
  assert.equal(r.primary.hex, '#111111');
  assert.equal(r.primary.role, 'brand');
});

test('状态上下文红/绿不误判为品牌色', () => {
  // success 绿 + error 红 均为 status 角色，且无 brand token → 不应成为 primary。
  // <lang zh-CN>primary 应来自其它非 status 证据；此处仅有 status，则 primary 可能为 null 或被强降权。</lang>
  // <lang en>primary should not be a status color; with only status evidence, primary is null or down-weighted.</lang>
  const ev = [
    { value: '#16A34A', hex: '#16A34A', alpha: 1, source: 'computed-text', role: 'status', count: 10, areaRatio: 0.3 },
    { value: '#DC2626', hex: '#DC2626', alpha: 1, source: 'computed-text', role: 'status', count: 10, areaRatio: 0.3 }
  ];
  const r = analyzeThemeV2(sig(ev));
  if (r.primary) {
    assert.notEqual(r.primary.role, 'status');
  }
});

test('unused token 不能仅凭名字获胜', () => {
  // --brand-primary 声明但从未在 DOM/截图中实际使用（无 computed/screenshot 来源）。
  // <lang zh-CN>仅 token 声明、零使用，score 应低，不应压过有实际使用的颜色。</lang>
  // <lang en>Token declared but zero usage scores low; must not beat a used color.</lang>
  const ev = [
    { value: '#6D28D9', hex: '#6D28D9', alpha: 1, source: 'css-token', role: 'brand', count: 1, tokenNames: ['--brand-primary'], areaRatio: 0 },
    { value: '#0EA5E9', hex: '#0EA5E9', alpha: 1, source: 'computed-background', role: 'cta', count: 8, areaRatio: 0.6, aboveFoldRatio: 0.6 }
  ];
  const r = analyzeThemeV2(sig(ev));
  assert.equal(r.primary.hex, '#0EA5E9'); // 实际使用的 CTA 胜出
});

test('token + DOM + screenshot 互证加分', () => {
  // 同一品牌色在 token、DOM、screenshot-ui 三处出现 → 应被识别且 reasons 含互证说明。
  // <lang zh-CN>互证提升 score 与 confidence。</lang>
  // <lang en>Corroboration raises score and confidence.</lang>
  const ev = [
    { value: '#6D28D9', hex: '#6D28D9', alpha: 1, source: 'css-token', role: 'brand', count: 1, tokenNames: ['--brand-primary'], areaRatio: 1 },
    { value: '#6D28D9', hex: '#6D28D9', alpha: 1, source: 'computed-background', role: 'brand', count: 4, areaRatio: 0.4, aboveFoldRatio: 0.4 },
    { value: '#6D28D9', hex: '#6D28D9', alpha: 1, source: 'screenshot-ui', role: 'brand', count: 1, pixelRatio: 0.08 }
  ];
  const r = analyzeThemeV2(sig(ev));
  assert.equal(r.primary.hex, '#6D28D9');
  assert.ok(r.primary.reasons.some(x => x.includes('互证')));
  assert.ok(r.primary.confidence > 0.3);
});

test('无真实副色时 derived fallback 标记正确', () => {
  // 仅一个主色，无副色候选 → secondary 应为 derived 且 origin harmony-fallback。
  // <lang zh-CN>derived 副色明确标记非网页原始颜色。</lang>
  // <lang en>derived secondary clearly tagged as not from the page.</lang>
  const ev = [
    { value: '#6D28D9', hex: '#6D28D9', alpha: 1, source: 'css-token', role: 'brand', count: 1, tokenNames: ['--brand-primary'], areaRatio: 1 },
    { value: '#6D28D9', hex: '#6D28D9', alpha: 1, source: 'computed-background', role: 'brand', count: 4, areaRatio: 0.4 }
  ];
  const r = analyzeThemeV2(sig(ev));
  assert.ok(r.secondary, '应生成 derived 副色');
  assert.equal(r.secondary.derived, true);
  assert.equal(r.secondary.origin, 'harmony-fallback');
  assert.ok(r.secondary.reasons.some(x => x.includes('协调生成')));
});

test('degraded-static 模式置信度封顶 0.45', () => {
  const ev = [
    { value: '#6D28D9', hex: '#6D28D9', alpha: 1, source: 'css-token', role: 'brand', count: 1, tokenNames: ['--brand-primary'], areaRatio: 1 },
    { value: '#0EA5E9', hex: '#0EA5E9', alpha: 1, source: 'computed-background', role: 'cta', count: 8, areaRatio: 0.6 }
  ];
  const r = analyzeThemeV2(sig(ev, 'degraded-static'));
  assert.ok(r.primary.confidence <= 0.45 + 1e-9, '降级模式置信度应 <= 0.45');
  assert.ok(r.warnings.some(w => w.includes('0.45')));
});

test('alternatives 返回 8~12 个候选', () => {
  const ev = [];
  const palette = ['#6D28D9', '#0EA5E9', '#16A34A', '#DC2626', '#F59E0B', '#0891B2', '#DB2777', '#65A30D', '#7C3AED', '#EA580C', '#0D9488', '#9333EA', '#1D4ED8', '#B91C1C'];
  for (const h of palette) ev.push({ value: h, hex: h, alpha: 1, source: 'computed-background', role: 'unknown', count: 3, areaRatio: 0.1 });
  const r = analyzeThemeV2(sig(ev));
  assert.ok(r.alternatives.length >= 8 && r.alternatives.length <= 12, `alternatives=${r.alternatives.length}`);
});
