/**
 * @lang zh-CN TDON 校验器（`W-tb-P26` / 规范 §2–§11）：手写零依赖实现，按键白名单重建文档。
 *   设计要点：①**不展开外部对象**，逐键读取后重建（TDON-11.3 原型污染面）；
 *   ②错误**收集而非抛出**，单次返回最多 20 条（TDON-8.1）；③令牌解析可缺省主题（文件结构校验与
 *   引用校验分离，便于"先加载、后随主题重解析"，TDON-8.3）。
 * @lang en TDON validator (`W-tb-P26` / spec §2–§11): hand-written, zero dependencies, rebuilding documents
 *   from a key whitelist. Design points: (1) never spread external objects — read key by key and rebuild
 *   (TDON-11.3, prototype-pollution surface); (2) collect issues instead of throwing, at most 20 per pass
 *   (TDON-8.1); (3) token resolution may omit the theme, separating structure from reference checks so a file
 *   can load first and re-resolve on theme change (TDON-8.3).
 */
import type{Theme}from'@hia/theme-core';
import{
  TDON_SPEC_VERSION,TDON_WARN_BYTES,TDON_MAX_BYTES,TDON_MAX_ISSUES,
  TDON_WARN_PREVIEW_NODES,TDON_MAX_PREVIEW_NODES,TDON_WARN_NODES_TOTAL,TDON_MAX_NODES_TOTAL,TDON_MAX_NESTING,
  TDON_WARN_TEMPLATE_BYTES,TDON_MAX_TEMPLATE_BYTES,TDON_WARN_TEMPLATE_TOTAL,TDON_MAX_TEMPLATE_TOTAL,
  TDON_WARN_FILE_COUNT,TDON_MAX_FILE_COUNT,TDON_MAX_IMAGE_URL,
  TDON_NODE_TYPES,type TdonDocument,type TdonNode,type TdonNodeType,type TdonPreviewLayout,
  type TdonExportFile,type TdonEffect,type TdonContrastRule,type TdonTokens,type TdonTemplateReserved
}from'./types.js';
import{tdonError,tdonWarning,type TdonIssue,type TdonIssueCode,type TdonValidationResult}from'./issues.js';
import{checkTdonPath,isDangerousKey,TDON_MAX_PATH_LENGTH}from'./paths.js';
import{resolveTdonToken,isTdonTokenSyntax,listTdonColorRoles}from'./resolve.js';
import{TDOT_SPEC_VERSION,TDOT_MAX_BODY_LENGTH}from'./tdot/types.js';

// 校验上下文：问题收集器 + 可选主题 + 节点计数。
// <lang zh-CN>theme 缺省时跳过引用解析与对比度断言（只做结构校验）。</lang>
// <lang en>When theme is absent, reference resolution and contrast assertions are skipped (structure only).</lang>
interface Ctx{
  errors:TdonIssue[];
  warnings:TdonIssue[];
  truncated:boolean;
  theme?:Theme;
  nodeCount:number;
  /** @lang zh-CN 软阈值警告只发一次，避免逐节点刷屏。 @lang en Soft-cap warnings fire once rather than per node. */
  warnedTotal:boolean;
}

// 追加一条错误（命中上限后置 truncated 并丢弃后续，保证列表不无限增长）。
// <lang zh-CN>上限判定在写入前，因此最终条数恒 ≤ TDON_MAX_ISSUES。</lang>
// <lang en>The cap is checked before writing, so the final count never exceeds TDON_MAX_ISSUES.</lang>
function pushError(ctx:Ctx,code:TdonIssueCode,path:string,zh:string,en:string):void{
  if(ctx.errors.length>=TDON_MAX_ISSUES){ctx.truncated=true;return;}
  ctx.errors.push(tdonError(code,path,zh,en));
}
// 追加一条警告（与错误共用上限，避免警告刷屏）。
// <lang zh-CN>警告不阻断注册，但仍计入条数上限。</lang>
// <lang en>Warnings never block registration but still count toward the cap.</lang>
function pushWarning(ctx:Ctx,code:TdonIssueCode,path:string,zh:string,en:string):void{
  if(ctx.warnings.length>=TDON_MAX_ISSUES){ctx.truncated=true;return;}
  ctx.warnings.push(tdonWarning(code,path,zh,en));
}

// 判断值是否为普通对象（排除 null 与数组）。
// <lang zh-CN>后续所有"对象键白名单"都基于此判定，避免对数组/标量做键遍历。</lang>
// <lang en>All key-whitelist passes rely on this, so arrays/scalars are never key-walked.</lang>
function isPlainObject(v:unknown):v is Record<string,unknown>{
  return typeof v==='object'&&v!==null&&!Array.isArray(v);
}

// 检查对象是否含危险键（TDON-11.3）；命中即报错并返回 true 供调用方跳过该对象。
// <lang zh-CN>只报一次（取首个命中键），避免嵌套对象刷出多条同类错误。</lang>
// <lang en>Reports once (first hit only) to avoid flooding identical errors across nested objects.</lang>
function rejectDangerousKeys(ctx:Ctx,obj:Record<string,unknown>,path:string):boolean{
  for(const key of Object.keys(obj)){
    if(isDangerousKey(key)){
      pushError(ctx,'E_BAD_KEY',`${path}.${key}`,`不允许的键名「${key}」（可能造成原型污染）。`,`Key "${key}" is not allowed (prototype-pollution risk).`);
      return true;
    }
  }
  return false;
}

// 检查对象只含白名单键；多余键逐个报 E_UNKNOWN_KEY（TDON-2.1）。
// <lang zh-CN>不做静默忽略：拼写错误必须暴露，否则"声明了但没生效"极难排查。</lang>
// <lang en>No silent ignoring: typos must surface, otherwise "declared but inert" is very hard to debug.</lang>
function checkKnownKeys(ctx:Ctx,obj:Record<string,unknown>,path:string,allowed:readonly string[]):void{
  for(const key of Object.keys(obj)){
    if(allowed.includes(key))continue;
    pushError(ctx,'E_UNKNOWN_KEY',`${path}.${key}`,`未知键「${key}」；本节允许的键：${allowed.join('、')}。`,`Unknown key "${key}"; allowed here: ${allowed.join(', ')}.`);
  }
}

// 读取必填字符串（含长度上限）。
// <lang zh-CN>缺失与类型错误分码：E_REQUIRED vs E_TYPE，便于 UI 给不同修复建议。</lang>
// <lang en>Missing and wrong-type are distinct codes (E_REQUIRED vs E_TYPE) so the UI can advise differently.</lang>
function wantString(ctx:Ctx,v:unknown,path:string,maxLen:number):string|undefined{
  if(v===undefined)return undefined;
  if(typeof v!=='string'){
    pushError(ctx,'E_TYPE',path,`应为字符串。`,`Must be a string.`);
    return undefined;
  }
  if(v.length>maxLen){
    pushError(ctx,'E_LIMIT',path,`长度 ${v.length} 超过上限 ${maxLen}。`,`Length ${v.length} exceeds the ${maxLen} limit.`);
    return undefined;
  }
  return v;
}
// 读取必填字段：undefined 时报 E_REQUIRED。
// <lang zh-CN>与 wantString 配合使用，把"必填"与"类型"两件事分开表达。</lang>
// <lang en>Paired with wantString, keeping "required" and "type" as separate concerns.</lang>
function requireString(ctx:Ctx,v:unknown,path:string,maxLen:number):string|undefined{
  if(v===undefined){
    pushError(ctx,'E_REQUIRED',path,'该字段必填。','This field is required.');
    return undefined;
  }
  return wantString(ctx,v,path,maxLen);
}
// 读取数值（可选区间与整数约束）。
// <lang zh-CN>NaN/Infinity 一律按类型错误处理，避免下游出现非有限值。</lang>
// <lang en>NaN/Infinity are type errors so non-finite values never reach downstream code.</lang>
function wantNumber(ctx:Ctx,v:unknown,path:string,opt:{min?:number;max?:number;int?:boolean}={}):number|undefined{
  if(v===undefined)return undefined;
  if(typeof v!=='number'||!Number.isFinite(v)){
    pushError(ctx,'E_TYPE',path,'应为有限数值。','Must be a finite number.');
    return undefined;
  }
  if(opt.int&&!Number.isInteger(v)){
    pushError(ctx,'E_TYPE',path,'应为整数。','Must be an integer.');
    return undefined;
  }
  if(opt.min!==undefined&&v<opt.min){
    pushError(ctx,'E_RANGE',path,`应 ≥ ${opt.min}，实际 ${v}。`,`Must be ≥ ${opt.min}, got ${v}.`);
    return undefined;
  }
  if(opt.max!==undefined&&v>opt.max){
    pushError(ctx,'E_RANGE',path,`应 ≤ ${opt.max}，实际 ${v}。`,`Must be ≤ ${opt.max}, got ${v}.`);
    return undefined;
  }
  return v;
}
// 读取枚举值。
// <lang zh-CN>报错文案列出合法值，减少用户查文档的次数。</lang>
// <lang en>The message lists legal values, sparing users a documentation lookup.</lang>
function wantEnum<T extends string>(ctx:Ctx,v:unknown,path:string,allowed:readonly T[]):T|undefined{
  if(v===undefined)return undefined;
  if(typeof v!=='string'||!allowed.includes(v as T)){
    pushError(ctx,'E_ENUM',path,`应为 ${allowed.join(' / ')} 之一。`,`Must be one of ${allowed.join(' / ')}.`);
    return undefined;
  }
  return v as T;
}
// 读取数组（元素由 item 回调逐个校验）。
// <lang zh-CN>非数组报类型错误；长度越界报 E_LIMIT 但仍继续校验元素，让用户一次看到全部问题。</lang>
// <lang en>Non-arrays are type errors; length violations report E_LIMIT yet items are still checked so the
//   user sees everything at once.</lang>
function wantArray<T>(ctx:Ctx,v:unknown,path:string,min:number,max:number,item:(v:unknown,path:string)=>T|undefined):T[]|undefined{
  if(v===undefined)return undefined;
  if(!Array.isArray(v)){
    pushError(ctx,'E_TYPE',path,'应为数组。','Must be an array.');
    return undefined;
  }
  if(v.length<min||v.length>max){
    pushError(ctx,'E_LIMIT',path,`元素数量应为 ${min}–${max}，实际 ${v.length}。`,`Item count must be ${min}–${max}, got ${v.length}.`);
  }
  const out:T[]=[];
  v.forEach((raw,i)=>{
    const parsed=item(raw,`${path}[${i}]`);
    if(parsed!==undefined)out.push(parsed);
  });
  return out;
}

