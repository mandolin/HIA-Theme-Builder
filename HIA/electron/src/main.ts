/**
 * @lang zh-CN Electron 主进程：创建窗口，处理取色 IPC（SSRF 校验 + 采集 + core.analyze 解析）。
 * @lang en Electron main process: create window, handle extraction IPC (SSRF guard + collect + core.analyze).
 */

import { app, BrowserWindow, ipcMain } from 'electron';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { collectSignalsV2 } from './render-adapter.js';
import { analyzeThemeV2 } from '@hia/theme-core';

const __dirname = dirname(fileURLToPath(import.meta.url));

/** @lang zh-CN 取色 IPC 通道名。 @lang en Extraction IPC channel name. */
const CHANNEL = 'extract-from-url';

/**
 * @lang zh-CN 打开主窗口并载入渲染页。
 * @lang en Open main window and load renderer page.
 */
function createWindow(): void {
  const win = new BrowserWindow({
    width: 1180,
    height: 820,
    // 窗口图标（W-tb-P14 维护者反馈）：松树 favicon.ico 随 web dist 复制到 renderer/，任务栏/标题栏一致。
    // <lang en>Window icon: pine favicon.ico shipped inside dist/renderer via copy-renderer.</lang>
    icon: join(__dirname, 'renderer/favicon.ico'),
    webPreferences: {
      // <lang zh-CN>允许渲染进程通过预加载桥接调用主进程取色。</lang>
      // <lang en>Allow renderer to call main extraction via preload bridge.</lang>
      preload: join(__dirname, 'preload.js')
    }
  });
  win.loadFile(join(__dirname, 'renderer', 'index.html'));
  // <lang zh-CN>DevTools 仅在显式设置 HIA_OPEN_DEVTOOLS=1 时打开：生产包默认不暴露调试面（遗留问题清理 B1）。</lang>
  // <lang en>Open DevTools only when HIA_OPEN_DEVTOOLS=1; production builds no longer expose the debug surface (cleanup B1).</lang>
  if (process.env.HIA_OPEN_DEVTOOLS === '1') {
    win.webContents.openDevTools();
  }
}

/**
 * @lang zh-CN 注册取色通道：渲染进程传 URL，主进程做 SSRF 校验 + 采集 + 加权分析，回传结果或错误原因。
 * @lang en Register extraction channel: renderer passes URL; main does SSRF guard + collect + weighted analysis, returns result or error reason.
 */
function registerIpc(): void {
  ipcMain.handle(CHANNEL, async (_evt, url: string) => {
    try {
      // <lang zh-CN>P2 真实渲染采集（失败自动降级静态）+ P3 V2 评分：返回完整主题分析报告（主副色/置信度/候选/理由）。</lang>
      // <lang en>P2 real-render collect (auto static fallback) + P3 V2 scoring: returns full analysis report.</lang>
      const signals = await collectSignalsV2(url);
      const analysis = analyzeThemeV2(signals);
      return { ok: true, signals, analysis, mode: signals.diagnostics.mode };
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      // <lang zh-CN>区分 SSRF 拒绝与其他错误。</lang>
      // <lang en>Distinguish SSRF rejection from other errors.</lang>
      return { ok: false, ssrf: msg.startsWith('SSRF:'), reason: msg };
    }
  });
}

app.whenReady().then(() => {
  registerIpc();
  createWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

/** @lang zh-CN 导出通道名供预加载复用。 @lang en Export channel name for preload reuse. */
export { CHANNEL };
