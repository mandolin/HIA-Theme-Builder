/**
 * @lang zh-CN DTCG 令牌互操作（`W-tb-P38`，ADR-013）：W3C Design Tokens Format **2025.10 稳定版**
 *   的导出与白名单导入。依据（一手资料）：design-tokens/community-group `schemas/src/2025.10/`
 *   的 color/gradient/shadow/dimension/token/group schema——值形状逐条对照，不凭记忆。
 *
 *   **导出映射**：`color.primary/secondary/third/aux<N>/semantic.<status>` 各组含 base/10 阶/on；
 *   `radius.*` 用 dimension(px)；`shadow.*` 用 shadow 数组（双层阴影逐层展开）；
 *   `typography.fontFamily` 用 fontFamily（字符串数组）；`spacing.<i>` 用 dimension；
 *   渐变用 `$type:"gradient"`（stops 数组，position 0–1），方向不在 DTCG 类型内 → 写入
 *   `$extensions["com.hia-theme-builder"].direction`。根级 `$extensions` 携带生成器信息。
 *
 *   **导入（白名单子集）**：识别 `color.primary/secondary/semantic.<status>` 与 `radius`；
 *   色值接受三形态（2025.10 对象 / 纯 hex 字符串（Tokens Studio 事实标准）/ 组内 `$ref`）；
 *   其余组跳过并出 `W_DTCG_SKIPPED` 警告（不静默丢弃）。
 *
 * @lang en DTCG token interop (`W-tb-P38`, ADR-013): W3C Design Tokens Format **2025.10 stable** export and
 *   whitelist import. Source of truth: the community-group `schemas/src/2025.10/` schemas — every value shape
 *   is checked against them, not recalled from memory.
 *
 *   **Export mapping**: `color.primary/secondary/third/aux<N>/semantic.<status>` groups carry base/10 steps/on;
 *   `radius.*` as dimension(px); `shadow.*` as shadow arrays (both layers of our two-layer shadows);
 *   `typography.fontFamily` as fontFamily (string arrays); `spacing.<i>` as dimension; gradients as
 *   `$type:"gradient"` (stop array, position 0–1) with direction in `$extensions` since the DTCG gradient type
 *   has no axis concept. Root `$extensions` carries generator info.
 *
 *   **Import (whitelist)**: recognises `color.primary/secondary/semantic.<status>` and `radius`; colour values
 *   accept three shapes (2025.10 objects / plain hex strings (Tokens Studio's de-facto form) / in-file `$ref`);
 *   other groups are skipped with `W_DTCG_SKIPPED` warnings — never silently dropped.
 */
import type{Theme,ThemeDraft,RadiusTokens,SemanticTokens,SemanticStatusKey,RoleColor,GradientConfig}from'../types.js';
import{hexToRgb,rgbToHex,normalizeHex,validHex,clamp}from'../color/convert.js';
import{nameColor}from'../color/color-name.js';
import{bestOnColor}from'../color/contrast.js';
import{tonalScale}from'../color/scale.js';
import{radiusSequence,shadowCss}from'../token/radius.js';
import{spacingSequence}from'../token/typography.js';
import{resolveScaleColor,collectCustomShades}from'../gradient/render.js';
import{cloneGradientSettings}from'../data/gradients.js';
import{GRADIENT_DEFS}from'../data/gradients.js';
import{slugifyThemeName}from'./shared.js';
import type{ExportTarget}from'./types.js';

// ===== 导出 =====

/** @lang zh-CN sRGB HEX → DTCG color 值（components 归一化 0–1 三位小数 + hex 兜底，均为 schema 允许形态）。 @lang en sRGB HEX → DTCG color value (components normalised 0–1 at 3dp plus the optional hex fallback — both schema-sanctioned). */
function colorValue(hex:string):Record<string,unknown>{
  const[r,g,b]=hexToRgb(hex);
  return{colorSpace:'srgb',components:[Number(r.toFixed(3)),Number(g.toFixed(3)),Number(b.toFixed(3))],hex:normalizeHex(hex)};
}

/** @lang zh-CN 颜色 token。 @lang en A colour token. */
function colorToken(hex:string,description?:string):Record<string,unknown>{
  const t:Record<string,unknown>={'$type':'color','$value':colorValue(hex)};
  if(description)t['$description']=description;
  return t;
}