// 校验远程图片地址（TDON-5.12）：仅 https、长度受限。
// <lang zh-CN>只允许 https——http 会在 https 页面被浏览器拦截，混合内容提示比直接拒绝更糟。
//   data:/blob:/javascript: 一律拒绝：前者可夹带任意载荷，后者是注入面。</lang>
// <lang en>https only: http is blocked as mixed content on https pages, and the warning is worse than a
//   clear rejection. data:/blob:/javascript: are rejected — the first can carry arbitrary payloads, the
//   last is an injection surface.</lang>
function wantImageUrl(ctx:Ctx,v:unknown,path:string):string|undefined{
  const url=wantString(ctx,v,path,TDON_MAX_IMAGE_URL);
  if(url===undefined)return undefined;
  if(!/^https:\/\/[^\s]+$/i.test(url)){
    pushError(ctx,'E_MEDIA_URL',path,`图片地址必须是 https:// 链接，实际「${url.slice(0,60)}」。`,`Image URL must be an https:// link, got "${url.slice(0,60)}".`);
    return undefined;
  }
  return url;
}

// 校验一条令牌引用（语法 + 可选的解析）。
// <lang zh-CN>语法错误与不可解析分码；无主题时只做语法校验（TDON-8.3）。</lang>
// <lang en>Syntax errors and unresolvable refs are distinct; without a theme only syntax is checked (TDON-8.3).</lang>
function wantToken(ctx:Ctx,v:unknown,path:string):string|undefined{
  const ref=wantString(ctx,v,path,120);
  if(ref===undefined)return undefined;
  if(!isTdonTokenSyntax(ref)){
    pushError(ctx,'E_TOKEN_SYNTAX',path,`令牌引用格式非法：「${ref}」。`,`Illegal token reference "${ref}".`);
    return undefined;
  }
  // 有主题时才真正解析；不可解析记 E_TOKEN_UNRESOLVED（结构合法但当前主题不满足）。
  // <lang zh-CN>带上节点的定位路径，便于 UI 直接高亮（TDON-5.7）。</lang>
  // <lang en>Carries the node path so the UI can highlight directly (TDON-5.7).</lang>
  if(ctx.theme){
    const r=resolveTdonToken(ctx.theme,ref);
    if(!r.ok){
      pushError(ctx,'E_TOKEN_UNRESOLVED',path,r.reasonZh,r.reasonEn);
      return undefined;
    }
  }
  return ref;
}

