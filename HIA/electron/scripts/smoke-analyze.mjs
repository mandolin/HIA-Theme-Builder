// P3 端到端冒烟（验证后可删）：真实渲染 fixture + core.analyzeThemeV2，打印完整分析报告摘要。
// <lang zh-CN>需 HIA_TEST_LOCAL=1 允许 file://；单 fixture 模式 argv[2]，否则跑全部 01~12。</lang>
// <lang en>P3 e2e smoke: real render + core.analyzeThemeV2, prints analysis summary. Needs HIA_TEST_LOCAL=1.</lang>
import { app } from 'electron';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { readdirSync } from 'node:fs';
import { renderCollect } from '../dist/render-adapter.js';
import { analyzeThemeV2 } from '@hia/theme-core';

const __dirname = dirname(fileURLToPath(import.meta.url));
const fxDir = join(__dirname, '..', '..', 'extractor', 'fixtures');
const arg = process.argv[2];
const files = arg ? [arg] : readdirSync(fxDir).filter(f => f.endsWith('.html') && /^\d{2}-/.test(f)).sort();

app.whenReady().then(async () => {
  let pass = 0;
  for (const f of files) {
    const url = 'file://' + join(fxDir, f);
    try {
      const sig = await renderCollect(url);
      const a = analyzeThemeV2(sig);
      const p = a.primary, s = a.secondary;
      const reasons = p ? p.reasons.slice(0, 5).join(' | ') : '—';
      console.log(`OK  ${f}`);
      console.log(`    mode=${sig.diagnostics.mode} confidence=${a.confidence.toFixed(2)}`);
      console.log(`    primary=${p ? p.hex : '—'} (conf ${(p ? p.confidence : 0).toFixed(2)}, role ${p ? p.role : '—'})`);
      console.log(`    secondary=${s ? s.hex : '—'} (derived=${s ? !!s.derived : '—'})`);
      console.log(`    reasons[0..5]: ${reasons}`);
      console.log(`    alternatives=${a.alternatives.length} warnings=${a.warnings.length}`);
      if (a.warnings.length) console.log(`    warn: ${a.warnings.join(' || ')}`);
      if (p) pass++;
    } catch (e) {
      console.log(`ERR ${f}  ${e && e.message || e}`);
    }
  }
  console.log(`\nANALYZE_PASS=${pass}/${files.length}`);
  app.quit();
}).catch(e => { console.error('FATAL', e); app.quit(); });
