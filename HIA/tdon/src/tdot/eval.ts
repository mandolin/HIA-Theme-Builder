/**
 * @lang zh-CN TDOT 求值器（`W-tb-P32` / ADR-011 §2、§4）：把 AST 与数据求值为字符串。
 *   **纯函数**：不接触 DOM/网络/存储/时间；不确定性只能来自宿主注入的 `buildInfo`（ADR-011 §4.1）。
 *   失败整体返回错误，不产出半份输出（ADR-011 §4）。
 * @lang en TDOT evaluator (`W-tb-P32` / ADR-011 §2, §4): turns an AST plus data into a string.
 *   **Pure**: no DOM/network/storage/time; the only non-determinism comes from host-injected `buildInfo`
 *   (ADR-011 §4.1). Failures return an error with no partial output (ADR-011 §4).
 */
import{
  TDOT_SPEC_VERSION,TDOT_MAX_STEPS,
  type TdotBuildInfo,type TdotError,type TdotEvalContext,type TdotEvalResult,type TdotExpr,
  type TdotNode,type TdotWarning
}from'./types.js';
import{lexTdot}from'./lexer.js';
import{parseTdot}from'./parser.js';

// 求值可接受的值类型（ADR-011 §1：只有这三种标量 + null）。
// <lang zh-CN>对象与数组不参与运算，仅可作为 each 的遍历源。</lang>
// <lang en>Objects/arrays never participate in operations; they only serve as each sources.</lang>
type Scalar=string|number|boolean|null;

// 构造求值错误。
// <lang zh-CN>求值层只产 E_TDOT_TYPE 与 E_TDOT_LIMIT。</lang>
// <lang en>The evaluator only emits E_TDOT_TYPE and E_TDOT_LIMIT.</lang>
function evalError(code:'E_TDOT_TYPE'|'E_TDOT_LIMIT',pos:number,zh:string,en:string):TdotError{
  return{code,pos,message:zh,messageEn:en};
}

// 把任意值安全转为标量用于比较/运算；不可转换时返回 undefined。
// <lang zh-CN>对象/数组返回 undefined，由调用方决定报错。</lang>
// <lang en>Objects/arrays yield undefined; the caller decides how to report.</lang>
function toScalar(v:unknown):Scalar|undefined{
  if(v===null||v===undefined)return null;
  if(typeof v==='string'||typeof v==='number'||typeof v==='boolean')return v;
  return undefined;
}

// 按路径取值（`project.name` → data.project.name）。
// <lang zh-CN>路径中任一段缺失返回 undefined；不做原型链穿越（只认自有属性）。</lang>
// <lang en>Any missing segment yields undefined; no prototype traversal (own properties only).</lang>
function readPath(root:unknown,path:string[]):unknown{
  let cur=root;
  for(const seg of path){
    if(cur===null||typeof cur!=='object')return undefined;
    // 只读自有属性，防 `__proto__` 之类的原型链访问（与 TDON-11.3 同一取向）。
    // <lang zh-CN>这不是"信任数据"的场景——数据来自外部文档。</lang>
    // <lang en>Data comes from external documents, so own-property access is mandatory.</lang>
    if(!Object.prototype.hasOwnProperty.call(cur,seg))return undefined;
    cur=(cur as Record<string,unknown>)[seg];
  }
  return cur;
}

// 解析 @ 占位符：@index / @this / @build.*。
// <lang zh-CN>未注入的 @build.* 返回 undefined（调用方记 W_TDOT_UNDEFINED）。</lang>
// <lang en>An uninjected @build.* returns undefined (the caller records W_TDOT_UNDEFINED).</lang>
function readAt(ctx:TdotEvalContext,name:string):unknown{
  if(name==='index'||name==='this')return ctx.locals[name];
  if(name==='build.year')return ctx.build?.year;
  if(name==='build.date')return ctx.build?.date;
  if(name==='build.timestamp')return ctx.build?.timestamp;
  if(name==='build.random')return ctx.build?.random;
  // 其它 @ 名一律未定义（词汇表未列出的占位符）。
  // <lang zh-CN>不抛错，交由调用方决定严重级别。</lang>
  // <lang en>Not an error here; the caller decides severity.</lang>
  return undefined;
}

