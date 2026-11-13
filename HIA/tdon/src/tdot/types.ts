/**
 * @lang zh-CN TDOT 模板语言类型契约（`W-tb-P32` / **ADR-011**）：受限求值子集的词法、语法、求值与错误模型。
 *   设计前提是**能力面固定**——只有变量、条件、遍历、比较、加减、字面量、否定七类；其余一律不支持。
 * @lang en TDOT template-language type contract (`W-tb-P32` / **ADR-011**): lexer/parser/evaluator and error model
 *   for the restricted evaluation subset. The premise is a **fixed capability surface** — variables, conditionals,
 *   iteration, comparison, add/subtract, literals and negation; nothing else is supported.
 */

// TDOT 规范版本（独立于 TDON 的版本串；ADR-011 §5）。
// <lang zh-CN>只有 specVersion 以 `tdot-` 开头且等于此值才触发求值（方案 B 宽容）。</lang>
// <lang en>Evaluation only triggers when specVersion starts with `tdot-` and equals this value (option B).</lang>
export const TDOT_SPEC_VERSION='tdot-0.1';

// ===== 求值上限（ADR-011 §2）=====
// 表达式嵌套深度：防止深层括号构造的解析栈耗尽。
// <lang zh-CN>真实模板极少超过 3 层；8 层留足余量。</lang>
// <lang en>Real templates rarely exceed 3 levels; 8 leaves headroom.</lang>
export const TDOT_MAX_EXPR_DEPTH=8;
// 单模板 AST 节点上限：防止超大模板拖慢解析与渲染。
// <lang zh-CN>2000 节点约等于数百行模板，远超正常用法。</lang>
// <lang en>2000 nodes is hundreds of template lines — far beyond normal usage.</lang>
export const TDOT_MAX_NODES=2000;
// 求值步数上限：防止循环嵌套造成的指数级展开。
// <lang zh-CN>每渲染一个节点/求值一个表达式计 1 步。</lang>
// <lang en>One step per rendered node / evaluated expression.</lang>
export const TDOT_MAX_STEPS=10000;

// ===== 词法单元（ADR-011 §1 词汇表的直接映射）=====
// 只在模板正文里出现的标记类型；不引入任何未列出的 token。
// <lang zh-CN>值类型限于字符串/数字/布尔/null——对象与数组不可作为插值输出。</lang>
// <lang en>Value types are limited to string/number/boolean/null; objects/arrays cannot be interpolated.</lang>
export type TdotTokenType=
  |'text'      // 模板正文（插值之外的静态文本）
  |'open'      // {{
  |'close'     // }}
  |'blockOpen' // {{#if ...}} / {{#each ...}}
  |'blockClose'// {{/if}} / {{/each}}
  |'else'      // {{else}}
  |'ident'     // 变量名 / 关键字（if / each / else / this / true / false / null）
  |'atVar'     // @index / @build.year 等 @ 前缀占位符
  |'number'    // 数字字面量
  |'string'    // 字符串字面量
  |'op'        // == != > < >= <= + - !
  |'eof';

// 单个词法单元。
// <lang zh-CN>pos 为源串偏移，供错误定位；`text` 类型保留原始字符（不转义，转义在渲染层）。</lang>
// <lang en>pos is the source offset for error location; `text` keeps raw characters (escaping happens at render).</lang>
export interface TdotToken{type:TdotTokenType;value:string;pos:number;}

// ===== 语法树（ADR-011 §1 七类能力）=====
// 表达式节点：只有字面量、变量、@ 占位符、二元运算、一元否定五种。
// <lang zh-CN>刻意不设函数调用节点——词汇表里没有它。</lang>
// <lang en>Deliberately no call node — the vocabulary has no function calls.</lang>
export type TdotExpr=
  |{kind:'literal';value:string|number|boolean|null;}
  |{kind:'var';path:string[];}          // template.data 下的路径
  |{kind:'at';name:string;}             // @index / @build.year
  |{kind:'unary';op:'!';operand:TdotExpr;}
  |{kind:'binary';op:TdotBinaryOp;left:TdotExpr;right:TdotExpr;};

// 二元运算符：比较六种 + 加减两种（ADR-011 §1）。
// <lang zh-CN>乘除取模不在表内——见 ADR-011 替代方案。</lang>
// <lang en>Multiplication/division/modulo are absent — see ADR-011 rejected alternatives.</lang>
export type TdotBinaryOp='=='|'!='|'>'|'<'|'>='|'<='|'+'|'-';

// 模板节点：文本 / 插值 / 条件 / 遍历。
// <lang zh-CN>四类即可表达 ADR-011 的全部能力；没有 include/partial 节点。</lang>
// <lang en>Four node kinds cover all ADR-011 capabilities; there is no include/partial node.</lang>
export type TdotNode=
  |{kind:'text';value:string;}
  |{kind:'interp';expr:TdotExpr;}
  |{kind:'if';test:TdotExpr;consequent:TdotNode[];alternate:TdotNode[]}
  |{kind:'each';source:TdotExpr;body:TdotNode[]};

// ===== 宿主注入的环境值（ADR-011 §4.1）=====
// @build.* 占位符的取值来源；求值器自身不产生任何不确定性。
// <lang zh-CN>全部可选：未注入的占位符解析为空串并记 W_TDOT_UNDEFINED。</lang>
// <lang en>All optional: an uninjected placeholder resolves to an empty string with W_TDOT_UNDEFINED.</lang>
export interface TdotBuildInfo{
  year?:string;
  date?:string;
  timestamp?:number;
  random?:number;
}

// 求值上下文：用户数据 + 循环变量 + 宿主注入 + 步数计数。
// <lang zh-CN>data 来自 template.data；locals 承载 @index 与 each 的 this；steps 由调用方创建。</lang>
// <lang en>data comes from template.data; locals carry @index and each's `this`; steps is caller-created.</lang>
export interface TdotEvalContext{
  data:Record<string,unknown>;
  locals:Record<string,unknown>;
  build?:TdotBuildInfo;
  steps:number;
}

// 求值结果：成功给字符串，失败给错误（不抛异常——调用方需收集而非中断）。
// <lang zh-CN>模板求值失败会让整份文档拒绝注册（ADR-011 §4），因此错误需带定位。</lang>
// <lang en>A failed evaluation rejects the whole document (ADR-011 §4), so errors carry positions.</lang>
export type TdotEvalResult=
  |{ok:true;output:string;warnings:TdotWarning[];}
  |{ok:false;error:TdotError;warnings:TdotWarning[];};

// 模板错误（ADR-011 §6）：码 + 位置 + 双语消息。
// <lang zh-CN>E_TDOT_VERSION 由版本路由产生，其余由词法/语法/求值产生。</lang>
// <lang en>E_TDOT_VERSION comes from version routing; the rest from lexing/parsing/evaluation.</lang>
export interface TdotError{
  code:'E_TDOT_VERSION'|'E_TDOT_SYNTAX'|'E_TDOT_TYPE'|'E_TDOT_LIMIT';
  pos:number;
  message:string;
  messageEn:string;
}

// 模板警告：不阻断，但需向用户提示。
// <lang zh-CN>目前只有未定义变量一种（含未注入的 @build.*）。</lang>
// <lang en>Currently only undefined variables (including uninjected @build.*).</lang>
export interface TdotWarning{
  code:'W_TDOT_UNDEFINED';
  pos:number;
  message:string;
  messageEn:string;
}
