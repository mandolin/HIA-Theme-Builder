# TDON 示例文件（`tdon-0.2`）

本目录是 TDON 声明式适配文件的**可运行示例**，随 `@hia/theme-core` 分发。
三个合法示例均通过 `parseTdonDocument` 校验、`renderTdonPreview` 渲染与 `createTdonExportTarget` 导出，
并有集成测试（`test/tdon-examples.test.mjs`）在**默认主题**（无辅助色、无第三色）下复核——
即"新建主题后直接连接示例就能用"。

## 合法示例

| 文件 | 覆盖能力 |
| --- | --- |
| `minimal.tdon.json` | 最小合法文档：仅 `target` + 1 个导出文件。适合作为起点拷贝 |
| `vitepress-docs.tdon.json` | 文档站：hero / nav / raw-text / table / list / divider / card + `alias` + `constraints` + 三种 `effects` |
| `admin-dashboard.tdon.json` | 后台：nav / stats / table / form / card + 多令牌映射 |

## 反例（`invalid/`）

每个反例只针对**一个**错误码，文件名即错误语义，供单测按码断言：

| 文件 | 期望错误码 |
| --- | --- |
| `bad-version.tdon.json` | `E_VERSION` |
| `bad-unknown-key.tdon.json` | `E_UNKNOWN_KEY` |
| `bad-path-traversal.tdon.json` | `E_BAD_PATH` |
| `bad-template-conflict.tdon.json` | `E_CONFLICT` |
| `bad-template-ref.tdon.json` | `E_TEMPLATE_REF` |
| `bad-interp.tdon.json` | `E_INTERP` |
| `bad-node-type.tdon.json` | `E_ENUM` |
| `bad-token-syntax.tdon.json` | `E_TOKEN_SYNTAX` |
| `bad-effect-range.tdon.json` | `E_EFFECT_RANGE` |
| `bad-proto-pollution.tdon.json` | `E_BAD_KEY` |

## 怎么用

**在 Theme Builder 界面里**：预览区切到「自定义支持」→ 选择「URL 源」或「本地文件」→ 连接；
或直接点「加载示例」体验完整链路（内置示例即本目录的 `vitepress-docs.tdon.json`）。

**在代码里**：

```js
import { parseTdonDocument, renderTdonPreview, createTdonExportTarget } from '@hia/theme-core';

const raw = JSON.parse(fs.readFileSync('vitepress-docs.tdon.json', 'utf8'));
const { result, doc } = parseTdonDocument(raw, { theme });
if (!result.ok) console.error(result.errors);   // 每条含 code / path / message
if (doc) {
  const html = renderTdonPreview(doc, theme);                 // 预览片段
  const files = createTdonExportTarget(doc).files(theme);     // [{ path, content }]
}
```

## 关键约定（详见规范）

- 令牌引用只有六种形式：`<role>.<shade>`、`gradient:<role>`、`on:<role>`、`font:<group>`、`fs:<step>`、`space:<i>`；
- `template` 与 `templateRef` 二选一；插值 `{{token:<ref>}}` / `{{meta:name|id}}` **只替换一次**；
- `exportManifest.files[].path` 必须是安全的相对 POSIX 路径（拒绝 `..`、绝对路径、盘符、反斜杠）；
- 特效只有 `gradient-shift` / `fade-in` / `hover-lift` 三种，参数受限，且在 `prefers-reduced-motion` 下自动失效。

规范正文：WorkZone `docs/standards/tdon-spec-v0.md`（`tdon-0.2`）。
