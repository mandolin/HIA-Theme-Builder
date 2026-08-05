# HIA-Theme-Builder · Web Shared Renderer

- `main.ts`：只负责启动。
- `app.ts`：共享 DOM 渲染器与预览交互。
- `platform.ts`：Browser / Electron / Tauri 平台端口。
- `@hia/theme-core`：模型、算法、预设、渐变、Token 和取色分析。

先构建 `../core`，再执行：

```bash
npm install
npm run build
```

Electron/Tauri 推荐直接加载 `web/dist/index.html`，不要复制一份独立 renderer。