/** @lang zh-CN dimension token（px）。 @lang en A dimension token (px). */
function dimensionToken(px:number):Record<string,unknown>{
  return{'$type':'dimension','$value':{value:px,unit:'px'}};
}

/** @lang zh-CN 角色色 → DTCG 组：base + on + 10 阶 + 渐变引用的自定义档。 @lang en Role colour → DTCG group: base + on + ten steps + gradient-referenced custom shades. */
function roleGroup(role:RoleColor,custom:Record<string,string>):Record<string,unknown>{
  const group:Record<string,unknown>={};
  group['base']=colorToken(role.value,'Base colour / 基色');
  group['on']=colorToken(role.on,'Readable foreground on base / 基色上的可读前景');
  for(const[k,v]of Object.entries(role.scale))group[k]=colorToken(v,`Step ${k} / ${k} 阶`);
  for(const[k,v]of Object.entries(custom))group[k]=colorToken(v,`Custom shade ${k} / 自定义 ${k} 阶`);
  return group;
}

/**
 * @lang zh-CN 渐变 bias → DTCG stops（position 0–1）。
 *   front80 → [(start,0),(start,0.8),(end,1)]；end20 → [(start,0),(end,0.8),(end,1)]；
 *   无 bias → [(start,0),(end,1)]。色值取 literal（真实色阶值）。
 * @lang en Gradient bias → DTCG stops (position 0–1): front80 → [(start,0),(start,0.8),(end,1)];
 *   end20 → [(start,0),(end,0.8),(end,1)]; no bias → [(start,0),(end,1)]. Colours are literal resolved scale
 *   values.
 */
function gradientStopsValue(config:GradientConfig,theme:Theme):Array<{color:Record<string,unknown>;position:number}>{
  const start=resolveScaleColor(theme,config.family,config.start),
    end=resolveScaleColor(theme,config.family,config.end);
  const m=/^(front|end)(\d+)$/.exec(config.bias);
  const n=m?clamp(Number(m[2]),0,100):null;
  const raw:Array<[string,number]>=m&&m[1]==='front'
    ?[[start,0],[start,n!/100],[end,1]]
    :m&&m[1]==='end'
      ?[[start,0],[end,(100-n!)/100],[end,1]]
      :[[start,0],[end,1]];
  return raw.map(([hex,position])=>({color:colorValue(hex),position}));
}

/**
 * @lang zh-CN CSS 双层 box-shadow 字符串 → DTCG shadow 数组（逐层解析 offset/blur/spread 与颜色）。
 *   我们生成的两层格式固定；覆写值可能任意——用宽松正则逐层抽取，解析失败的层跳过（尽量保真）。
 * @lang en Parses our two-layer CSS box-shadow string into a DTCG shadow array (offset/blur/spread/colour per
 *   layer). Our generated format is fixed, but overrides may be arbitrary — a lenient regex extracts layers and
 *   skips unparseable ones to stay lossless where possible.
 */
function parseBoxShadow(css:string):Array<Record<string,unknown>>|null{
  if(!css||css==='none')return null;
  // 顶层逗号分层（括号深度感知）——legacy rgba(...) 内的逗号不会被误切。
  // <lang en>Split on top-level commas (paren-depth aware) so commas inside legacy rgba(...) never split.</lang>
  const layers:string[]=[];
  let depth=0,buf='';
  for(const ch of css){
    if(ch==='(')depth++;
    else if(ch===')')depth--;
    if(ch===','&&depth===0){layers.push(buf.trim());buf='';}else buf+=ch;
  }
  if(buf.trim())layers.push(buf.trim());
  const out:Array<Record<string,unknown>>=[];
  for(const layer of layers){
    // 首 token 可无 px（CSS box-shadow 合法形态：`0 1px 3px 0px …`）。
    // <lang en>The first token may omit px (a legal box-shadow form: `0 1px 3px 0px …`).</lang>
    const m=/^([-.\d]+)(?:px)?\s+([-\d.]+)px\s+([-\d.]+)px(?:\s+([-\d.]+)px)?\s+(.+)$/.exec(layer);
    if(!m)continue;
    const shadowColor=parseShadowColor(m[5]??'');
    if(!shadowColor)continue;
    out.push({
      color:shadowColor,
      offsetX:{value:Number(m[1]??0),unit:'px'},
      offsetY:{value:Number(m[2]),unit:'px'},
      blur:{value:Number(m[3]),unit:'px'},
      spread:{value:Number(m[4]??0),unit:'px'},
      inset:false
    });
  }
  return out.length?out:null;
}

