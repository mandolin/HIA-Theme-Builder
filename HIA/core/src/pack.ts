/**
 * @lang zh-CN 主题包清洗与导入合并（`W-tb-P10`）：远程预设源与本地库文件共用同一格式
 *   （ThemeLibraryDocument，schemaVersion:1）与同一条清洗链——"导出的文件可以直接托管为源"。
 *   安全边界：纯 JSON 不执行；脏条目丢弃并计数；永不静默覆盖本地预设。
 * @lang en Theme-pack sanitizing and import merging (`W-tb-P10`): remote preset sources and local
 *   library files share one format (ThemeLibraryDocument, schemaVersion:1) and one sanitizing chain —
 *   "an exported file can be hosted as a source directly". Security boundary: JSON-only, never executed;
 *   dirty entries are dropped with a count; never silently overwrites local presets.
 */
import type{Preset,GradientSettings}from'./types.js';
import{normalizeHex,validHex}from'./color/convert.js';
import{cloneGradientSettings}from'./data/gradients.js';

// 单条预设字段上限：与 share.ts LIMITS 同口径（外界输入一律截断）。
// <lang zh-CN>name/note/taxonomy 分别 80/200/40。</lang>
// <lang en>name/note/taxonomy are 80/200/40 respectively.</lang>
const LIMITS={name:80,note:200,taxonomy:40} as const;
// 远程源条目上限：防超巨源拖垮 UI（超出部分丢弃并计数）。
// <lang zh-CN>200 条对"浏览/搜索"场景已远超需要。</lang>
// <lang en>200 entries is far beyond browse/search needs.</lang>
export const THEME_PACK_MAX_PRESETS=200;

// 文本净化：字符串截断裁剪，非字符串回退空串。
// <lang zh-CN>与 share.ts 的 sanitizeText 同语义；独立实现避免互相耦合。</lang>
// <lang en>Same semantics as share.ts's sanitizeText; kept separate to avoid coupling.</lang>
function sanitizeText(value:unknown,max:number):string{
  return typeof value==='string'?value.trim().slice(0,max):'';
}

// 单条预设清洗：字段级校验/截断/回退，非法返回 null（由调用方计数丢弃）。
// <lang zh-CN>主副色 HEX 强校验；name 必填（空则丢弃）；gradients 过 clone 校验链；
//   id 缺省用 index 生成占位（合并层处理冲突）。</lang>
// <lang en>Strict HEX validation for colors; name required (dropped when empty); gradients pass the
//   clone chain; id falls back to an index-based placeholder (merge layer resolves clashes).</lang>
export function sanitizePreset(raw:unknown,index:number):Preset|null{
  if(!raw||typeof raw!=='object')return null;
  const r=raw as Record<string,unknown>;
  // name：预设的可读标识，为空视为脏数据。
  // <lang zh-CN>trim 后仍空 → 丢弃。</lang>
  // <lang en>Empty after trim → dropped.</lang>
  const name=sanitizeText(r.name,LIMITS.name);
  if(!name)return null;
  // 主副色：normalize 后仍非法 → 丢弃。
  // <lang zh-CN>validHex 才接受，绝不静默替换颜色。</lang>
  // <lang en>Accepted only when validHex passes; colors are never silently substituted.</lang>
  const primary=normalizeHex(sanitizeText(r.primary,16));
  const secondary=normalizeHex(sanitizeText(r.secondary,16));
  if(!validHex(primary)||!validHex(secondary))return null;
  // 渐变：仅接受对象形态，clone 链内非法值回退默认（与 ADR-004 校验一致）。
  // <lang zh-CN>缺失/非对象容忍为无渐变（纯色预设）。</lang>
  // <lang en>Missing/non-object tolerated as a flat preset.</lang>
  const gradients=(r.gradients&&typeof r.gradients==='object')
    ?cloneGradientSettings(r.gradients as GradientSettings)
    :undefined;
  // id：保留合法形态的传入 id，否则生成占位（合并层若遇冲突会重命名）。
  // <lang zh-CN>id 仅用于去重识别，不做安全假设。</lang>
  // <lang en>id is only for dedupe identity, never a security assumption.</lang>
  const rawId=sanitizeText(r.id,64);
  const id=/^[A-Za-z0-9_-]+$/.test(rawId)?rawId:`pack-${index}`;
  return{
    id,
    name,
    category:sanitizeText(r.category,LIMITS.taxonomy)||'custom',
    industry:sanitizeText(r.industry,LIMITS.taxonomy),
    primary,
    secondary,
    primaryName:sanitizeText(r.primaryName,LIMITS.taxonomy)||'主色',
    secondaryName:sanitizeText(r.secondaryName,LIMITS.taxonomy)||'副色',
    note:sanitizeText(r.note,LIMITS.note),
    ...(gradients?{gradients}:{})
  };
}

