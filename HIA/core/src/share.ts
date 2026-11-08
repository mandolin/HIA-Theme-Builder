/**
 * @lang zh-CN 主题分享链接编解码（`W-tb-P10` / M-THEME-BUILDER-MARKET）。链接形态
 *   `#hia=v1&p=<base64url(JSON)>`（hash 不进服务器日志、可书签）；载荷为 Preset 同构子集
 *   （颜色+渐变+名称，`W-tb-P9` 边界决策：不含字体/间距令牌）。纯函数，core 无 DOM——
 *   URL 拼接由调用方（web 层）完成。先例对标见 WorkZone `dev/research/share-link-patterns-2026-11.md`。
 * @lang en Theme share-link codec (`W-tb-P10` / M-THEME-BUILDER-MARKET). Link shape
 *   `#hia=v1&p=<base64url(JSON)>` (hash stays out of server logs, bookmarkable); payload is a
 *   Preset-isomorphic subset (colors+gradients+name, per the `W-tb-P9` boundary decision — no
 *   typography/spacing tokens). Pure functions, core is DOM-free — URL assembly belongs to the web layer.
 *   Precedent research: WorkZone `dev/research/share-link-patterns-2026-11.md`.
 */
import type{GradientSettings,ThemeDraft}from'./types.js';
import{cloneGradientSettings}from'./data/gradients.js';
import{normalizeHex,validHex}from'./color/convert.js';

// 载荷格式版本：字段演进时升级并路由解析分支（对齐 TDON specVersion 思想）。
// <lang zh-CN>v1 固定为当前唯一版本；decode 对未知版本返回 null 并由 UI 提示。</lang>
// <lang en>v1 is the only version today; decode returns null on unknown versions for the UI to report.</lang>
const SHARE_VERSION=1 as const;
// hash 前缀与字段分隔：`hia=v1&p=<payload>`。
// <lang zh-CN>解析容错：带不带开头的 '#' 均可。</lang>
// <lang en>Tolerant parsing: works with or without the leading '#'.</lang>
const SHARE_HASH_PREFIX='hia=';
// 名称/备注截断上限：防极端输入撑爆链接（对齐对标页长度实测约定）。
// <lang zh-CN>name 80、note 200、category/industry 40——均远超正常使用。</lang>
// <lang en>name 80, note 200, category/industry 40 — all well above normal usage.</lang>
const LIMITS={name:80,note:200,taxonomy:40} as const;

// 分享载荷（v1）：与 Preset 同构但无 id（链接自身即凭证）。
// <lang zh-CN>颜色字段必填且解码时强校验；渐变可选（缺省=纯色主题）。</lang>
// <lang en>Color fields are required and strictly validated on decode; gradients optional (absent = flat theme).</lang>
export interface SharePayload{
  v:1;
  name:string;
  primary:string;
  secondary:string;
  primaryName:string;
  secondaryName:string;
  category?:string;
  industry?:string;
  note?:string;
  gradients?:GradientSettings;
}

// 字符串净化：截断 + 空白裁剪；非字符串回退空串。
// <lang zh-CN>分享载荷是外界输入，所有字符串字段过这里。</lang>
// <lang en>Share payloads are external input; every string field passes through here.</lang>
function sanitizeText(value:unknown,max:number):string{
  return typeof value==='string'?value.trim().slice(0,max):'';
}

// 由草稿构建分享载荷：只取颜色/名称/渐变（不含令牌组与 id）。
// <lang zh-CN>note 仅在有值时写入（保持载荷紧凑）；渐变整体深拷贝（cloneGradientSettings 自带非法值回退）。</lang>
// <lang en>note only written when present (keeps payload compact); gradients deep-cloned (cloneGradientSettings already repairs invalid values).</lang>
export function buildSharePayload(draft:ThemeDraft):SharePayload{
  const payload:SharePayload={
    v:SHARE_VERSION,
    name:sanitizeText(draft.name,LIMITS.name)||'HIA 主题',
    primary:normalizeHex(draft.primary),
    secondary:normalizeHex(draft.secondary),
    primaryName:sanitizeText(draft.primaryName,LIMITS.taxonomy)||'主色',
    secondaryName:sanitizeText(draft.secondaryName,LIMITS.taxonomy)||'副色'
  };
  // 可选字段：仅在非空时加入，控制载荷体积。
  // <lang zh-CN>category/industry/note 缺省不写入。</lang>
  // <lang en>category/industry/note omitted when absent.</lang>
  const category=sanitizeText(draft.category,LIMITS.taxonomy);
  if(category)payload.category=category;
  const industry=sanitizeText(draft.industry,LIMITS.taxonomy);
  if(industry)payload.industry=industry;
  const note=sanitizeText(draft.note,LIMITS.note);
  if(note)payload.note=note;
  // 渐变：clone 后仅在存在角色时写入（cloneGradientSettings 恒产出全角色键，此处恒写入——字段紧凑但语义完整）。
  // <lang zh-CN>默认八角色全带（约 400 字符）；若未来体积告警可裁剪禁用角色。</lang>
  // <lang en>All eight roles carried (~400 chars); roles may be trimmed if size ever becomes a concern.</lang>
  payload.gradients=cloneGradientSettings(draft.gradients);
  return payload;
}

