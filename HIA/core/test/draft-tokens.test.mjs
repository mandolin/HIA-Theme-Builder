/**
 * @lang zh-CN 草稿令牌组单测（`ADR-006` / `W-tb-P9`）：ThemeDraft 携带 typography/spacing 时
 *   createThemeDraft 深拷贝隔离、buildThemeFromDraft 透传、旧数据补默认且 overrides 不显式写入。
 * @lang en Draft token-group tests (`ADR-006` / `W-tb-P9`): createThemeDraft deep-clones carried
 *   typography/spacing, buildThemeFromDraft passes them through, legacy data gets defaults with
 *   no explicit overrides key.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { createThemeDraft, buildThemeFromDraft, draftFromPreset, builtinPresets, DEFAULT_TYPOGRAPHY, DEFAULT_SPACING } from '../dist/index.js';

test('草稿令牌: 缺省补默认且与 DEFAULT 常量 deepEqual（defaults on absent）', () => {
  const draft = createThemeDraft();
  assert.deepEqual(draft.typography, DEFAULT_TYPOGRAPHY);
  assert.deepEqual(draft.spacing, DEFAULT_SPACING);
});

test('草稿令牌: 传入组被深拷贝（传入对象后续修改不影响草稿）（deep clone isolation）', () => {
  const input = {
    typography: { fontFamily: { body: 'A', heading: 'B', mono: 'C' }, fontSizeScale: { base: 18, ratio: 1.3 }, lineHeightBody: 1.5 },
    spacing: { base: 6, step: 'linear4', levels: 5 }
  };
  const draft = createThemeDraft(input);
  input.typography.fontSizeScale.base = 99;
  input.spacing.base = 99;
  assert.equal(draft.typography.fontSizeScale.base, 18, 'typography 深拷贝隔离');
  assert.equal(draft.spacing.base, 6, 'spacing 深拷贝隔离');
});

test('草稿令牌: buildThemeFromDraft 透传字体/间距到主题（passthrough to Theme）', () => {
  const draft = createThemeDraft({
    typography: { fontFamily: { body: 'X', heading: 'Y', mono: 'Z' }, fontSizeScale: { base: 14, ratio: 1.2 }, lineHeightBody: 1.4 },
    spacing: { base: 10, step: 'x15', levels: 4 }
  });
  const theme = buildThemeFromDraft(draft);
  assert.equal(theme.typography.fontSizeScale.base, 14);
  assert.equal(theme.typography.fontFamily.body, 'X');
  assert.equal(theme.spacing.base, 10);
  assert.equal(theme.spacing.step, 'x15');
});

test('草稿令牌: overrides 存在时保留、缺失时不显式写入键（overrides key semantics）', () => {
  const withOv = createThemeDraft({
    typography: { fontFamily: { body: 'A', heading: 'B', mono: 'C' }, fontSizeScale: { base: 16, ratio: 1.25, overrides: { h1: 20 } }, lineHeightBody: 1.5 }
  });
  assert.ok('overrides' in withOv.typography.fontSizeScale, 'overrides 显式传入应保留');
  const noOv = createThemeDraft();
  assert.ok(!('overrides' in noOv.typography.fontSizeScale), '缺省草稿不得显式写入 overrides 键（deepEqual 语义）');
  assert.ok(!('overrides' in noOv.spacing));
});

test('草稿令牌: draftFromPreset（预设无令牌字段）回退默认（preset round-trip fallback）', () => {
  const draft = draftFromPreset(builtinPresets[0]);
  assert.deepEqual(draft.typography, DEFAULT_TYPOGRAPHY);
  assert.deepEqual(draft.spacing, DEFAULT_SPACING);
});
