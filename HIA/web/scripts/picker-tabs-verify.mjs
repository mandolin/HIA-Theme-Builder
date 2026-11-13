#!/usr/bin/env node
/**
 * @lang zh-CN 主色候选库 tab 复核（`W-tb-P34`，维护者二次校正）：无头 Chrome 驱动生产 dist，逐个点击四个 tab，
 *   断言 ①同一时刻只有一个视图可见；②tab 的 active 与可见视图一致；③徽标计数与该组实际卡片数一致；
 *   ④副色候选区仍是独立区块、始终可见（不参与 tab）；⑤无横向溢出；
 *   ⑥点一张主色卡后主色输入框真的变到该卡色值；⑦切换语言后停在原 tab 且徽标已翻译。
 * @lang en Primary-library tab verification (`W-tb-P34`, maintainer's second correction): headless Chrome drives
 *   the production dist through all four tabs, asserting (1) exactly one view is visible; (2) the active tab
 *   matches the visible view; (3) the badge matches that group's card count; (4) the secondary area is still a
 *   separate, always-visible box outside the tabs; (5) no horizontal overflow; (6) clicking a card really moves
 *   the primary input to that colour; (7) switching language keeps the tab and translates the badge.
 *
 * 用法 / Usage: node scripts/picker-tabs-verify.mjs
 * 产物 / Output: temp/picker-tabs/*.png
 */
import { createServer } from 'node:http';
import { readFile, mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve, sep } from 'node:path';
import puppeteer from 'puppeteer-core';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..', '..', '..'); // 仓库根 / repo root
const DIST = resolve(__dirname, '..', 'dist');
const OUT = join(ROOT, 'temp', 'picker-tabs');
const PORT = 18996;
const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.svg': 'image/svg+xml',
  '.png': 'image/png', '.ico': 'image/x-icon', '.map': 'application/json'
};
// 期望的分组规模：由候选数据自身 group 字段决定（12 / 20 / 12），情感 24。
// <lang en>Expected group sizes come from the data's own group field (12 / 20 / 12); mood is 24.</lang>
const EXPECT = { hia: 12, award: 20, trending: 12, mood: 24 };

// 静态服务：只暴露 dist 内的文件，其余 404。
// <lang en>Static server: only files inside dist are served; everything else 404s.</lang>
function serve() {
  return new Promise((res) => {
    const server = createServer(async (req, resp) => {
      try {
        const url = decodeURIComponent(req.url.split('?')[0]);
        const rel = url === '/' ? '/index.html' : url;
        const file = join(DIST, rel);
        if (!file.startsWith(DIST + sep) && file !== DIST) { resp.writeHead(403); return resp.end(); }
        const buf = await readFile(file);
        resp.writeHead(200, {
          'content-type': MIME[file.slice(file.lastIndexOf('.')).toLowerCase()] ?? 'application/octet-stream',
          'cache-control': 'no-store'
        });
        resp.end(buf);
      } catch { resp.writeHead(404); resp.end('not found'); }
    });
    server.listen(PORT, '127.0.0.1', () => res(server));
  });
}

async function launch() {
  for (const channel of ['chrome', 'chrome-beta', 'msedge']) {
    try { return await puppeteer.launch({ channel, headless: true, protocolTimeout: 180000, args: ['--no-sandbox', '--disable-dev-shm-usage', '--hide-scrollbars'] }); }
    catch { /* 下一个候选通道 / next channel */ }
  }
  throw new Error('未找到可用的 Chrome/Edge。');
}