/** @lang zh-CN 解析阴影色：rgb(R G B / A) 现代记法或 #hex。 @lang en Parses a shadow colour: modern rgb(R G B / A) notation or #hex. */
function parseShadowColor(text:string):Record<string,unknown>|null{
  const hex=/#[0-9a-fA-F]{6}/.exec(text);
  if(hex)return colorValue(hex[0]);
  const rgb=/rgba?\(\s*([\d.]+)[\s,]+([\d.]+)[\s,]+([\d.]+)(?:\s*[/,]\s*([\d.]+))?\s*\)/.exec(text);
  if(rgb){
    const r=Number(rgb[1])/255,g=Number(rgb[2])/255,b=Number(rgb[3])/255,a=rgb[4]!==undefined?Number(rgb[4]):1;
    return{colorSpace:'srgb',components:[Number(r.toFixed(3)),Number(g.toFixed(3)),Number(b.toFixed(3))],alpha:a,hex:rgbToHex([r,g,b])};
  }
  return null;
}

/** @lang zh-CN CSS 字体栈 → fontFamily 数组（去引号、去空白）。 @lang en CSS font stack → fontFamily array (quotes/whitespace stripped). */
function fontFamilyValue(stack:string):string[]{return stack.split(',').map(s=>s.trim().replace(/^["']|["']$/g,'')).filter(Boolean);}

/**
 * @lang zh-CN 导出 DTCG 2025.10 文本（`.tokens.json`）。根级组：color（含语义）、radius、shadow、
 *   typography、spacing、gradient；`$extensions["com.hia-theme-builder"]` 记录生成器与主题名。
 *   可选组按 ADR-012/006 语义缺省不输出。
 * @lang en Emits the DTCG 2025.10 text (`.tokens.json`). Root groups: colour (incl. semantics), radius, shadow,
 *   typography, spacing, gradient; `$extensions["com.hia-theme-builder"]` records generator and theme name.
 *   Optional groups are omitted when absent.
 */
export function exportDtcgTokens(theme:Theme):string{
  const custom=collectCustomShades(theme);
  const color:Record<string,unknown>={
    primary:roleGroup(theme.primary,custom.primary),
    secondary:roleGroup(theme.secondary,custom.secondary)
  };
  if(theme.thirdColor)color['third']=roleGroup(theme.thirdColor,{});
  theme.auxiliary.forEach((aux,i)=>{color[`aux${i}`]=roleGroup(aux,{});});
  if(theme.semantic)color['semantic']=Object.fromEntries(
    (Object.entries(theme.semantic)as Array<[SemanticStatusKey,RoleColor]>).map(([k,role])=>[k,roleGroup(role,{})])
  );
  const radius:Record<string,unknown>=Object.fromEntries(
    (Object.entries(radiusSequence(theme.radius))as Array<[string,number]>).map(([k,v])=>[k,dimensionToken(v)])
  );
  const shadows=shadowCss(theme.shadow,theme.primary.value);
  const shadow:Record<string,unknown>={};
  for(const k of['sm','md','lg']as const){
    const parsed=parseBoxShadow(shadows[k]);
    if(parsed)shadow[k]={'$type':'shadow','$value':parsed};
  }
  const spacing:Record<string,unknown>=Object.fromEntries(
    spacingSequence(theme.spacing).map((v,i)=>[String(i),dimensionToken(v)])
  );
  const gradients:Record<string,unknown>={};
  for(const def of GRADIENT_DEFS){
    const config=theme.gradients[def.key];
    if(!config||config.enabled===false)continue;
    gradients[def.key]={
      '$type':'gradient',
      '$value':gradientStopsValue(config,theme),
      '$extensions':{'com.hia-theme-builder':{direction:config.direction,bias:config.bias}},
      '$description':def.label
    };
  }
  const root:Record<string,unknown>={
    '$description':`HIA Theme Builder tokens — ${theme.name}`,
    '$extensions':{'com.hia-theme-builder':{generator:'HIA Theme Builder',format:'dtcg-2025.10',themeName:theme.name}},
    color,
    radius,
    shadow,
    typography:{fontFamily:Object.fromEntries(
      (['body','heading','mono']as const).map(k=>[k,{'$type':'fontFamily','$value':fontFamilyValue(theme.typography.fontFamily[k])}])
    )},
    spacing,
    gradients
  };
  return JSON.stringify(root,null,2)+'\n';
}

// ===== 导入 =====

/** @lang zh-CN 导入错误/警告码（ADR-013）。 @lang en Import error/warning codes (ADR-013). */
export type DtcgIssueCode='E_DTCG_ROOT'|'E_DTCG_TOKEN'|'E_DTCG_COLOR'|'E_JSON'|'W_DTCG_SKIPPED';
export interface DtcgIssue{code:DtcgIssueCode;path:string;message:string;messageEn:string;}
export interface DtcgParseResult{
  ok:boolean;
  /** @lang zh-CN 成功时的可编辑草稿（semanticDerived 全 false=用户值，不随主色刷新）。 @lang en An editable draft on success (semanticDerived all false — user-managed, not following the primary). */
  draft?:ThemeDraft;
  errors:DtcgIssue[];
  warnings:DtcgIssue[];
}

/** @lang zh-CN JSON Pointer（`#/a/b/0`）解析：仅本文件内引用，失败返回 null。 @lang en JSON Pointer (`#/a/b/0`) resolution: in-file references only; null on failure. */
function resolveRef(root:unknown,ref:string):unknown{
  if(typeof ref!=='string'||!ref.startsWith('#/'))return null;
  let node:unknown=root;
  for(const seg of ref.slice(2).split('/')){
    if(node===null||typeof node!=='object')return null;
    node=(node as Record<string,unknown>)[seg.replace(/~1/g,'/').replace(/~0/g,'~')];
  }
  return node;
}

type Ctx={errors:DtcgIssue[];warnings:DtcgIssue[];root:unknown};

/** @lang zh-CN 色值解析（三形态）：返回 HEX 或 null（不可解析，由调用方记警告/错误）。 @lang en Colour resolution (three shapes): returns HEX or null (the caller warns/errors). */
function resolveColorValue(value:unknown,ctx:Ctx,path:string,depth=0):string|null{
  // 统一解包：token 包装（$value）与组内引用（$ref，限两层防循环）都在入口处理——
  //   调用方（含 $ref 目标是完整 token 的情况）无需各自关心包装层。
  // <lang en>Uniform unwrapping at the top: token wrappers ($value) and in-file references ($ref, depth-capped
  //   against cycles) are handled here, so callers — including cases where a $ref targets a full token — never
  //   worry about wrapper layers.</lang>
  if(value&&typeof value==='object'){
    const w=value as Record<string,unknown>;
    if('$value'in w&&depth<4)return resolveColorValue(w['$value'],ctx,path,depth+1);
    if('$ref'in w&&depth<2){
      const target=resolveRef(ctx.root,w['$ref'] as string);
      if(target===null||target===value)return null;
      return resolveColorValue(target,ctx,path,depth+1);
    }
  }
  if(value&&typeof value==='object'){
    const v=value as Record<string,unknown>;
    // 形态一：2025.10 对象——hex 兜底优先（无损），否则 srgb components（alpha 相乘）。
    // <lang en>Shape 1: the 2025.10 object — prefer the hex fallback (lossless), else srgb components
    //   (alpha multiplied in).</lang>
    if(typeof v.hex==='string'&&validHex(v.hex))return normalizeHex(v.hex);
    if(v.colorSpace==='srgb'&&Array.isArray(v.components)&&v.components.length>=3){
      const comps=v.components.map(c=>typeof c==='number'?clamp(c,0,1):0);
      const alpha=typeof v.alpha==='number'?clamp(v.alpha,0,1):1;
      return rgbToHex([comps[0]!*alpha,comps[1]!*alpha,comps[2]!*alpha]);
    }
    ctx.warnings.push({code:'W_DTCG_SKIPPED',path,message:`色彩空间 ${String(v.colorSpace)} 无 hex 兜底，跳过。`,messageEn:`Colour space ${String(v.colorSpace)} without a hex fallback — skipped.`});
    return null;
  }
  // 形态二：颜色字符串——hex（Tokens Studio 事实标准）或 rgb()/rgba() CSS 记法。
  // <lang en>Shape 2: colour strings — hex (Tokens Studio's de-facto standard) or rgb()/rgba() CSS notation.</lang>
  if(typeof value==='string'){
    if(validHex(value))return normalizeHex(value);
    const css=parseShadowColor(value);
    if(css)return css['hex'] as string;
  }
  return null;
}

/**
 * @lang zh-CN 递归收集一个组内全部颜色 token。判定顺序（DTCG 生态形态差异大）：
 *   ①带 `$value` 的标准 token；②`$ref`-only token；③值对象（含 hex/colorSpace 键——2025.10 形态）；
 *   ④字符串叶子（Tokens Studio 的 hex 简写）；⑤其余下探为子组。
 *   非 color 类型逐条警告（不静默丢弃）。
 * @lang en Recursively collects colour tokens in a group. Decision order (ecosystem shapes vary): (1) standard
 *   `$value` tokens; (2) `$ref`-only tokens; (3) value objects (hex/colorSpace keys — the 2025.10 shape);
 *   (4) string leaves (Tokens Studio hex shorthand); (5) otherwise descend as a sub-group. Non-colour types
 *   warn individually — never silently dropped.
 */
function collectColors(group:unknown,ctx:Ctx,base:string,out:Record<string,string>):void{
  if(group===null||typeof group!=='object')return;
  for(const[key,value]of Object.entries(group as Record<string,unknown>)){
    if(key.startsWith('$'))continue;
    const path=`${base}.${key}`;
    const record=value as Record<string,unknown>|null;
    const type=record&&typeof record==='object'?record['$type']:undefined;
    const hasValue=!!(record&&typeof record==='object'&&'$value'in record);
    const isRef=!!(record&&typeof record==='object'&&'$ref'in record);
    const isValueLike=!!(record&&typeof record==='object'&&('hex'in record||'colorSpace'in record));
    if(hasValue||isRef||isValueLike){
      // token 形态（标准/$ref/值对象）——统一走色值解析；类型白名单先校验。
      // <lang en>Token shapes (standard/$ref/value-object) all go through colour resolution; the type
      //   whitelist is checked first.</lang>
      if(typeof type==='string'&&type!=='color'){
        ctx.warnings.push({code:'W_DTCG_SKIPPED',path,message:`类型 ${type} 超出导入白名单，跳过。`,messageEn:`Type ${type} is outside the import whitelist — skipped.`});
        continue;
      }
      const hex=resolveColorValue(record,ctx,path);
      if(hex)out[key]=hex;
      else ctx.errors.push({code:'E_DTCG_COLOR',path,message:'颜色值不可解析。',messageEn:'Colour value is unresolvable.'});
      continue;
    }
    if(typeof value==='string'){
      // 字符串叶子：Tokens Studio 的 hex 简写；非色字符串记 E_DTCG_TOKEN。
      // <lang en>String leaves: Tokens Studio hex shorthand; non-colour strings report E_DTCG_TOKEN.</lang>
      const hex=resolveColorValue(value,ctx,path);
      if(hex)out[key]=hex;
      else ctx.errors.push({code:'E_DTCG_TOKEN',path,message:'叶子值不是可识别的颜色。',messageEn:'Leaf value is not a recognisable colour.'});
      continue;
    }
    if(record&&typeof record==='object'&&Object.keys(record).some(k=>!k.startsWith('$'))){
      if(typeof type==='string'){
        ctx.warnings.push({code:'W_DTCG_SKIPPED',path,message:`类型 ${type} 超出导入白名单，跳过。`,messageEn:`Type ${type} is outside the import whitelist — skipped.`});
        continue;
      }
      collectColors(value,ctx,path,out);
      continue;
    }
    ctx.errors.push({code:'E_DTCG_TOKEN',path,message:'token 缺少 $value。',messageEn:'Token lacks $value.'});
  }
}

/** @lang zh-CN 组内取"base 优先、500 兜底"的基色。 @lang en Picks the group base colour: "base" first, "500" fallback. */
function pickBase(colors:Record<string,string>):string|undefined{return colors['base']??colors['500'];}

/** @lang zh-CN 组内按顺序找第一个可解析的 dimension(px)。 @lang en Finds the first parseable dimension (px) in a group by key order. */
function walkDimension(group:Record<string,unknown>|undefined,keys:string[]):number|undefined{
  if(!group)return undefined;
  for(const key of keys){
    const token=group[key];
    if(token&&typeof token==='object'){
      const value=(token as Record<string,unknown>)['$value'];
      if(value&&typeof value==='object'){
        const v=value as Record<string,unknown>;
        if(v.unit==='px'&&typeof v.value==='number')return v.value;
      }
      if(typeof value==='number')return value;
    }
  }
  return undefined;
}

/** @lang zh-CN 读取根级 $extensions["com.hia-theme-builder"] 的字段。 @lang en Reads a field from the root $extensions["com.hia-theme-builder"]. */
function ext(obj:Record<string,unknown>,key:string):string|undefined{
  const e=obj['$extensions'] as Record<string,Record<string,unknown>>|undefined;
  const h=e?.['com.hia-theme-builder'];
  const v=h?.[key];
  return typeof v==='string'?v:undefined;
}

/**
 * @lang zh-CN 导入 DTCG 文件（白名单子集，ADR-013）：识别 `color.primary/secondary/semantic.<status>` 与
 *   `radius`（md/base 为圆角基准）。成功返回可编辑草稿（**semanticDerived 全 false**——导入值视为用户值，
 *   不随主色刷新，ADR-012 决策 3 的导入侧对称）；跳过的组逐条 `W_DTCG_SKIPPED`。
 *   语义组以导入基色重建完整色阶与 on 色（与角色色同一管线，保证导出物完整）。
 * @lang en Imports a DTCG file (whitelist subset, ADR-013): recognises `color.primary/secondary/semantic.<status>`
 *   and `radius` (md/base becomes the base radius). Returns an editable draft with **semanticDerived all
 *   false** — imported values are user-managed (the import-side mirror of ADR-012 decision 3); skipped groups
 *   warn one by one. Semantic groups rebuild full scales and `on` from the imported base colours (same pipeline
 *   as role colours, so exports stay complete).
 */
export function parseDtcgTokens(raw:unknown):DtcgParseResult{
  const ctx:Ctx={errors:[],warnings:[],root:raw};
  let root:unknown=raw;
  if(typeof raw==='string'){
    try{root=JSON.parse(raw) as unknown;}
    catch(e){
      return{ok:false,errors:[{code:'E_JSON',path:'$',message:`JSON 解析失败：${e instanceof Error?e.message:String(e)}`,messageEn:`JSON parse failed: ${e instanceof Error?e.message:String(e)}`}],warnings:[]};
    }
  }
  if(root===null||typeof root!=='object'||Array.isArray(root)){
    return{ok:false,errors:[{code:'E_DTCG_ROOT',path:'$',message:'DTCG 顶层必须是 JSON 对象。',messageEn:'The DTCG top level must be a JSON object.'}],warnings:[]};
  }
  const obj=root as Record<string,unknown>;
  // 定位颜色组：root.color 或 root 下任一层包装的 color 组（Tokens Studio 主题包装常见）。
  // <lang en>Locate the colour group: root.color, or a wrapped "color" group (common Tokens Studio shape).</lang>
  let colorGroup=obj['color'] as unknown;
  if(!colorGroup||typeof colorGroup!=='object'){
    for(const value of Object.values(obj)){
      if(value&&typeof value==='object'&&(value as Record<string,unknown>)['color']){
        colorGroup=(value as Record<string,unknown>)['color'];
        break;
      }
    }
  }
  let primaryHex:string|undefined,secondaryHex:string|undefined;
  const sem:Partial<SemanticTokens>={};
  if(colorGroup&&typeof colorGroup==='object'){
    const cg=colorGroup as Record<string,unknown>;
    for(const role of['primary','secondary']as const){
      const g=cg[role];
      if(!g||typeof g!=='object')continue;
      const colors:Record<string,string>={};
      collectColors(g,ctx,`color.${role}`,colors);
      const hex=pickBase(colors);
      if(role==='primary')primaryHex=hex;else secondaryHex=hex;
    }
    const semGroup=cg['semantic'];
    if(semGroup&&typeof semGroup==='object'){
      for(const key of['success','info','warning','danger']as SemanticStatusKey[]){
        const g=(semGroup as Record<string,unknown>)[key];
        if(!g||typeof g!=='object')continue;
        const colors:Record<string,string>={};
        collectColors(g,ctx,`color.semantic.${key}`,colors);
        const hex=pickBase(colors);
        if(!hex)continue;
        // 以导入基色重建完整色阶与 on 色（导入组可能只有 base/500——重建保证导出物完整）。
        // <lang en>Rebuild the full scale and on from the imported base (groups may only carry base/500) so
        //   exports stay complete.</lang>
        sem[key]={name:nameColor(hex).zh,value:hex,scale:tonalScale(hex),on:bestOnColor(hex).hex};
      }
    }
  }else{
    ctx.warnings.push({code:'W_DTCG_SKIPPED',path:'color',message:'未找到 color 组。',messageEn:'No colour group found.'});
  }
  // 圆角：radius.md（base 兜底）为圆角基准（dimension px）。
  // <lang en>Radius: radius.md (base fallback) becomes the base radius (dimension px).</lang>
  const radiusBase=walkDimension(obj['radius'] as Record<string,unknown>|undefined,['md','base']);
  // 其余根级组逐条警告（不静默丢弃）。
  // <lang en>Warn per remaining root group — never silently dropped.</lang>
  for(const[key,value]of Object.entries(obj)){
    if(key.startsWith('$')||key==='color'||key==='radius')continue;
    const type=value&&typeof value==='object'?(value as Record<string,unknown>)['$type']:undefined;
    ctx.warnings.push({code:'W_DTCG_SKIPPED',path:key,message:`组 "${key}"（${typeof type==='string'?type:'group'}）超出导入白名单，跳过。`,messageEn:`Group "${key}" (${typeof type==='string'?type:'group'}) is outside the import whitelist — skipped.`});
  }
  if(!primaryHex||!secondaryHex){
    ctx.errors.push({code:'E_DTCG_COLOR',path:'color.primary/secondary',message:'缺少可识别的主色或副色。',messageEn:'No recognisable primary or secondary colour.'});
  }
  if(ctx.errors.length||!primaryHex||!secondaryHex)return{ok:false,errors:ctx.errors,warnings:ctx.warnings};
  const semantic:SemanticTokens|undefined=Object.keys(sem).length?sem as SemanticTokens:undefined;
  const radius:RadiusTokens|undefined=radiusBase!==undefined?{base:radiusBase}:undefined;
  const draft:ThemeDraft={
    name:ext(obj,'themeName')||'DTCG 导入',
    category:'custom',
    industry:'',
    primary:primaryHex,
    secondary:secondaryHex,
    primaryName:nameColor(primaryHex).zh,
    secondaryName:nameColor(secondaryHex).zh,
    note:'由 DTCG .tokens.json 导入。',
    semantic,
    ...(radius?{radius}:{}),
    gradients:cloneGradientSettings(undefined),
    semanticDerived:semantic?Object.fromEntries((Object.keys(semantic)as SemanticStatusKey[]).map(k=>[k,false])):undefined
  };
  return{ok:true,draft,errors:ctx.errors,warnings:ctx.warnings};
}

/** @lang zh-CN DTCG 导出目标（注册在导出注册表；ZIP 内单一 `.tokens.json`，W3C 2025.10 形状）。 @lang en The DTCG export target (registered in the export registry; a single .tokens.json in W3C 2025.10 shape inside the ZIP). */
export const dtcgExportTarget:ExportTarget={
  id:'dtcg',
  name:'DTCG .tokens.json（ZIP）',
  nameEn:'DTCG .tokens.json (ZIP)',
  notes:'导出 W3C Design Tokens 2025.10 格式（color/radius/shadow/typography/spacing/gradient），可直接导入 Tokens Studio、Style Dictionary、Penpot 等生态工具。',
  notesEn:'Emits W3C Design Tokens 2025.10 (colour/radius/shadow/typography/spacing/gradient) consumable by Tokens Studio, Style Dictionary, Penpot and friends.',
  archiveName:theme=>`hia-dtcg-${slugifyThemeName(theme.name)}.zip`,
  files:theme=>[{path:`${slugifyThemeName(theme.name)}.tokens.json`,content:exportDtcgTokens(theme)}]
};