// base64url 编码 UTF-8 安全：先用 encodeURIComponent 把字符串转全 ASCII（%XX）再 btoa；
// 输出去 padding、把 +/ 换成 -_（URL/hash 安全）。
// <lang zh-CN>btoa 直接编码中文会抛错，经典两步技巧避免该问题且无废弃 API。</lang>
// <lang en>btoa throws on raw CJK; the classic two-step avoids deprecated APIs.</lang>
function base64UrlEncode(text:string):string{
  return btoa(encodeURIComponent(text)).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
}
// base64url 解码：先还原 +/ 与 padding，再 atob + decodeURIComponent 逆向。
// <lang zh-CN>非法输入抛错，由 decodeShareLink 统一捕获返回 null。</lang>
// <lang en>Invalid input throws; decodeShareLink catches and returns null.</lang>
function base64UrlDecode(encoded:string):string{
  let b64=encoded.replace(/-/g,'+').replace(/_/g,'/');
  while(b64.length%4!==0)b64+='=';
  return decodeURIComponent(atob(b64));
}

// 紧凑编码（Tailwind Play 同思路）：JSON 键名换位置化数组，默认主题 hash 从 ~2600 字符降到 ~1000。
// <lang zh-CN>CompactPayload 顺序固定：[v,name,primary,secondary,primaryName,secondaryName,
//   category?,industry?,note?,gradients?]；渐变值数组 [enabled(0/1),family,start,end,direction,bias]。
//   破坏性变更需升 SHARE_VERSION。</lang>
// <lang en>Compact form: positional array replaces JSON keys; gradient values become arrays
//   [enabled(0/1),family,start,end,direction,bias]. Bump SHARE_VERSION on breaking changes.</lang>
type CompactGradient=[number,string,string,string,string,string];
type CompactPayload=[number,string,string,string,string,string,string?,string?,string?,Record<string,CompactGradient>?];

// 载荷 → 紧凑形态（内部序列化用；可选字段为空串占位以保持位置对齐）。
// <lang zh-CN>空可选字段写空串而非 undefined——JSON 数组中 undefined 会丢失导致位次错乱。</lang>
// <lang en>Empty strings (not undefined) for absent optionals — undefined would drop and shift positions in JSON arrays.</lang>
function toCompact(p:SharePayload):CompactPayload{
  const gradients:Record<string,CompactGradient>={};
  for(const[k,g]of Object.entries(p.gradients??{})){
    gradients[k]=[g.enabled===false?0:1,g.family,g.start,g.end,g.direction,g.bias];
  }
  return[
    p.v,p.name,p.primary,p.secondary,p.primaryName,p.secondaryName,
    p.category??'',p.industry??'',p.note??'',
    Object.keys(gradients).length?gradients:undefined
  ];
}

// 紧凑形态 → 载荷（字段净化与 HEX 校验共用主链）。
// <lang zh-CN>渐变重建后交给 cloneGradientSettings 校验（非法值回退默认，与 ADR-004 一致）。</lang>
// <lang en>Rebuilt gradients go through cloneGradientSettings (invalid values fall back, per ADR-004).</lang>
function fromCompact(arr:unknown[]):SharePayload|null{
  // 长度下限：v+四个必填字段 = 6；少于即非法。
  // <lang zh-CN>可选尾段缺失容忍（v1 早期产物兼容）。</lang>
  // <lang en>Missing optional tail tolerated (compat with early v1).</lang>
  if(arr.length<6)return null;
  const primary=normalizeHex(sanitizeText(arr[2],16));
  const secondary=normalizeHex(sanitizeText(arr[3],16));
  if(!validHex(primary)||!validHex(secondary))return null;
  const payload:SharePayload={
    v:SHARE_VERSION,
    name:sanitizeText(arr[1],LIMITS.name)||'HIA 主题',
    primary,
    secondary,
    primaryName:sanitizeText(arr[4],LIMITS.taxonomy)||'主色',
    secondaryName:sanitizeText(arr[5],LIMITS.taxonomy)||'副色'
  };
  const category=sanitizeText(arr[6],LIMITS.taxonomy);
  if(category)payload.category=category;
  const industry=sanitizeText(arr[7],LIMITS.taxonomy);
  if(industry)payload.industry=industry;
  const note=sanitizeText(arr[8],LIMITS.note);
  if(note)payload.note=note;
  // 渐变：紧凑对象重建为 GradientConfig 形态，非法结构整体忽略（容忍为无渐变）。
  // <lang zh-CN>值数组长度须为 6；enabled 用 0/1 编码。</lang>
  // <lang en>Value arrays must have length 6; enabled is 0/1.</lang>
  const gRaw=arr[9] as Record<string,unknown>|undefined;
  if(gRaw&&typeof gRaw==='object'){
    const rebuilt:GradientSettings={};
    let valid=true;
    for(const[k,v]of Object.entries(gRaw)){
      if(!Array.isArray(v)||v.length!==6){valid=false;break;}
      // ShadeValue/GradientBias 断言：形态由 cloneGradientSettings 校验兜底（非法回退默认）。
      // <lang zh-CN>数值档/占比合法性不在重建处强校验，统一走 ADR-004 校验链。</lang>
      // <lang en>Numeric shade/bias validity is delegated to the ADR-004 chain, not re-checked here.</lang>
      rebuilt[k]={enabled:v[0]!==0,family:v[1] as 'primary'|'secondary',start:v[2] as import('./types.js').ShadeValue,end:v[3] as import('./types.js').ShadeValue,direction:v[4] as string,bias:v[5] as import('./types.js').GradientBias};
    }
    if(valid&&Object.keys(rebuilt).length)payload.gradients=cloneGradientSettings(rebuilt);
  }
  return payload;
}