/** 读取某个 tab 下的可见性快照与卡片数（在页面上下文执行）。 */
// <lang en>Reads a visibility snapshot and card counts for one tab (runs in page context).</lang>
const snapshot = (tab) => {
  const moodView = document.getElementById('primaryViewMood');
  const gridView = document.getElementById('primaryCandidatesWrap');
  const box = document.getElementById('primaryLibBox');
  const secBox = document.getElementById('secondaryLibBox');
  return {
    requested: tab,
    moodVisible: !!moodView && !moodView.hidden,
    gridVisible: !!gridView && !gridView.hidden,
    active: [...document.querySelectorAll('#primaryLibTabs .tab')]
      .filter((b) => b.classList.contains('active')).map((b) => b.dataset.primaryTab),
    badge: document.getElementById('primaryLibBadge')?.textContent?.trim() ?? '',
    gridCards: gridView ? gridView.querySelectorAll('.color-card').length : 0,
    moodCards: document.getElementById('moodPrimaryWrap')?.querySelectorAll('.color-card').length ?? 0,
    // 副色区必须始终可见且不在任何 tab 容器内。
    // <lang en>The secondary box must always be visible and outside any tab container.</lang>
    secVisible: !!secBox && !secBox.hidden && (secBox.getBoundingClientRect().height > 0),
    secInsidePrimary: !!document.querySelector('#primaryLibBox #secondaryCandidatesWrap'),
    overflowPrimary: box ? box.scrollWidth - box.clientWidth : 0,
    overflowDoc: document.documentElement.scrollWidth - document.documentElement.clientWidth
  };
};

const server = await serve();
const browser = await launch();
const page = await browser.newPage();
await page.setViewport({ width: 1440, height: 1200, deviceScaleFactor: 2 });
await mkdir(OUT, { recursive: true });

await page.goto(`http://127.0.0.1:${PORT}/`, { waitUntil: 'networkidle2', timeout: 30000 });
await page.waitForSelector('#primaryLibBox', { timeout: 15000 });
// 等 bind() 挂完事件：以语言切换按钮的可访问名为探针。
// <lang en>Wait for bind() to attach handlers, probing the language toggle's accessible name.</lang>
await page.waitForFunction(() => document.getElementById('langToggleBtn')?.getAttribute('aria-label')?.includes('EN'), { timeout: 10000 }).catch(() => {});

let failed = 0;
for (const tab of ['hia', 'award', 'trending', 'mood']) {
  await page.evaluate((v) => {
    document.querySelector(`#primaryLibTabs .tab[data-primary-tab="${v}"]`)?.click();
  }, tab);
  await new Promise((r) => setTimeout(r, 350));
  const s = await page.evaluate(snapshot, tab);
  const el = await page.$('#primaryLibBox');
  if (el) await el.screenshot({ path: join(OUT, `${tab}.png`) });

  // 情感 tab 显示独立视图；其余三组显示候选网格。两者必须互斥。
  // <lang en>The mood tab shows its own view; the other three show the grid. They must be mutually exclusive.</lang>
  const wantMood = tab === 'mood';
  const viewOk = s.moodVisible === wantMood && s.gridVisible === !wantMood;
  const activeOk = s.active.length === 1 && s.active[0] === tab;
  const cards = wantMood ? s.moodCards : s.gridCards;
  const countOk = cards === EXPECT[tab];
  console.log(`[${tab}] mood=${s.moodVisible} grid=${s.gridVisible} active=${s.active.join(',')} badge="${s.badge}" cards=${cards} secVisible=${s.secVisible} overflow=${s.overflowPrimary}/${s.overflowDoc}`);

  if (!viewOk) { console.error(`❌ ${tab}: 视图互斥失败（mood=${s.moodVisible} grid=${s.gridVisible}）`); failed++; }
  if (!activeOk) { console.error(`❌ ${tab}: active tab ${JSON.stringify(s.active)}`); failed++; }
  if (!countOk) { console.error(`❌ ${tab}: 卡片数应为 ${EXPECT[tab]}，实为 ${cards}`); failed++; }
  // 徽标里的数字必须与卡片数一致（中英两种文案都含数字）。
  // <lang en>The badge number must match the card count in both locales.</lang>
  const badgeNum = s.badge.match(/\d+/)?.[0];
  if (badgeNum !== String(EXPECT[tab])) { console.error(`❌ ${tab}: 徽标 "${s.badge}" 与卡片数 ${EXPECT[tab]} 不一致`); failed++; }
  // 副色区不受 tab 影响。
  // <lang en>The secondary box is unaffected by tab switching.</lang>
  if (!s.secVisible) { console.error(`❌ ${tab}: 副色候选区不可见`); failed++; }
  if (s.secInsidePrimary) { console.error(`❌ ${tab}: 副色候选区被嵌进主色候选库容器`); failed++; }
  if (s.overflowPrimary > 0) { console.error(`❌ ${tab}: 主色候选库横向溢出 ${s.overflowPrimary}px`); failed++; }
  if (s.overflowDoc > 0) { console.error(`❌ ${tab}: 页面横向溢出 ${s.overflowDoc}px`); failed++; }
}

