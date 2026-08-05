# @hia/theme-core

跨 Web、Electron、Tauri 共用的纯主题领域核心。

- 无 DOM / localStorage / Electron / Tauri 依赖。
- 颜色换算、色阶、副色生成、渐变渲染、预设管理、Token 导出、网址取色分析集中于此。
- Web 只负责 DOM 渲染；桌面端复用相同 UI 并注入平台桥。

```ts
import {createThemeDraft,buildThemeFromDraft,exportThemeCss} from '@hia/theme-core';
const theme=buildThemeFromDraft(createThemeDraft({primary:'#0047AB',secondary:'#00A8D3'}));
console.log(exportThemeCss(theme));
```
