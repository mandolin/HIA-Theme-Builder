/**
 * @lang zh-CN TDON 导出适配器（`W-tb-P26` / 规范 §6）：把已校验的 TDON 清单转换为与内置适配器同构的
 *   `ExportTarget`，产物为虚拟文件树（纯函数，core 无 IO）。
 *   安全要点：①插值**只替换一次**（TDON-6.7，防主题名里的 `{{…}}` 二次展开）；
 *   ②路径在渲染与打包两侧各校验一遍（TDON-11.1，不信任单点校验）；
 *   ③未知令牌引用不静默留空，而是抛错——导出物缺色比报错更难排查。
 * @lang en TDON export adapter (`W-tb-P26` / spec §6): turns a validated manifest into an `ExportTarget`
 *   isomorphic to the built-in adapters, producing a virtual file tree (pure function, core stays IO-free).
 *   Security: (1) interpolation replaces **once only** (TDON-6.7, so a theme name containing `{{…}}` cannot
 *   expand again); (2) paths are validated on both render and packaging sides (TDON-11.1); (3) unresolvable
 *   token refs throw rather than silently blanking — a missing color is harder to diagnose than an error.
 */
import type{Theme}from'@hia/theme-core';
import type{ExportTarget,VirtualFile}from'@hia/theme-core';
import type{TdonDocument}from'./types.js';
import{checkTdonPath}from'./paths.js';
import{resolveTdonToken,tdonBuiltinTokensCss}from'./resolve.js';
import{exportThemeJson}from'@hia/theme-core';
import{slugifyThemeName}from'@hia/theme-core';
// TDOT 求值（ADR-011 §5.1）：`template.body` 的展开在导出侧按需执行。
// <lang zh-CN>放在导出侧而非校验侧——求值需要 buildInfo，而校验器不接触宿主环境。</lang>
// <lang en>Evaluation lives here rather than in the validator: it needs buildInfo, and the validator never
//   touches host state.</lang>
import{evaluateTdot,shouldEvaluateTdot,tdotData}from'./tdot/eval.js';
import type{TdotBuildInfo,TdotError,TdotWarning}from'./tdot/types.js';

// 内置模板引用 → 文本生成器（白名单，TDON-6.5）。
// <lang zh-CN>新增内置模板必须在此登记，并同步规范 §6.5 白名单与单测。</lang>
// <lang en>New builtin templates must be registered here and mirrored in spec §6.5 plus tests.</lang>
const BUILTIN_TEMPLATES:Record<string,((theme:Theme)=>string)>={
  'builtin:hia-tokens-css':theme=>tdonBuiltinTokensCss(theme),
  'builtin:hia-tokens-json':theme=>exportThemeJson(theme)
};

// 展开单次插值：`{{token:<ref>}}` 与 `{{meta:name|id}}`。
// <lang zh-CN>用 split/join 而非 replace(RegExp) 之外的回调重扫——替换结果**不再**参与匹配，
//   这是 TDON-6.7 的核心保证。</lang>
// <lang en>Uses a single non-rescanning pass: replacement output is **not** matched again, which is the
//   core guarantee of TDON-6.7.</lang>
function interpolate(template:string,theme:Theme,doc:TdonDocument):string{
  // 单次扫描：正则一次性抓取所有占位，然后按序拼接。由于拼接不进入再匹配，天然满足"只替换一次"。
  // <lang zh-CN>不可解析的令牌直接抛错（导出物缺色难以排查）。</lang>
  // <lang en>An unresolvable token throws — a missing color in an artifact is hard to diagnose.</lang>
  let out='';
  let last=0;
  const re=/\{\{(token:[^{}]+|meta:(?:name|id))\}\}/g;
  let m:RegExpExecArray|null;
  while((m=re.exec(template))!==null){
    out+=template.slice(last,m.index);
    const body=m[1]!;
    if(body.startsWith('meta:')){
      const key=body.slice(5);
      out+=key==='name'?doc.target.name:doc.target.id;
    }else{
      const ref=body.slice(6);
      const r=resolveTdonToken(theme,ref);
      if(!r.ok)throw new Error(`TDON 导出：令牌 ${ref} 无法解析（${r.reasonZh}）`);
      out+=r.value;
    }
    last=m.index+m[0].length;
  }
  // 尾部剩余文本原样保留（含未匹配的 `{{`，它们在再匹配中也不会被处理）。
  // <lang zh-CN>未匹配的花括号保持字面，等价于"不再解析"。</lang>
  // <lang en>Unmatched braces stay literal, which is equivalent to "never re-parsed".</lang>
  out+=template.slice(last);
  return out;
}

