/**
 * @lang zh-CN 预加载脚本：向渲染进程暴露类型安全的取色桥接（仅封装 IPC，不泄露 Node 能力）。
 * @lang en Preload script: expose a typed extraction bridge to renderer (wraps IPC only, no Node surface leaked).
 */

import { contextBridge, ipcRenderer } from 'electron';
import { CHANNEL } from './main.js';

/** @lang zh-CN 桥接 API 形态。 @lang en Bridge API shape. */
export interface ExtractBridge {
  extractFromUrl: (url: string) => Promise<unknown>;
}

// <lang zh-CN>仅暴露取色方法，renderer 无法访问其他 Node/Electron API。</lang>
// <lang en>Expose only extraction; renderer cannot reach other Node/Electron APIs.</lang>
const bridge: ExtractBridge = {
  extractFromUrl: (url: string) => ipcRenderer.invoke(CHANNEL, url)
};

contextBridge.exposeInMainWorld('hia', bridge);