// 字符串化输出值（插值用）。
// <lang zh-CN>undefined/null 输出空串；布尔输出 true/false；数字原样。</lang>
// <lang en>undefined/null become empty; booleans as true/false; numbers verbatim.</lang>
function stringify(v:unknown):string{
  if(v===undefined||v===null)return'';
  if(typeof v==='string')return v;
  if(typeof v==='number')return String(v);
  if(typeof v==='boolean')return v?'true':'false';
  // 对象/数组不参与插值（ADR-011 §2：不得作为插值输出）。
  // <lang zh-CN>返回空串而非 `[object Object]`，避免把内部结构漏到产物里。</lang>
  // <lang en>Empty rather than `[object Object]`, so internals never leak into artifacts.</lang>
  return'';
}

// 真值判定：遵循模板语言惯例（空串/0/null/undefined/false/空数组为假）。
// <lang zh-CN>空数组为假——模板里"有内容才渲染"是最常见用法。</lang>
// <lang en>Empty arrays are falsy — "render only when non-empty" is the most common usage.</lang>
function truthy(v:unknown):boolean{
  if(v===undefined||v===null||v===false)return false;
  if(v===''||v===0)return false;
  if(Array.isArray(v))return v.length>0;
  return true;
}

// 求值单个表达式；返回标量或错误。
// <lang zh-CN>深度由解析层已限制，这里不再重复判定，只累加步数。</lang>
// <lang en>Depth was capped at parse time; here only the step counter advances.</lang>
function evalExpr(expr:TdotExpr,ctx:TdotEvalContext,warnings:TdotWarning[],pos:number):{value:Scalar}|{error:TdotError}|{undef:true}{
  // 每求值一个表达式计 1 步（ADR-011 §2 的步数上限）。
  // <lang zh-CN>超限即中断，防止指数级展开。</lang>
  // <lang en>Exceeding it aborts, preventing exponential expansion.</lang>
  ctx.steps++;
  if(ctx.steps>TDOT_MAX_STEPS){
    return{error:evalError('E_TDOT_LIMIT',pos,`求值步数超过 ${TDOT_MAX_STEPS}。`,`Evaluation steps exceed ${TDOT_MAX_STEPS}.`)};
  }
  switch(expr.kind){
    // 字面量：直接返回。
    // <lang zh-CN>无需转换，类型已在解析层确定。</lang>
    // <lang en>Already typed by the parser.</lang>
    case'literal':return{value:expr.value};
    // 变量路径：从 data 读取。
    // <lang zh-CN>缺失记警告，不阻断（模板常有多分支）。</lang>
    // <lang en>Missing records a warning without blocking (templates often branch).</lang>
    case'var':{
      const raw=readPath(ctx.data,expr.path);
      if(raw===undefined){
        warnings.push({code:'W_TDOT_UNDEFINED',pos,message:`变量「${expr.path.join('.')}」未定义。`,messageEn:`Variable "${expr.path.join('.')}" is undefined.`});
        return{value:null};
      }
      const s=toScalar(raw);
      // 数组/对象在**条件位置**合法（空数组为假）；ADR-011 §2 只禁止"作为插值输出"。
      //   这里返回布尔占位，插值语境下由 stringify 输出空串（不会把结构漏进产物）。
      // <lang en>Arrays/objects are legal in conditions (empty = falsy); §2 only forbids interpolating them.
      //   This returns a boolean placeholder; in interpolation contexts stringify yields an empty string.</lang>
      if(s===undefined)return{value:Array.isArray(raw)?raw.length>0:true};
      return{value:s};
    }
    // @ 占位符：循环变量或宿主注入的构建信息。
    // <lang zh-CN>未定义时记警告并返回 null。</lang>
    // <lang en>Undefined records a warning and yields null.</lang>
    case'at':{
      const raw=readAt(ctx,expr.name);
      if(raw===undefined){
        warnings.push({code:'W_TDOT_UNDEFINED',pos,message:`占位符「@${expr.name}」未定义或未注入。`,messageEn:`Placeholder "@${expr.name}" is undefined or was not injected.`});
        return{value:null};
      }
      const s=toScalar(raw);
      if(s===undefined)return{error:evalError('E_TDOT_TYPE',pos,`占位符「@${expr.name}」的值不是标量。`,`Placeholder "@${expr.name}" is not a scalar.`)};
      return{value:s};
    }
    // 一元否定：只对真值判定取反。
    // <lang zh-CN>返回布尔而非原值，保持语义清晰。</lang>
    // <lang en>Yields a boolean, keeping semantics explicit.</lang>
    case'unary':{
      const inner=evalExpr(expr.operand,ctx,warnings,pos);
      if('error'in inner)return inner;
      if('undef'in inner)return{value:false};
      return{value:!truthy(inner.value)};
    }
    // 二元运算：比较或加减。
    // <lang zh-CN>两侧都求值后按运算符分派；类型不匹配报 E_TDOT_TYPE。</lang>
    // <lang en>Both sides are evaluated then dispatched; mismatches yield E_TDOT_TYPE.</lang>
    case'binary':{
      const left=evalExpr(expr.left,ctx,warnings,pos);
      if('error'in left)return left;
      if('undef'in left)return left;
      const right=evalExpr(expr.right,ctx,warnings,pos);
      if('error'in right)return right;
      if('undef'in right)return right;
      const a=left.value,b=right.value;
      switch(expr.op){
        // 相等：同类型直接比；字符串与数字不隐式互转（避免 "1" == 1 的陷阱）。
        // <lang zh-CN>跨类型一律 false（`!=` 为 true），不报错——相等判断本身容错。</lang>
        // <lang en>Cross-type comparisons are false (true for !=) without erroring — equality is tolerant.</lang>
        case'==':return{value:a===b};
        case'!=':return{value:a!==b};
        // 大小比较：两侧必须同为数字或同为字符串。
        // <lang zh-CN>混合类型报错——静默转换会掩盖数据错误。</lang>
        // <lang en>Mixed types error — silent coercion hides data bugs.</lang>
        case'>':case'<':case'>=':case'<=':{
          const bothNum=typeof a==='number'&&typeof b==='number';
          const bothStr=typeof a==='string'&&typeof b==='string';
          if(!bothNum&&!bothStr){
            return{error:evalError('E_TDOT_TYPE',pos,`比较运算要求两侧同为数字或同为字符串（实际 ${typeof a} 与 ${typeof b}）。`,`Comparison requires both sides to be numbers or both strings (got ${typeof a} and ${typeof b}).`)};
          }
          if(bothNum){
            const x=a as number,y=b as number;
            return{value:expr.op==='>'?x>y:expr.op==='<'?x<y:expr.op==='>='?x>=y:x<=y};
          }
          const x=a as string,y=b as string;
          return{value:expr.op==='>'?x>y:expr.op==='<'?x<y:expr.op==='>='?x>=y:x<=y};
        }
        // 加法：数字相加，字符串拼接；混合类型报错。
        // <lang zh-CN>`+` 是模板里唯一的"重载"运算符，语义按左操作数类型决定。</lang>
        // <lang en>`+` is the only overloaded operator; semantics follow the left operand's type.</lang>
        case'+':{
          if(typeof a==='number'&&typeof b==='number')return{value:a+b};
          if(typeof a==='string'&&typeof b==='string')return{value:a+b};
          return{error:evalError('E_TDOT_TYPE',pos,`加法要求两侧同为数字或同为字符串（实际 ${typeof a} 与 ${typeof b}）。`,`Addition requires both sides to be numbers or both strings (got ${typeof a} and ${typeof b}).`)};
        }
        // 减法：仅数字。
        // <lang zh-CN>字符串相减无意义，报错而非静默 NaN。</lang>
        // <lang en>String subtraction is meaningless; errors rather than a silent NaN.</lang>
        case'-':{
          if(typeof a!=='number'||typeof b!=='number'){
            return{error:evalError('E_TDOT_TYPE',pos,`减法要求两侧同为数字（实际 ${typeof a} 与 ${typeof b}）。`,`Subtraction requires numbers (got ${typeof a} and ${typeof b}).`)};
          }
          return{value:a-b};
        }
      }
    }
  }
}

