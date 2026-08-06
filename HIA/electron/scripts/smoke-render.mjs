// 临时冒烟脚本（P2 验证，验证后可删）：遍历 extractor fixtures，逐一真实渲染采集，打印 V2 信号摘要。
// <lang zh-CN>仅用于本地 fixture 验证，不走生产 IPC；需 HIA_TEST_LOCAL=1 允许 file://。</lang>
// <lang en>P2 local verification only; not a production path; requires HIA_TEST_LOCAL=1 for file://.</lang>
import { app } from 'electron';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { readdirSync } from 'node:fs';
import { renderCollect } from '../dist/render-adapter.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const fxDir = join(__dirname, '..', '..', 'extractor', 'fixtures');
// 支持单 fixture 模式（argv[2]）以避免 headless GPU 状态在多 fixture 间串扰；
// 批量由 shell 循环逐个进程调用。
// <lang zh-CN>每个 fixture 独立进程，规避本环境 headless 截图后 GPU 崩溃影响后续加载。</lang>
// <lang en>Per-fixture process avoids headless GPU crash after screenshot affecting later loads in this env.</lang>
const arg = process.argv[2];
const files = arg ? [arg] : readdirSync(fxDir).filter(f => f.endsWith('.html') && /^\d{2}-/.test(f)).sort();

app.whenReady().then(async () => {
  let pass = 0;
  for (const f of files) {
    const url = 'file://' + join(fxDir, f);
    try {
      const sig = await renderCollect(url);
      const bySource = {};
      for (const e of sig.evidence) bySource[e.source] = (bySource[e.source] || 0) + 1;
      const brand = sig.evidence.filter(e => e.role === 'brand' || e.role === 'primary' || e.role === 'cta');
      console.log(`OK  ${f}  mode=${sig.diagnostics.mode} ev=${sig.evidence.length} brand/cta=${brand.length} src=${JSON.stringify(bySource)}`);
      pass++;
    } catch (e) {
      console.log(`ERR ${f}  ${e && e.message || e}`);
    }
  }
  console.log(`\nFIXTURES_PASS=${pass}/${files.length}`);
  app.quit();
}).catch(e => { console.error('FATAL', e); app.quit(); });
