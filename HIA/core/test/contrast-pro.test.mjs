/**
 * @lang zh-CN 对比度深化单测（`W-tb-P36`）：APCA 副指标、CVD 色觉模拟、全调色板矩阵、目标驱动生成。
 *   断言分两类：**行为性质**（单调性/不变量/对称性，防实现回退）与**黄金值**（来自参考常量的确定性输出）。
 *   注意：本文件是 .mjs，不能使用 TypeScript 非空断言语法。
 * @lang en Contrast-deepening tests (`W-tb-P36`): APCA secondary metric, CVD simulation, palette-wide matrix,
 *   target-driven synthesis. Two assertion classes: behavioural properties (monotonicity/invariants/symmetry)
 *   and golden values (deterministic outputs from reference constants). NB: this is a .mjs file — TypeScript
 *   non-null assertions are not valid here.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  contrast, contrastMatrix, stepForContrast, apcaLc, apcaY,
  simulateCvd, MACHADO_2009_SEV1, CVD_LABELS, hexToOklch
} from '../dist/index.js';

// ===== 1. APCA（参考值副指标）=====
test('APCA：极性约定——黑/白为正、白/黑为负（符号即信息）', () => {
  const bow = apcaLc('#000000', '#FFFFFF');
  const wob = apcaLc('#FFFFFF', '#000000');
  assert.ok(bow > 90, `黑字白底应为大正值，实为 ${bow}`);
  assert.ok(wob < -90, `白字黑底应为大负值，实为 ${wob}`);
  // 黄金值：由 SA98G 0.1.9 常量确定性推出；偏离即实现被改动。
  // <lang en>Golden values derived deterministically from the SA98G 0.1.9 constants; drift means the
  //   implementation changed.</lang>
  assert.ok(Math.abs(bow - 106.0) < 0.5, `黑字白底黄金值 ≈106.0，实为 ${bow.toFixed(1)}`);
  assert.ok(Math.abs(wob - -107.9) < 0.5, `白字黑底黄金值 ≈-107.9，实为 ${wob.toFixed(1)}`);
});

test('APCA：参考表值 #666/#FFF ≈ 78.8（与 Myndex 表对照）', () => {
  const lc = apcaLc('#666666', '#FFFFFF');
  assert.ok(Math.abs(lc - 78.8) < 2, `应 ≈78.8，实为 ${lc.toFixed(1)}`);
});

test('APCA：亮度差越大 |Lc| 越大（单调性）', () => {
  const bgs = ['#FFFFFF', '#E5E7EB', '#9CA3AF'];
  // 文字固定黑，背景由白到灰：ΔY 递减，|Lc| 应递减。
  // <lang en>Fixed black text with backgrounds going white→grey: ΔY shrinks, so |Lc| must shrink.</lang>
  const values = bgs.map(bg => Math.abs(apcaLc('#000000', bg)));
  for (let i = 1; i < values.length; i++) assert.ok(values[i] < values[i - 1], `单调性破坏于 ${bgs[i]}`);
});

test('APCA：同色或极近色返回 0（ΔY 早退）', () => {
  assert.equal(apcaLc('#888888', '#888888'), 0);
  // ΔY 低于 deltaYmin 的极近色也必须归零，防止极性翻转噪声。
  // <lang en>Extremely close colours below deltaYmin must also zero out to prevent polarity-flip noise.</lang>
  assert.equal(apcaLc('#808080', '#7F7F7F'), 0);
});

test('APCA：apcaY 基本有界（0..1.04，加权总和略大于 1 属算法设计）', () => {
  assert.ok(apcaY('#000000') >= 0 && apcaY('#000000') < 0.001);
  assert.ok(apcaY('#FFFFFF') > 0.99 && apcaY('#FFFFFF') < 1.04);
});

// ===== 2. CVD 色觉模拟 =====
test('CVD：灰阶与黑白不变（行和 ≈1 的矩阵性质）', () => {
  for (const type of ['protanopia', 'deuteranopia', 'tritanopia']) {
    assert.equal(simulateCvd('#FFFFFF', type), '#FFFFFF');
    assert.equal(simulateCvd('#000000', type), '#000000');
    assert.equal(simulateCvd('#888888', type), '#888888');
    assert.equal(simulateCvd('#C2C2C2', type), '#C2C2C2');
  }
});

test('CVD：矩阵行和 ≈ 1（灰阶不变量的来源）', () => {
  for (const row of Object.values(MACHADO_2009_SEV1)) {
    for (let r = 0; r < 3; r++) {
      const sum = row[r * 3] + row[r * 3 + 1] + row[r * 3 + 2];
      assert.ok(Math.abs(sum - 1) < 0.003, `行 ${r} 和 ${sum.toFixed(4)} 偏离 1`);
    }
  }
});

test('CVD：红/绿在 protan/deutan 下显著偏移（黄金值）', () => {
  // 黄金值来自已发表的 severity 1.0 矩阵（线性空间应用），实现确定性输出。
  // <lang en>Golden values from the published severity-1.0 matrices applied in linear space — deterministic.</lang>
  assert.equal(simulateCvd('#FF0000', 'protanopia'), '#6D5F00');
  assert.equal(simulateCvd('#FF0000', 'deuteranopia'), '#A39000');
  // 红色弱者把纯红看成暗黄褐（B 分量归零）——语义抽查防"换了矩阵没人发现"。
  // <lang en>Protan observers see pure red as a dark yellow-brown (B channel zeroes) — a semantic spot-check.</lang>
  const protan = simulateCvd('#FF0000', 'protanopia');
  assert.ok(parseInt(protan.slice(1, 3), 16) > parseInt(protan.slice(5, 7), 16), 'protan 红色的 R 应大于 B');
});

test('CVD：tritan 下红基本不变、蓝显著偏移（缺陷类型针对性）', () => {
  // 蓝黄缺陷不涉红端：纯红只轻微偏移；纯蓝应显著变化并偏向青。
  // <lang en>Tritan does not touch the red end: pure red barely moves; pure blue shifts strongly toward cyan.</lang>
  assert.equal(simulateCvd('#FF0000', 'tritanopia'), '#FF000F');
  const blue = simulateCvd('#0000FF', 'tritanopia');
  assert.notEqual(blue, '#0000FF');
  // 蓝色缺失者看纯蓝 → 偏青（G 通道显著抬升）。
  // <lang en>A tritan observer sees pure blue shifted toward cyan (G channel rises well above 0).</lang>
  assert.ok(parseInt(blue.slice(3, 5), 16) > 40, `tritan 蓝色的 G 应显著抬升，实为 ${blue}`);
});

test('CVD：类型标签齐全（滤镜下拉直接消费）', () => {
  for (const label of Object.values(CVD_LABELS)) {
    assert.ok(label.zh.length > 0 && label.en.length > 0, '标签缺失');
  }
});

// ===== 3. 对比度矩阵 =====
test('矩阵：WCAG 对称、对角线为 1、与单点 contrast 一致', () => {
  const entries = [
    { key: '主色', hex: '#0047AB' }, { key: '副色', hex: '#00A8D3' }, { key: '白', hex: '#FFFFFF' }, { key: '黑', hex: '#000000' }
  ];
  const m = contrastMatrix(entries);
  assert.deepEqual(m.keys, entries.map(e => e.key));
  for (let i = 0; i < 4; i++) {
    assert.equal(m.wcag[i][i], 1);
    for (let j = 0; j < 4; j++) {
      assert.equal(m.wcag[i][j], m.wcag[j][i], 'WCAG 矩阵必须对称');
      assert.ok(Math.abs(m.wcag[i][j] - contrast(entries[i].hex, entries[j].hex)) < 1e-9);
    }
  }
  // 黄金对：黑/白 = 21（WCAG 定义上限）。
  // <lang en>Golden pair: black/white = 21, the WCAG ceiling.</lang>
  assert.ok(Math.abs(m.wcag[2][3] - 21) < 1e-9);
});

test('矩阵：APCA 具方向性（行=文字色），同对正负取决于极性', () => {
  const entries = [{ key: '黑字', hex: '#000000' }, { key: '白底', hex: '#FFFFFF' }];
  const m = contrastMatrix(entries);
  // 行=文字色：行0(黑)在列1(白底) → 正；行1(白)在列0(黑底) → 负。
  // <lang en>Row = text colour: row 0 (black) on column 1 (white) → positive; row 1 (white) on column 0
  //   (black) → negative.</lang>
  assert.ok(m.apca[0][1] > 90, `黑字白底应为正，实为 ${m.apca[0][1]}`);
  assert.ok(m.apca[1][0] < -90, `白字黑底应为负，实为 ${m.apca[1][0]}`);
  assert.notEqual(m.apca[0][1], m.apca[1][0], 'APCA 矩阵不应对称');
  assert.equal(m.apca[0][0], 0);
});

// ===== 4. 目标驱动生成 =====
test('目标生成：亮底取深字，比值命中 4.5 ± 0.1 且色相不变', () => {
  const r = stepForContrast('#0047AB', '#FFFFFF', 4.5);
  assert.equal(r.direction, 'darker');
  assert.ok(r.ok, `比值 ${r.ratio.toFixed(2)} 未命中 4.5±0.1`);
  const baseHue = hexToOklch('#0047AB').h, outHue = hexToOklch(r.hex).h;
  let dh = Math.abs(baseHue - outHue); if (dh > 180) dh = 360 - dh;
  assert.ok(dh < 1, `色相漂移 ${dh.toFixed(2)}°，应保持色相`);
});

test('目标生成：暗底取浅字，比值命中 4.5 ± 0.1', () => {
  const r = stepForContrast('#0047AB', '#101418', 4.5);
  assert.equal(r.direction, 'lighter');
  assert.ok(r.ok, `比值 ${r.ratio.toFixed(2)} 未命中`);
});

test('目标生成：7.0（AAA）同样可达', () => {
  for (const bg of ['#FFFFFF', '#F8FAFC', '#101418']) {
    const r = stepForContrast('#00A8D3', bg, 7.0);
    assert.ok(r.ok, `bg=${bg} 比值 ${r.ratio.toFixed(2)} 未命中 7.0±0.1`);
  }
});

test('目标生成：不可达目标返回最接近值且 ok:false（诚实降级）', () => {
  // 灰底两侧的最大比值都远低于 21：应返回可达上限并明确标记未达标。
  // <lang en>Neither side of a mid-grey bg can reach 21; return the reachable maximum, flagged.</lang>
  const r = stepForContrast('#336699', '#808080', 21);
  assert.equal(r.ok, false);
  assert.ok(r.ratio > 1, `比值 ${r.ratio} 异常`);
});

test('目标生成：与真实对比度函数自洽（结果用 contrast 复测）', () => {
  const cases = [['#0047AB', '#FFFFFF', 4.5], ['#00A8D3', '#101418', 7.0], ['#5BBD2B', '#FFFFFF', 3.0]];
  for (const [base, bg, target] of cases) {
    const r = stepForContrast(base, bg, target);
    const measured = contrast(r.hex, bg);
    assert.ok(Math.abs(measured - r.ratio) < 1e-9, '返回比值应可直接复测');
    if (r.ok) assert.ok(Math.abs(measured - target) <= 0.1, `实测 ${measured.toFixed(2)} 偏离 ${target}`);
  }
});