// ===== §3 target =====
// target 校验：id 为注册键（正则 + 与内置冲突在注册层判），name/nameEn 展示串，homepage 仅 http(s)。
// <lang zh-CN>targetVersion 只做长度校验，不求值（TDON-3.4）。</lang>
// <lang en>targetVersion is length-checked only, never evaluated (TDON-3.4).</lang>
function validateTarget(ctx:Ctx,raw:unknown,path:string){
  if(!isPlainObject(raw)){
    pushError(ctx,'E_REQUIRED',path,'缺少 target 目标元信息对象。','The target metadata object is required.');
    return undefined;
  }
  if(rejectDangerousKeys(ctx,raw,path))return undefined;
  checkKnownKeys(ctx,raw,path,['id','name','nameEn','author','homepage','targetVersion']);
  const id=requireString(ctx,raw.id,`${path}.id`,48);
  // id 形状：kebab-case，2–48 字符（TDON-3.1）。
  // <lang zh-CN>形状不符时不返回 id，避免非法键进入注册表。</lang>
  // <lang en>On a shape violation the id is not returned, keeping it out of the registry.</lang>
  if(id!==undefined&&!/^[a-z][a-z0-9-]{1,47}$/.test(id)){
    pushError(ctx,'E_PATTERN',`${path}.id`,`id 必须为 kebab-case（小写字母开头，可含数字与连字符，2–48 字符）。`,`id must be kebab-case (lowercase letter first, digits/hyphens allowed, 2–48 chars).`);
    return undefined;
  }
  const name=requireString(ctx,raw.name,`${path}.name`,80);
  // nameEn 缺省回退 name（TDON-3.2）。
  // <lang zh-CN>回退发生在校验层，保证下游拿到的 nameEn 恒非空。</lang>
  // <lang en>The fallback lives here so downstream always receives a non-empty nameEn.</lang>
  const nameEn=wantString(ctx,raw.nameEn,`${path}.nameEn`,80)??name??'';
  const author=wantString(ctx,raw.author,`${path}.author`,120);
  const homepage=wantString(ctx,raw.homepage,`${path}.homepage`,300);
  // homepage 协议白名单（TDON-3.3）：仅 http(s)，阻断 javascript:/file:/data: 等。
  // <lang zh-CN>失败时不保留该字段（避免下游误用）。</lang>
  // <lang en>On failure the field is dropped so downstream cannot misuse it.</lang>
  let safeHomepage:string|undefined;
  if(homepage!==undefined){
    if(/^https?:\/\//i.test(homepage))safeHomepage=homepage;
    else pushError(ctx,'E_PATTERN',`${path}.homepage`,'homepage 仅支持 http(s) 链接。','homepage must be an http(s) URL.');
  }
  const targetVersion=wantString(ctx,raw.targetVersion,`${path}.targetVersion`,40);
  if(id===undefined||name===undefined)return undefined;
  return{
    id,name,nameEn,
    ...(author!==undefined?{author}:{}),
    ...(safeHomepage!==undefined?{homepage:safeHomepage}:{}),
    ...(targetVersion!==undefined?{targetVersion}:{})
  };
}

// ===== §4 tokens =====
// tokens 校验：include 各组的形状 + alias 的命名与引用格式。
// <lang zh-CN>颜色角色名在无主题时也做语法级白名单（primary/secondary/third/auxN）。</lang>
// <lang en>Color roles are syntax-whitelisted even without a theme (primary/secondary/third/auxN).</lang>
function validateTokens(ctx:Ctx,raw:unknown,path:string):TdonTokens|undefined{
  if(!isPlainObject(raw))return undefined;
  if(rejectDangerousKeys(ctx,raw,path))return undefined;
  checkKnownKeys(ctx,raw,path,['include','alias','fontUrl']);
  let include:TdonTokens['include'];
  if(raw.include!==undefined){
    if(!isPlainObject(raw.include)){
      pushError(ctx,'E_TYPE',`${path}.include`,'include 应为对象。','include must be an object.');
    }else{
      const inc=raw.include;
      if(rejectDangerousKeys(ctx,inc,`${path}.include`))return undefined;
      checkKnownKeys(ctx,inc,`${path}.include`,['color','colorShades','gradient','typography','spacing']);
      // color 角色列表（TDON-4.2）：形状白名单 + 有主题时校验存在性。
      const color=wantArray(ctx,inc.color,`${path}.include.color`,1,12,(v,p)=>{
        const role=wantString(ctx,v,p,16);
        if(role===undefined)return undefined;
        if(!/^(primary|secondary|third|aux\d{1,2})$/.test(role)){
          pushError(ctx,'E_PATTERN',p,`颜色角色「${role}」不合法（primary/secondary/third/aux<N>）。`,`Illegal color role "${role}" (primary/secondary/third/aux<N>).`);
          return undefined;
        }
        // 有主题时检查角色是否真的存在（third 需三色模式，aux<N> 需在槽数内）。
        // <lang zh-CN>避免用户在单色模式里声明 third 却毫无反馈。</lang>
        // <lang en>Prevents declaring third under single mode with no feedback.</lang>
        if(ctx.theme&&!listTdonColorRoles(ctx.theme).includes(role)){
          pushError(ctx,'E_TOKEN_UNRESOLVED',p,`当前主题不含颜色角色「${role}」。`,`The current theme has no color role "${role}".`);
          return undefined;
        }
        return role;
      });
      // colorShades：'all' 或档位数组（TDON-4.3）。
      // <lang zh-CN>数值档位限 0–1000，字符串档位必须是 50–900 标准键。</lang>
      // <lang en>Numeric shades are 0–1000; string shades must be standard 50–900 keys.</lang>
      let colorShades:'all'|(string|number)[]|undefined;
      if(inc.colorShades==='all')colorShades='all';
      else if(inc.colorShades!==undefined){
        colorShades=wantArray(ctx,inc.colorShades,`${path}.include.colorShades`,1,11,(v,p)=>{
          if(typeof v==='number'){
            if(!Number.isInteger(v)||v<0||v>1000){
              pushError(ctx,'E_SHADE_RANGE',p,`色阶数值应为 0–1000 的整数，实际 ${v}。`,`Shade must be an integer 0–1000, got ${v}.`);
              return undefined;
            }
            return v;
          }
          const s=wantString(ctx,v,p,4);
          if(s===undefined)return undefined;
          if(!/^(50|100|200|300|400|500|600|700|800|900)$/.test(s)){
            pushError(ctx,'E_SHADE_RANGE',p,`色阶键「${s}」不合法（标准档为 50/100/…/900）。`,`Illegal shade key "${s}" (standard keys are 50/100/…/900).`);
            return undefined;
          }
          return s;
        });
      }
      const gradient=wantArray(ctx,inc.gradient,`${path}.include.gradient`,1,8,(v,p)=>{
        const g=wantString(ctx,v,p,24);
        if(g===undefined)return undefined;
        if(!/^[a-z][a-z0-9-]{0,23}$/.test(g)){
          pushError(ctx,'E_PATTERN',p,`渐变角色名「${g}」不合法。`,`Illegal gradient role "${g}".`);
          return undefined;
        }
        return g;
      });
      const typography=wantArray(ctx,inc.typography,`${path}.include.typography`,1,4,(v,p)=>{
        const s=wantString(ctx,v,p,24);
        if(s===undefined)return undefined;
        if(!/^(fontFamily|fontSizeScale|lineHeightBody)$/.test(s)){
          pushError(ctx,'E_PATTERN',p,`字体组「${s}」不合法（fontFamily/fontSizeScale/lineHeightBody）。`,`Illegal typography group "${s}" (fontFamily/fontSizeScale/lineHeightBody).`);
          return undefined;
        }
        return s;
      });
      // spacing 仅接受 'all'（规范 §4 表；细分档位无实际意义）。
      // <lang zh-CN>其他值按枚举错误处理。</lang>
      // <lang en>Other values are enum errors.</lang>
      const spacing=inc.spacing===undefined?undefined:wantEnum(ctx,inc.spacing,`${path}.include.spacing`,['all']as const);
      include={...(color?{color}:{}),...(colorShades?{colorShades}:{}),...(gradient?{gradient}:{}),...(typography?{typography}:{}),...(spacing?{spacing}:{})};
    }
  }
  // alias 映射（TDON-4.4）：变量名形状 + 引用格式 + 存在性。
  // <lang zh-CN>值必须为 <role>.<shade>（不接受 gradient/font 等形式——别名语义是"目标侧颜色变量"）。</lang>
  // <lang en>Values must be <role>.<shade>; gradient/font forms are rejected because an alias means a
  //   target-side color variable.</lang>
  let alias:Record<string,string>|undefined;
  if(raw.alias!==undefined){
    if(!isPlainObject(raw.alias)){
      pushError(ctx,'E_TYPE',`${path}.alias`,'alias 应为对象。','alias must be an object.');
    }else{
      const map=raw.alias;
      if(rejectDangerousKeys(ctx,map,`${path}.alias`))return undefined;
      const out:Record<string,string>={};
      for(const key of Object.keys(map)){
        const p=`${path}.alias.${key}`;
        if(!/^--[a-zA-Z0-9-]{1,60}$/.test(key)){
          pushError(ctx,'E_PATTERN',p,`变量名「${key}」不合法（应为 -- 开头的 CSS 自定义属性名）。`,`Illegal variable name "${key}" (must be a CSS custom property starting with --).`);
          continue;
        }
        const ref=wantString(ctx,map[key],p,120);
        if(ref===undefined)continue;
        if(!/^[a-z][a-z0-9]{0,15}\.[0-9]{1,4}$/.test(ref)){
          pushError(ctx,'E_TOKEN_SYNTAX',p,`别名值必须是 <role>.<shade> 形式，实际「${ref}」。`,`Alias value must be <role>.<shade>, got "${ref}".`);
          continue;
        }
        if(ctx.theme){
          const r=resolveTdonToken(ctx.theme,ref);
          if(!r.ok){
            pushError(ctx,'E_TOKEN_UNRESOLVED',p,r.reasonZh,r.reasonEn);
            continue;
          }
        }
        out[key]=ref;
      }
      alias=out;
    }
  }
  // fontUrl 为远程字体预留（TDON-4.6）：形状校验但**不消费**，并给出"暂未生效"的明确警告。
  // <lang zh-CN>先接受再警告而不是直接报错——保证作者可提前写，等字体加载落地后无需改文件。</lang>
  // <lang en>Accepted-then-warned rather than rejected, so authors can write ahead and need no file change later.</lang>
  let fontUrl:string|undefined;
  if(raw.fontUrl!==undefined){
    const u=wantString(ctx,raw.fontUrl,`${path}.fontUrl`,TDON_MAX_IMAGE_URL);
    if(u!==undefined){
      if(/^https:\/\/[^\s]+$/i.test(u)){
        fontUrl=u;
        pushWarning(ctx,'W_FONT_RESERVED',`${path}.fontUrl`,'远程字体为预留能力，当前不会加载（待 TDOT 定型）。','Remote fonts are reserved and not loaded yet (pending TDOT).');
      }else{
        pushError(ctx,'E_MEDIA_URL',`${path}.fontUrl`,`字体地址必须是 https:// 链接，实际「${u.slice(0,60)}」。`,`Font URL must be an https:// link, got "${u.slice(0,60)}".`);
      }
    }
  }
  if(include===undefined&&alias===undefined&&fontUrl===undefined)return undefined;
  return{...(include?{include}:{}),...(alias?{alias}:{}),...(fontUrl?{fontUrl}:{})};
}

// ===== §5 preview =====
// 节点通用字段：id / effect / children。
// <lang zh-CN>type 单独处理（枚举），此函数只校验三种通用可选字段并返回它们的值。</lang>
// <lang en>type is handled separately (enum); this checks the three shared optional fields and returns them.</lang>
function validateNodeCommon(ctx:Ctx,raw:Record<string,unknown>,path:string){
  const id=wantString(ctx,raw.id,`${path}.id`,48);
  const effect=wantString(ctx,raw.effect,`${path}.effect`,32);
  // effect 形状与 id 规则一致；存在性在 effects 通过后再判（此处只校验形状）。
  // <lang zh-CN>存在性检查放在 §9 之后统一做，避免前向引用误报。</lang>
  // <lang en>Existence is checked after §9 to avoid false positives on forward references.</lang>
  if(effect!==undefined&&!/^[a-z][a-z0-9-]{0,31}$/.test(effect)){
    pushError(ctx,'E_PATTERN',`${path}.effect`,`effect id「${effect}」不合法（kebab-case，≤32）。`,`Illegal effect id "${effect}" (kebab-case, ≤32).`);
  }
  return{...(id!==undefined?{id}:{}),...(effect!==undefined?{effect}:{})};
}

// 单节点校验：按 type 走对应属性表，其余键报 E_NODE_ATTR（TDON-5.8）。
// <lang zh-CN>children 递归最多两层、总量 ≤200（TDON-5.2）。</lang>
// <lang en>children recurse at most two levels with ≤200 nodes total (TDON-5.2).</lang>
function validateNode(ctx:Ctx,raw:unknown,path:string,depth:number):TdonNode|undefined{
  if(!isPlainObject(raw)){
    pushError(ctx,'E_TYPE',path,'节点应为对象。','A node must be an object.');
    return undefined;
  }
  if(rejectDangerousKeys(ctx,raw,path))return undefined;
  // 计数：每个节点计入总量，超限即停止深入（防止构造的超大文件耗时）。
  // <lang zh-CN>先增后判，保证计数含当前节点。</lang>
  // <lang en>Increment first, so the current node is counted.</lang>
  ctx.nodeCount++;
  // 两级阈值（TDON-5.2）：越过软阈值只提示一次，越过硬阈值才阻断。
  // <lang zh-CN>软阈值一次性提醒，避免上千节点逐条刷满问题列表。</lang>
  // <lang en>The soft cap warns once so a thousand nodes cannot flood the issue list.</lang>
  if(!ctx.warnedTotal&&ctx.nodeCount>TDON_WARN_NODES_TOTAL){
    ctx.warnedTotal=true;
    pushWarning(ctx,'W_NODE_LIMIT',path,`节点总数已超过 ${TDON_WARN_NODES_TOTAL}（硬上限 ${TDON_MAX_NODES_TOTAL}），预览渲染可能变慢。`,`Total node count exceeds ${TDON_WARN_NODES_TOTAL} (hard cap ${TDON_MAX_NODES_TOTAL}); preview rendering may slow down.`);
  }
  if(ctx.nodeCount>TDON_MAX_NODES_TOTAL){
    pushError(ctx,'E_LIMIT',path,`节点总数超过 ${TDON_MAX_NODES_TOTAL}。`,`Total node count exceeds ${TDON_MAX_NODES_TOTAL}.`);
    return undefined;
  }
  const type=wantEnum(ctx,raw.type,`${path}.type`,TDON_NODE_TYPES);
  if(type===undefined)return undefined;
  // 属性表：每类节点的合法键集合 + 逐字段校验。
  // <lang zh-CN>用一张表集中表达规范 §5.2，避免 9 个分支各写一遍键白名单。</lang>
  // <lang en>One table encodes spec §5.2, avoiding nine copies of key whitelists.</lang>
  const spec=NODE_SPECS[type]!;
  const common=validateNodeCommon(ctx,raw,path);
  const attrs:Record<string,unknown>={};
  const allowed=['type',...spec.keys,...Object.keys(common),...(depth<TDON_MAX_NESTING-1?['children']:[])];
  // 未知属性：逐个报错（含允许列表），便于用户对照规范修订。
  // <lang zh-CN>深度已满时 children 也不再合法，会以未知键形式报出。</lang>
  // <lang en>At max depth, children stops being legal and surfaces as an unknown key.</lang>
  checkKnownKeys(ctx,raw,path,allowed);
  // 逐字段执行该类型的校验器。
  // <lang zh-CN>校验器返回 undefined 表示非法或缺失，不写入 attrs。</lang>
  // <lang en>A validator returning undefined means invalid or absent; nothing is written to attrs.</lang>
  for(const key of spec.keys){
    const value=spec.validate(ctx,raw[key],`${path}.${key}`,key);
    if(value!==undefined)attrs[key]=value;
  }
  // children：仅在未达深度上限时解析（第二层后拒绝）。
  // <lang zh-CN>子节点同样计入 nodeCount，实现总量约束。</lang>
  // <lang en>Children also count toward nodeCount, enforcing the total cap.</lang>
  if(depth<TDON_MAX_NESTING-1&&raw.children!==undefined){
    const kids=wantArray(ctx,raw.children,`${path}.children`,1,12,(v,p)=>validateNode(ctx,v,p,depth+1));
    if(kids!==undefined)attrs.children=kids;
  }
  return{type,...common,attrs};
}

// 预览声明校验：title/layout/nodes 三键。
// <lang zh-CN>nodes 顶层 1–80（TDON-5.2），layout 缺省 stack（TDON-5.1）。</lang>
// <lang en>Top-level nodes 1–80 (TDON-5.2); layout defaults to stack (TDON-5.1).</lang>
function validatePreview(ctx:Ctx,raw:unknown,path:string){
  if(!isPlainObject(raw)){
    pushError(ctx,'E_TYPE',path,'preview 应为对象。','preview must be an object.');
    return undefined;
  }
  if(rejectDangerousKeys(ctx,raw,path))return undefined;
  checkKnownKeys(ctx,raw,path,['title','layout','nodes']);
  const title=wantString(ctx,raw.title,`${path}.title`,80);
  const layout=wantEnum<TdonPreviewLayout>(ctx,raw.layout,`${path}.layout`,['stack','sidebar-left','sidebar-right','hero'] as const)??'stack';
  // 软阈值提示（TDON-5.2）：大于 100 个顶层节点通常是"该拆页面"的信号，但不阻断。
  // <lang zh-CN>硬上限仍为 300，防止构造的空壳节点树拖死渲染。</lang>
  // <lang en>The hard cap stays at 300 so a constructed shell tree cannot stall rendering.</lang>
  if(Array.isArray(raw.nodes)&&raw.nodes.length>TDON_WARN_PREVIEW_NODES&&raw.nodes.length<=TDON_MAX_PREVIEW_NODES){
    pushWarning(ctx,'W_NODE_LIMIT',`${path}.nodes`,`顶层节点 ${raw.nodes.length} 个，超过建议值 ${TDON_WARN_PREVIEW_NODES}。`,`${raw.nodes.length} top-level nodes exceed the suggested ${TDON_WARN_PREVIEW_NODES}.`);
  }
  const nodes=wantArray(ctx,raw.nodes,`${path}.nodes`,1,TDON_MAX_PREVIEW_NODES,(v,p)=>validateNode(ctx,v,p,0));
  if(nodes===undefined){
    pushError(ctx,'E_REQUIRED',`${path}.nodes`,'preview.nodes 必填。','preview.nodes is required.');
    return undefined;
  }
  return{...(title!==undefined?{title}:{}),layout,nodes};
}

// ===== §6 exportManifest =====
// 单文件校验：path 相对性 + template/templateRef 二选一 + 插值语法。
// <lang zh-CN>template 与 templateRef 互斥（TDON-6.1），都不给也要报错。</lang>
// <lang en>template and templateRef are mutually exclusive (TDON-6.1); providing neither is also an error.</lang>
function validateExportFile(ctx:Ctx,raw:unknown,path:string):TdonExportFile|undefined{
  if(!isPlainObject(raw)){
    pushError(ctx,'E_TYPE',path,'导出文件条目应为对象。','An export file entry must be an object.');
    return undefined;
  }
  if(rejectDangerousKeys(ctx,raw,path))return undefined;
  checkKnownKeys(ctx,raw,path,['path','template','templateRef']);
  const p=wantString(ctx,raw.path,`${path}.path`,TDON_MAX_PATH_LENGTH);
  // 路径安全（TDON-6.2/11.1）：失败即丢弃条目，避免非法路径进入打包环节。
  // <lang zh-CN>校验在渲染与打包两侧都会再跑一遍（不信任单点校验）。</lang>
  // <lang en>Re-validated on both render and packaging paths — a single check is not trusted.</lang>
  if(p===undefined)return undefined;
  const pc=checkTdonPath(p);
  if(!pc.ok){
    pushError(ctx,'E_BAD_PATH',`${path}.path`,pc.reasonZh??'路径非法。',pc.reasonEn??'Illegal path.');
    return undefined;
  }
  // 单模板超长单独判定（TDON-6.3）：若交给 wantString 过滤，template 会被丢弃，
  //   下游随即误报"两者都缺"，把"超长"错报成"未提供"。
  // <lang zh-CN>因此先按原始值判定并提前返回，保证错误码指向真实原因。</lang>
  // <lang en>Checked on the raw value and returned early, so the code points at the real cause.</lang>
  if(typeof raw.template==='string'&&raw.template.length>TDON_MAX_TEMPLATE_BYTES){
    pushError(ctx,'E_TOO_LARGE',`${path}.template`,`模板长度 ${raw.template.length} 字符，超过单文件硬上限 ${TDON_MAX_TEMPLATE_BYTES}。`,`Template length ${raw.template.length} characters, over the per-file hard cap ${TDON_MAX_TEMPLATE_BYTES}.`);
    return undefined;
  }
  // 软阈值（TDON-6.3）：超过 256 KB 提示但放行——大模板是合法的，只是要留意体积。
  // <lang zh-CN>硬上限 512 KB，远高于真实需求。</lang>
  // <lang en>The hard cap is 512 KB, far above real needs.</lang>
  if(typeof raw.template==='string'&&raw.template.length>TDON_WARN_TEMPLATE_BYTES){
    pushWarning(ctx,'W_TEMPLATE_SIZE',`${path}.template`,`模板长度 ${raw.template.length} 字符，超过建议值 ${TDON_WARN_TEMPLATE_BYTES}。`,`Template length ${raw.template.length} characters exceeds the suggested ${TDON_WARN_TEMPLATE_BYTES}.`);
  }
  const tpl=wantString(ctx,raw.template,`${path}.template`,TDON_MAX_TEMPLATE_BYTES);
  const ref=wantString(ctx,raw.templateRef,`${path}.templateRef`,60);
  // 互斥与必填：两者都缺或都给都算错误。
  // <lang zh-CN>分别给出 E_REQUIRED / E_CONFLICT，便于 UI 精确提示。</lang>
  // <lang en>Distinct E_REQUIRED / E_CONFLICT codes let the UI be precise.</lang>
  if(tpl===undefined&&ref===undefined){
    pushError(ctx,'E_REQUIRED',path,'每个导出文件必须提供 template 或 templateRef 之一。','Each export file must provide either template or templateRef.');
    return undefined;
  }
  if(tpl!==undefined&&ref!==undefined){
    pushError(ctx,'E_CONFLICT',path,'template 与 templateRef 不能同时提供。','template and templateRef cannot both be provided.');
    return undefined;
  }
  // templateRef 白名单（TDON-6.5）：仅 builtin: 两个固定模板。
  // <lang zh-CN>不接受任意内置名，避免未来新增模板悄悄扩大能力面。</lang>
  // <lang en>No arbitrary builtin names, so future templates cannot silently widen the surface.</lang>
  let templateRef:string|undefined;
  if(ref!==undefined){
    if(!/^builtin:(hia-tokens-css|hia-tokens-json)$/.test(ref)){
      pushError(ctx,'E_TEMPLATE_REF',`${path}.templateRef`,`templateRef「${ref}」不在白名单（builtin:hia-tokens-css / builtin:hia-tokens-json）。`,`templateRef "${ref}" is not whitelisted (builtin:hia-tokens-css / builtin:hia-tokens-json).`);
      return undefined;
    }
    templateRef=ref;
  }
  // 插值语法预检（TDON-6.4）：只允许 token:/meta: 两个命名空间。
  // <lang zh-CN>此处只查命名空间与前缀形状，令牌是否可解析由主题侧在导出时再判。</lang>
  // <lang en>Only the namespace and prefix shape are checked here; resolvability is judged at export time.</lang>
  if(tpl!==undefined){
    const bad=findBadInterpolation(tpl);
    if(bad!==null){
      pushError(ctx,'E_INTERP',`${path}.template`,`插值语法非法：「${bad}」；仅支持 {{token:<ref>}} 与 {{meta:name|id}}。`,`Illegal interpolation "${bad}"; only {{token:<ref>}} and {{meta:name|id}} are supported.`);
      return undefined;
    }
  }
  return{path:p,...(tpl!==undefined?{template:tpl}:{}),...(templateRef?{templateRef}:{})};
}

// 在文本中查找第一个非法插值片段；全部合法返回 null。
// <lang zh-CN>用非贪婪全局匹配找出全部 {{…}}，逐个比对白名单形式。</lang>
// <lang en>Non-greedy global match finds every {{…}}, each compared against the whitelist forms.</lang>
function findBadInterpolation(text:string):string|null{
  const re=/\{\{([^{}]{0,200})\}\}/g;
  let m:RegExpExecArray|null;
  while((m=re.exec(text))!==null){
    const body=m[1]!;
    if(/^token:.+$/.test(body)&&isTdonTokenSyntax(body.slice(6)))continue;
    if(/^meta:(name|id)$/.test(body))continue;
    return m[0];
  }
  return null;
}

// 导出清单校验：files 1–32 + package.rootDir。
// <lang zh-CN>合计大小上限 512 KB（TDON-6.3）按 template 文本长度累加判定。</lang>
// <lang en>The 512 KB total (TDON-6.3) sums template text lengths.</lang>
function validateExportManifest(ctx:Ctx,raw:unknown,path:string){
  if(!isPlainObject(raw)){
    pushError(ctx,'E_REQUIRED',path,'缺少 exportManifest 导出清单对象。','The exportManifest object is required.');
    return undefined;
  }
  if(rejectDangerousKeys(ctx,raw,path))return undefined;
  checkKnownKeys(ctx,raw,path,['files','package']);
  // 软阈值（TDON-6.1）：超过 32 个文件提示（通常意味着该拆成多个 TDON）。
  // <lang zh-CN>硬上限 64。</lang>
  // <lang en>Hard cap 64.</lang>
  if(Array.isArray(raw.files)&&raw.files.length>TDON_WARN_FILE_COUNT&&raw.files.length<=TDON_MAX_FILE_COUNT){
    pushWarning(ctx,'W_FILE_COUNT',`${path}.files`,`导出文件 ${raw.files.length} 个，超过建议值 ${TDON_WARN_FILE_COUNT}。`,`${raw.files.length} export files exceed the suggested ${TDON_WARN_FILE_COUNT}.`);
  }
  const files=wantArray(ctx,raw.files,`${path}.files`,1,TDON_MAX_FILE_COUNT,(v,p)=>validateExportFile(ctx,v,p));
  if(files===undefined){
    pushError(ctx,'E_REQUIRED',`${path}.files`,'exportManifest.files 必填（至少 1 个文件）。','exportManifest.files is required (at least one file).');
    return undefined;
  }
  // 合计大小：所有 template 的字符数之和（UTF-16 长度，按"不超过"语义已足够保守）。
  // <lang zh-CN>超限只报一次，指出实际总量。</lang>
  // <lang en>Reported once with the actual total.</lang>
  const total=files.reduce((sum,f)=>sum+(f.template?.length??0),0);
  // 合计两级阈值（TDON-6.3）：软告警、硬阻断。
  // <lang zh-CN>软阈值 512 KB 与文件软阈值同量级，硬阈值 2 MB。</lang>
  // <lang en>Soft cap 512 KB matches the file soft cap order; hard cap 2 MB.</lang>
  if(total>TDON_MAX_TEMPLATE_TOTAL)pushError(ctx,'E_TOO_LARGE',`${path}.files`,`导出模板合计 ${total} 字符，超过硬上限 ${TDON_MAX_TEMPLATE_TOTAL}。`,`Export templates total ${total} characters, over the hard cap ${TDON_MAX_TEMPLATE_TOTAL}.`);
  else if(total>TDON_WARN_TEMPLATE_TOTAL)pushWarning(ctx,'W_TEMPLATE_SIZE',`${path}.files`,`导出模板合计 ${total} 字符，超过建议值 ${TDON_WARN_TEMPLATE_TOTAL}。`,`Export templates total ${total} characters exceeds the suggested ${TDON_WARN_TEMPLATE_TOTAL}.`);
  let pkg:{rootDir?:string}|undefined;
  if(raw.package!==undefined){
    if(!isPlainObject(raw.package)){
      pushError(ctx,'E_TYPE',`${path}.package`,'package 应为对象。','package must be an object.');
    }else{
      const p=raw.package;
      if(rejectDangerousKeys(ctx,p,`${path}.package`))return undefined;
      checkKnownKeys(ctx,p,`${path}.package`,['rootDir']);
      const rootDir=wantString(ctx,p.rootDir,`${path}.package.rootDir`,TDON_MAX_PATH_LENGTH);
      // rootDir 与文件路径同规则（TDON-6.6），但允许以 `/` 结尾表示目录。
      // <lang zh-CN>去掉末尾斜杠后复检，避免 `docs/` 被判成空段。</lang>
      // <lang en>Trailing slash is stripped before re-checking, so `docs/` is not read as an empty segment.</lang>
      if(rootDir!==undefined){
        const normalized=rootDir.endsWith('/')?rootDir.slice(0,-1):rootDir;
        const rc=checkTdonPath(normalized);
        if(!rc.ok)pushError(ctx,'E_BAD_PATH',`${path}.package.rootDir`,rc.reasonZh??'路径非法。',rc.reasonEn??'Illegal path.');
        else pkg={rootDir};
      }
    }
  }
  return{files,...(pkg?{package:pkg}:{})};
}

// ===== §7 constraints =====
// 约束校验：requiredTokens 必须可解析（TDON-7.3），对比度规则记录后交主题侧断言。
// <lang zh-CN>min 区间 1–21（TDON-7.2）；strict 缺省 false。</lang>
// <lang en>min is 1–21 (TDON-7.2); strict defaults to false.</lang>
function validateConstraints(ctx:Ctx,raw:unknown,path:string){
  if(!isPlainObject(raw)){
    pushError(ctx,'E_TYPE',path,'constraints 应为对象。','constraints must be an object.');
    return undefined;
  }
  if(rejectDangerousKeys(ctx,raw,path))return undefined;
  checkKnownKeys(ctx,raw,path,['requiredTokens','minShade','maxShade','requireContrast','strict']);
  const requiredTokens=wantArray(ctx,raw.requiredTokens,`${path}.requiredTokens`,1,64,(v,p)=>{
    const ref=wantString(ctx,v,p,120);
    if(ref===undefined)return undefined;
    if(!isTdonTokenSyntax(ref)){
      pushError(ctx,'E_TOKEN_SYNTAX',p,`令牌引用格式非法：「${ref}」。`,`Illegal token reference "${ref}".`);
      return undefined;
    }
    // 声明了不存在的令牌属文档缺陷，即使 strict:false 也算错误（TDON-7.3）。
    // <lang zh-CN>与节点引用的 E_TOKEN_UNRESOLVED 同码，但语义更严格。</lang>
    // <lang en>Same code as node references but a stricter semantic.</lang>
    if(ctx.theme){
      const r=resolveTdonToken(ctx.theme,ref);
      if(!r.ok){pushError(ctx,'E_TOKEN_UNRESOLVED',p,r.reasonZh,r.reasonEn);return undefined;}
    }
    return ref;
  });
  const minShade=wantNumber(ctx,raw.minShade,`${path}.minShade`,{min:0,max:1000,int:true});
  const maxShade=wantNumber(ctx,raw.maxShade,`${path}.maxShade`,{min:0,max:1000,int:true});
  // 区间倒置无法表达任何合法意图，直接报错。
  // <lang zh-CN>两者都给出时才判定，缺一不判。</lang>
  // <lang en>Only compared when both are present.</lang>
  if(minShade!==undefined&&maxShade!==undefined&&minShade>maxShade){
    pushError(ctx,'E_RANGE',path,`minShade(${minShade}) 不能大于 maxShade(${maxShade})。`,`minShade (${minShade}) must not exceed maxShade (${maxShade}).`);
  }
  const requireContrast=wantArray(ctx,raw.requireContrast,`${path}.requireContrast`,1,16,(v,p):TdonContrastRule|undefined=>{
    if(!isPlainObject(v)){
      pushError(ctx,'E_TYPE',p,'对比度规则应为对象。','A contrast rule must be an object.');
      return undefined;
    }
    if(rejectDangerousKeys(ctx,v,p))return undefined;
    checkKnownKeys(ctx,v,p,['fg','bg','min']);
    const fg=wantString(ctx,v.fg,p+'.fg',120);
    const bg=wantString(ctx,v.bg,p+'.bg',120);
    // 对比度规则的 fg/bg 必须是颜色引用（不接受 gradient/font 等形式）。
    // <lang zh-CN>语义上只有颜色才能算对比度。</lang>
    // <lang en>Only colors have a contrast ratio.</lang>
    if(fg!==undefined&&!/^[a-z][a-z0-9]{0,15}\.[0-9]{1,4}$/.test(fg))pushError(ctx,'E_TOKEN_SYNTAX',p+'.fg',`fg 必须是 <role>.<shade>，实际「${fg}」。`,`fg must be <role>.<shade>, got "${fg}".`);
    if(bg!==undefined&&!/^[a-z][a-z0-9]{0,15}\.[0-9]{1,4}$/.test(bg))pushError(ctx,'E_TOKEN_SYNTAX',p+'.bg',`bg 必须是 <role>.<shade>，实际「${bg}」。`,`bg must be <role>.<shade>, got "${bg}".`);
    const min=wantNumber(ctx,v.min,p+'.min',{min:1,max:21});
    if(fg===undefined||bg===undefined||min===undefined)return undefined;
    return{fg,bg,min};
  });
  const strict=raw.strict===undefined?false:raw.strict===true;
  if(raw.strict!==undefined&&typeof raw.strict!=='boolean')pushError(ctx,'E_TYPE',`${path}.strict`,'strict 应为布尔值。','strict must be a boolean.');
  const out={
    ...(requiredTokens?{requiredTokens}:{}),
    ...(minShade!==undefined?{minShade}:{}),
    ...(maxShade!==undefined?{maxShade}:{}),
    ...(requireContrast?{requireContrast}:{}),
    strict
  };
  return out;
}

// ===== §14 TDOT 预留 =====
// 接受并保留 template 段（TDON-14.1/14.2）：不校验内容语义，只保证是干净对象树。
// <lang zh-CN>返回原样浅拷贝的顶层字段（不深拷贝不重排），未来 TDOT 运行时按 specVersion 自行解释。
//   specVersion 若存在只做类型与长度检查，不做版本匹配——TDOT 规范尚未发布。</lang>
// <lang en>Returns the top-level fields as-is (no deep copy, no reordering); a future TDOT runtime interprets
//   them by specVersion. If present, specVersion is only type/length checked — the TDOT spec is unpublished.</lang>
function validateTemplateReserved(ctx:Ctx,raw:unknown,path:string):TdonTemplateReserved|undefined{
  if(raw===undefined)return undefined;
  if(!isPlainObject(raw)){
    pushError(ctx,'E_TYPE',path,'template 应为对象（TDOT 预留段）。','template must be an object (reserved for TDOT).');
    return undefined;
  }
  if(rejectDangerousKeys(ctx,raw,path))return undefined;
  // 原样保留：逐键复制（不展开、不解释），保留顺序便于未来 diff。
  // <lang zh-CN>用 Object.keys 显式复制而非展开运算符——展开会带上原型链上的可枚举属性。</lang>
  // <lang en>Explicit key copy, not spread: spreading would also carry enumerable prototype properties.</lang>
  const out:TdonTemplateReserved={};
  for(const key of Object.keys(raw))out[key]=raw[key];
  const sv=raw.specVersion;
  if(sv!==undefined&&(typeof sv!=='string'||sv.length>32)){
    pushError(ctx,'E_TYPE',`${path}.specVersion`,'template.specVersion 应为 ≤32 字符的字符串。','template.specVersion must be a string of at most 32 characters.');
  }
  // TDOT 求值触发判定（ADR-011 §5 方案 B）：只有 specVersion 等于当前 TDOT 版本才求值。
  //   - 等于 `tdot-0.1` → 求值（模板语法/类型错误在求值期报 E_TDOT_*）。
  //   - 以 `tdot-` 开头但版本不同 → E_TDOT_VERSION（显式声明了 TDOT 却版本不符，属文档缺陷）。
  //   - 其它（缺 specVersion、非 tdot 前缀）→ 继续忽略 + 保留 W_TDOT_RESERVED（向后兼容存量占位内容）。
  // <lang en>TDOT trigger (ADR-011 §5 option B): evaluate only when specVersion equals the current TDOT version.
  //   A different `tdot-*` version is E_TDOT_VERSION; anything else stays ignored with W_TDOT_RESERVED.</lang>
  if(typeof sv==='string'&&sv.startsWith('tdot-')){
    if(sv!==TDOT_SPEC_VERSION){
      pushError(ctx,'E_TDOT_VERSION',`${path}.specVersion`,`不支持的 TDOT 版本「${sv}」，当前支持 ${TDOT_SPEC_VERSION}。`,`Unsupported TDOT version "${sv}"; this build supports ${TDOT_SPEC_VERSION}.`);
      return out;
    }
    // 版本匹配：只校验 `body` 的**形状**（字符串 + 长度上限），语法错误留给求值期（那里能给出精确位置）。
    // <lang zh-CN>body 缺省合法：仅有 data 的模板可交付给宿主提供源串（ADR-011 §5.1）。</lang>
    // <lang en>An absent body is legal: a data-only template may receive its source from the host (ADR-011 §5.1).</lang>
    if(raw.body!==undefined){
      if(typeof raw.body!=='string'){
        pushError(ctx,'E_TYPE',`${path}.body`,'template.body 应为字符串（TDOT 源串）。','template.body must be a string (TDOT source).');
      }else if(raw.body.length>TDOT_MAX_BODY_LENGTH){
        pushError(ctx,'E_LIMIT',`${path}.body`,`template.body 长度 ${raw.body.length} 超过 ${TDOT_MAX_BODY_LENGTH} 上限。`,`template.body length ${raw.body.length} exceeds the ${TDOT_MAX_BODY_LENGTH} cap.`);
      }
    }
    // `data` 若提供必须是对象（模板按路径访问）。
    // <lang zh-CN>数组/标量无法按路径取值，属文档缺陷。</lang>
    // <lang en>Arrays/scalars cannot be path-addressed, so they are document defects.</lang>
    if(raw.data!==undefined&&!isPlainObject(raw.data)){
      pushError(ctx,'E_TYPE',`${path}.data`,'template.data 应为对象。','template.data must be an object.');
    }
    return out;
  }
  pushWarning(ctx,'W_TDOT_RESERVED',path,'template 段未声明 `tdot-*` 版本，按占位内容忽略（不产生导出效果）。','The template block declares no `tdot-*` version and is ignored as a placeholder.');
  return out;
}

// ===== §9 effects =====
// 特效校验：仅三种类型 + 参数区间（TDON-9.1/9.2）。
// <lang zh-CN>效果 id 形状 `^[a-z][a-z0-9-]{0,31}$`，最多 12 个（TDON-9.4）。</lang>
// <lang en>Effect ids match `^[a-z][a-z0-9-]{0,31}$`, at most 12 (TDON-9.4).</lang>
function validateEffects(ctx:Ctx,raw:unknown,path:string):Record<string,TdonEffect>|undefined{
  if(!isPlainObject(raw)){
    pushError(ctx,'E_TYPE',path,'effects 应为对象。','effects must be an object.');
    return undefined;
  }
  if(rejectDangerousKeys(ctx,raw,path))return undefined;
  const keys=Object.keys(raw);
  if(keys.length>12)pushError(ctx,'E_LIMIT',path,`特效数量 ${keys.length} 超过上限 12。`,`Effect count ${keys.length} exceeds the 12 limit.`);
  const out:Record<string,TdonEffect>={};
  for(const id of keys){
    const p=`${path}.${id}`;
    // 幂等边界：id 直接作为 CSS 类名后缀，形状必须受限。
    // <lang zh-CN>形状非法时不写入结果，避免污染类名。</lang>
    // <lang en>An illegal shape is dropped so it cannot pollute class names.</lang>
    if(!/^[a-z][a-z0-9-]{0,31}$/.test(id)){
      pushError(ctx,'E_PATTERN',p,`特效 id「${id}」不合法（kebab-case，≤32）。`,`Illegal effect id "${id}" (kebab-case, ≤32).`);
      continue;
    }
    const v=raw[id];
    if(!isPlainObject(v)){
      pushError(ctx,'E_TYPE',p,'特效定义应为对象。','An effect definition must be an object.');
      continue;
    }
    if(rejectDangerousKeys(ctx,v,p))continue;
    const type=wantEnum(ctx,v.type,p+'.type',['gradient-shift','fade-in','hover-lift'] as const);
    if(type===undefined)continue;
    if(type==='gradient-shift'){
      // 无参效果：多余参数一律报错（防止用户误以为能调）。
      // <lang zh-CN>允许 type 之外的键即视为参数错误。</lang>
      // <lang en>Any key beyond type is a parameter error.</lang>
      checkKnownKeys(ctx,v,p,['type']);
      out[id]={type:'gradient-shift'};
      continue;
    }
    if(type==='fade-in'){
      checkKnownKeys(ctx,v,p,['type','duration']);
      // duration 100–2000，步长 50（TDON-9.2 表）。
      // <lang zh-CN>步长用取模判定，非 50 倍数报参数区间错误。</lang>
      // <lang en>Step is a modulo check; a non-multiple reports a range error.</lang>
      const duration=wantNumber(ctx,v.duration,p+'.duration',{min:100,max:2000,int:true});
      if(duration===undefined){
        pushError(ctx,'E_REQUIRED',p+'.duration','fade-in 需要 duration（100–2000ms）。','fade-in requires duration (100–2000ms).');
        continue;
      }
      if(duration%50!==0){
        pushError(ctx,'E_EFFECT_RANGE',p+'.duration',`duration 应为 50 的倍数，实际 ${duration}。`,`duration must be a multiple of 50, got ${duration}.`);
        continue;
      }
      out[id]={type:'fade-in',duration};
      continue;
    }
    // hover-lift：distance 1–8 整数。
    // <lang zh-CN>上移距离过大在密集布局中会造成重叠，故上限取 8。</lang>
    // <lang en>Capped at 8px because larger lifts overlap adjacent content in dense layouts.</lang>
    checkKnownKeys(ctx,v,p,['type','distance']);
    const distance=wantNumber(ctx,v.distance,p+'.distance',{min:1,max:8,int:true});
    if(distance===undefined){
      pushError(ctx,'E_REQUIRED',p+'.distance','hover-lift 需要 distance（1–8 整数）。','hover-lift requires distance (integer 1–8).');
      continue;
    }
    out[id]={type:'hover-lift',distance};
  }
  return out;
}

// ===== 节点属性表 =====
// 每类节点的合法属性键 + 逐字段校验器（集中表达规范 §5.2）。
// <lang zh-CN>validate 返回 undefined 表示该字段缺失或非法，不写入 attrs。</lang>
// <lang en>A validate returning undefined means absent or invalid; nothing is written to attrs.</lang>
interface NodeSpec{keys:readonly string[];validate:(ctx:Ctx,v:unknown,path:string,key:string)=>unknown;}
// 通用校验器工厂：把"可选字符串/令牌/数组"收敛成一行声明。
// <lang zh-CN>键集合直接从校验器表推导，避免与 allowed 列表两处维护。</lang>
// <lang en>The key set derives from the validator map, avoiding a second list to maintain.</lang>
function optString(maxLen:number){return(ctx:Ctx,v:unknown,p:string)=>wantString(ctx,v,p,maxLen);}
function reqString(maxLen:number){return(ctx:Ctx,v:unknown,p:string)=>requireString(ctx,v,p,maxLen);}
function optToken(){return(ctx:Ctx,v:unknown,p:string)=>wantToken(ctx,v,p);}
// 字符串数组工厂（元素长度受限，数量区间固定）。
// <lang zh-CN>用于 nav.items / list.items 这类纯文本列表。</lang>
// <lang en>Used for plain-text lists such as nav.items / list.items.</lang>
function stringList(min:number,max:number,maxLen:number){return(ctx:Ctx,v:unknown,p:string)=>wantArray(ctx,v,p,min,max,(raw,ip)=>{
  const s=wantString(ctx,raw,ip,maxLen);
  return s===undefined?undefined:s;
});}

const NODE_SPECS:Record<TdonNodeType,NodeSpec>={
  // hero：主视觉区块，title 必填；actions ≤3。
  // <lang zh-CN>bgToken 通常指向 gradient:*，但允许任何合法令牌引用。</lang>
  // <lang en>bgToken usually targets gradient:*, but any legal token ref is accepted.</lang>
  hero:{
    keys:['title','subtitle','bgToken','actions','imageUrl'],
    validate:(ctx,v,p,key)=>{
      switch(key){
        case 'title':return reqString(120)(ctx,v,p);
        case 'subtitle':return optString(200)(ctx,v,p);
        case 'bgToken':return optToken()(ctx,v,p);
        case 'imageUrl':return wantImageUrl(ctx,v,p);
        case 'actions':return wantArray(ctx,v,p,1,3,(raw,ip)=>{
          if(!isPlainObject(raw)){pushError(ctx,'E_TYPE',ip,'动作项应为对象。','An action must be an object.');return undefined;}
          if(rejectDangerousKeys(ctx,raw,ip))return undefined;
          checkKnownKeys(ctx,raw,ip,['label','token']);
          const label=requireString(ctx,raw.label,ip+'.label',40);
          const token=wantToken(ctx,raw.token,ip+'.token');
          if(label===undefined)return undefined;
          return{label,...(token?{token}:{})};
        });
        default:return undefined;
      }
    }
  },
  // nav：导航条，items 支持纯字符串或 {label, active}。
  // <lang zh-CN>active 只作视觉标记，不触发跳转。</lang>
  // <lang en>active is purely visual and never navigates.</lang>
  nav:{
    keys:['items','bgToken','activeToken'],
    validate:(ctx,v,p,key)=>{
      switch(key){
        case 'items':return wantArray(ctx,v,p,1,8,(raw,ip)=>{
          if(typeof raw==='string'){
            const s=wantString(ctx,raw,ip,40);
            return s===undefined?undefined:{label:s};
          }
          if(!isPlainObject(raw)){pushError(ctx,'E_TYPE',ip,'导航项应为字符串或 {label, active}。','A nav item must be a string or {label, active}.');return undefined;}
          if(rejectDangerousKeys(ctx,raw,ip))return undefined;
          checkKnownKeys(ctx,raw,ip,['label','active']);
          const label=requireString(ctx,raw.label,ip+'.label',40);
          if(label===undefined)return undefined;
          return{label,active:raw.active===true};
        });
        case 'bgToken':return optToken()(ctx,v,p);
        case 'activeToken':return optToken()(ctx,v,p);
        default:return undefined;
      }
    }
  },
  // card：内容卡，title 必填，text ≤400。
  // <lang zh-CN>文本与标题令牌分离，允许卡内对比度不同的组合。</lang>
  // <lang en>Separate title/text tokens allow different intra-card contrast pairs.</lang>
  card:{
    keys:['title','text','bgToken','titleToken','textToken','imageUrl'],
    validate:(ctx,v,p,key)=>{
      switch(key){
        case 'title':return reqString(120)(ctx,v,p);
        case 'text':return optString(400)(ctx,v,p);
        case 'bgToken':return optToken()(ctx,v,p);
        case 'titleToken':return optToken()(ctx,v,p);
        case 'textToken':return optToken()(ctx,v,p);
        case 'imageUrl':return wantImageUrl(ctx,v,p);
        default:return undefined;
      }
    }
  },
  // stats：指标组，items 1–6。
  // <lang zh-CN>value 为静态演示数字（不做数值计算）。</lang>
  // <lang en>value is a static demo figure; no numeric computation happens.</lang>
  stats:{
    keys:['items','labelToken','valueToken'],
    validate:(ctx,v,p,key)=>{
      switch(key){
        case 'items':return wantArray(ctx,v,p,1,6,(raw,ip)=>{
          if(!isPlainObject(raw)){pushError(ctx,'E_TYPE',ip,'指标项应为对象。','A stat must be an object.');return undefined;}
          if(rejectDangerousKeys(ctx,raw,ip))return undefined;
          checkKnownKeys(ctx,raw,ip,['label','value']);
          const label=requireString(ctx,raw.label,ip+'.label',40);
          const value=requireString(ctx,raw.value,ip+'.value',24);
          if(label===undefined||value===undefined)return undefined;
          return{label,value};
        });
        case 'labelToken':return optToken()(ctx,v,p);
        case 'valueToken':return optToken()(ctx,v,p);
        default:return undefined;
      }
    }
  },
  // list：列表，items 1–12 纯文本。
  // <lang zh-CN>markerToken 控制项目符号颜色。</lang>
  // <lang en>markerToken colors the list marker.</lang>
  list:{
    keys:['items','textToken','markerToken'],
    validate:(ctx,v,p,key)=>{
      switch(key){
        case 'items':return stringList(1,12,120)(ctx,v,p);
        case 'textToken':return optToken()(ctx,v,p);
        case 'markerToken':return optToken()(ctx,v,p);
        default:return undefined;
      }
    }
  },
  // table：列定义 1–6 + 数据行 ≤20；行键须属于列键（TDON-5.10）。
  // <lang zh-CN>多余行键忽略，缺键渲染为空单元格。</lang>
  // <lang en>Extra row keys are ignored; missing ones render as empty cells.</lang>
  table:{
    keys:['columns','rows','headerToken','cellToken'],
    validate:(ctx,v,p,key)=>{
      switch(key){
        case 'columns':return wantArray(ctx,v,p,1,6,(raw,ip)=>{
          if(!isPlainObject(raw)){pushError(ctx,'E_TYPE',ip,'列定义应为对象。','A column must be an object.');return undefined;}
          if(rejectDangerousKeys(ctx,raw,ip))return undefined;
          checkKnownKeys(ctx,raw,ip,['key','label']);
          const key=requireString(ctx,raw.key,ip+'.key',24);
          const label=requireString(ctx,raw.label,ip+'.label',40);
          if(key===undefined||label===undefined)return undefined;
          // 列键会作为行对象的索引名，形状必须受限。
          // <lang zh-CN>与行数据键比对时大小写敏感。</lang>
          // <lang en>Case-sensitive when matched against row keys.</lang>
          if(!/^[a-z][a-z0-9_]{0,23}$/.test(key)){
            pushError(ctx,'E_PATTERN',ip+'.key',`列键「${key}」不合法（小写字母开头，可含数字与下划线，≤24）。`,`Illegal column key "${key}" (lowercase first, digits/underscores, ≤24).`);
            return undefined;
          }
          return{key,label};
        });
        case 'rows':return wantArray(ctx,v,p,1,40,(raw,ip)=>{
          if(!isPlainObject(raw)){pushError(ctx,'E_TYPE',ip,'数据行应为对象。','A row must be an object.');return undefined;}
          if(rejectDangerousKeys(ctx,raw,ip))return undefined;
          // 行值统一转字符串（数字/布尔也接受），保证渲染侧不用做类型分支。
          // <lang zh-CN>嵌套对象/数组视为类型错误。</lang>
          // <lang en>Nested objects/arrays are type errors.</lang>
          const out:Record<string,string>={};
          for(const key of Object.keys(raw)){
            const rv=raw[key];
            if(typeof rv==='string'){if(rv.length>120){pushError(ctx,'E_LIMIT',`${ip}.${key}`,`单元格文本超过 120 字符。`,`Cell text exceeds 120 characters.`);continue;}out[key]=rv;}
            else if(typeof rv==='number'&&Number.isFinite(rv))out[key]=String(rv);
            else if(typeof rv==='boolean')out[key]=String(rv);
            else pushError(ctx,'E_TYPE',`${ip}.${key}`,'单元格值应为字符串/数字/布尔。','Cell values must be string/number/boolean.');
          }
          return out;
        });
        case 'headerToken':return optToken()(ctx,v,p);
        case 'cellToken':return optToken()(ctx,v,p);
        default:return undefined;
      }
    }
  },
  // form：只读展示（TDON-5.9），fields 1–8。
  // <lang zh-CN>type 限定四种控件形态，提交按钮仅为视觉元素。</lang>
  // <lang en>type is limited to four control shapes; the submit button is visual only.</lang>
  form:{
    keys:['fields','submitLabel','accentToken'],
    validate:(ctx,v,p,key)=>{
      switch(key){
        case 'fields':return wantArray(ctx,v,p,1,8,(raw,ip)=>{
          if(!isPlainObject(raw)){pushError(ctx,'E_TYPE',ip,'表单字段应为对象。','A field must be an object.');return undefined;}
          if(rejectDangerousKeys(ctx,raw,ip))return undefined;
          checkKnownKeys(ctx,raw,ip,['label','type']);
          const label=requireString(ctx,raw.label,ip+'.label',40);
          const type=wantEnum(ctx,raw.type,ip+'.type',['text','email','select','textarea'] as const);
          if(label===undefined||type===undefined)return undefined;
          return{label,type};
        });
        case 'submitLabel':return optString(40)(ctx,v,p);
        case 'accentToken':return optToken()(ctx,v,p);
        default:return undefined;
      }
    }
  },
  // divider：分隔线，thickness 1–4 整数。
  // <lang zh-CN>token 控制线条颜色。</lang>
  // <lang en>token colors the rule.</lang>
  divider:{
    keys:['token','thickness'],
    validate:(ctx,v,p,key)=>{
      switch(key){
        case 'token':return optToken()(ctx,v,p);
        case 'thickness':return wantNumber(ctx,v,p,{min:1,max:4,int:true});
        default:return undefined;
      }
    }
  },
  // raw-text：纯文本段（\\n → <br>），text 必填 ≤2000。
  // <lang zh-CN>size 必须是 fs:<step> 形式（TDON-5.11）。</lang>
  // <lang en>size must be an fs:<step> reference (TDON-5.11).</lang>
  'raw-text':{
    keys:['text','textToken','size'],
    validate:(ctx,v,p,key)=>{
      switch(key){
        case 'text':return reqString(2000)(ctx,v,p);
        case 'textToken':return optToken()(ctx,v,p);
        case 'size':{
          const ref=wantString(ctx,v,p,20);
          if(ref===undefined)return undefined;
          if(!/^fs:[a-z0-9]{1,10}$/.test(ref)){
            pushError(ctx,'E_TOKEN_SYNTAX',p,`size 必须是 fs:<step> 形式，实际「${ref}」。`,`size must be an fs:<step> reference, got "${ref}".`);
            return undefined;
          }
          if(!isTdonTokenSyntax(ref)){
            pushError(ctx,'E_TOKEN_SYNTAX',p,`字号档引用非法：「${ref}」。`,`Illegal font-size reference "${ref}".`);
            return undefined;
          }
          return ref;
        }
        default:return undefined;
      }
    }
  }
};

// ===== 对比度断言（§7 / TDON-7.1）=====
// 需要主题才能求值；违反时按 strict 决定错误或警告。
// <lang zh-CN>只在结构校验通过且提供主题时执行，避免在半成品文档上报无意义断言。</lang>
// <lang en>Runs only when structure passed and a theme is present, avoiding meaningless assertions on partial docs.</lang>
function assertContrast(ctx:Ctx,rules:TdonContrastRule[],strict:boolean,path:string):void{
  const theme=ctx.theme;
  if(!theme)return;
  rules.forEach((rule,i)=>{
    const fg=resolveTdonToken(theme,rule.fg);
    const bg=resolveTdonToken(theme,rule.bg);
    // 引用不可解析时已有其它条款报错，这里静默跳过（避免重复噪音）。
    // <lang zh-CN>静默跳过是安全的：文档本身已因 E_TOKEN_UNRESOLVED 被拒。</lang>
    // <lang en>Silent skip is safe: the document is already rejected by E_TOKEN_UNRESOLVED.</lang>
    if(!fg.ok||!bg.ok)return;
    const ratio=contrastRatio(fg.value,bg.value);
    if(ratio===null)return;
    if(ratio+1e-9>=rule.min)return;
    const p=`${path}[${i}]`;
    const zh=`对比度 ${ratio.toFixed(2)} 低于要求的 ${rule.min}（${rule.fg} / ${rule.bg}）。`;
    const en=`Contrast ${ratio.toFixed(2)} is below the required ${rule.min} (${rule.fg} / ${rule.bg}).`;
    // strict 决定阻断与否（TDON-7.1）。
    // <lang zh-CN>非严格模式降级为警告，保持"可用但提示"。</lang>
    // <lang en>Non-strict mode degrades to a warning, keeping the document usable but flagged.</lang>
    if(strict)pushError(ctx,'E_CONTRAST',p,zh,en);
    else pushWarning(ctx,'W_CONTRAST',p,zh,en);
  });
}

// 计算两色对比度（WCAG 相对亮度）；任一值非 HEX 时返回 null。
// <lang zh-CN>令牌解析结果可能是渐变/字体等非颜色值，此函数只处理 #rrggbb(aa)。</lang>
// <lang en>Resolved tokens may be gradients or fonts; this handles #rrggbb(aa) only.</lang>
function contrastRatio(a:string,b:string):number|null{
  const la=relativeLuminance(a);const lb=relativeLuminance(b);
  if(la===null||lb===null)return null;
  const hi=Math.max(la,lb);const lo=Math.min(la,lb);
  return hi===lo?1:(hi+0.05)/(lo+0.05);
}
// 相对亮度（WCAG 2.x）：sRGB 线性化后按 0.2126/0.7152/0.0722 加权。
// <lang zh-CN>支持 #rgb 与 #rrggbb；带 alpha 的 8 位值按 rgb 部分计算（忽略透明度）。</lang>
// <lang en>Supports #rgb and #rrggbb; 8-digit values use the rgb part (alpha ignored).</lang>
function relativeLuminance(hex:string):number|null{
  const m=/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})([0-9a-fA-F]{2})?$/.exec(hex.trim());
  if(!m)return null;
  let body=m[1]!;
  if(body.length===3)body=body.split('').map(c=>c+c).join('');
  const r=parseInt(body.slice(0,2),16)/255;
  const g=parseInt(body.slice(2,4),16)/255;
  const b=parseInt(body.slice(4,6),16)/255;
  const lin=(c:number)=>c<=0.03928?c/12.92:Math.pow((c+0.055)/1.055,2.4);
  return 0.2126*lin(r)+0.7152*lin(g)+0.0722*lin(b);
}

