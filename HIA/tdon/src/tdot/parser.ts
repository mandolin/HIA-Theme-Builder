/**
 * @lang zh-CN TDOT 解析器（`W-tb-P32` / ADR-011 §2）：把 token 序列解析为模板 AST。
 *   递归下降 + 优先级爬升；表达式深度受 `TDOT_MAX_EXPR_DEPTH` 限制，AST 节点数受 `TDOT_MAX_NODES` 限制。
 *   刻意不做错误恢复——首个语法错误即返回，避免"半份 AST"带来的歧义。
 * @lang en TDOT parser (`W-tb-P32` / ADR-011 §2): turns tokens into a template AST.
 *   Recursive descent with precedence climbing; expression depth is capped by `TDOT_MAX_EXPR_DEPTH` and AST
 *   node count by `TDOT_MAX_NODES`. No error recovery by design — the first syntax error returns immediately,
 *   avoiding the ambiguity of a half-built AST.
 */
import{
  TDOT_MAX_EXPR_DEPTH,TDOT_MAX_NODES,
  type TdotBinaryOp,type TdotError,type TdotExpr,type TdotNode,type TdotToken
}from'./types.js';
import type{TdotLexResult}from'./lexer.js';

// 解析结果：成功给 AST 与节点数，失败给错误。
// <lang zh-CN>节点数回传供调用方与上限对账（也便于测试）。</lang>
// <lang en>The node count is returned for cap accounting and tests.</lang>
export type TdotParseResult=
  |{ok:true;nodes:TdotNode[];nodeCount:number;}
  |{ok:false;error:TdotError;};

// 构造语法/上限错误。
// <lang zh-CN>解析层只产这两种码：语法与超限。</lang>
// <lang en>The parser only emits these two codes: syntax and limit.</lang>
function parseError(code:'E_TDOT_SYNTAX'|'E_TDOT_LIMIT',pos:number,zh:string,en:string):TdotError{
  return{code,pos,message:zh,messageEn:en};
}

// 二元运算符优先级表（数字越大结合越紧）。
// <lang zh-CN>比较低于加减，保证 `a + 1 > b` 解析为 `(a + 1) > b`。</lang>
// <lang en>Comparisons bind looser than arithmetic, so `a + 1 > b` parses as `(a + 1) > b`.</lang>
const PRECEDENCE:Record<TdotBinaryOp,number>={'==':1,'!=':1,'>':1,'<':1,'>=':1,'<=':1,'+':2,'-':2};

// 判断 token 是否为指定二元运算符。
// <lang zh-CN>比较与算术共用 op 类型。</lang>
// <lang en>Comparisons and arithmetic share the op type.</lang>
function asBinaryOp(tok:TdotToken):TdotBinaryOp|null{
  if(tok.type!=='op')return null;
  const v=tok.value;
  if(v==='=='||v==='!='||v==='>'||v==='<'||v==='>='||v==='<='||v==='+'||v==='-')return v;
  return null;
}

// 解析器主体：持有 token 指针、深度与节点计数。
// <lang zh-CN>全部状态封装在闭包里，避免模块级可变状态。</lang>
// <lang en>All state lives in the closure, avoiding module-level mutability.</lang>
class Parser{
  private pos=0;
  private nodeCount=0;
  constructor(private readonly tokens:TdotToken[]){}

  // 当前 token（不前进）。
  // <lang zh-CN>末尾恒为 eof，故无需越界判断。</lang>
  // <lang en>eof is always last, so no bounds check is needed.</lang>
  private peek():TdotToken{return this.tokens[this.pos]!;}
  // 前进一格并返回被消费的 token。
  // <lang zh-CN>eof 不会被消费（调用方先判断）。</lang>
  // <lang en>eof is never consumed (callers check first).</lang>
  private next():TdotToken{return this.tokens[this.pos++]!;}

  // 解析整个模板：连续解析节点直到 eof。
  // <lang zh-CN>顶层不允许出现孤立的 else 或块闭合（由 parseNodes 的终止条件覆盖）。</lang>
  // <lang en>A stray else or close at top level is covered by parseNodes' stop conditions.</lang>
  parseTemplate():TdotNode[]{
    const nodes:TdotNode[]=[];
    for(;;){
      const tok=this.peek();
      if(tok.type==='eof')break;
      const parsed=this.parseNode(false);
      if(parsed.error)throw new ParseFailure(parsed.error);
      if(parsed.node)nodes.push(parsed.node);
    }
    return nodes;
  }

