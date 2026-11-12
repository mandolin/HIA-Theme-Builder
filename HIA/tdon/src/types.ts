/**
 * @lang zh-CN TDON 文档类型契约（`W-tb-P26` / 规范 `tdon-0.2`）：把 `work-zone/docs/standards/tdon-spec-v0.md`
 *   v0.3 的条款映射为可编译类型。这里只描述**校验后的形态**——原始输入一律以 unknown 进入校验器，
 *   由校验器按键白名单重建对象，避免直接展开外部 JSON（原型污染面，规范 TDON-11.3）。
 * @lang en TDON document type contract (`W-tb-P26` / spec `tdon-0.2`): maps the v0.3 clauses to compilable types.
 *   Only the **validated shape** is described here — raw input always enters the validator as unknown and is
 *   rebuilt from a key whitelist, never spread directly (prototype-pollution surface, clause TDON-11.3).
 */

// 规范版本串：主.次；次版本仅允许加性变更，主版本允许破坏性变更并要求迁移说明（TDON-13.1）。
// <lang zh-CN>v0.2 相对 v0.1 只有加性变更（放宽阈值 + 新增可选字段），故次版本 +1。</lang>
// <lang en>v0.2 over v0.1 is additive only (relaxed caps + new optional fields), hence a minor bump.</lang>
export const TDON_SPEC_VERSION='tdon-0.2';

// ===== 两级规模阈值（TDON-1.7 / TDON-2.3）=====
// 软阈值只产生警告（正常复杂页面可以越过）；硬阈值远高于真实需求，用于阻断资源耗尽。
// <lang zh-CN>软/硬必须成对：只有软阈值等于放弃防护，只有硬阈值等于一刀切拦住合法大文件。</lang>
// <lang en>Soft/hard come in pairs: soft-only abandons protection; hard-only blocks legitimate large files.</lang>
export const TDON_WARN_BYTES=512*1024;
export const TDON_MAX_BYTES=4*1024*1024;
// 单模板与模板合计（TDON-6.3）：软阈值警告、硬阈值报错。
// <lang zh-CN>合计软阈值与文件软阈值同量级，硬阈值 2 MB。</lang>
// <lang en>Total soft cap is on the same order as the file soft cap; the hard cap is 2 MB.</lang>
export const TDON_WARN_TEMPLATE_BYTES=256*1024;
export const TDON_MAX_TEMPLATE_BYTES=512*1024;
export const TDON_WARN_TEMPLATE_TOTAL=512*1024;
export const TDON_MAX_TEMPLATE_TOTAL=2*1024*1024;

// 校验最多返回的问题条数（TDON-8.1）：超出即截断并置 truncated 标记，防止恶意文件刷屏。
// <lang zh-CN>取 20 条：足够定位常见笔误，又不会把界面撑爆。</lang>
// <lang en>20 entries: enough to surface typical typos without flooding the UI.</lang>
export const TDON_MAX_ISSUES=20;

// 预览节点规模（TDON-5.2）：顶层 300（>100 警告）、总计 1500（>400 警告）、最多 4 层节点（含根）。
// <lang zh-CN>v0.3 放宽后仍保留硬上限，防止构造的超大节点树拖死渲染。</lang>
// <lang en>Hard caps remain after the v0.3 relaxation so a constructed giant tree cannot stall rendering.</lang>
export const TDON_WARN_PREVIEW_NODES=100;
export const TDON_MAX_PREVIEW_NODES=300;
export const TDON_WARN_NODES_TOTAL=400;
export const TDON_MAX_NODES_TOTAL=1500;
export const TDON_MAX_NESTING=4;

// 导出文件数（TDON-6.1）：1–64，超过 32 警告。
// <lang zh-CN>64 是"多目标产物"的实际上限；再多说明该拆成多个 TDON 文件。</lang>
// <lang en>64 is the practical ceiling for multi-target output; beyond it the file should be split.</lang>
export const TDON_WARN_FILE_COUNT=32;
export const TDON_MAX_FILE_COUNT=64;

// 远程图片地址长度上限（TDON-5.12）。
// <lang zh-CN>2048 是浏览器与 CDN 签名的常见实用上限，足够长且能挡住构造的超长串。</lang>
// <lang en>2048 is the practical browser/CDN-signed-URL ceiling — long enough yet stops constructed giants.</lang>
export const TDON_MAX_IMAGE_URL=2048;

// 预览布局模式（TDON-5.1）：四值枚举，缺省 stack。
// <lang zh-CN>布局只决定容器排列语义，不引入任意 CSS。</lang>
// <lang en>Layout only selects container arrangement semantics; no arbitrary CSS.</lang>
export type TdonPreviewLayout='stack'|'sidebar-left'|'sidebar-right'|'hero';

// 预览节点类型（TDON-5.3）：固定 9 类，未知值一律拒绝。
// <lang zh-CN>顺序即文档与 UI 的展示顺序。</lang>
// <lang en>Order doubles as the documentation/UI listing order.</lang>
export const TDON_NODE_TYPES=['hero','nav','card','stats','list','table','form','divider','raw-text']as const;
export type TdonNodeType=typeof TDON_NODE_TYPES[number];

// 目标元信息（§3）。
// <lang zh-CN>id 为注册键（kebab-case），name/nameEn 供 UI 展示，homepage 仅接受 http(s)。</lang>
// <lang en>id is the registry key; name/nameEn are display strings; homepage accepts http(s) only.</lang>
export interface TdonTarget{
  id:string;
  name:string;
  nameEn:string;
  author?:string;
  homepage?:string;
  /** @lang zh-CN 仅展示，不做 semver 求值（TDON-3.4）。 @lang en Display-only, never semver-evaluated (TDON-3.4). */
  targetVersion?:string;
}

