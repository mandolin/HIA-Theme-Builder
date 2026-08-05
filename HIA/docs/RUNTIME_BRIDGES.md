# 运行时平台桥

统一端口位于 `HIA/web/src/platform.ts`：

```ts
interface ThemeManagerPlatform {
  storage: StoragePort;
  clipboard: ClipboardPort;
  now(): number;
  alert(message: string): void;
  confirm(message: string): boolean;
  explorer?: ThemeExplorePort;
}
```

## Electron preload

```ts
contextBridge.exposeInMainWorld('hiaThemeBridge', {
  explorer: {
    async exploreUrl(url: string) {
      const response = await ipcRenderer.invoke('extract-from-url', url);
      if (!response.ok) throw new Error(response.reason);
      return response.result;
    }
  }
});
```

## Tauri

```ts
window.hiaThemeBridge = {
  explorer: {
    async exploreUrl(url) {
      const signals = await invoke('extract_signals', { url });
      return analyzeTheme(signals);
    }
  }
};
```

Rust/Electron 主进程负责网络抓取和 SSRF 防护，`@hia/theme-core` 负责颜色评分。
