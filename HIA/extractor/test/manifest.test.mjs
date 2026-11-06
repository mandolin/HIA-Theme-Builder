/**
 * @lang zh-CN manifest 颜色提取单测（遗留问题清理 C9）：验证 manifestColorsFromJson 纯函数的解析与降级行为。
 *   不依赖 DOM/Canvas；fetchManifest 的网络路径由适配器端到端验证。
 * @lang en Manifest color extraction tests (cleanup C9): verify manifestColorsFromJson pure-function parsing and degrade behavior.
 *   DOM/Canvas-free; the fetchManifest network path is verified end-to-end by adapters.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { manifestColorsFromJson } from '../dist/browser/index.js';

test('manifest: 解析 theme_color 与 background_color（manifest: parse both colors）', () => {
  const r = manifestColorsFromJson(JSON.stringify({
    name: 'demo',
    theme_color: '#0047AB',
    background_color: '#ffffff'
  }));
  assert.ok(r, '应解析成功（should parse）');
  assert.equal(r.themeColor, '#0047AB');
  assert.equal(r.backgroundColor, '#ffffff');
});

test('manifest: 缺字段或空串返回 null（manifest: missing/blank fields → null）', () => {
  assert.equal(manifestColorsFromJson(JSON.stringify({ name: 'demo' })), null);
  assert.equal(manifestColorsFromJson(JSON.stringify({ theme_color: '   ' })), null);
  assert.equal(manifestColorsFromJson('{}'), null);
});

test('manifest: 非法 JSON 返回 null 而非抛出（manifest: invalid JSON → null, no throw）', () => {
  assert.equal(manifestColorsFromJson('not json'), null);
  assert.equal(manifestColorsFromJson(''), null);
});

test('manifest: 非字符串类型字段被忽略（manifest: non-string fields ignored）', () => {
  const r = manifestColorsFromJson(JSON.stringify({ theme_color: 123, background_color: null }));
  assert.equal(r, null, '数字/null 字段不应被采纳（non-string fields rejected）');
});