  // 解析单个节点（含块结构）。
  // <lang zh-CN>inBlock 为真时，遇到 else/blockClose 立即返回 null 交给上层收尾。</lang>
  // <lang en>When inBlock is true, else/blockClose returns null so the caller can close the block.</lang>
  parseNode(inBlock:boolean):{node?:TdotNode;error?:TdotError}{
    const tok=this.peek();
    // 文本：直接产出（词法器已保证非空）。
    // <lang zh-CN>文本是最常见节点，优先处理。</lang>
    // <lang en>Text is the common case and handled first.</lang>
    if(tok.type==='text'){
      this.next();
      this.bump();
      return{node:{kind:'text',value:tok.value}};
    }
    // 块终止符：交给调用方（parseNodes/parseBlock）处理。
    // <lang zh-CN>顶层出现即语法错误，由调用方判定。</lang>
    // <lang en>Whether it is legal at the current level is the caller's call.</lang>
    if(tok.type==='else'||tok.type==='blockClose'){
      if(!inBlock)return{error:parseError('E_TDOT_SYNTAX',tok.pos,`顶层不允许出现「${tok.value}」。`,`"${tok.value}" is not allowed at the top level.`)};
      return{};
    }
    // 插入标记 `{{`：读表达式后必须紧跟 `}}`。
    // <lang zh-CN>这是变量插值的唯一形态。</lang>
    // <lang en>The only interpolation form.</lang>
    if(tok.type==='open'){
      this.next();
      const expr=this.parseExpr(0);
      if('error'in expr)return{error:expr.error};
      const closeTok=this.peek();
      if(closeTok.type!=='close'){
        return{error:parseError('E_TDOT_SYNTAX',closeTok.pos,'插值缺少 }}。','Interpolation is missing }}.')};
      }
      this.next();
      this.bump();
      return{node:{kind:'interp',expr:expr.expr}};
    }
    // 块开启：`{{#if}}` / `{{#each}}`。
    // <lang zh-CN>各自读表达式后递归解析块体，直到 else 或对应闭合。</lang>
    // <lang en>Each reads its expression then parses the body until else or the matching close.</lang>
    if(tok.type==='blockOpen'){
      this.next();
      this.bump();
      const blockName=tok.value;
      const expr=this.parseExpr(0);
      if('error'in expr)return{error:expr.error};
      // 表达式后必须是 `}}`。
      // <lang zh-CN>否则说明标签写法有误。</lang>
      // <lang en>Anything else means a malformed tag.</lang>
      const closeTok=this.peek();
      if(closeTok.type!=='close'){
        return{error:parseError('E_TDOT_SYNTAX',closeTok.pos,`${blockName} 标签缺少 }}。`,`The ${blockName} tag is missing }}.`)};
      }
      this.next();

      // if：解析 consequent，遇 else 再解析 alternate。
      // <lang zh-CN>每个块最多一个 else。</lang>
      // <lang en>At most one else per block.</lang>
      if(blockName==='if'){
        const cons=this.parseBlockBody('if');
        if(cons.error)return{error:cons.error};
        let alt:TdotNode[]=[];
        // 若停在 else，消费它并解析 alternate。
        // <lang zh-CN>else 之后 body 继续到对应 /if。</lang>
        // <lang en>After else the body runs to the matching /if.</lang>
        if(cons.stoppedAt==='else'){
          this.next();
          const altRes=this.parseBlockBody('if');
          if(altRes.error)return{error:altRes.error};
          alt=altRes.nodes;
        }
        return{node:{kind:'if',test:expr.expr,consequent:cons.nodes,alternate:alt}};
      }
      // each：body 直到 /each。
      // <lang zh-CN>each 内不提供 else（词汇表刻意省略——空列表直接渲染为空）。</lang>
      // <lang en>No else inside each — an empty list simply renders nothing.</lang>
      const body=this.parseBlockBody('each');
      if(body.error)return{error:body.error};
      return{node:{kind:'each',source:expr.expr,body:body.nodes}};
    }
    // `}}` 孤立出现：正文里写了闭合标记但没有开启。
    // <lang zh-CN>报错而非当文本，避免用户误以为已生效。</lang>
    // <lang en>Rejected rather than treated as text so users are not misled.</lang>
    if(tok.type==='close'){
      return{error:parseError('E_TDOT_SYNTAX',tok.pos,'孤立的 }}（没有对应的 {{）。','Stray }} without a matching {{.')};
    }
    // 其余（ident/op/atVar/number/string）：只能出现在标签内，此处为语法错误。
    // <lang zh-CN>典型原因是忘了写 `{{ }}`。</lang>
    // <lang en>The usual cause is a missing `{{ }}`.</lang>
    return{error:parseError('E_TDOT_SYNTAX',tok.pos,'标签外的语法 token（是否漏写 {{ }}？）。','Syntax token outside a tag (missing {{ }}?).')};
  }

