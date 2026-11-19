/**
 * @lang zh-CN 预加载脚本：向渲染进程暴露类型安全的取色桥接（仅封装 IPC，不泄露 Node 能力）。
 *   编译后由 build 脚本将 ESM import 转为 CJS require（Electron preload 沙箱不支持 ESM）。
 * @lang en Preload script: expose a typed extraction bridge to renderer (wraps IPC only, no Node surface leaked).
 *   Post-build script converts ESM imports to CJS requires (Electron sandboxed preload lacks ESM support).
 */
import { contextBridge, ipcRenderer } from 'electron';
import { CHANNEL, UPDATER_CHECK, UPDATER_STATUS } from './main.js';

const bridge = {
  extractFromUrl: (url: string): Promise<unknown> => ipcRenderer.invoke(CHANNEL, url)
};

// 更新桥（W-tb-P48）：手动检查 + 状态订阅（主→渲染单向广播）。渲染层按特性检测启用 UI。
// <lang en>Updater bridge (W-tb-P48): manual check + status subscription (main→renderer broadcast).
//   The renderer feature-detects this surface before enabling any UI.</lang>
const updaterBridge = {
  check: (): Promise<unknown> => ipcRenderer.invoke(UPDATER_CHECK),
  onStatus: (cb: (status: unknown) => void): void => {
    ipcRenderer.on(UPDATER_STATUS, (_evt, status: unknown) => cb(status));
  }
};

contextBridge.exposeInMainWorld('hia', bridge);
contextBridge.exposeInMainWorld('hiaUpdater', updaterBridge);