// ===== 顶层入口 =====
// 解析并校验一份 TDON 文档（unknown 输入，绝不假设形状）。
// <lang zh-CN>`raw` 接受两种形态：JSON 文本（推荐，宿主直接喂文件内容）或已解析对象。
//   文本形态的解析失败给 `E_JSON`；两者都以 `$` 为路径根。
//   theme 可选：给出时执行引用解析与对比度断言；否则只做结构与语法校验（TDON-8.3）。</lang>
// <lang en>`raw` accepts two shapes: JSON text (preferred — hand it the file content) or an already parsed
//   object. A text parse failure reports `E_JSON`; both use `$` as the path root. theme is optional: when given,
//   reference resolution and contrast assertions run; otherwise only structure and syntax are checked
//   (TDON-8.3).</lang>
export interface TdonParseResult{
  result:TdonValidationResult;
  /** @lang zh-CN 校验通过时的文档（已按白名单重建）；失败为 undefined。 @lang en Rebuilt document on success; undefined on failure. */
  doc?:TdonDocument;
}
export function parseTdonDocument(raw:unknown,options:{theme?:Theme}={}):TdonParseResult{
  const ctx:Ctx={errors:[],warnings:[],truncated:false,nodeCount:0,warnedTotal:false,...(options.theme?{theme:options.theme}:{})};
  // 大小预检：调用方通常已按字节判断，这里对字符串形态再兜一次（TDON-2.3）。
  // <lang zh-CN>字符数 ≤ 字节数，故用 length 判定不会放过超限文件。</lang>
  // <lang en>Character count ≤ byte count, so length cannot let an oversized file through.</lang>
  // 两级阈值（TDON-2.3）：512 KB 以上提示、4 MB 以上拒绝。
  // <lang zh-CN>复杂页面预览不应被 256 KB 一刀切拦住（维护者 2026-11-12 审核意见）。</lang>
  // <lang en>Complex previews should not be blocked at 256 KB (maintainer review, 2026-11-12).</lang>
  // 对象输入（已 JSON.parse 后传入）也要受同一约束：否则调用方绕开字符串形态即可跳过体积检查。
  // <lang zh-CN>按序列化长度估算；序列化失败（循环引用）由调用方负责，不属于 TDON 文档。</lang>
  // <lang en>Object input is held to the same cap, so callers cannot bypass it by pre-parsing. Length is
  //   estimated by serialization; unserializable input is the caller's problem, not a TDON document.</lang>
  const sizeChars=typeof raw==='string'?raw.length:JSON.stringify(raw)?.length??0;
  if(sizeChars>TDON_WARN_BYTES&&sizeChars<=TDON_MAX_BYTES){
    pushWarning(ctx,'W_TOO_LARGE','$',`文档约 ${sizeChars} 字符，超过建议值 ${TDON_WARN_BYTES}。`,`Document is about ${sizeChars} characters, over the suggested ${TDON_WARN_BYTES}.`);
  }
  if(sizeChars>TDON_MAX_BYTES){
    pushError(ctx,'E_TOO_LARGE','$',`文档超过 ${TDON_MAX_BYTES} 字符上限。`,`Document exceeds the ${TDON_MAX_BYTES}-character cap.`);
    return{result:{ok:false,errors:ctx.errors,warnings:ctx.warnings,truncated:ctx.truncated}};
  }
  // 字符串输入先解析：公开契约（README/规范站）承诺 `raw` 可为 JSON 文本，否则调用方要自己
  //   写一遍 parse + 错误归并（这正是宿主上次漏解析导致误报的根因）。
  //   解析失败给专用 E_JSON，而不是笼统的 E_NOT_OBJECT——"JSON 写错了"和"顶层不是对象"是两类问题。
  // <lang en>String input is parsed here: the public contract (README/spec site) says `raw` may be JSON text;
  //   otherwise every caller re-implements parse plus error merging — exactly the omission that produced a
  //   bogus error in the host last time. Parse failure gets its own E_JSON, not a blanket E_NOT_OBJECT:
  //   "bad JSON" and "top level is not an object" are different problems.</lang>
  let parsed:unknown=raw;
  if(typeof raw==='string'){
    // <lang zh-CN>字节数预检仍然用原始文本长度，故超限文档不会进入 JSON.parse（避免大文本解析开销）。</lang>
    // <lang en>The size pre-check already used the raw text length, so oversized documents never reach
    //   JSON.parse — no needless work on huge input.</lang>
    try{
      parsed=JSON.parse(raw) as unknown;
    }catch(e){
      pushError(ctx,'E_JSON','$',`JSON 解析失败：${e instanceof Error?e.message:String(e)}`,`JSON parse failed: ${e instanceof Error?e.message:String(e)}`);
      return{result:{ok:false,errors:ctx.errors,warnings:ctx.warnings,truncated:ctx.truncated}};
    }
  }
  // 顶层必须是对象（TDON-2.4）。
  if(!isPlainObject(parsed)){
    pushError(ctx,'E_NOT_OBJECT','$','TDON 顶层必须是 JSON 对象。','The TDON top level must be a JSON object.');
    return{result:{ok:false,errors:ctx.errors,warnings:ctx.warnings,truncated:ctx.truncated}};
  }
  const obj=parsed;
  if(rejectDangerousKeys(ctx,obj,'$'))return{result:{ok:false,errors:ctx.errors,warnings:ctx.warnings,truncated:ctx.truncated}};
  // 顶层键白名单（TDON-2.1）。
  checkKnownKeys(ctx,obj,'$',['specVersion','target','tokens','preview','exportManifest','constraints','effects','template']);
  // 版本路由（TDON-1.5）：未知版本直接拒绝，不尝试兼容猜测。
  // <lang zh-CN>提示当前支持的版本串，降低排查成本。</lang>
  // <lang en>The message names the supported version to speed up diagnosis.</lang>
  const specVersion=requireString(ctx,obj.specVersion,'$.specVersion',32);
  if(specVersion!==undefined&&specVersion!==TDON_SPEC_VERSION){
    pushError(ctx,'E_VERSION','$.specVersion',`不支持的规范版本「${specVersion}」，当前支持 ${TDON_SPEC_VERSION}。`,`Unsupported spec version "${specVersion}"; this build supports ${TDON_SPEC_VERSION}.`);
  }
  const target=validateTarget(ctx,obj.target,'$.target');
  // 其余各组独立校验：可选组缺失不报错（TDON-2.2）。
  // <lang zh-CN>tokens 返回 undefined 表示未提供或全空，语义等价。</lang>
  // <lang en>tokens returning undefined means absent or empty — semantically equivalent.</lang>
  const tokens=obj.tokens===undefined?undefined:validateTokens(ctx,obj.tokens,'$.tokens');
  const preview=obj.preview===undefined?undefined:validatePreview(ctx,obj.preview,'$.preview');
  const exportManifest=validateExportManifest(ctx,obj.exportManifest,'$.exportManifest');
  const constraints=obj.constraints===undefined?undefined:validateConstraints(ctx,obj.constraints,'$.constraints');
  const effects=obj.effects===undefined?undefined:validateEffects(ctx,obj.effects,'$.effects');
  // TDOT 预留段（TDON-14.1/14.2）：只做"存在即可"的接受 + 警告，**不解释内容**、不产生错误。
  // <lang zh-CN>先接受再警告，作者可以提前写模板；等 TDOT 运行时落地后无需改文件。
  //   仍做危险键与对象形态检查——透传给未来运行时也必须是一棵干净的对象树。</lang>
  // <lang en>Accepted-then-warned so authors can write ahead without touching the file later. Dangerous keys
  //   and object shape are still checked: whatever is forwarded to a future runtime must be a clean tree.</lang>
  const template=validateTemplateReserved(ctx,obj.template,'$.template');
  // effect 引用存在性：结构层面通过后再判，避免前向引用误报。
  // <lang zh-CN>缺失的 effect 引用记错误——声明了不存在的东西属文档缺陷。</lang>
  // <lang en>A missing effect reference is an error: declaring something nonexistent is a document defect.</lang>
  if(preview&&effects){
    const checkNodes=(nodes:TdonNode[],base:string)=>{
      nodes.forEach((n,i)=>{
        if(n.effect&&!effects[n.effect])pushError(ctx,'E_EFFECT_UNKNOWN',`${base}[${i}].effect`,`未声明的特效「${n.effect}」。`,`Undeclared effect "${n.effect}".`);
        const kids=n.attrs.children;
        if(Array.isArray(kids))checkNodes(kids as TdonNode[],`${base}[${i}].children`);
      });
    };
    checkNodes(preview.nodes,'$.preview.nodes');
  }
  // 对比度断言（TDON-7.1）：需要主题与规则两者齐备。
  // <lang zh-CN>放在结构校验之后，避免在半成品文档上执行。</lang>
  // <lang en>Runs after structure validation so partial documents are never asserted.</lang>
  if(constraints?.requireContrast&&constraints.requireContrast.length>0)assertContrast(ctx,constraints.requireContrast,constraints.strict===true,'$.constraints.requireContrast');
  const ok=ctx.errors.length===0;
  const result:TdonValidationResult={ok,errors:ctx.errors,warnings:ctx.warnings,truncated:ctx.truncated};
  // 失败时不返回半成品文档——调用方据 ok 决定是否注册（TDON-1.3）。
  // <lang zh-CN>返回 undefined 而非部分对象，杜绝"部分生效"。</lang>
  // <lang en>Returning undefined (not a partial object) rules out partial application.</lang>
  if(!ok||!target||!exportManifest||specVersion===undefined)return{result};
  const doc:TdonDocument={
    specVersion,
    target,
    exportManifest,
    ...(tokens?{tokens}:{}),
    ...(preview?{preview}:{}),
    ...(constraints?{constraints}:{}),
    ...(effects?{effects}:{}),
    ...(template?{template}:{})
  };
  return{result,doc};
}
