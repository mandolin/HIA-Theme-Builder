/**
 * @lang zh-CN TDON 预览渲染器（`W-tb-P26` / 规范 §5、§9）：把已校验的节点树渲染为 HTML 片段字符串。
 *   安全模型：①全部文本经 `escapeHtml`；②样式只用**令牌解析出的值**拼进内联 style，不接受任何外部字符串
 *   直接作 CSS（TDON-5.5 / TDON-11.2）；③节点类型与属性已在校验阶段白名单化，此处只按 type 分派。
 * @lang en TDON preview renderer (`W-tb-P26` / spec §5, §9): renders a validated node tree into HTML fragment
 *   strings. Security model: (1) all text is `escapeHtml`-escaped; (2) styles only ever interpolate **resolved
 *   token values**, never external strings as raw CSS (TDON-5.5 / TDON-11.2); (3) node types and attributes are
 *   already whitelisted by the validator — this layer only dispatches on type.
 */
import type{Theme}from'@hia/theme-core';
import{TDON_MAX_NESTING,type TdonDocument,type TdonNode,type TdonEffect}from'./types.js';
import{resolveTdonToken}from'./resolve.js';

// HTML 转义：文本节点与属性值统一走此函数（TDON-5.4）。
// <lang zh-CN>覆盖 & < > " ' 五个字符；不处理反引号（不进入 HTML 语法位置）。</lang>
// <lang en>Covers & < > " '; backticks are untouched (they never enter an HTML syntax position here).</lang>
export function escapeTdonHtml(text:string):string{
  return text
    .replace(/&/g,'&amp;')
    .replace(/</g,'&lt;')
    .replace(/>/g,'&gt;')
    .replace(/"/g,'&quot;')
    .replace(/'/g,'&#39;');
}

// 把令牌引用解析为 CSS 值；失败返回空串（不渲染该声明，避免崩出非法 CSS）。
// <lang zh-CN>校验通过后仍可能因主题变更而失败（TDON-8.3 降级路径），故此处必须容错。</lang>
// <lang en>Even after validation a theme change can break a reference (TDON-8.3 fallback), so this must be tolerant.</lang>
function css(theme:Theme,ref:unknown):string{
  if(typeof ref!=='string')return'';
  const r=resolveTdonToken(theme,ref);
  return r.ok?r.value:'';
}

// 渲染远程图片（TDON-5.12 / 5.13）：懒加载 + 不发送 referrer。
// <lang zh-CN>地址已在校验阶段限定为 https 且长度受限；这里再做一次属性转义。
//   lazy 与 no-referrer 是隐私与性能默认值，不由 TDON 文件控制。</lang>
// <lang en>The URL was already constrained to https with a length cap at validation; here it is attribute-escaped
//   again. lazy + no-referrer are defaults for privacy and performance, not controlled by the TDON file.</lang>
function imageEl(url:unknown,cls:string):string{
  if(typeof url!=='string'||url==='')return'';
  return`<img class="${cls}" src="${escapeTdonHtml(url)}" alt="" loading="lazy" referrerpolicy="no-referrer">`;
}

// 组装内联 style：只拼接"属性名 + 已解析值"，属性名来自本模块常量。
// <lang zh-CN>空值声明被丢弃，避免出现 `color:;` 这类无效声明。</lang>
// <lang en>Empty declarations are dropped, avoiding invalid `color:;`-style output.</lang>
function style(decls:[string,string][]):string{
  const body=decls.filter(([,v])=>v!=='').map(([k,v])=>`${k}:${v}`).join(';');
  return body?` style="${body}"`:'';
}

// 特效类名与额外属性：type → 固定类名（TDON-9.3）。
// <lang zh-CN>distance/duration 通过 CSS 自定义属性传入固定 keyframes，不接受任意 transform 字符串。</lang>
// <lang en>distance/duration travel as custom properties into fixed keyframes; no arbitrary transform strings.</lang>
function effectAttrs(effect:TdonEffect|undefined):{cls:string;styleAttr:string}{
  if(!effect)return{cls:'',styleAttr:''};
  if(effect.type==='gradient-shift')return{cls:' tdon-fx-gradient-shift',styleAttr:''};
  if(effect.type==='fade-in')return{cls:' tdon-fx-fade-in',styleAttr:` style="--tdon-fx-duration:${effect.duration}ms"`};
  return{cls:' tdon-fx-hover-lift',styleAttr:` style="--tdon-fx-lift:${effect.distance}px"`};
}

// 渲染单个节点（含 children 递归）。
// <lang zh-CN>effect 通过 doc.effects 查表；未声明时静默忽略（校验阶段已报 E_EFFECT_UNKNOWN）。
//   **前置契约**：node 必须是校验器重建后的节点（含 `attrs`）。直接传裸 JSON 会在 `node.attrs.children`
//   处抛错——冒烟测试（`W-tb-P31`）踩到过。这里补一层防御：缺 attrs 时按空对象处理并跳过 children，
//   让误用在运行时退化为"渲染空内容"而不是崩栈。</lang>
// <lang en>Effect is looked up in doc.effects; an undeclared id is silently skipped (validation already flagged it).
//   **Precondition**: node must be a validated node (with `attrs`). Passing raw JSON used to throw at
//   `node.attrs.children` — hit during the `W-tb-P31` smoke test. Defensive: missing attrs becomes an empty
//   object and children are skipped, degrading to "renders empty" instead of a stack crash.</lang>
function renderNode(theme:Theme,node:TdonNode,doc:TdonDocument,depth:number):string{
  const eff=node.effect?doc.effects?.[node.effect]:undefined;
  const fx=effectAttrs(eff);
  const idAttr=node.id?` data-tdon-id="${escapeTdonHtml(node.id)}"`:'';
  // 递归渲染 children：深度上限由校验器保证（TDON_MAX_NESTING），此处按同一常量判定。
  // <lang zh-CN>子节点包在统一容器内，便于布局类控制间距。</lang>
  // <lang en>Children are wrapped in a uniform container so layout classes control spacing.</lang>
  const kids=depth<TDON_MAX_NESTING-1?renderChildren(theme,(node.attrs??{}).children as TdonNode[]|undefined,doc,depth+1):'';
  const a=node.attrs??{};
  switch(node.type){
    // hero：主视觉。bgToken 常为渐变；标题字号取 fs 档变量。
    // <lang zh-CN>actions 渲染为 span（非按钮）——预览不提供交互（TDON-5.9 同理）。</lang>
    // <lang en>Actions render as spans, not buttons — the preview offers no interaction (same rationale as TDON-5.9).</lang>
    case 'hero':{
      const bg=css(theme,a.bgToken);
      const actions=Array.isArray(a.actions)?a.actions.map((act)=>{
        const label=escapeTdonHtml(String((act as {label:string}).label??''));
        const token=css(theme,(act as {token?:string}).token);
        return`<span class="tdon-hero-action"${token?` style="background:${token}"`:''}>${label}</span>`;
      }).join(''):'';
      // 图片作为底层铺满、文字叠在其上（hero 的常见形态）；无图片时不产生额外节点。
      // <lang zh-CN>图片层绝对定位由样式表控制，渲染器只负责产出结构。</lang>
      // <lang en>The image layer's absolute positioning lives in the stylesheet; the renderer only emits structure.</lang>
      const heroImg=imageEl(a.imageUrl,'tdon-hero-img');
      return`<section class="tdon-node tdon-hero${fx.cls}${heroImg?' has-image':''}"${idAttr}${bg?` style="background:${bg}"`:''}${fx.styleAttr}>
  ${heroImg}
  <h2 class="tdon-hero-title">${escapeTdonHtml(String(a.title??''))}</h2>
  ${a.subtitle?`<p class="tdon-hero-sub">${escapeTdonHtml(String(a.subtitle))}</p>`:''}
  ${actions?`<div class="tdon-hero-actions">${actions}</div>`:''}
  ${kids}
</section>`;
    }
    // nav：导航条。items 已在校验阶段归一化为 {label, active}。
    // <lang zh-CN>active 项用 activeToken 上色，其余用 bgToken 作为整体背景。</lang>
    // <lang en>Active items use activeToken; bgToken colors the bar itself.</lang>
    case 'nav':{
      const bg=css(theme,a.bgToken);
      const activeCss=css(theme,a.activeToken);
      const items=Array.isArray(a.items)?a.items.map((raw)=>{
        const it=raw as {label:string;active?:boolean};
        const st=it.active&&activeCss?` style="color:${activeCss}"`:'';
        return`<span class="tdon-nav-item${it.active?' is-active':''}"${st}>${escapeTdonHtml(String(it.label??''))}</span>`;
      }).join(''):'';
      return`<nav class="tdon-node tdon-nav${fx.cls}"${idAttr}${bg?` style="background:${bg}"`:''}${fx.styleAttr}>${items}${kids}</nav>`;
    }
    // card：内容卡。bg/title/text 三个令牌独立，便于表达卡内层级。
    // <lang zh-CN>text 保留换行为 <br>，与 raw-text 一致。</lang>
    // <lang en>text keeps newlines as <br>, matching raw-text.</lang>
    case 'card':{
      const bg=css(theme,a.bgToken);const tc=css(theme,a.titleToken);const xc=css(theme,a.textToken);
      const cardImg=imageEl(a.imageUrl,'tdon-card-img');
      return`<div class="tdon-node tdon-card${fx.cls}"${idAttr}${bg?` style="background:${bg}"`:''}${fx.styleAttr}>
  ${cardImg}
  <h3 class="tdon-card-title"${tc?` style="color:${tc}"`:''}>${escapeTdonHtml(String(a.title??''))}</h3>
  ${a.text?`<p class="tdon-card-text"${xc?` style="color:${xc}"`:''}>${nl2br(String(a.text))}</p>`:''}
  ${kids}
</div>`;
    }
    // stats：指标组。数值为静态演示文本（不做数值计算）。
    // <lang zh-CN>label/value 令牌分离，常配合浅底深字。</lang>
    // <lang en>Separate label/value tokens are typically used on a light background with dark text.</lang>
    case 'stats':{
      const lc=css(theme,a.labelToken);const vc=css(theme,a.valueToken);
      const items=Array.isArray(a.items)?a.items.map((raw)=>{
        const it=raw as {label:string;value:string};
        return`<div class="tdon-stat"><b class="tdon-stat-value"${vc?` style="color:${vc}"`:''}>${escapeTdonHtml(String(it.value??''))}</b><span class="tdon-stat-label"${lc?` style="color:${lc}"`:''}>${escapeTdonHtml(String(it.label??''))}</span></div>`;
      }).join(''):'';
      return`<div class="tdon-node tdon-stats${fx.cls}"${idAttr}${fx.styleAttr}>${items}${kids}</div>`;
    }
    // list：列表。markerToken 控制项目符号颜色。
    // <lang zh-CN>用 ::marker 着色需内联自定义属性，故写成 li 的 list-style 颜色类。</lang>
    // <lang en>Coloring ::marker needs a custom property, so the marker color is set via a class on the li.</lang>
    case 'list':{
      const tc=css(theme,a.textToken);const mc=css(theme,a.markerToken);
      const items=Array.isArray(a.items)?a.items.map((raw)=>{
        return`<li${tc?` style="color:${tc}"`:''}${mc?` data-marker="${mc}"`:''}>${escapeTdonHtml(String(raw))}</li>`;
      }).join(''):'';
      return`<ul class="tdon-node tdon-list${fx.cls}"${idAttr}${fx.styleAttr}>${items}${kids}</ul>`;
    }
    // table：表格。列键已校验，行值已归一化为字符串（缺键渲染空单元格）。
    // <lang zh-CN>表头与单元格令牌分离；行数上限由校验阶段保证。</lang>
    // <lang en>Header/cell tokens are separate; row caps are enforced at validation time.</lang>
    case 'table':{
      const hc=css(theme,a.headerToken);const cc=css(theme,a.cellToken);
      const cols=Array.isArray(a.columns)?a.columns as {key:string;label:string}[]:[];
      const rows=Array.isArray(a.rows)?a.rows as Record<string,string>[]:[];
      const head=cols.map(c=>`<th${hc?` style="color:${hc}"`:''}>${escapeTdonHtml(c.label)}</th>`).join('');
      const body=rows.map(r=>`<tr>${cols.map(c=>`<td${cc?` style="color:${cc}"`:''}>${escapeTdonHtml(r[c.key]??'')}</td>`).join('')}</tr>`).join('');
      return`<div class="tdon-node tdon-table-wrap${fx.cls}"${idAttr}${fx.styleAttr}><table class="tdon-table"><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table>${kids}</div>`;
    }
    // form：只读展示（TDON-5.9）。控件一律 disabled，不绑定提交。
    // <lang zh-CN>禁用态由样式表达，属性 disabled 保证键盘也无法操作。</lang>
    // <lang en>Disabled is both styled and set as an attribute, so keyboard input cannot operate it either.</lang>
    case 'form':{
      const ac=css(theme,a.accentToken);
      const fields=Array.isArray(a.fields)?a.fields.map((raw)=>{
        const f=raw as {label:string;type:string};
        const label=escapeTdonHtml(f.label);
        const control=f.type==='textarea'
          ?`<textarea class="tdon-input" rows="2" disabled></textarea>`
          :f.type==='select'
            ?`<select class="tdon-input" disabled><option>—</option></select>`
            :`<input class="tdon-input" type="${f.type==='email'?'email':'text'}" disabled>`;
        return`<label class="tdon-field"><span class="tdon-field-label">${label}</span>${control}</label>`;
      }).join(''):'';
      const submit=a.submitLabel?`<span class="tdon-submit"${ac?` style="background:${ac}"`:''}>${escapeTdonHtml(String(a.submitLabel))}</span>`:'';
      return`<div class="tdon-node tdon-form${fx.cls}"${idAttr}${fx.styleAttr}>${fields}${submit}${kids}</div>`;
    }
    // divider：分隔线。thickness 1–4（校验已限域）。
    // <lang zh-CN>用 border-top 宽度表达，颜色取令牌。</lang>
    // <lang en>Expressed via border-top width; color from the token.</lang>
    case 'divider':{
      const c=css(theme,a.token);
      const w=typeof a.thickness==='number'?a.thickness:1;
      return`<div class="tdon-node tdon-divider${fx.cls}"${idAttr}${c?` style="border-top:${w}px solid ${c}"`:''}${fx.styleAttr}></div>`;
    }
    // raw-text：纯文本段。\n → <br>，其余全部转义（TDON-5.11）。
    // <lang zh-CN>size 为 fs:<step> 令牌，解析后作为 font-size。</lang>
    // <lang en>size is an fs:<step> token, resolved into font-size.</lang>
    default:{
      const tc=css(theme,a.textToken);const sz=css(theme,a.size);
      const decls:[string,string][]=[];
      if(tc)decls.push(['color',tc]);
      if(sz)decls.push(['font-size',sz]);
      return`<p class="tdon-node tdon-raw-text${fx.cls}"${idAttr}${style(decls)}${fx.styleAttr}>${nl2br(String(a.text??''))}</p>`;
    }
  }
}

// 渲染 children 列表。
// <lang zh-CN>无 children 时返回空串，调用方无需判空。</lang>
// <lang en>Returns an empty string when absent, so callers need no null checks.</lang>
function renderChildren(theme:Theme,kids:TdonNode[]|undefined,doc:TdonDocument,depth:number):string{
  if(!Array.isArray(kids)||kids.length===0)return'';
  return`<div class="tdon-children">${kids.map(k=>renderNode(theme,k,doc,depth)).join('')}</div>`;
}

// 换行转 <br>：先整体转义，再把已转义文本中的 \n 替换为 <br>。
// <lang zh-CN>顺序不可颠倒——先替换后转义会把 <br> 也转义掉。</lang>
// <lang en>Order matters — replacing before escaping would escape the <br> too.</lang>
function nl2br(text:string):string{
  return escapeTdonHtml(text).replace(/\n/g,'<br>');
}

// 渲染整份预览：标题 + 布局类 + 节点序列。
// <lang zh-CN>布局只影响外层容器类名，具体排布由随包 CSS 提供（不生成任意 CSS）。
//   入参 doc 应为 `parseTdonDocument` 返回的文档（节点已归一化）。传裸 JSON 时节点缺 `attrs`，
//   渲染为空内容而非抛错——门槛在 API 注释与返回类型上，不在运行时崩栈。</lang>
// <lang en>Layout only selects a container class; concrete arrangement comes from the packaged CSS (no generated CSS).
//   `doc` should come from `parseTdonDocument` (nodes normalized). Raw JSON yields empty node content rather
//   than throwing — the contract lives in the API docs and types, not in a runtime crash.</lang>
export function renderTdonPreview(doc:TdonDocument,theme:Theme):string{
  const preview=doc?.preview;
  if(!preview)return'';
  const title=preview.title?`<div class="tdon-preview-title">${escapeTdonHtml(preview.title)}</div>`:'';
  const nodes=(preview.nodes??[]).map(n=>renderNode(theme,n,doc,0)).join('\n');
  return`<div class="tdon-preview tdon-layout-${preview.layout}">${title}${nodes}</div>`;
}

// 预览所需 CSS（随 core 分发，不含任何用户输入）。
// <lang zh-CN>特效 keyframes 为固定定义：只读 opacity 与 translateY（TDON-9.6），
//   prefers-reduced-motion 下整体关闭（TDON-9.5）。</lang>
// <lang en>Effect keyframes are fixed: opacity and translateY only (TDON-9.6), fully disabled under
//   prefers-reduced-motion (TDON-9.5).</lang>
export const TDON_PREVIEW_CSS=`
.tdon-preview{display:flex;flex-direction:column;gap:12px;font-family:var(--hia-font-body,system-ui,sans-serif);line-height:var(--hia-line-height-body,1.6)}
.tdon-preview-title{font-size:var(--hia-fs-h3,18px);font-weight:700}
.tdon-layout-sidebar-left .tdon-nav,.tdon-layout-sidebar-right .tdon-nav{max-width:220px}
.tdon-node{border-radius:10px}
.tdon-hero{padding:24px;border-radius:12px;color:#fff}
.tdon-hero-title{margin:0 0 6px;font-size:var(--hia-fs-h2,22px)}
.tdon-hero-sub{margin:0;opacity:.9;font-size:var(--hia-fs-small,14px)}
.tdon-hero.has-image{position:relative;overflow:hidden}
.tdon-hero-img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;opacity:.35;pointer-events:none}
.tdon-hero.has-image > *:not(.tdon-hero-img){position:relative}
.tdon-card-img{display:block;width:100%;aspect-ratio:16/9;object-fit:cover;border-radius:8px;margin-bottom:10px;background:rgba(0,0,0,.05)}
.tdon-hero-actions{display:flex;gap:8px;margin-top:12px}
.tdon-hero-action{display:inline-block;padding:6px 14px;border-radius:999px;background:rgba(255,255,255,.22);font-size:var(--hia-fs-small,14px)}
.tdon-nav{display:flex;gap:14px;align-items:center;padding:10px 14px;border-radius:10px;background:rgba(0,0,0,.04)}
.tdon-nav-item{font-size:var(--hia-fs-small,14px);opacity:.85}
.tdon-nav-item.is-active{font-weight:700;opacity:1}
.tdon-card{padding:16px;background:rgba(0,0,0,.03);border:1px solid rgba(0,0,0,.06)}
.tdon-card-title{margin:0 0 6px;font-size:var(--hia-fs-h3,18px)}
.tdon-card-text{margin:0;font-size:var(--hia-fs-body,16px)}
.tdon-stats{display:flex;gap:16px;flex-wrap:wrap}
.tdon-stat{display:flex;flex-direction:column;gap:2px;min-width:96px}
.tdon-stat-value{font-size:var(--hia-fs-h2,22px)}
.tdon-stat-label{font-size:var(--hia-fs-small,14px);opacity:.75}
.tdon-list{margin:0;padding-left:20px;font-size:var(--hia-fs-body,16px)}
.tdon-list li{list-style:disc}
.tdon-table{width:100%;border-collapse:collapse;font-size:var(--hia-fs-small,14px)}
.tdon-table th,.tdon-table td{padding:8px 10px;border-bottom:1px solid rgba(0,0,0,.08);text-align:left}
.tdon-form{display:flex;flex-direction:column;gap:10px;padding:16px;background:rgba(0,0,0,.02)}
.tdon-field{display:flex;flex-direction:column;gap:4px}
.tdon-field-label{font-size:var(--hia-fs-small,14px);opacity:.8}
.tdon-input{padding:7px 10px;border:1px solid rgba(0,0,0,.16);border-radius:8px;font-size:var(--hia-fs-small,14px);background:#fff}
.tdon-submit{align-self:flex-start;padding:7px 16px;border-radius:8px;color:#fff;font-size:var(--hia-fs-small,14px)}
.tdon-divider{border-top:1px solid rgba(0,0,0,.14);height:0;margin:4px 0}
.tdon-raw-text{margin:0;font-size:var(--hia-fs-body,16px)}
.tdon-children{display:flex;flex-direction:column;gap:10px;margin-top:12px}
.tdon-fx-gradient-shift{background-size:200% 100%;animation:tdon-gradient-shift 6s linear infinite}
.tdon-fx-fade-in{animation:tdon-fade-in var(--tdon-fx-duration,400ms) ease-out both}
.tdon-fx-hover-lift{transition:transform 160ms ease}
.tdon-fx-hover-lift:hover{transform:translateY(calc(var(--tdon-fx-lift,2px) * -1))}
@keyframes tdon-gradient-shift{from{background-position:0% 50%}to{background-position:100% 50%}}
@keyframes tdon-fade-in{from{opacity:0}to{opacity:1}}
@media (prefers-reduced-motion: reduce){
  .tdon-fx-gradient-shift,.tdon-fx-fade-in,.tdon-fx-hover-lift{animation:none;transition:none}
  .tdon-fx-hover-lift:hover{transform:none}
}
`;
