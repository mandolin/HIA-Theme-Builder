/**
 * @lang zh-CN Electron 主进程：创建窗口，处理取色 IPC（SSRF 校验 + 采集 + core.analyze 解析）。
 * @lang en Electron main process: create window, handle extraction IPC (SSRF guard + collect + core.analyze).
 */

import { app, BrowserWindow, ipcMain } from 'electron';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { collectSignals } from './fetch-signals.js';
import { analyzeTheme } from '@hia/theme-core';

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
    webPreferences: {
      // <lang zh-CN>允许渲染进程通过预加载桥接调用主进程取色。</lang>
      // <lang en>Allow renderer to call main extraction via preload bridge.</lang>
      preload: join(__dirname, 'preload.js')
    }
  });
  win.loadFile(join(__dirname, 'renderer', 'index.html'));
}

/**
 * @lang zh-CN 注册取色通道：渲染进程传 URL，主进程做 SSRF 校验 + 采集 + 加权分析，回传结果或错误原因。
 * @lang en Register extraction channel: renderer passes URL; main does SSRF guard + collect + weighted analysis, returns result or error reason.
 */
function registerIpc(): void {
  ipcMain.handle(CHANNEL, async (_evt, url: string) => {
    try {
      const signals = await collectSignals(url);
      const result = analyzeTheme(signals);
      return { ok: true, result };
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
