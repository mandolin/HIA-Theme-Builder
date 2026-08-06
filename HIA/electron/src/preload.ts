/**
 * @lang zh-CN 预加载脚本：向渲染进程暴露类型安全的取色桥接（仅封装 IPC，不泄露 Node 能力）。
 *   编译后由 build 脚本将 ESM import 转为 CJS require（Electron preload 沙箱不支持 ESM）。
 * @lang en Preload script: expose a typed extraction bridge to renderer (wraps IPC only, no Node surface leaked).
 *   Post-build script converts ESM imports to CJS requires (Electron sandboxed preload lacks ESM support).
 */
import { contextBridge, ipcRenderer } from 'electron';
import { CHANNEL } from './main.js';

const bridge = {
  extractFromUrl: (url: string): Promise<unknown> => ipcRenderer.invoke(CHANNEL, url)
};

contextBridge.exposeInMainWorld('hia', bridge);