  // 解析块体：连续解析节点直到遇到 else 或匹配的 blockClose。
  // <lang zh-CN>返回 nodes 与"停在哪个终止符"，由调用方决定后续动作。</lang>
  // <lang en>Returns the nodes plus which terminator stopped it, so the caller decides what follows.</lang>
  private parseBlockBody(expected:string):{nodes:TdotNode[];stoppedAt?:'else'|'close';error?:TdotError}{
    const nodes:TdotNode[]=[];
    for(;;){
      const tok=this.peek();
      if(tok.type==='eof'){
        return{nodes,error:parseError('E_TDOT_SYNTAX',tok.pos,`${expected} 块未闭合。`,`The ${expected} block is not closed.`)};
      }
      if(tok.type==='else'){
        // else 只对 if 有效；each 内出现属语法错误。
        // <lang zh-CN>提示可用"each + if"替代。</lang>
        // <lang en>Suggests the each + if workaround.</lang>
        if(expected!=='if'){
          return{nodes,error:parseError('E_TDOT_SYNTAX',tok.pos,'each 块内不支持 else。','else is not supported inside each.')};
        }
        return{nodes,stoppedAt:'else'};
      }
      if(tok.type==='blockClose'){
        // 闭合名必须匹配，否则是嵌套写错。
        // <lang zh-CN>提示期望的标签名。</lang>
        // <lang en>Names the expected tag.</lang>
        if(tok.value!==expected){
          return{nodes,error:parseError('E_TDOT_SYNTAX',tok.pos,`块闭合不匹配：期望 /${expected}，实际 /${tok.value}。`,`Mismatched close: expected /${expected}, got /${tok.value}.`)};
        }
        this.next();
        return{nodes,stoppedAt:'close'};
      }
      const parsed=this.parseNode(true);
      if(parsed.error)return{nodes,error:parsed.error};
      if(parsed.node)nodes.push(parsed.node);
    }
  }

  // 解析表达式（优先级爬升）。
  // <lang zh-CN>depth 为当前嵌套深度，超限即 E_TDOT_LIMIT。</lang>
  // <lang en>depth is the current nesting level; exceeding the cap yields E_TDOT_LIMIT.</lang>
  parseExpr(depth:number):{expr:TdotExpr}|{error:TdotError}{
    if(depth>TDOT_MAX_EXPR_DEPTH){
      const tok=this.peek();
      return{error:parseError('E_TDOT_LIMIT',tok.pos,`表达式嵌套超过 ${TDOT_MAX_EXPR_DEPTH} 层。`,`Expression nesting exceeds ${TDOT_MAX_EXPR_DEPTH} levels.`)};
    }
    // 先解析一元/原子，再按优先级消费二元运算符。
    // <lang zh-CN>左结合：同级运算符从左向右折叠。</lang>
    // <lang en>Left-associative: same-precedence operators fold left to right.</lang>
    let left=this.parseUnary(depth);
    if('error'in left)return left;
    for(;;){
      const tok=this.peek();
      const op=asBinaryOp(tok);
      if(!op)break;
      const prec=PRECEDENCE[op];
      // 只在自己优先级足够高时才消费（爬升法）。
      // <lang zh-CN>这里用简单循环：同/更高优先级都吃进来，左结合。</lang>
      // <lang en>Simple loop: consume same-or-higher precedence, folding left.</lang>
      this.next();
      const right=this.parseUnary(depth+1);
      if('error'in right)return right;
      this.bump();
      left={expr:{kind:'binary',op,left:left.expr,right:right.expr}};
      void prec;
    }
    return left;
  }

  // 解析一元表达式：`!expr` 或原子。
  // <lang zh-CN>只有 `!` 一种一元运算符（ADR-011 §1）。</lang>
  // <lang en>`!` is the only unary operator (ADR-011 §1).</lang>
  private parseUnary(depth:number):{expr:TdotExpr}|{error:TdotError}{
    // 一元链也计入深度：`!!!!!a` 与 `((((a))))` 同属嵌套。
    // <lang zh-CN>检查曾只在 parseExpr 入口，导致 `!` 链可无限加深。</lang>
    // <lang en>The check used to live only at parseExpr's entry, letting `!` chains deepen without limit.</lang>
    if(depth>TDOT_MAX_EXPR_DEPTH){
      const tok=this.peek();
      return{error:parseError('E_TDOT_LIMIT',tok.pos,`表达式嵌套超过 ${TDOT_MAX_EXPR_DEPTH} 层。`,`Expression nesting exceeds ${TDOT_MAX_EXPR_DEPTH} levels.`)};
    }
    const tok=this.peek();
    if(tok.type==='op'&&tok.value==='!'){
      this.next();
      const operand=this.parseUnary(depth+1);
      if('error'in operand)return operand;
      this.bump();
      return{expr:{kind:'unary',op:'!',operand:operand.expr}};
    }
    return this.parseAtom();
  }

