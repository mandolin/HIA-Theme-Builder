/**
 * @lang zh-CN TDOT 词法器（`W-tb-P32` / ADR-011 §2）：把手写模板源串切分为 token 序列。
 *   **两态状态机**：标签外一切皆文本（`text`），标签内才解析标识符/运算符/字面量。
 *   这个区分是必须的——否则正文里的 `Hello` 会被当成变量名。
 *   手写、零依赖、单遍扫描；无法识别的结构立即返回 `E_TDOT_SYNTAX`（不猜测、不跳过）。
 * @lang en TDOT lexer (`W-tb-P32` / ADR-011 §2): splits a hand-written template into tokens.
 *   **Two-state machine**: outside a tag everything is text (`text`); identifiers/operators/literals are only
 *   parsed inside tags. The distinction is mandatory — otherwise `Hello` in prose becomes a variable name.
 *   Hand-written, zero-dependency, single pass; unrecognised constructs return `E_TDOT_SYNTAX` immediately.
 */
import type{TdotError,TdotToken}from'./types.js';

// 词法结果：成功给 token 序列，失败给错误（含位置）。
// <lang zh-CN>与求值结果同构，便于调用方统一处理。</lang>
// <lang en>Mirrors the eval result shape so callers handle both uniformly.</lang>
export type TdotLexResult={ok:true;tokens:TdotToken[];}|{ok:false;error:TdotError;};

// 构造语法错误（词法与语法层共用同一码）。
// <lang zh-CN>位置为源串偏移，便于在 UI 里定位。</lang>
// <lang en>pos is the source offset for UI highlighting.</lang>
function syntaxError(pos:number,zh:string,en:string):TdotError{
  return{code:'E_TDOT_SYNTAX',pos,message:zh,messageEn:en};
}

// 运算符集合：按长度降序匹配，保证 `>=` 不被误切成 `>` + `=`。
// <lang zh-CN>只含 ADR-011 §1 列出的八种（六比较 + 两算术）与 `!`。</lang>
// <lang en>Only the eight operators from ADR-011 §1 (six comparisons + two arithmetic) plus `!`.</lang>
const OPERATORS=['>=','<=','==','!=','>','<','+','-','!'] as const;

// 关键字集合：控制结构名与三个字面量词。
// <lang zh-CN>大小写敏感——模板语言不做大小写宽松；导出给解析器与测试复用。</lang>
// <lang en>Case-sensitive — no case folding; exported for the parser and tests.</lang>
export const TDOT_KEYWORDS:ReadonlySet<string>=new Set(['if','each','else','this','true','false','null']);

// 判断字符是否可作标识符起始（字母或下划线）。
// <lang zh-CN>不允许数字起始，避免与数字字面量歧义。</lang>
// <lang en>Digits cannot start an identifier, avoiding ambiguity with number literals.</lang>
function isIdentStart(c:string):boolean{
  return(c>='a'&&c<='z')||(c>='A'&&c<='Z')||c==='_';
}
// 判断字符是否可作标识符延续（字母、数字、下划线、点）。
// <lang zh-CN>点号用于路径（`project.name`），在解析层再拆段。</lang>
// <lang en>Dots are for paths (`project.name`), split into segments at parse time.</lang>
function isIdentPart(c:string):boolean{
  return isIdentStart(c)||(c>='0'&&c<='9')||c==='.';
}
// 判断是否为空白字符。
// <lang zh-CN>标签内的空白跳过；标签外的空白保留在文本里。</lang>
// <lang en>Whitespace inside tags is skipped; outside tags it stays in the text.</lang>
function isSpace(c:string):boolean{
  return c===' '||c==='\t'||c==='\r'||c==='\n';
}

