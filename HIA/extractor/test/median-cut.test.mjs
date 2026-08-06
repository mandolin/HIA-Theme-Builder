/**
 * @lang zh-CN median-cut 量化确定性回归测试：相同输入必须恒得相同输出。
 * @lang en Deterministic median-cut tests: identical input must always yield identical output.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { quantizeMedianCut } from '../dist/index.js';

// 构造一组纯红/纯绿/纯蓝像素（各 100 个），加少量低 alpha 噪声。
// <lang zh-CN>目标 6 个代表色，验证确定性、数量与占比降序。</lang>
// <lang en>Target 6 reps; verify determinism, count and descending ratio.</lang>
function buildPixels(){
  const px=[];
  const add=(r,g,b,n)=>{ for(let i=0;i<n;i++)px.push({r,g,b,a:255}); };
  add(255,0,0,100); add(0,255,0,100); add(0,0,255,100);
  add(255,255,0,50); add(0,255,255,50); add(255,0,255,50);
  return px;
}

test('deterministic: same input yields identical output across runs', ()=>{
  const px=buildPixels();
  const a=quantizeMedianCut(px,6);
  const b=quantizeMedianCut(px,6);
  assert.deepEqual(a,b);
});

test('produces at most targetCount representatives', ()=>{
  const px=buildPixels();
  const out=quantizeMedianCut(px,6);
  assert.ok(out.length<=6);
  assert.ok(out.length>=3);
});

test('ratio sorted descending and sums ~1', ()=>{
  const px=buildPixels();
  const out=quantizeMedianCut(px,6);
  for(let i=1;i<out.length;i++) assert.ok(out[i-1].count>=out[i].count);
  const sum=out.reduce((s,c)=>s+c.ratio,0);
  assert.ok(Math.abs(sum-1)<1e-6);
});

test('ignoreAlpha drops near-transparent pixels', ()=>{
  const px=buildPixels();
  // 插入大量低 alpha 红像素，应被忽略，不污染代表色。
  // <lang zh-CN>alpha<16 视作透明被筛除。</lang>
  // <lang en>alpha<16 treated transparent and filtered.</lang>
  for(let i=0;i<500;i++)px.push({r:1,g:2,b:3,a:5});
  const out=quantizeMedianCut(px,6);
  // 代表色中不应出现 (1,2,3) 这类噪声色占主导。
  assert.ok(!out.some(c=>c.hex==='#010203'));
});

test('empty/transparent-only returns []', ()=>{
  assert.deepEqual(quantizeMedianCut([],6),[]);
  assert.deepEqual(quantizeMedianCut([{r:0,g:0,b:0,a:0}],6),[]);
});
