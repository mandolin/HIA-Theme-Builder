/**
 * @lang zh-CN TDON 路径与键安全（`W-tb-P26` / 规范 TDON-6.2、TDON-11.1、TDON-11.3）：
 *   导出路径的相对性校验与 JSON 危险键拦截。两处都是"不信任外部输入"的边界，渲染与打包各自独立调用，
 *   不允许只在上游校验一次就放行。
 * @lang en TDON path and key safety (`W-tb-P26` / clauses TDON-6.2, TDON-11.1, TDON-11.3):
 *   relative-path validation for export paths and dangerous-key rejection for JSON. Both are trust boundaries:
 *   rendering and packaging each call them independently — a single upstream check is not treated as sufficient.
 */

// 单条导出路径长度上限（TDON-6.2）。
// <lang zh-CN>取 200 字符：足够表达深层目录，又能拦住构造的超长路径。</lang>
// <lang en>200 chars: room for deep directories while rejecting constructed giants.</lang>
export const TDON_MAX_PATH_LENGTH=200;

// JSON 危险键（TDON-11.3）：原型污染与构造器替换的经典入口。
// <lang zh-CN>用 Set 做 O(1) 判定；大小写敏感——JSON 键本身大小写敏感，`__PROTO__` 不构成污染。</lang>
// <lang en>O(1) lookup via Set; case-sensitive because JSON keys are — `__PROTO__` is not a pollution vector.</lang>
const DANGEROUS_KEYS:ReadonlySet<string>=new Set(['__proto__','constructor','prototype']);

// 判断键是否为危险键。
// <lang zh-CN>校验器在重建对象前逐键调用；命中即拒绝整个文档（不尝试"跳过该键"）。</lang>
// <lang en>The validator calls this per key before rebuilding an object; a hit rejects the whole document
//   (no attempt to merely skip the key).</lang>
export function isDangerousKey(key:string):boolean{
  return DANGEROUS_KEYS.has(key);
}

// 路径校验结果：合法时 normalized 为原始路径（不做重写），否则给出原因。
// <lang zh-CN>刻意不"清洗后放行"——路径被改写会让用户拿到的产物与声明不符，静默修正是更坏的失败方式。</lang>
// <lang en>Deliberately no "sanitize and continue": rewriting a path yields artifacts that differ from the
//   declaration, and a silent correction is a worse failure mode.</lang>
export interface TdonPathCheck{ok:boolean;reasonZh?:string;reasonEn?:string;}

// 校验导出相对路径（TDON-6.2）：POSIX 斜杠、相对、无 `..`、无盘符、无 `~`、无空段、非反斜杠、长度受限。
// <lang zh-CN>按顺序检查并返回首个失败原因，便于用户一次看清最直接的问题。</lang>
// <lang en>Checks run in order and return the first failure so the user sees the most direct problem.</lang>
export function checkTdonPath(path:unknown):TdonPathCheck{
  // 类型先判：非字符串无法进入后续规则。
  // <lang zh-CN>返回统一措辞，避免调用点各自拼文案。</lang>
  // <lang en>Uniform wording avoids per-call-site copy assembly.</lang>
  if(typeof path!=='string')return{ok:false,reasonZh:'路径必须是字符串。',reasonEn:'Path must be a string.'};
  // 空串与长度：空路径无意义，超长路径用于资源耗尽。
  // <lang zh-CN>先查长度再做分段分析，避免在超长串上重复扫描。</lang>
  // <lang en>Length is checked before segment analysis to avoid rescanning huge strings.</lang>
  if(path.length===0)return{ok:false,reasonZh:'路径不能为空。',reasonEn:'Path must not be empty.'};
  if(path.length>TDON_MAX_PATH_LENGTH)return{ok:false,reasonZh:`路径超过 ${TDON_MAX_PATH_LENGTH} 字符。`,reasonEn:`Path exceeds ${TDON_MAX_PATH_LENGTH} characters.`};
  // 反斜杠：统一要求 POSIX 斜杠，避免 Windows/Linux 产物路径不一致（ADR-005 可复现性要求）。
  // <lang zh-CN>不自动把 `\` 替换为 `/`——静默转换会掩盖声明错误。</lang>
  // <lang en>No automatic `\`→`/` conversion: silent rewriting would mask a declaration error.</lang>
  if(path.includes('\\'))return{ok:false,reasonZh:'路径必须使用正斜杠（不允许反斜杠）。',reasonEn:'Path must use forward slashes (no backslashes).'};
  // 绝对路径与盘符：以 `/` 开头或含 `X:` 一律拒绝。
  // <lang zh-CN>盘符判定用 `^[A-Za-z]:` 覆盖 Windows 风格，避免依赖运行时平台。</lang>
  // <lang en>Drive detection via `^[A-Za-z]:` covers Windows style independent of the host platform.</lang>
  if(path.startsWith('/'))return{ok:false,reasonZh:'路径必须是相对路径（不能以 / 开头）。',reasonEn:'Path must be relative (must not start with /).'};
  if(/^[A-Za-z]:/.test(path))return{ok:false,reasonZh:'路径不能包含盘符。',reasonEn:'Path must not contain a drive letter.'};
  // 家目录展开：`~` 开头在部分环境中会被解析，属越界访问面。
  // <lang zh-CN>`~/` 与裸 `~` 都拦截。</lang>
  // <lang en>Both `~/` and a bare `~` are rejected.</lang>
  if(path==='~'||path.startsWith('~/'))return{ok:false,reasonZh:'路径不能以 ~ 开头。',reasonEn:'Path must not start with ~.'};
  // 段级检查：空段（`a//b`）、`.`、`..` 全部拒绝；同时拦截 URL 编码形式的 `..`。
  // <lang zh-CN>`%2e%2e` 解码后仍是 `..`，部分解包器会先解码再落盘，故一并拒绝。</lang>
  // <lang en>`%2e%2e` decodes to `..` and some extractors decode before writing, so it is rejected too.</lang>
  const segments=path.split('/');
  for(const seg of segments){
    if(seg==='')return{ok:false,reasonZh:'路径不能包含空段（连续的 /）。',reasonEn:'Path must not contain empty segments (consecutive /).'};
    if(seg==='.'||seg==='..')return{ok:false,reasonZh:'路径不能包含 . 或 .. 段。',reasonEn:'Path must not contain . or .. segments.'};
    // 解码后再比对一次：仅当解码结果与原文不同才需要额外判定。
    // <lang zh-CN>用 try/catch 包住 decodeURIComponent（畸形百分号会抛错），抛错时按原文判定即可。</lang>
    // <lang en>decodeURIComponent is wrapped in try/catch (malformed percent sequences throw); on throw the
    //   literal segment judgement already applies.</lang>
    let decoded=seg;
    try{decoded=decodeURIComponent(seg);}catch{/* 畸形编码按原文处理 */}
    if(decoded==='..'||decoded==='.')return{ok:false,reasonZh:'路径段解码后不能是 . 或 ..。',reasonEn:'Decoded path segments must not be . or ..'};
  }
  return{ok:true};
}