// 交互断言：点一张情感卡后，主色输入框必须变到该卡的色值。
// <lang en>Interaction check: clicking a mood card must move the primary input to that card's colour.</lang>
await page.evaluate(() => document.querySelector('#primaryLibTabs .tab[data-primary-tab="mood"]')?.click());
await new Promise((r) => setTimeout(r, 300));
const before = await page.evaluate(() => ({
  primary: document.getElementById('primaryHexInput')?.value ?? '',
  name: document.getElementById('themeNameInput')?.value ?? ''
}));
const applied = await page.evaluate(() => {
  const card = [...document.querySelectorAll('#moodPrimaryWrap [data-mood-primary]')]
    .find((b) => /热情/.test(b.textContent ?? ''))
    ?? document.querySelector('#moodPrimaryWrap [data-mood-primary]');
  if (!card) return null;
  const swatch = card.querySelector('.color-top')?.getAttribute('style') ?? '';
  card.click();
  return { mood: card.dataset.moodPrimary, swatch };
});
await new Promise((r) => setTimeout(r, 350));
const after = await page.evaluate(() => ({
  primary: document.getElementById('primaryHexInput')?.value ?? '',
  name: document.getElementById('themeNameInput')?.value ?? '',
  activeMood: document.querySelector('#moodPrimaryWrap .color-card.active')?.dataset.moodPrimary ?? ''
}));
if (!applied) {
  console.error('❌ 情感视图没有可点击的色卡'); failed++;
} else {
  console.log(`[click] mood=${applied.mood} primary ${before.primary} → ${after.primary} name "${before.name}" → "${after.name}"`);
  if (after.primary.toLowerCase() === before.primary.toLowerCase()) {
    console.error(`❌ 点击情感卡未改变主色（仍为 ${after.primary}）`); failed++;
  }
  // 色卡里的预览色必须与套用后的输入框一致（防止"展示的色 ≠ 套用的色"）。
  // <lang en>The swatch colour shown on the card must match what got applied — no "displayed ≠ applied" drift.</lang>
  const shown = (applied.swatch.match(/#[0-9a-fA-F]{6}/) ?? [''])[0].toLowerCase();
  if (shown && shown !== after.primary.toLowerCase()) {
    console.error(`❌ 色卡预览 ${shown} 与套用结果 ${after.primary} 不一致`); failed++;
  }
  if (after.activeMood !== applied.mood) {
    console.error(`❌ 套用后高亮未跟到 ${applied.mood}（实为 "${after.activeMood}"）`); failed++;
  }
}

// 语言切换回归：停在情感 tab 时切语言，必须仍停在该 tab，且徽标文案换成新语言。
// <lang en>Locale regression: switching language while on the mood tab must keep that tab and translate the badge.</lang>
const before2 = await page.evaluate(() => document.getElementById('primaryLibBadge')?.textContent?.trim() ?? '');
await page.evaluate(() => document.getElementById('langToggleBtn')?.click());
await new Promise((r) => setTimeout(r, 450));
const after2 = await page.evaluate(() => ({
  active: document.querySelector('#primaryLibTabs .tab.active')?.dataset.primaryTab ?? '',
  badge: document.getElementById('primaryLibBadge')?.textContent?.trim() ?? '',
  moodCards: document.querySelectorAll('#moodPrimaryWrap .color-card').length,
  secVisible: !document.getElementById('secondaryLibBox')?.hidden
}));
console.log(`[locale] active=${after2.active} badge "${before2}" → "${after2.badge}"`);
if (after2.active !== 'mood') { console.error(`❌ 切换语言后未停在情感 tab（active="${after2.active}"）`); failed++; }
if (after2.badge === before2) { console.error('❌ 切换语言后徽标文案未翻译'); failed++; }
if (after2.moodCards !== 24) { console.error(`❌ 切换语言后情感卡应为 24，实为 ${after2.moodCards}`); failed++; }
if (!after2.secVisible) { console.error('❌ 切换语言后副色候选区不可见'); failed++; }

// 字号回归（维护者反馈：色卡右上情感名与宝典「整套」角标太小）：实测渲染字号必须 ≥ 11px。
//   只查 CSS 声明不够——继承与层叠可能把它压回去，所以要读计算值。
// <lang en>Font-size regression (maintainer feedback: the corner mood label and the handbook's full-set chip
//   were too small): measured computed size must be ≥ 11px. Checking the stylesheet alone is not enough because
//   inheritance and cascade can pull it back, so read the computed value.</lang>
await page.evaluate(() => document.querySelector('#primaryLibTabs .tab[data-primary-tab="mood"]')?.click());
await new Promise((r) => setTimeout(r, 300));
const fonts = await page.evaluate(() => {
  const pick = (sel) => {
    const el = document.querySelector(sel);
    if (!el) return null;
    return Math.round(parseFloat(getComputedStyle(el).fontSize) * 10) / 10;
  };
  return {
    moodCorner: pick('#moodPrimaryWrap .color-top span'),
    moodName: pick('#moodPrimaryWrap .color-name'),
    pairChip: pick('#moodPrimaryWrap .pair-chip'),
    cardMeta: pick('#moodPrimaryWrap .color-meta')
  };
});
console.log(`[fonts] corner=${fonts.moodCorner} name=${fonts.moodName} pair=${fonts.pairChip} meta=${fonts.cardMeta}`);
for (const [k, v] of Object.entries(fonts)) {
  if (v !== null && v < 11) { console.error(`❌ ${k} 字号 ${v}px < 11px`); failed++; }
}
// 宝典「整套」角标在弹层里，需先展开再量。
// <lang en>The handbook's full-set chip lives in an overlay, so open it before measuring.</lang>
await page.evaluate(() => document.getElementById('baodianPickBtn')?.click());
await new Promise((r) => setTimeout(r, 600));
const fullChip = await page.evaluate(() => {
  const el = document.querySelector('.bd-full');
  return el ? Math.round(parseFloat(getComputedStyle(el).fontSize) * 10) / 10 : null;
});
console.log(`[fonts] baodian 整套 chip=${fullChip}`);
if (fullChip !== null && fullChip < 11) { console.error(`❌ 宝典「整套」角标字号 ${fullChip}px < 11px`); failed++; }
await page.keyboard.press('Escape');
await new Promise((r) => setTimeout(r, 300));

// 断点溢出扫描：候选库位于侧栏，宽屏（>1500px）才回到双栏。
// <lang en>Breakpoint overflow sweep: the library lives in the sidebar, which only returns to two columns above
//   1500px.</lang>
for (const width of [1280, 1440, 1920]) {
  await page.setViewport({ width, height: 1200, deviceScaleFactor: 1 });
  await page.evaluate(() => document.querySelector('#primaryLibTabs .tab[data-primary-tab="mood"]')?.click());
  await new Promise((r) => setTimeout(r, 250));
  const o = await page.evaluate(() => {
    const box = document.getElementById('primaryLibBox');
    const tabbar = document.getElementById('primaryLibTabs');
    return {
      box: box ? box.scrollWidth - box.clientWidth : 0,
      tabbar: tabbar ? tabbar.scrollWidth - tabbar.clientWidth : 0,
      doc: document.documentElement.scrollWidth - document.documentElement.clientWidth
    };
  });
  console.log(`[bp ${width}] overflow box=${o.box} tabbar=${o.tabbar} doc=${o.doc}`);
  if (o.box > 0) { console.error(`❌ ${width}px 主色候选库横向溢出 ${o.box}px`); failed++; }
  if (o.tabbar > 0) { console.error(`❌ ${width}px tab 栏横向溢出 ${o.tabbar}px`); failed++; }
  if (o.doc > 0) { console.error(`❌ ${width}px 页面横向溢出 ${o.doc}px`); failed++; }
}

await browser.close();
server.close();
console.log(failed === 0 ? '✅ 主色候选库 tab 复核通过' : `❌ 失败 ${failed} 项`);
process.exit(failed === 0 ? 0 : 1);
