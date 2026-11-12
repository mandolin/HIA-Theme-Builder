# @hia/tdon

TDON（Theme Design Object Notation）声明式主题适配格式的运行时实现。**纯函数、零第三方依赖、无 IO。**

一个 TDON 文件描述"某个目标长什么样、导出哪些文件"，由宿主解释执行——不携带可执行代码。
本包提供校验、预览渲染与导出适配三件事；取回（URL）与文件读取留在宿主。

- 规范版本：**`tdon-0.2`**
- 规范文档：[TDON 规范子站](https://mandolin.github.io/HIA-Theme-Builder/docs/tdon/)
- 依赖：仅 `@hia/theme-core`（令牌/色阶/渐变/对比度算法）

## 安装

```bash
npm install @hia/tdon
```

## 快速开始

```js
import {
  parseTdonDocument, renderTdonPreview, createTdonExportTarget,
  TDON_PREVIEW_CSS
} from '@hia/tdon';

// 1) 校验：raw 可以是 JSON 字符串或已解析对象
const { result, doc } = parseTdonDocument(rawText, { theme });

if (!result.ok) {
  // 每条含 code / path / message（中英双语）
  for (const issue of result.errors) console.error(issue.code, issue.path, issue.message);
} else {
  // 2) 预览：返回 HTML 片段；样式表是常量，宿主注入一次即可
  document.head.insertAdjacentHTML('beforeend', `<style>${TDON_PREVIEW_CSS}</style>`);
  previewEl.innerHTML = renderTdonPreview(doc, theme);

  // 3) 导出：与内置适配器同构的 { path, content } 列表
  const files = createTdonExportTarget(doc).files(theme);
}
```

`theme` 可选：不传则只做结构与语法校验（便于先加载文件、后随主题变更重新解析）。

## 两级阈值

规模限制分**软阈值（警告）/ 硬阈值（错误）**，硬阈值远高于真实需求：

| 维度 | 软（警告） | 硬（错误） |
| --- | --- | --- |
| 文件大小 | 512 KB | 4 MB |
| 单模板 | 256 KB | 512 KB |
| 模板合计 | 512 KB | 2 MB |
| 顶层节点 | 100 | 300 |
| 节点总数 | 400 | 1500 |
| 导出文件数 | 32 | 64 |

## 主要 API

| 导出 | 说明 |
| --- | --- |
| `parseTdonDocument(raw, opts?)` | 校验并返回 `{ result, doc }`；失败不返回半成品文档 |
| `renderTdonPreview(doc, theme)` | 9 类节点的 HTML 片段 |
| `TDON_PREVIEW_CSS` | 预览所需样式（含固定特效 keyframes） |
| `createTdonExportTarget(doc)` | 构造与内置导出适配器同构的目标 |
| `resolveTdonToken(theme, ref)` | 解析单条令牌引用（6 种形式） |
| `checkTdonPath(p)` | 导出路径安全检查（宿主打包前可复用） |
| `TDON_SPEC_VERSION` 等 | 版本与阈值常量 |

## 示例

`tdon-examples/` 随包分发，包含三个合法示例与十个按错误码命名的反例。详见包内 `tdon-examples/README.md`。

## 许可

MIT