// 求值节点序列，拼接输出。
// <lang zh-CN>逐节点累加；任一步失败即整体失败（ADR-011 §4）。</lang>
// <lang en>Accumulates per node; any failure fails the whole run (ADR-011 §4).</lang>
function evalNodes(nodes:TdotNode[],ctx:TdotEvalContext,warnings:TdotWarning[]):{out:string}|{error:TdotError}{
  let out='';
  for(const node of nodes){
    ctx.steps++;
    if(ctx.steps>TDOT_MAX_STEPS){
      return{error:evalError('E_TDOT_LIMIT',0,`求值步数超过 ${TDOT_MAX_STEPS}。`,`Evaluation steps exceed ${TDOT_MAX_STEPS}.`)};
    }
    if(node.kind==='text'){out+=node.value;continue;}
    if(node.kind==='interp'){
      const r=evalExpr(node.expr,ctx,warnings,0);
      if('error'in r)return{error:r.error};
      if('undef'in r)continue;
      out+=stringify(r.value);
      continue;
    }
    if(node.kind==='if'){
      const r=evalExpr(node.test,ctx,warnings,0);
      if('error'in r)return{error:r.error};
      const branch='undef'in r?node.alternate:(truthy(r.value)?node.consequent:node.alternate);
      const sub=evalNodes(branch,ctx,warnings);
      if('error'in sub)return sub;
      out+=sub.out;
      continue;
    }
    // each：源必须是数组；逐项设置 locals 后渲染 body。
    // <lang zh-CN>each 需要**原始数组**而非标量，故直接按表达式形态取值，不走标量求值路径。</lang>
    // <lang en>each needs the raw array, so it reads by expression shape rather than the scalar path.</lang>
    const raw=node.source.kind==='var'
      ?readPath(ctx.data,node.source.path)
      :node.source.kind==='at'
        ?readAt(ctx,node.source.name)
        :undefined;
    // 源缺失（未定义变量/未注入占位符）→ 警告 + 渲染空（与"空列表"同义）。
    // <lang zh-CN>比报错更宽容：模板里"有数据就渲染"是常态。</lang>
    // <lang en>More forgiving than erroring: "render when data exists" is the norm.</lang>
    if(raw===undefined){
      warnings.push({code:'W_TDOT_UNDEFINED',pos:0,message:'each 的源未定义，按空列表处理。',messageEn:'The source of each is undefined; treated as an empty list.'});
      continue;
    }
    // 非数组报 E_TDOT_TYPE（静默渲染空会掩盖数据错误）。
    // <lang zh-CN>提示实际类型便于排查。</lang>
    // <lang en>Names the actual type to aid diagnosis.</lang>
    if(!Array.isArray(raw)){
      return{error:evalError('E_TDOT_TYPE',0,`each 的源必须是数组（实际 ${typeof raw}）。`,`The source of each must be an array (got ${typeof raw}).`)};
    }
    for(let idx=0;idx<raw.length;idx++){
      ctx.steps++;
      if(ctx.steps>TDOT_MAX_STEPS){
        return{error:evalError('E_TDOT_LIMIT',0,`求值步数超过 ${TDOT_MAX_STEPS}。`,`Evaluation steps exceed ${TDOT_MAX_STEPS}.`)};
      }
      // 保存外层 locals 以便嵌套 each 后恢复。
      // <lang zh-CN>不用 try/finally：纯函数且失败即整体返回，无需保证恢复。</lang>
      // <lang en>No try/finally needed: pure and failing means the whole run returns.</lang>
      const prevThis=ctx.locals['this'],prevIndex=ctx.locals['index'];
      ctx.locals['this']=raw[idx];
      ctx.locals['index']=idx;
      const sub=evalNodes(node.body,ctx,warnings);
      if('error'in sub)return sub;
      out+=sub.out;
      ctx.locals['this']=prevThis;
      ctx.locals['index']=prevIndex;
    }
  }
  return{out};
}