// 生成文件树（纯函数）：逐条展开 template / templateRef，路径二次校验。
// <lang zh-CN>路径非法时抛错而非跳过——静默丢弃会让用户拿到的 ZIP 与声明不符。</lang>
// <lang en>An illegal path throws instead of being skipped: silent drops would make the ZIP disagree with the declaration.</lang>
function tdonFiles(doc:TdonDocument,theme:Theme):VirtualFile[]{
  return doc.exportManifest.files.map(file=>{
    // 打包侧独立校验（TDON-11.1）：不因校验阶段已通过而放行。
    // <lang zh-CN>错误信息带路径，便于定位到具体条目。</lang>
    // <lang en>The message carries the path so the specific entry is identifiable.</lang>
    const pc=checkTdonPath(file.path);
    if(!pc.ok)throw new Error(`TDON 导出：路径非法 ${file.path}（${pc.reasonZh}）`);
    // templateRef 走白名单生成器；template 走单次插值。
    // <lang zh-CN>两者互斥由校验器保证，此处不重复判定。</lang>
    // <lang en>Mutual exclusivity is guaranteed by the validator; not re-checked here.</lang>
    const content=file.templateRef!==undefined
      ?(BUILTIN_TEMPLATES[file.templateRef]?.(theme)??'')
      :interpolate(file.template??'',theme,doc);
    return{path:file.path,content};
  });
}

// 构造 TDON 导出目标（与内置适配器同构，可直接进注册表或作为临时目标）。
// <lang zh-CN>archiveName 用目标 id slug 化，避免与内置目标文件名冲突。</lang>
// <lang en>archiveName slugifies the target id so it cannot collide with built-in artifact names.</lang>
export function createTdonExportTarget(doc:TdonDocument):ExportTarget{
  // 目标 id 已在校验阶段限定为 kebab-case，此处只需拼前缀。
  // <lang zh-CN>前缀 tdon- 让 UI 能一眼区分自定义目标。</lang>
  // <lang en>The tdon- prefix lets the UI distinguish custom targets at a glance.</lang>
  const id=`tdon-${doc.target.id}`;
  return{
    id,
    name:doc.target.name,
    nameEn:doc.target.nameEn,
    notes:`自定义支持（TDON）：来源 ${doc.target.author??'未署名'}，共 ${doc.exportManifest.files.length} 个导出文件。`,
    notesEn:`Custom support (TDON): by ${doc.target.author??'unknown'}, ${doc.exportManifest.files.length} export file(s).`,
    // 归档名：主题 slug + 目标 slug，双段便于同主题多目标区分。
    // <lang zh-CN>扩展名固定 .zip（打包由 UI 层 fflate 完成）。</lang>
    // <lang en>Extension is always .zip (fflate packaging happens in the UI layer).</lang>
    archiveName:theme=>`${slugifyThemeName(theme.name)}-${doc.target.id}.zip`,
    files:theme=>tdonFiles(doc,theme)
  };
}

/**
 * @lang zh-CN 求值 `template.body`（ADR-011 §5.1）：返回模板展开后的文本，供宿主写入导出产物或追加到预览。
 *   未声明 body 或版本不匹配时返回 `{ok:true}`（无 text）——调用方据此跳过，不视为错误。
 * @lang en Evaluates `template.body` (ADR-011 §5.1): returns expanded text for the host to write into artifacts
 *   or append to previews. Returns `{ok:true}` with no text when absent or version-mismatched — not an error.
 */
export function evaluateTemplateBody(
  doc:TdonDocument,
  build?:TdotBuildInfo
):{ok:true;text?:string;warnings:TdotWarning[]}|{ok:false;error:TdotError;warnings:TdotWarning[]}{
  const tpl=doc.template;
  // 方案 B（ADR-011 §5）：仅 `tdot-*` 且版本匹配才求值；无 body 则无需求值。
  // <lang zh-CN>两条件任一不满足都静默跳过，与"忽略占位内容"一致。</lang>
  // <lang en>Either condition failing means a silent skip, consistent with ignoring placeholders.</lang>
  if(!tpl||typeof tpl.body!=='string'||!shouldEvaluateTdot(tpl))return{ok:true,warnings:[]};
  const r=evaluateTdot(tpl.body,tdotData(tpl),build);
  if(!r.ok)return{ok:false,error:r.error,warnings:r.warnings};
  return{ok:true,text:r.output,warnings:r.warnings};
}

// 导出文件清单摘要（供 UI 在不生成内容时展示，避免大模板重复计算）。
// <lang zh-CN>只统计路径与声明来源，不展开模板。</lang>
// <lang en>Counts paths and declaration source only; templates are not expanded.</lang>
export function describeTdonFiles(doc:TdonDocument):{path:string;source:'template'|'builtin';bytes:number}[]{
  return doc.exportManifest.files.map(f=>({
    path:f.path,
    source:f.templateRef!==undefined?'builtin':'template',
    bytes:f.template!==undefined?new TextEncoder().encode(f.template).length:0
  }));
}