// 词法主函数：单遍扫描，产出 token 序列（末尾恒有 eof）。
// <lang zh-CN>状态机：inTag=false 时累积文本；遇到 `{{` 进入标签态，`}}` 退出。</lang>
// <lang en>State machine: accumulate text while inTag=false; `{{` enters a tag, `}}` exits.</lang>
export function lexTdot(source:string):TdotLexResult{
  const tokens:TdotToken[]=[];
  const n=source.length;
  let i=0;
  // 标签态标志：决定当前字符按文本处理还是按语法 token 处理。
  // <lang zh-CN>这是整个词法器的核心状态。</lang>
  // <lang en>The lexer's core state.</lang>
  let inTag=false;
  // 文本缓冲与其起点（供 text token 定位）。
  // <lang zh-CN>切到标签态前冲刷，避免碎片化。</lang>
  // <lang en>Flushed before entering a tag to avoid fragmentation.</lang>
  let textBuf='';
  let textStart=0;

  // 冲刷静态文本缓冲。
  // <lang zh-CN>空缓冲不产出 token。</lang>
  // <lang en>An empty buffer emits nothing.</lang>
  const flushText=()=>{
    if(textBuf.length>0){tokens.push({type:'text',value:textBuf,pos:textStart});textBuf='';}
  };

  while(i<n){
    // ===== 文本态 =====
    // <lang zh-CN>一切字符原样累积；只有 `{{` 触发状态切换。</lang>
    // <lang en>Everything accumulates verbatim; only `{{` switches state.</lang>
    if(!inTag){
      if(source[i]==='{'&&source[i+1]==='{'){
        flushText();
        // 先判定标签种类，再决定是否产出 `open`：
        //   块开启（`{{#`）/ 块闭合（`{{/`）/ else 自带完整边界，不产 `open`；
        //   只有普通插值才产 `open` 让解析器进入表达式模式。
        // <lang zh-CN>曾先无条件产 `open` 导致 `{{#if}}` 被当插值解析，报"表达式里出现 if"。</lang>
        // <lang en>Emitting `open` unconditionally made `{{#if}}` parse as interpolation ("unexpected if").</lang>
        const tagStart=i;
        i+=2;
        inTag=true;
        // 标签起始后立即处理块标记（`#` / `/`），避免额外状态。
        // <lang zh-CN>块标记紧贴 `{{`，与普通插值区分。</lang>
        // <lang en>Block markers follow `{{` directly, distinguishing them from interpolation.</lang>
        if(source[i]==='#'){
          const start=i;
          i++;
          const nameStart=i;
          while(i<n&&isIdentPart(source[i]!))i++;
          const name=source.slice(nameStart,i);
          if(name!=='if'&&name!=='each'){
            return{ok:false,error:syntaxError(start,`未知块类型「${name}」，只支持 if 与 each。`,`Unknown block type "${name}"; only if and each are supported.`)};
          }
          tokens.push({type:'blockOpen',value:name,pos:start});
          continue;
        }
        if(source[i]==='/'){
          const start=i;
          i++;
          const nameStart=i;
          while(i<n&&isIdentPart(source[i]!))i++;
          const name=source.slice(nameStart,i);
          if(name!=='if'&&name!=='each'){
            return{ok:false,error:syntaxError(start,`未知块闭合「${name}」。`,`Unknown block close "${name}".`)};
          }
          // 闭合标签必须紧跟可选空白与 `}}`。
          // <lang zh-CN>闭合标签不带表达式，多余字符即语法错误。</lang>
          // <lang en>Close tags carry no expression; trailing characters are a syntax error.</lang>
          while(i<n&&isSpace(source[i]!))i++;
          if(source[i]!=='}'||source[i+1]!=='}'){
            return{ok:false,error:syntaxError(start,'块闭合标签必须以 }} 结束。','A close tag must end with }}.')};
          }
          i+=2;
          inTag=false;
          tokens.push({type:'blockClose',value:name,pos:start});
          continue;
        }
        // `{{else}}`：保留字、无表达式、自带 `}}`。
        // <lang zh-CN>单独判定，避免被当成普通标识符插值。</lang>
        // <lang en>Handled specially so it is not treated as an interpolated identifier.</lang>
        if(source.startsWith('else',i)){
          const after=source[i+4];
          if(after===undefined||after==='}'||isSpace(after)){
            const start=i;
            i+=4;
            while(i<n&&isSpace(source[i]!))i++;
            if(source[i]!=='}'||source[i+1]!=='}'){
              return{ok:false,error:syntaxError(start,'else 标签必须以 }} 结束。','The else tag must end with }}.')};
            }
            i+=2;
            inTag=false;
            tokens.push({type:'else',value:'else',pos:start});
            continue;
          }
        }
        // 到这里是普通插值：产 `open` 让解析器进入表达式模式。
        // <lang zh-CN>块标记已在上面各自 continue，不会走到这里。</lang>
        // <lang en>Block markers already returned above and never reach here.</lang>
        tokens.push({type:'open',value:'{{',pos:tagStart});
        continue;
      }
      // 文本累积：记录起点（仅在缓冲为空时），逐字符追加。
      // <lang zh-CN>单花括号属正文，原样保留。</lang>
      // <lang en>A single brace is prose and stays verbatim.</lang>
      if(textBuf.length===0)textStart=i;
      textBuf+=source[i];
      i++;
      continue;
    }

    // ===== 标签态 =====
    // `}}`：退出标签态。
    // <lang zh-CN>此时冲洗文本缓冲已完成，切回文本态。</lang>
    // <lang en>Switches back to text state.</lang>
    if(source[i]==='}'&&source[i+1]==='}'){
      tokens.push({type:'close',value:'}}',pos:i});
      i+=2;
      inTag=false;
      continue;
    }

    // 空白：标签内跳过。
    // <lang zh-CN>不影响语义，只做分隔。</lang>
    // <lang en>Separators only, no semantic effect.</lang>
    if(isSpace(source[i]!)){i++;continue;}

    // @ 占位符：@index / @build.year 等。
    // <lang zh-CN>@ 后的名字按标识符规则读取（含点号）。</lang>
    // <lang en>The name after @ follows identifier rules (dots allowed).</lang>
    if(source[i]==='@'){
      const start=i;
      i++;
      const nameStart=i;
      while(i<n&&isIdentPart(source[i]!))i++;
      const name=source.slice(nameStart,i);
      if(name.length===0){
        return{ok:false,error:syntaxError(start,'@ 后必须跟占位符名。','@ must be followed by a placeholder name.')};
      }
      tokens.push({type:'atVar',value:name,pos:start});
      continue;
    }

    // 字符串字面量：单引号或双引号，不支持转义序列（保持词汇表最小）。
    // <lang zh-CN>不支持转义是刻意的——需要引号就用另一种引号包裹。</lang>
    // <lang en>No escape sequences by design — use the other quote when you need one inside.</lang>
    if(source[i]==='"'||source[i]==="'"){
      const quote=source[i]!;
      const start=i;
      i++;
      const valStart=i;
      while(i<n&&source[i]!==quote)i++;
      if(i>=n){
        return{ok:false,error:syntaxError(start,'字符串字面量未闭合。','Unterminated string literal.')};
      }
      const value=source.slice(valStart,i);
      i++;
      tokens.push({type:'string',value,pos:start});
      continue;
    }

    // 数字字面量：整数或小数。
    // <lang zh-CN>不支持负号字面量——负数用 `0 - n` 表达（词汇表只有二元的减）。</lang>
    // <lang en>No negative literals — express negatives as `0 - n` (only binary minus exists).</lang>
    const digitChar=source[i]!;
    if(digitChar>='0'&&digitChar<='9'){
      const start=i;
      i++;
      // 小数部分：仅在点后跟数字时吞入。
      // <lang zh-CN>只允许一个小数点；数字后不会出现路径分隔点，故无需考虑标识符冲突。</lang>
      // <lang en>At most one decimal point; a path dot cannot follow a number, so no identifier clash.</lang>
      if(source[i]==='.'&&((source[i+1]??'')>='0'&&(source[i+1]??'')<='9')){
        i++;
        // 吞掉小数位。
        // <lang zh-CN>循环条件同样对索引取非空断言。</lang>
        // <lang en>The loop condition also needs a non-null assertion.</lang>
        while(i<n&&(source[i]!>='0'&&source[i]!<='9'))i++;
      }
      tokens.push({type:'number',value:source.slice(start,i),pos:start});
      continue;
    }

    // 标识符 / 关键字。
    // <lang zh-CN>关键字与普通标识符同为 ident token，语义在解析层区分。</lang>
    // <lang en>Keywords and plain identifiers share the ident token; the parser distinguishes them.</lang>
    if(isIdentStart(source[i]!)){
      const start=i;
      while(i<n&&isIdentPart(source[i]!))i++;
      tokens.push({type:'ident',value:source.slice(start,i),pos:start});
      continue;
    }

    // 运算符（长度降序匹配）。
    // <lang zh-CN>先试两字符再试单字符，保证 `>=` 不被切开。</lang>
    // <lang en>Two-character forms are tried first so `>=` is not split.</lang>
    let matched:string|null=null;
    for(const op of OPERATORS){
      if(source.startsWith(op,i)){matched=op;break;}
    }
    if(matched){
      tokens.push({type:'op',value:matched,pos:i});
      i+=matched.length;
      continue;
    }

    // 其余字符：语法错误（不静默跳过，避免"写了但没生效"）。
    // <lang zh-CN>报出具体字符与其位置。</lang>
    // <lang en>The offending character and position are reported.</lang>
    return{ok:false,error:syntaxError(i,`标签内无法识别的字符「${source[i]}」。`,`Unrecognised character "${source[i]}" inside a tag.`)};
  }

  // 收尾：标签未闭合是语法错误（比静默输出半截模板更安全）。
  // <lang zh-CN>文本缓冲先冲刷，保证未闭合时的错误位置有意义。</lang>
  // <lang en>The text buffer is flushed first so the error position is meaningful.</lang>
  if(inTag){
    return{ok:false,error:syntaxError(n,'模板标记未闭合（缺少 }}）。','Unclosed template tag (missing }}).')};
  }
  flushText();
  tokens.push({type:'eof',value:'',pos:n});
  return{ok:true,tokens};
}