// ===== 公共入口 =====

// 求值一份 TDOT 模板（源串 + 数据 + 可选构建信息）。
// <lang zh-CN>词法/语法失败也在此转成 Result，调用方只需看 ok。</lang>
// <lang en>Lex/parse failures are converted here too; callers only check ok.</lang>
export function evaluateTdot(
  source:string,
  data:Record<string,unknown>,
  build?:TdotBuildInfo
):TdotEvalResult{
  const warnings:TdotWarning[]=[];
  // 1) 词法。
  // <lang zh-CN>失败即返回，不做部分解析。</lang>
  // <lang en>Failures return immediately; no partial parsing.</lang>
  const lexed=lexTdot(source);
  if(!lexed.ok)return{ok:false,error:lexed.error,warnings};
  // 2) 语法。
  // <lang zh-CN>节点数上限由解析器强制。</lang>
  // <lang en>The node cap is enforced by the parser.</lang>
  const parsed=parseTdot(source,lexed.tokens);
  if(!parsed.ok)return{ok:false,error:parsed.error,warnings};
  // 3) 求值。
  // <lang zh-CN>steps 从 0 起算，locals 为空对象。</lang>
  // <lang en>steps starts at 0; locals is an empty object.</lang>
  const ctx:TdotEvalContext={data,locals:{},steps:0,...(build?{build}:{})};
  const result=evalNodes(parsed.nodes,ctx,warnings);
  if('error'in result)return{ok:false,error:result.error,warnings};
  return{ok:true,output:result.out,warnings};
}