  // 解析原子：字面量 / 变量路径 / @ 占位符。
  // <lang zh-CN>没有括号分组——词汇表刻意省略（深度上限已足够防滥用）。</lang>
  // <lang en>No parenthesis grouping — deliberately omitted (the depth cap already guards abuse).</lang>
  private parseAtom():{expr:TdotExpr}|{error:TdotError}{
    const tok=this.peek();
    // 数字字面量。
    // <lang zh-CN>非法数字（如 `1.2.3`）在此判失败。</lang>
    // <lang en>Malformed numbers (e.g. `1.2.3`) fail here.</lang>
    if(tok.type==='number'){
      const v=Number(tok.value);
      if(!Number.isFinite(v))return{error:parseError('E_TDOT_SYNTAX',tok.pos,`非法数字「${tok.value}」。`,`Invalid number "${tok.value}".`)};
      this.next();
      return{expr:{kind:'literal',value:v}};
    }
    // 字符串字面量。
    // <lang zh-CN>词法器已去掉引号，这里直接用。</lang>
    // <lang en>Quotes were stripped by the lexer.</lang>
    if(tok.type==='string'){
      this.next();
      return{expr:{kind:'literal',value:tok.value}};
    }
    // 标识符：true/false/null 为字面量，this 为循环内当前项，其余为变量路径。
    // <lang zh-CN>路径在解析层按点号拆段。</lang>
    // <lang en>Paths are split on dots at parse time.</lang>
    if(tok.type==='ident'){
      this.next();
      if(tok.value==='true')return{expr:{kind:'literal',value:true}};
      if(tok.value==='false')return{expr:{kind:'literal',value:false}};
      if(tok.value==='null')return{expr:{kind:'literal',value:null}};
      if(tok.value==='this')return{expr:{kind:'at',name:'this'}};
      // 控制关键字不能作变量名（`if`/`each`/`else` 已在结构层消费，此处是误用）。
      // <lang zh-CN>给出明确提示而非"未定义变量"。</lang>
      // <lang en>An explicit message instead of "undefined variable".</lang>
      if(tok.value==='if'||tok.value==='each'||tok.value==='else'){
        return{error:parseError('E_TDOT_SYNTAX',tok.pos,`关键字「${tok.value}」不能用作变量。`,`Keyword "${tok.value}" cannot be used as a variable.`)};
      }
      return{expr:{kind:'var',path:tok.value.split('.')}};
    }
    // @ 占位符：@index / @build.* 等。
    // <lang zh-CN>语义解析留给求值器（它知道 buildInfo 是否注入）。</lang>
    // <lang en>Semantics are left to the evaluator, which knows whether buildInfo was injected.</lang>
    if(tok.type==='atVar'){
      this.next();
      return{expr:{kind:'at',name:tok.value}};
    }
    // 其余：表达式位置出现意外 token。
    // <lang zh-CN>报出实际 token 类型帮助定位。</lang>
    // <lang en>Names the actual token type to aid diagnosis.</lang>
    return{error:parseError('E_TDOT_SYNTAX',tok.pos,`表达式中出现意外的「${tok.value||tok.type}」。`,`Unexpected "${tok.value||tok.type}" in an expression.`)};
  }

  // 累加 AST 节点计数并在超限时抛错。
  // <lang zh-CN>在产出节点处调用，保证计数与实际 AST 一致。</lang>
  // <lang en>Called where nodes are produced so the count matches the AST.</lang>
  bump():void{
    this.nodeCount++;
    if(this.nodeCount>TDOT_MAX_NODES){
      throw new ParseFailure(parseError('E_TDOT_LIMIT',this.peek().pos,`模板节点数超过 ${TDOT_MAX_NODES}。`,`Template node count exceeds ${TDOT_MAX_NODES}.`));
    }
  }
  // 暴露计数供结果回传。
  // <lang zh-CN>只读，避免外部改写。</lang>
  // <lang en>Read-only to prevent external mutation.</lang>
  get count():number{return this.nodeCount;}
}

// 解析失败时用于穿透递归的控制流异常（内部使用，不外泄）。
// <lang zh-CN>递归下降里用异常比层层返回 error 更清晰；对外仍是 Result 形态。</lang>
// <lang en>Exceptions keep recursive descent readable; the public surface is still a Result.</lang>
class ParseFailure extends Error{
  constructor(readonly detail:TdotError){super(detail.message);}
}

// 解析入口：词法 → 语法，产出 AST。
// <lang zh-CN>词法失败直接透出；语法失败经 ParseFailure 捕获后转 Result。</lang>
// <lang en>Lexer failures pass through; parser failures are converted from ParseFailure to a Result.</lang>
export function parseTdot(source:string,tokens:TdotToken[]):TdotParseResult{
  const parser=new Parser(tokens);
  try{
    const nodes=parser.parseTemplate();
    return{ok:true,nodes,nodeCount:parser.count};
  }catch(e){
    if(e instanceof ParseFailure)return{ok:false,error:e.detail};
    throw e;
  }
}