// 解析主题包（远程源或本地文件）：schemaVersion 路由 + 逐条清洗 + 计数截断。
// <lang zh-CN>返回清洗后的预设与丢弃计数（UI 可上报"丢弃 N 条无效预设"）；
//   任何解析层错误（非法 JSON/未知 schemaVersion）返回 null。</lang>
// <lang en>Returns sanitized presets plus a dropped count (UI reports "N invalid presets dropped");
//   parse-level failures (bad JSON / unknown schemaVersion) yield null.</lang>
export function parseThemePack(raw:string):{presets:Preset[];dropped:number}|null{
  // JSON 解析：任何异常返回 null。
  // <lang zh-CN>调用方（fetch/文件读取）已限大小/超时，这里只管内容合法性。</lang>
  // <lang en>The caller (fetch/file read) enforces size/timeout; here we only validate content.</lang>
  let parsed:unknown;
  try{
    parsed=JSON.parse(raw);
  }catch{
    return null;
  }
  if(!parsed||typeof parsed!=='object')return null;
  const doc=parsed as {schemaVersion?:unknown;presets?:unknown};
  // 版本路由：仅识别 schemaVersion:1（与 ThemeLibraryDocument 一致）。
  // <lang zh-CN>其它版本显式拒绝，提示源格式过新。</lang>
  // <lang en>Unknown versions are rejected explicitly (source format too new).</lang>
  if(doc.schemaVersion!==1||!Array.isArray(doc.presets))return null;
  const presets:Preset[]=[];
  let dropped=0;
  // 逐条清洗：脏条目丢弃计数；超上限截断。
  // <lang zh-CN>清洗函数永不抛错（内部全容错）。</lang>
  // <lang en>The sanitizer never throws (fully defensive).</lang>
  for(const item of doc.presets){
    if(presets.length>=THEME_PACK_MAX_PRESETS){dropped++;continue;}
    const clean=sanitizePreset(item,presets.length);
    if(clean)presets.push(clean);
    else dropped++;
  }
  return{presets,dropped};
}

// 导入合并：incoming 并入 local；id 冲突时给导入项重命名（<id>-imported，仍冲突则追加序号）。
// <lang zh-CN>本地预设永不覆盖/删除；返回合并结果与重命名计数（UI 提示"N 条因 id 冲突已重命名"）。</lang>
// <lang en>Local presets are never overwritten/deleted; returns the merge plus a rename count
//   (UI reports "N items renamed due to id clashes").</lang>
export function mergeImportedPresets(local:readonly Preset[],incoming:readonly Preset[]):{merged:Preset[];renamed:number}{
  // 已占用 id 集合：本地全部 + 本次已并入的导入项。
  // <lang zh-CN>集合语义避免 O(n²) 查找。</lang>
  // <lang en>A Set avoids O(n²) lookups.</lang>
  const taken=new Set(local.map(p=>p.id));
  const merged:Preset[]=[...local];
  let renamed=0;
  for(const item of incoming){
    let id=item.id;
    // 冲突消解：先加 -imported 后缀；仍冲突再追加递增序号。
    // <lang zh-CN>重命名仅改 id 不改 name（展示名保持原样）。</lang>
    // <lang en>Renames touch id only; the display name stays intact.</lang>
    if(taken.has(id)){
      id=`${item.id}-imported`;
      let seq=1;
      while(taken.has(id)){id=`${item.id}-imported-${seq}`;seq++;}
      renamed++;
    }
    taken.add(id);
    merged.push({...item,id});
  }
  return{merged,renamed};
}
