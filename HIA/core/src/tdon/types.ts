/**
 * @lang zh-CN TDON 文档类型契约（`W-tb-P26` / 规范 `tdon-0.1`）：把 `work-zone/docs/standards/tdon-spec-v0.md`
 *   v0.2 的条款映射为可编译类型。这里只描述**校验后的形态**——原始输入一律以 unknown 进入校验器，
 *   由校验器按键白名单重建对象，避免直接展开外部 JSON（原型污染面，规范 TDON-11.3）。
 * @lang en TDON document type contract (`W-tb-P26` / spec `tdon-0.1`): maps the v0.2 clauses to compilable types.
 *   Only the **validated shape** is described here — raw input always enters the validator as unknown and is
 *   rebuilt from a key whitelist, never spread directly (prototype-pollution surface, clause TDON-11.3).
 */

// 规范版本串：主.次；次版本仅允许加性变更，主版本允许破坏性变更并要求迁移说明（TDON-13.1）。
// <lang zh-CN>取值 `tdon-0.1`——发布 1.0 之前不出现 `1.0` 字样，避免虚标成熟度。</lang>
// <lang en>`tdon-0.1` — no `1.0` string before the spec actually reaches 1.0.</lang>
export const TDON_SPEC_VERSION='tdon-0.1';

// 文件大小上限 256 KB（TDON-2.3）：校验阶段即拒绝，不进入解析后的渲染路径。
// <lang zh-CN>与导出单模板 128 KB、合计 512 KB 的上限彼此独立，按各自路径校验。</lang>
// <lang en>Independent from the 128 KB per-template and 512 KB total export limits; each path checks its own.</lang>
export const TDON_MAX_BYTES=256*1024;

// 校验最多返回的错误条数（TDON-8.1）：超出即截断并置 truncated 标记，防止恶意文件刷屏。
// <lang zh-CN>取 20 条：足够定位常见笔误，又不会把界面撑爆。</lang>
// <lang en>20 entries: enough to surface typical typos without flooding the UI.</lang>
export const TDON_MAX_ISSUES=20;

// 预览节点数量上限（TDON-5.2）：顶层 80、含两层 children 总计 200。
// <lang zh-CN>两者分别限制"宽度"与"总量"，防止单层极宽绕过总量约束。</lang>
// <lang en>Separate limits for breadth and total, so a single very wide level cannot bypass the cap.</lang>
export const TDON_MAX_PREVIEW_NODES=80;
export const TDON_MAX_NODES_TOTAL=200;

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
// <lang zh-CN>colorShades 支持 'all' 或显式档位数组，档位可为标准键或 0–1000 整数。</lang>
// <lang en>colorShades is 'all' or an explicit shade list (standard keys or integers 0–1000).</lang>
export interface TdonTokensInclude{
  color?:string[];
  colorShades?:'all'|(string|number)[];
  gradient?:string[];
  typography?:string[];
  spacing?:'all';
}
export interface TdonTokens{include?:TdonTokensInclude;alias?:Record<string,string>;}

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
// 导出清单（§6）：files 1–32 条；package.rootDir 可选。
// <lang zh-CN>rootDir 只影响打包时的根目录提示，不改变文件自身路径。</lang>
// <lang en>rootDir only hints the archive root; it never rewrites file paths.</lang>
export interface TdonExportManifest{files:TdonExportFile[];package?:{rootDir?:string};}

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

// 校验后的完整文档（§2）。
// <lang zh-CN>tokens/preview/constraints/effects 为可选，缺省语义见各节。</lang>
// <lang en>Optional groups default per their sections.</lang>
export interface TdonDocument{
  specVersion:string;
  target:TdonTarget;
  tokens?:TdonTokens;
  preview?:TdonPreview;
  exportManifest:TdonExportManifest;
  constraints?:TdonConstraints;
  effects?:Record<string,TdonEffect>;
}