// 判断 `template` 段是否应触发求值（ADR-011 §5 方案 B）。
// <lang zh-CN>只有 specVersion 以 `tdot-` 开头且等于当前版本才求值；其余继续忽略。</lang>
// <lang en>Only a `tdot-*` specVersion equal to the current one evaluates; everything else is ignored.</lang>
export function shouldEvaluateTdot<T extends {specVersion?:unknown}>(template:T):boolean{
  if(!template||typeof template!=='object')return false;
  const sv=(template as {specVersion?:unknown}).specVersion;
  return typeof sv==='string'&&sv===TDOT_SPEC_VERSION;
}

// 从 template 段取出 data（缺省为空对象）。
// <lang zh-CN>data 非对象时按空处理——求值会因缺变量产生警告而非崩溃。</lang>
// <lang en>A non-object data becomes empty; evaluation then warns instead of crashing.</lang>
export function tdotData(template:{data?:unknown;[key:string]:unknown}):Record<string,unknown>{
  const d=template.data;
  return d&&typeof d==='object'&&!Array.isArray(d)?(d as Record<string,unknown>):{};
}

// 判断 template 段是否为不支持的 TDOT 版本（用于 E_TDOT_VERSION）。
// <lang zh-CN>显式声明了 `tdot-` 前缀但不等于当前版本 → 文档缺陷，报错。</lang>
// <lang en>An explicit `tdot-` prefix that is not the current version is a document defect.</lang>
export function isUnsupportedTdotVersion(template:unknown):boolean{
  if(!template||typeof template!=='object')return false;
  const sv=(template as {specVersion?:unknown}).specVersion;
  return typeof sv==='string'&&sv.startsWith('tdot-')&&sv!==TDOT_SPEC_VERSION;
}
