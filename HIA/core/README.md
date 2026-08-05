# HIA-Theme-Builder · Core (`@hia/theme-core`)

公共核心包。提供框架无关、无 DOM 依赖的主题模型、OKLCH 颜色算法、主/副色和谐生成、Token（CSS/JSON）导出，供 `web`、`electron`、`tauri` 各端复用。

许可证：**MIT**（与主库默认一致；`HIA/electron/` 为 Apache-2.0 例外，见根 `LICENSE`）。

## 设计边界（首次纵切契约）

- `core` 只负责**纯数据与算法**：颜色换算、色阶、副色生成、对比度、预设数据、Token 字符串导出。
- `core` **不依赖任何 UI 框架、不操作 DOM、不读写 localStorage**；这些由各端在适配层完成。
- 所有公共 API、类型与关键实现从首份源码起执行 ROP 中英双语文档化注释（见根 `AGENTS.md`）。

## 包结构

| 路径 | 职责 |
| --- | --- |
| `src/types.ts` | 主题模型类型（Theme / ColorScale / Preset / GradientSettings …） |
| `src/color/convert.ts` | HEX ↔ sRGB ↔ OKLab/OKLCH 转换 |
| `src/color/scale.ts` | `tonalScale`：由主/副色生成 50–900 色阶 |
| `src/color/harmony.ts` | `harmonyCandidate` / `generateSecondarySet`：副色候选生成 |
| `src/color/contrast.ts` | `contrast` / `bestOnColor`：可读前景色 |
| `src/data/primaryCandidates.ts` | 主色候选库（44 色） |
| `src/data/presets.ts` | 内置主题预设（6 个） |
| `src/data/gradients.ts` | 全局渐变定义与默认值 |
| `src/token/css.ts` | `exportThemeCss`：生成 CSS 变量文本 |
| `src/token/json.ts` | `exportThemeJson`：生成 JSON Token |
| `src/theme.ts` | `buildTheme`：整合为完整 Theme 对象 |
| `src/index.ts` | 公共 API 出口 |

## 快速使用

```ts
import { buildTheme, exportThemeCss, exportThemeJson } from '@hia/theme-core';

const theme = buildTheme({
  primary: '#0047AB',
  secondary: '#00A8D3',
  primaryName: '钴蓝',
  secondaryName: '清透青',
  name: 'HIA 默认'
});

const css = exportThemeCss(theme);
const json = exportThemeJson(theme);
```

## 开发

```bash
npm install
npm run build   # tsc -> dist/
npm test        # vitest
```

## 维护说明

本包是 P2 最小纵切的产物；各端消费前须保证 `buildTheme` 的返回结构与 Token 导出格式稳定。原始单文件工具见 `I:\HIA_SYS_DOC\工具\主题管理器\HIA_theme_manager.html`。
