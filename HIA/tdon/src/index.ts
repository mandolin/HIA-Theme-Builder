/**
 * @lang zh-CN `@hia/tdon` 公共入口（barrel）：TDON 声明式适配文档（`tdon-0.2`）的类型、校验、令牌解析、
 *   预览渲染与导出适配。全部为纯函数（无 IO、无 DOM），取回与文件读取由宿主实现。
 *   独立成包的依据见规范 TDON-15.1：第三方应用可按需引用，不必引入整个 theme-core。
 * @lang en `@hia/tdon` public entry (barrel): types, validation, token resolution, preview rendering and export
 *   adaptation for TDON declarative adapter documents (`tdon-0.2`). Everything is pure (no IO, no DOM); fetch and
 *   file reading belong to the host. The standalone package is mandated by spec TDON-15.1: third-party apps can
 *   depend on it without pulling in all of theme-core.
 */

// 版本与规模常量（含两级阈值，TDON-1.7）。
// <lang zh-CN>宿主可直接读取这些常量做前置拦截（如取回前按 TDON_MAX_BYTES 判大小）。</lang>
// <lang en>Hosts may read these for pre-checks (e.g. reject by TDON_MAX_BYTES before fetching).</lang>
export{
  TDON_SPEC_VERSION,
  TDON_WARN_BYTES,TDON_MAX_BYTES,
  TDON_WARN_TEMPLATE_BYTES,TDON_MAX_TEMPLATE_BYTES,TDON_WARN_TEMPLATE_TOTAL,TDON_MAX_TEMPLATE_TOTAL,
  TDON_MAX_ISSUES,
  TDON_WARN_PREVIEW_NODES,TDON_MAX_PREVIEW_NODES,TDON_WARN_NODES_TOTAL,TDON_MAX_NODES_TOTAL,TDON_MAX_NESTING,
  TDON_WARN_FILE_COUNT,TDON_MAX_FILE_COUNT,
  TDON_MAX_IMAGE_URL,
  TDON_NODE_TYPES
}from'./types.js';
export type{
  TdonDocument,TdonTarget,TdonTokens,TdonTokensInclude,TdonPreview,TdonPreviewLayout,TdonNode,TdonNodeType,
  TdonExportManifest,TdonExportFile,TdonConstraints,TdonContrastRule,TdonEffect,TdonTemplateReserved
}from'./types.js';

// 问题模型：24+ 个稳定错误码、双语消息与定位路径（TDON-8.1）。
// <lang zh-CN>错误码是稳定契约——宿主可据码做本地化文案覆盖而不必解析消息。</lang>
// <lang en>Codes are a stable contract: hosts can override copy by code without parsing messages.</lang>
export{tdonError,tdonWarning,isTdonWarning}from'./issues.js';
export type{TdonIssue,TdonIssueCode,TdonValidationResult}from'./issues.js';

// 路径与键安全（TDON-6.2 / TDON-11.1 / TDON-11.3）：宿主打包前可独立复用。
// <lang zh-CN>导出给宿主是必要的：打包器不是本包的一部分，但必须能自查路径。</lang>
// <lang en>Exported on purpose: packaging is not part of this package, yet it must be able to self-check paths.</lang>
export{checkTdonPath,isDangerousKey,TDON_MAX_PATH_LENGTH}from'./paths.js';
export type{TdonPathCheck}from'./paths.js';

// 令牌解析（§5.1 六种形式）：预览渲染与导出插值共用同一实现。
// <lang zh-CN>listTdonTokens 供 UI 做令牌选择器，也便于用户发现可用引用。</lang>
// <lang en>listTdonTokens backs UI token pickers and helps users discover valid references.</lang>
export{
  resolveTdonToken,isTdonTokenSyntax,listTdonColorRoles,listTdonTokens,tdonBuiltinTokensCss,tdonCustomShades
}from'./resolve.js';
export type{TdonTokenResult}from'./resolve.js';

// 校验入口（手写零依赖）：返回问题列表，结构合法时附带重建后的文档。
// <lang zh-CN>失败不返回半成品文档，调用方据 result.ok 决定是否注册（TDON-1.3）。</lang>
// <lang en>On failure no partial document is returned; callers register based on result.ok (TDON-1.3).</lang>
export{parseTdonDocument}from'./validate.js';
export type{TdonParseResult}from'./validate.js';

// 预览渲染（9 类节点 + 固定特效类）。
// <lang zh-CN>样式表是常量：宿主注入一次即可，渲染输出不含任何外部 CSS 字符串。
//   **前置契约**：`renderTdonPreview` 的 doc 参数应来自 `parseTdonDocument`（节点已归一化出 attrs）。
//   传裸 JSON 只会渲染出空节点内容——不做静默修复，也不会崩栈。</lang>
// <lang en>The stylesheet is a constant: hosts inject it once, and rendered output carries no external CSS strings.
//   **Precondition**: `renderTdonPreview` expects a doc from `parseTdonDocument` (nodes normalized with attrs).
//   Raw JSON renders empty node content — no silent repair, no crash.</lang>
export{renderTdonPreview,escapeTdonHtml,TDON_PREVIEW_CSS}from'./render.js';

// 导出适配（TDON → 与内置适配器同构的 ExportTarget）。
// <lang zh-CN>describeTdonFiles 提供轻量清单（不展开模板），供 UI 列表使用。</lang>
// <lang en>describeTdonFiles gives a light listing (no template expansion) for UI lists.</lang>
export{createTdonExportTarget,describeTdonFiles}from'./export.js';

// TDOT 模板语言（`W-tb-P32` / ADR-011）：受限求值子集（变量/条件/遍历/比较/加减）。
// <lang zh-CN>求值器是纯函数；时间与随机通过 `buildInfo` 由宿主注入（ADR-011 §4.1），
//   求值器自身不产生任何不确定性。触发条件是 `template.specVersion === 'tdot-0.1'`（方案 B）。</lang>
// <lang en>Restricted evaluation subset (variables/conditionals/iteration/comparison/add-subtract).
//   The evaluator is pure; time and randomness are host-injected via `buildInfo` (ADR-011 §4.1), so the
//   evaluator itself introduces no non-determinism. Trigger: `template.specVersion === 'tdot-0.1'` (option B).</lang>
export{
  TDOT_SPEC_VERSION,TDOT_MAX_EXPR_DEPTH,TDOT_MAX_NODES,TDOT_MAX_STEPS
}from'./tdot/types.js';
export type{
  TdotTokenType,TdotToken,TdotExpr,TdotBinaryOp,TdotNode,TdotBuildInfo,TdotEvalContext,
  TdotEvalResult,TdotError,TdotWarning
}from'./tdot/types.js';
export{lexTdot,TDOT_KEYWORDS}from'./tdot/lexer.js';
export type{TdotLexResult}from'./tdot/lexer.js';
export{parseTdot}from'./tdot/parser.js';
export type{TdotParseResult}from'./tdot/parser.js';
export{evaluateTdot,shouldEvaluateTdot,tdotData,isUnsupportedTdotVersion}from'./tdot/eval.js';