// 编码分享载荷为链接载荷段：`v1&p=<base64url>`（hash 内容，不含 '#' 与 host）。
// <lang zh-CN>web 层拼接 `${origin}${pathname}#hia=<本函数返回值去掉 'hia=' 前缀形态>` ——
//   实际约定：本函数返回完整 hash 值 `hia=v1&p=…`，调用方直接 `#${返回值}`。</lang>
// <lang en>The web layer assembles `#<returned>` directly; this returns the full hash value `hia=v1&p=…`.</lang>
export function encodeShareHash(payload:SharePayload):string{
  // 紧凑数组序列化后编码；字段位次固定，保证同载荷逐字节一致（可复现）。
  // <lang zh-CN>不 pretty-print——最小化长度。</lang>
  // <lang en>No pretty-print — minimize length.</lang>
  const json=JSON.stringify(toCompact(payload));
  return`${SHARE_HASH_PREFIX}v${SHARE_VERSION}&p=${base64UrlEncode(json)}`;
}

// 解码分享 hash 为载荷；任何一步非法返回 null（UI 提示"链接无效"）。
// <lang zh-CN>容错范围：前缀（带不带 #）、版本号、base64、JSON 数组结构、HEX 合法性、渐变 clone 校验。
//   name 缺省回退 'HIA 主题'。</lang>
// <lang en>Tolerant of leading '#'; strict about version/base64/JSON-array/HEX; gradients pass clone
//   validation. Missing name falls back to the default title.</lang>
export function decodeShareHash(hash:string):SharePayload|null{
  // 归一化输入：去首 '#' 与空白。
  // <lang zh-CN>调用方可能传 location.hash（带 #）或裸值。</lang>
  // <lang en>Callers may pass location.hash (with #) or the bare value.</lang>
  const raw=hash.trim().replace(/^#/,'');
  if(!raw.startsWith(SHARE_HASH_PREFIX))return null;
  const body=raw.slice(SHARE_HASH_PREFIX.length);
  // 版本解析：v<pn>；仅识别 v1，其它版本显式拒绝（提示升级而非静默错解）。
  // <lang zh-CN>m[1] 为版本号（不带 'v'）。</lang>
  // <lang en>m[1] is the version number without the 'v'.</lang>
  const m=/^v(\d+)&p=([A-Za-z0-9_-]+)$/.exec(body);
  if(!m)return null;
  if(parseInt(m[1]!,10)!==SHARE_VERSION)return null;
  let json:string;
  try{
    json=base64UrlDecode(m[2]!);
  }catch{
    return null;
  }
  let parsed:unknown;
  try{
    parsed=JSON.parse(json);
  }catch{
    return null;
  }
  // 紧凑形态必须是数组；其余形态（对象/标量）拒绝。
  // <lang zh-CN>v1 仅定义数组形态。</lang>
  // <lang en>v1 defines the array form only.</lang>
  if(!Array.isArray(parsed))return null;
  // 首位版本号校验：与 hash 段一致才继续。
  // <lang zh-CN>双重版本位（hash 段 + 数组首位）防错配。</lang>
  // <lang en>Dual version positions (hash segment + array head) prevent mismatched payloads.</lang>
  if(parsed[0]!==SHARE_VERSION)return null;
  return fromCompact(parsed);
}
