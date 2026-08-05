# Desktop runtime adapters

这些文件是 Electron / Tauri 接入共享 `HIA/web/dist` 的参考实现，不替代各桌面端的安全抓取逻辑。

跨端边界：

```text
@hia/theme-core       主题模型、算法、预设、渐变、Token、颜色分析
HIA/web/src/app.ts    唯一共享 DOM 界面与交互
HIA/web/src/platform.ts 浏览器 / Electron / Tauri 运行时端口
Electron / Tauri     窗口、文件系统、剪贴板、网络抓取、SSRF 防护
```

## 推荐集成顺序

1. 构建 `HIA/core`。
2. 构建 `HIA/web`，非 GitHub Pages 环境的 Vite `base` 为 `./`，可以由 `file://` / WebView 加载。
3. Electron 将 `HIA/web/dist` 复制到自己的 `dist/renderer`。
4. Tauri 将 `HIA/web/dist` 复制到 `src-tauri/dist`。
5. 通过平台桥注入网址探索等桌面能力。

这里的示例脚本可在正式迁移桌面端时复制进对应子包；当前覆盖包不会强行改写尚未完成的 Electron / Tauri 工程。