// 令牌消费声明（§4）：include 缺省=全量；alias 仅影响导出文本（TDON-4.5）。
// <lang zh-CN>fontUrl 为远程字体预留（TDON-4.6）：当前接受但忽略并警告，等 TDOT 定型后启用。</lang>
// <lang en>fontUrl is the remote-font reservation (TDON-4.6): accepted but ignored with a warning until TDOT lands.</lang>
export interface TdonTokensInclude{
  color?:string[];
  colorShades?:'all'|(string|number)[];
  gradient?:string[];
  typography?:string[];
  spacing?:'all';
}
export interface TdonTokens{
  include?:TdonTokensInclude;
  alias?:Record<string,string>;
  /** @lang zh-CN 远程字体地址（预留）：接受但不消费，产生 W_FONT_RESERVED。 @lang en Remote font URL (reserved): accepted but unconsumed, emits W_FONT_RESERVED. */
  fontUrl?:string;
}

// 预览节点：type 判别 + 通用可选字段，其余属性按键白名单在校验器中逐一读取。
// <lang zh-CN>刻意不把 9 类属性写成判别联合——属性表随规范演进时，联合类型会迫使所有分支同步改写；
//   校验器是唯一权威，渲染器按 type 取已校验字段。</lang>
// <lang en>A discriminated union is deliberately avoided: evolving attribute tables would force every branch
//   to be rewritten. The validator is the single authority; the renderer reads validated fields by type.</lang>
export interface TdonNode{
  type:TdonNodeType;
  id?:string;
  effect?:string;
  /** @lang zh-CN 其余已校验属性（键集合由 type 决定）。 @lang en Remaining validated attributes, keyed by type. */
  attrs:Record<string,unknown>;
}

// 预览声明（§5）。
// <lang zh-CN>nodes 为扁平顶层列表；children 由校验器归一化进 attrs。</lang>
// <lang en>nodes is the flat top level; children are normalized into attrs by the validator.</lang>
export interface TdonPreview{title?:string;layout:TdonPreviewLayout;nodes:TdonNode[];}

// 导出文件条目（§6.1）：template 与 templateRef 二选一。
// <lang zh-CN>互斥由校验器强制（同时给 = E_CONFLICT，都不给 = E_REQUIRED）。</lang>
// <lang en>Mutual exclusivity is enforced by the validator (both → E_CONFLICT, neither → E_REQUIRED).</lang>
export interface TdonExportFile{path:string;template?:string;templateRef?:string;}
// 导出清单（§6）：files 1–64；package.rootDir 可选。
// <lang zh-CN>rootDir 只影响打包时的根目录提示，不改变文件自身路径。</lang>
// <lang en>rootDir only hints the archive root; it never rewrites file paths.</lang>
export interface TdonExportManifest{files:TdonExportFile[];package?:{rootDir?:string;};}

// 对比度断言规则（§7）：fg/bg 为令牌引用，min 为 WCAG 对比度阈值。
// <lang zh-CN>strict:false 时违反记警告，strict:true 时阻断注册。</lang>
// <lang en>With strict:false a violation is a warning; with strict:true it blocks registration.</lang>
export interface TdonContrastRule{fg:string;bg:string;min:number;}

// 约束断言（§7）。
// <lang zh-CN>requiredTokens 不可解析一律视为错误（文档缺陷），不受 strict 影响（TDON-7.3）。</lang>
// <lang en>Unresolvable requiredTokens are always errors (document defect), regardless of strict (TDON-7.3).</lang>
export interface TdonConstraints{
  requiredTokens?:string[];
  minShade?:number;
  maxShade?:number;
  requireContrast?:TdonContrastRule[];
  strict?:boolean;
}

// 特效声明（§9）：仅三种类型，参数区间内才合法。
// <lang zh-CN>实现映射到固定 CSS 类，不接受自定义 keyframes/transform 字符串（TDON-9.3）。</lang>
// <lang en>Mapped to fixed CSS classes; no custom keyframes/transform strings (TDON-9.3).</lang>
export type TdonEffect=
  |{type:'gradient-shift';}
  |{type:'fade-in';duration:number;}
  |{type:'hover-lift';distance:number;};

// TDOT 预留（§14）：`template` 段当前只做"存在即可"的接受 + 警告，内容不解释。
// <lang zh-CN>单独建类型以便宿主原样透传给未来的 TDOT 运行时，不必二次解析。</lang>
// <lang en>A distinct type lets hosts forward the block verbatim to a future TDOT runtime without re-parsing.</lang>
export interface TdonTemplateReserved{
  /** @lang zh-CN TDOT 规范版本串（由 TDOT 规范定义，本包不校验）。 @lang en TDOT spec version (owned by the TDOT spec; not validated here). */
  specVersion?:string;
  /** @lang zh-CN 其余字段原样保留，供 TDOT 运行时消费。 @lang en Other fields are preserved verbatim for the TDOT runtime. */
  [key:string]:unknown;
}

// 校验后的完整文档（§2）。
// <lang zh-CN>template 段存在时原样保留（当前不消费），便于未来 TDOT 直接接管。</lang>
// <lang en>The template block is preserved as-is (unconsumed today) so a future TDOT can take it over directly.</lang>
export interface TdonDocument{
  specVersion:string;
  target:TdonTarget;
  tokens?:TdonTokens;
  preview?:TdonPreview;
  exportManifest:TdonExportManifest;
  constraints?:TdonConstraints;
  effects?:Record<string,TdonEffect>;
  template?:TdonTemplateReserved;
}
