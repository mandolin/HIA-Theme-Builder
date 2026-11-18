/**
 * @lang zh-CN 色阶生成模式单测（`W-tb-P47` / `ADR-018`）：classic 回归基线、grid 等差、
 *   curve 缓动（t=0=grid）、锚点一致性、500=基色、强度 clamp。
 * @lang en Scale-mode tests (`W-tb-P47` / `ADR-018`): classic regression baseline, grid uniformity,
 *   curve easing (t=0=grid), anchor consistency, 500=base, strength clamping.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { tonalScale, tonalScaleAt, hexToOklch } from '../dist/index.js';

/** @lang zh-CN 默认主色（钴蓝）。 @lang en Default primary (cobalt). */
const COBALT='#0047AB';

/** @lang zh-CN 1.0.0 classic 输出回归基线（封版时捕获，改公式必须显式更新本基线）。
    @lang en The 1.0.0 classic output baseline (captured at seal; formula changes must update it explicitly). */
const COBALT_CLASSIC={"50":"#F0F6FF","100":"#D6E6FF","200":"#ACCCFF","300":"#7EACF4","400":"#4C84E0","500":"#0047AB","600":"#003481","700":"#00245E","800":"#001239","900":"#000417"};

const KEYS=['50','100','200','300','400','500','600','700','800','900'];

test('classic 回归：缺省与显式 classic 输出逐位等于 1.0.0 基线', () => {
  assert.deepEqual(tonalScale(COBALT),COBALT_CLASSIC);
  assert.deepEqual(tonalScale(COBALT,'classic'),COBALT_CLASSIC);
});

test('classic 回归：tonalScaleAt 缺省锚点逐位一致', () => {
  for(const k of KEYS)assert.equal(tonalScaleAt(COBALT,parseInt(k,10)),COBALT_CLASSIC[k],`锚点 ${k}`);
});

test('契约：三模式 500 恒为基色本色', () => {
  assert.equal(tonalScale(COBALT,'grid')['500'],COBALT);
  assert.equal(tonalScale(COBALT,'curve',1)['500'],COBALT);
  assert.equal(tonalScaleAt(COBALT,500,'grid'),COBALT);
});

test('grid：灰阶基色浅坡 ΔL 均匀（hex 量化噪声容差内）且单调递减', () => {
  const g=tonalScale('#8A8F98','grid');
  const Ls=[500,400,300,200,100,50].map(k=>hexToOklch(g[k]).L);
  const diffs=Ls.slice(1).map((v,i)=>v-Ls[i]);
  for(const d of diffs)assert.ok(d>0,'L 须自 500 向 50 递增（浅坡）');
  const spread=Math.max(...diffs)-Math.min(...diffs);
  assert.ok(spread<0.003,'浅坡 ΔL 应均匀（容差内）：'+spread.toFixed(5));
  const Ds=[500,600,700,800,900].map(k=>hexToOklch(g[k]).L);
  const dd=Ds.slice(1).map((v,i)=>v-Ds[i]);
  for(const d of dd)assert.ok(d<0,'L 须自 500 向 900 递减（深坡）');
});

test('grid：饱和基色锚点 L 单调递减（50→900）且全部合法 HEX', () => {
  const g=tonalScale(COBALT,'grid');
  let prev=Infinity;
  for(const k of KEYS){
    assert.match(g[k],/^#[0-9A-F]{6}$/);
    const L=hexToOklch(g[k]).L;
    assert.ok(L<prev,`L 单调递减 @${k}`);prev=L;
  }
});

test('curve：t=0 逐位等于 grid；t=1 中段锚点可见偏移', () => {
  const grid=tonalScale(COBALT,'grid');
  const c0=tonalScale(COBALT,'curve',0);
  assert.deepEqual(c0,grid);
  const c1=tonalScale(COBALT,'curve',1);
  const moved=KEYS.filter(k=>k!=='500'&&k!=='50'&&k!=='900'&&c1[k]!==grid[k]);
  assert.ok(moved.length>=2,'t=1 应使中段锚点可见偏移：'+moved.join(','));
});

test('curve：强度 clamp（t=5 等价 t=1）且三模式锚点处 tonalScaleAt 逐位一致', () => {
  const c1=tonalScale(COBALT,'curve',1),c5=tonalScale(COBALT,'curve',5);
  assert.deepEqual(c1,c5);
  const grid=tonalScale(COBALT,'grid');
  for(const k of KEYS){
    assert.equal(tonalScaleAt(COBALT,parseInt(k,10),'grid'),grid[k],`grid 锚点 ${k}`);
    assert.equal(tonalScaleAt(COBALT,parseInt(k,10),'curve',1),c1[k],`curve 锚点 ${k}`);
  }
});

test('grid/curve：副色与语义管线同参可用（副色基色跑通三模式）', () => {
  for(const mode of ['classic','grid','curve']){
    const s=tonalScale('#3EC6D3',mode,0.7);
    assert.match(s['300'],/^#[0-9A-F]{6}$/);
    assert.equal(s['500'],'#3EC6D3');
  }
});
