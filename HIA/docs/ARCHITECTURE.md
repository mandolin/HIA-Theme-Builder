# HIA Theme Builder · 跨端架构

```text
                       ┌────────────────────────────┐
                       │ HIA/web/src/app.ts          │
                       │ 唯一共享 DOM UI / 预览器     │
                       └─────────────┬──────────────┘
                                     │ ThemeManagerPlatform
                      ┌──────────────┼──────────────┐
                      │              │              │
                   Browser       Electron        Tauri
                      │              │              │
                      └──────────────┴──────────────┘
                                     │
                       ┌─────────────▼──────────────┐
                       │ @hia/theme-core             │
                       │ 纯模型、算法、预设、Token    │
                       └────────────────────────────┘
```

## 应放进 core 的代码

- `Theme / ThemeDraft / Preset / GradientSettings` 数据模型。
- OKLab / OKLCH、色域映射、色阶与副色和谐算法。
- 44 个主色候选、内置主题预设和渐变默认值。
- 主题草稿转换、主题库增删改查、版本化序列化。
- CSS / JSON Token 与运行时 CSS 变量计算。
- 网站颜色信号的加权分析 `analyzeTheme`。

这些代码必须是纯函数或纯数据，不访问 DOM、localStorage、Electron IPC、Tauri invoke 和文件系统。

## 不应放进 core 的代码

- HTML、CSS、DOM 查询和事件绑定。
- 浏览器存储、剪贴板、弹窗。
- Electron `BrowserWindow`、IPC、preload。
- Tauri invoke 与 Rust 命令。
- URL 抓取、SSRF 防护和系统文件能力。

这些能力由 `ThemeManagerPlatform` 或各端主进程提供。

## web 的定位

`HIA/web` 同时是：

1. GitHub Pages 的浏览器应用；
2. Electron / Tauri 可直接复用的规范 UI 构建产物。

`src/main.ts` 只创建平台适配器并挂载 `app.ts`；主题模型与算法全部来自 `@hia/theme-core`。Vite 在非 Pages 环境使用相对 `base: './'`，生成物可由 `file://` 和 WebView 加载。

## 桌面端迁移策略

- Electron 主进程继续负责 SSRF 校验、抓取和窗口管理，把 `HIA/web/dist` 复制到 `dist/renderer` 后由现有 `loadFile` 加载。
- Tauri Rust 端继续负责 SSRF 校验与信号采集，把 `HIA/web/dist` 复制到 `src-tauri/dist`。
- 两端均不复制主题算法，也不维护另一套简化操作台。
- 适配参考位于 `HIA/adapters/`。

若未来 UI 需要独立发布为 npm 包，可再将 `app.ts / style.css / index.html` 提升为 `HIA/ui`；当前阶段先避免过早增加第四个正式子包。
