/** Electron preload example for the shared HIA renderer. */
import { clipboard, contextBridge, ipcRenderer } from 'electron';

const explorer = {
  async exploreUrl(url: string) {
    const response = await ipcRenderer.invoke('extract-from-url', url) as
      | { ok: true; result: unknown }
      | { ok: false; reason?: string };
    if (!response.ok) throw new Error(response.reason || '网址主题探索失败。');
    return response.result;
  }
};

contextBridge.exposeInMainWorld('hiaThemeBridge', {
  clipboard: { writeText: async (value: string) => clipboard.writeText(value) },
  explorer
});

// Keep the current bridge during migration.
contextBridge.exposeInMainWorld('hia', {
  extractFromUrl: (url: string) => ipcRenderer.invoke('extract-from-url', url)
});
