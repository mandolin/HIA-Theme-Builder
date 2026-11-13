/**
 * @lang zh-CN TDON 校验问题模型（`W-tb-P26` / 规范 §8）：统一错误码、双语消息与定位路径。
 *   校验器只产问题列表，不做副作用；调用方据 `errors` 是否为空决定是否注册（TDON-8.2）。
 * @lang en TDON validation issue model (`W-tb-P26` / spec §8): unified codes, bilingual messages and location paths.
 *   The validator only emits issues and has no side effects; the caller registers based on whether `errors` is empty.
 */

// 错误码集合（规范各条 §2–§11 会点名其中之一）。
// <lang zh-CN>码值为稳定契约：单测按码断言，UI 按码映射文案；新增码须同步规范条款表。</lang>
// <lang en>Codes are a stable contract: tests assert on them and the UI maps them to copy; new codes must be
//   registered in the spec clause table.</lang>
export type TdonIssueCode=
  // 取回与解析层
  |'E_TOO_LARGE'|'E_JSON'|'E_NOT_OBJECT'|'E_VERSION'|'E_UNKNOWN_KEY'|'E_BAD_KEY'
  // 通用结构层
  |'E_REQUIRED'|'E_TYPE'|'E_ENUM'|'E_RANGE'|'E_LIMIT'|'E_PATTERN'|'E_CONFLICT'
  // 令牌层
  |'E_TOKEN_SYNTAX'|'E_TOKEN_UNRESOLVED'|'E_SHADE_RANGE'
  // 预览层
  |'E_UNKNOWN_NODE'|'E_NODE_ATTR'|'E_MEDIA_URL'
  // 导出层
  |'E_BAD_PATH'|'E_INTERP'|'E_TEMPLATE_REF'
  // 约束与特效层
  |'E_CONTRAST'|'E_EFFECT_UNKNOWN'|'E_EFFECT_PARAM'|'E_EFFECT_RANGE'
  // 非阻断提示
  |'W_CONTRAST'|'W_TOKEN_UNRESOLVED'
  // 软阈值与预留提示（TDON-1.7 / §10.1 / §14）
  |'W_TOO_LARGE'|'W_NODE_LIMIT'|'W_FILE_COUNT'|'W_TEMPLATE_SIZE'|'W_TDOT_RESERVED'|'W_FONT_RESERVED'
  // TDOT 模板语言（ADR-011 §6）
  // <lang en>TDOT template language codes (ADR-011 §6).</lang>
  |'E_TDOT_VERSION'|'E_TDOT_SYNTAX'|'E_TDOT_TYPE'|'E_TDOT_LIMIT'|'W_TDOT_UNDEFINED';

// 单条校验问题。
// <lang zh-CN>path 用点/中括号定位（如 preview.nodes[2].bgToken），便于 UI 直接高亮。</lang>
// <lang en>path uses dot/bracket notation (e.g. preview.nodes[2].bgToken) so the UI can highlight directly.</lang>
export interface TdonIssue{
  code:TdonIssueCode;
  /** @lang zh-CN 定位路径；顶层问题为 '$'。 @lang en Location path; '$' for top-level issues. */
  path:string;
  /** @lang zh-CN 中文说明（面向用户）。 @lang en Chinese message (end-user facing). */
  message:string;
  /** @lang en English message. @lang zh-CN 英文说明。 */
  messageEn:string;
}

// 校验结果（TDON-8.2）：errors 阻断注册，warnings 仅提示。
// <lang zh-CN>truncated 表示命中 TDON_MAX_ISSUES 上限（TDON-8.1），提示用户仍有未列出的问题。</lang>
// <lang en>truncated signals the TDON_MAX_ISSUES cap was hit (TDON-8.1) and more issues remain unreported.</lang>
export interface TdonValidationResult{
  ok:boolean;
  errors:TdonIssue[];
  warnings:TdonIssue[];
  truncated:boolean;
}

// 构造一条错误问题（内部工厂，保证 message/messageEn 成对出现）。
// <lang zh-CN>直接返回对象字面量，不做冻结——问题列表本身是短生命周期数据。</lang>
// <lang en>Returns a plain object (not frozen) — the issue list is short-lived data.</lang>
export function tdonError(code:TdonIssueCode,path:string,message:string,messageEn:string):TdonIssue{
  return{code,path,message,messageEn};
}

// 构造一条警告问题（语义同 tdonError，仅用于表达"提示但可用"）。
// <lang zh-CN>与错误分开建函数，便于调用点一眼看出严重级别。</lang>
// <lang en>A separate factory makes the severity obvious at the call site.</lang>
export function tdonWarning(code:TdonIssueCode,path:string,message:string,messageEn:string):TdonIssue{
  return{code,path,message,messageEn};
}

// 判断码是否为警告码（W_ 前缀）。
// <lang zh-CN>渲染层用它决定问题条的视觉级别，避免字符串前缀判断散落各处。</lang>
// <lang en>Lets the renderer decide visual severity without scattering prefix checks.</lang>
export function isTdonWarning(code:TdonIssueCode):boolean{
  return code.startsWith('W_');
}
