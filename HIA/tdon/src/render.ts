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
import{TDON_MAX_NESTING,type TdonDocument,type TdonNode,type TdonEffect,type TdonPreviewLayout}from'./types.js';
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

// 把令牌解析出的 HEX 颜色衍生为半透明 rgba 浅底色（ADR-019 的 tree/callout 着色用）。
// <lang zh-CN>输入只能来自令牌解析结果（css() 的输出），非 HEX 返回空串——调用方放弃着色。
//   不破坏 TDON-5.5 的安全模型：这里没有引入任何外部字符串，只是对令牌值做纯函数透明度衍生。</lang>
// <lang en>Derives a translucent rgba tint from a resolved HEX token value (used by tree/callout in
//   ADR-019). Input must come from token resolution (css() output); non-HEX yields '' and the caller
//   skips colouring. TDON-5.5's security model is intact: no external strings — a pure transform of a
//   resolved token value.</lang>
function hexTint(value:string,alpha:number):string{
  const m=/^#([0-9a-fA-F]{6})$/.exec(value);
  if(!m)return'';
  const n=parseInt(m[1]!,16);
  return`rgba(${(n>>16)&255},${(n>>8)&255},${n&255},${alpha})`;
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
        const it=act as {label:string;token?:string;page?:string};
        const label=escapeTdonHtml(String(it.label??''));
        const token=css(theme,it.token);
        // page 引用（ADR-020 / TDON-5.22）：只输出 data 属性 + tdon-link 类，事件由宿主实现。
        // <lang en>page reference (ADR-020 / TDON-5.22): emits data attribute + tdon-link class only;
        //   interaction belongs to the host.</lang>
        const pageAttr=it.page?` data-tdon-page="${escapeTdonHtml(it.page)}"`:'';
        return`<span class="tdon-hero-action${it.page?' tdon-link':''}"${pageAttr}${token?` style="background:${token}"`:''}>${label}</span>`;
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
        const it=raw as {label:string;active?:boolean;page?:string};
        const st=it.active&&activeCss?` style="color:${activeCss}"`:'';
        // page 引用（ADR-020 / TDON-5.22）：data 属性 + tdon-link 类，事件由宿主实现。
        // <lang en>page reference (ADR-020 / TDON-5.22): data attribute + tdon-link class; host implements interaction.</lang>
        const pageAttr=it.page?` data-tdon-page="${escapeTdonHtml(it.page)}"`:'';
        return`<span class="tdon-nav-item${it.active?' is-active':''}${it.page?' tdon-link':''}"${pageAttr}${st}>${escapeTdonHtml(String(it.label??''))}</span>`;
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
    // code-editor：代码编辑器预览（`W-tb-P42`/ADR-015）——行号+轻量语法着色示意。
    // <lang zh-CN>着色是近似（四类 token），导出才是精确映射；文本全部转义（TDON-5.4）。
    //   accentToken 控制标题栏，缺省取 primary.500。</lang>
    // <lang en>Colouring is an approximation (four token classes); exports are exact. All text is escaped
    //   (TDON-5.4). accentToken styles the title bar, defaulting to primary.500.</lang>
    case 'code-editor':{
      const ac=css(theme,a.accentToken)??css(theme,'primary.500')??'';
      const title=a.title?String(a.title):'example / 示例代码';
      const code=String(a.code??SAMPLE_CODE);
      const codeLines=code.split('\n');
      // 状态栏左：文件名 + 语言；右：行数 + 编码（真实编辑器惯例）。
      // <lang en>Status bar: filename + language on the left, line count + encoding on the right.</lang>
      const extMatch=a.title?/\.([A-Za-z0-9]+)$/.exec(String(a.title)):null;
      const lang=extMatch?extMatch[1]!:'text';
      // 明暗两套并排渲染（维护者定案 2026-11-17）：同一份代码，各自取能看清的着色档位。
      // <lang en>Render both appearances side by side (maintainer decision, 2026-11-17): same code, each with
      //   steps legible on its own background.</lang>
      const renderOne=(appearance:'light'|'dark'):string=>{
        const rows=codeLines.map((line,i)=>{
          const esc=escapeTdonHtml(line);
          return`<div class="tdon-code-row"><span class="tdon-code-ln">${i+1}</span><span class="tdon-code-text">${colorize(esc,theme,appearance)}</span></div>`;
        }).join('');
        const label=appearance==='dark'?'dark':'light';
        return`<div class="tdon-code-editor is-${label}"><div class="tdon-code-title"${ac&&appearance==='dark'?` style="background:${ac}"`:''}><span class="tdon-code-dot"></span><span class="tdon-code-dot"></span><span class="tdon-code-dot"></span><span class="tdon-code-title-text">${escapeTdonHtml(title)}</span></div><div class="tdon-code-body">${rows}</div><div class="tdon-code-status"><span>${escapeTdonHtml(title)} · ${escapeTdonHtml(lang)} · ${label}</span><span>${codeLines.length} lines · UTF-8</span></div></div>`;
      };
      return`<div class="tdon-node tdon-code-pair${fx.cls}"${idAttr}${fx.styleAttr}>${renderOne('light')}${renderOne('dark')}</div>`;
    }

    // tree：分组导航树/文档树（`T-tb-TDON-P1`/ADR-019）——VitePress 侧栏、WP 后台菜单等签名元素。
    // <lang zh-CN>sections 已在校验阶段归一化为 {label, items:[{label, active}]}；bgToken 面板底、
    //   accentToken 激活项文字色 + 同源浅底（hexTint 衍生，色值仍来自令牌）。</lang>
    // <lang en>tree node (`T-tb-TDON-P1`/ADR-019): grouped nav/doc tree — the signature element of
    //   VitePress sidebars and WP admin menus. Sections are normalized by the validator; bgToken paints
    //   the panel, accentToken the active item's text plus a same-source tint (via hexTint, still token-derived).</lang>
    case 'tree':{
      const bg=css(theme,a.bgToken);
      const ac=css(theme,a.accentToken);
      const sections=Array.isArray(a.sections)?a.sections as {label:string;items:{label:string;active:boolean;page?:string}[]}[]:[];
      const html=sections.map(sec=>`<div class="tdon-tree-section"><div class="tdon-tree-heading">${escapeTdonHtml(sec.label)}</div>${sec.items.map(it=>{
        // page 引用（ADR-020 / TDON-5.22）：data 属性 + tdon-link 类，事件由宿主实现。
        // <lang en>page reference (ADR-020 / TDON-5.22): data attribute + tdon-link class; host implements interaction.</lang>
        const pageAttr=it.page?` data-tdon-page="${escapeTdonHtml(it.page)}"`:'';
        return`<div class="tdon-tree-item${it.active?' is-active':''}${it.page?' tdon-link':''}"${pageAttr}${it.active&&ac?` style="color:${ac};background:${hexTint(ac,0.12)}"`:''}>${escapeTdonHtml(it.label)}</div>`;
      }).join('')}</div>`).join('');
      return`<div class="tdon-node tdon-tree${fx.cls}"${idAttr}${bg?` style="background:${bg}"`:''}${fx.styleAttr}>${html}${kids}</div>`;
    }
    // code-block：文档代码块（`T-tb-TDON-P1`/ADR-019）——圆角浅块 + 语言标签（右下，VP 口径）+ 复制钮示意（右上）。
    // <lang zh-CN>与 code-editor 的区别：无编辑器 chrome（标题栏/行号/状态栏），亮底用 light 档着色；
    //   code 必填（校验保证），此处兜底空串。</lang>
    // <lang en>code-block node (`T-tb-TDON-P1`/ADR-019): rounded light block with language badge
    //   (bottom-right, VP convention) and a copy affordance (top-right) — no editor chrome
    //   (title bar/gutter/status bar); light-step colouring on the light surface. code is guaranteed
    //   by validation; '' is a defensive fallback.</lang>
    case 'code-block':{
      const ac=css(theme,a.accentToken);
      const lang=String(a.lang??'text');
      const title=String(a.title??'');
      const code=String(a.code??'');
      const rows=code.split('\n').map(line=>`<div class="tdon-codeblock-row">${colorize(escapeTdonHtml(line),theme,'light')}</div>`).join('');
      const bar=`<div class="tdon-codeblock-bar">${title?`<span class="tdon-codeblock-title">${escapeTdonHtml(title)}</span>`:''}<span class="tdon-codeblock-copy" aria-hidden="true">⧉</span></div>`;
      const langLabel=`<span class="tdon-codeblock-lang"${ac?` style="color:${ac}"`:''}>${escapeTdonHtml(lang)}</span>`;
      return`<div class="tdon-node tdon-code-block${fx.cls}"${idAttr}${fx.styleAttr}>${bar}<div class="tdon-codeblock-body">${rows}</div>${langLabel}</div>`;
    }
    // callout：提示容器（`T-tb-TDON-P1`/ADR-019/TDON-5.17）——左边线 + 浅底 + 标题着色。
    // <lang zh-CN>缺省 accent 按 kind→语义角色映射（TDON-5.17）经解析器直取（语义角色已可解析）；
    //   显式 token 优先；details 中性（无 accent，走 CSS 缺省）。浅底由 accent 的 hexTint 衍生。</lang>
    // <lang en>callout node (`T-tb-TDON-P1`/ADR-019/TDON-5.17): left rule + tinted surface + coloured title.
    //   The default accent follows the kind→semantic-role mapping (TDON-5.17) through the resolver
    //   (semantic roles now resolve); an explicit token wins; details is neutral (no accent, CSS default).
    //   The surface tint derives from the accent via hexTint.</lang>
    case 'callout':{
      const kind=String(a.kind??'info');
      const kindRole:Record<string,string|undefined>={info:'info',note:'info',tip:'success',important:'primary',warning:'warning',caution:'warning',danger:'danger',details:undefined};
      const role=kindRole[kind];
      const explicit=css(theme,a.token);
      let accent=explicit;
      if(!accent&&role){
        const r=resolveTdonToken(theme,`${role}.600`);
        accent=r.ok?r.value:'';
      }
      const tint=hexTint(accent,0.08);
      const decls:[string,string][]=[];
      if(accent)decls.push(['border-left-color',accent]);
      if(tint)decls.push(['background',tint]);
      return`<div class="tdon-node tdon-callout is-${escapeTdonHtml(kind)}${fx.cls}"${idAttr}${style(decls)}${fx.styleAttr}>
  ${a.title!==undefined&&a.title!==''?`<p class="tdon-callout-title"${accent?` style="color:${accent}"`:''}>${escapeTdonHtml(String(a.title))}</p>`:''}
  <p class="tdon-callout-text">${nl2br(String(a.text??''))}</p>
  ${kids}
</div>`;
    }

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
// code-editor 内置样例（节点缺省 code；覆盖常见着色类别）。
// <lang en>Built-in sample for the code-editor node, covering the common colouring classes.</lang>
const SAMPLE_CODE=[
  '// HIA Theme Builder — editor preview / 编辑器预览',
  'import { buildTheme } from "@hia/theme-core";',
  '',
  'const shade = buildTheme({',
  '  primary: "#0047AB",',
  '  secondary: "#00A8D3"',
  '});',
  '',
  '// contrast-checked foreground per role',
  'export function foreground(step: number) {',
  '  return shade[step];',
  '}'
].join('\n');

// 轻量着色：单行内按 注释>字符串>数字>关键字 顺序切分（行级渲染，无跨行状态）。
// <lang en>Lightweight colouring: per line, priority comment > string > number > keyword (line-level
//   rendering, no cross-line state).</lang>
const CODE_KEYWORDS=/^(const|let|var|function|return|if|else|for|while|import|export|class|type|interface)$/;
function colorize(escapedLine:string,theme:Theme,appearance:'light'|'dark'='dark'):string{
  // 明暗两套各自取"能在该底色上看清"的档位：浅底用中深阶（500–700），深底用浅阶（200–400）。
  //   此前只取 500–700，压在主色 900 深底上几乎不可见（维护者反馈"没有颜色高亮"）。
  // <lang en>Each appearance uses steps legible on its own background: mid/dark (500–700) on light, light
  //   (200–400) on dark. Previously only 500–700 were used, nearly invisible on a primary-900 backdrop
  //   (the maintainer's "no colour highlighting" report).</lang>
  const col=(ref:string)=>css(theme,ref)??'inherit';
  const dark=appearance==='dark';
  const comment=col(dark?'secondary.300':'secondary.600');
  // 语义色直取（ADR-019 修复）：旧实现引用 "semantic.success.300" 形状——双点号不匹配任何引用形式，
  //   在解析器中永远失败，实际始终落到 secondary 回退（语义高亮从未生效）。
  //   TDON-5.19 落地后语义角色可解析，直接取语义组；保留 secondary 回退以兼容未派生语义色的主题。
  // <lang en>Semantic colours taken directly (fixed in ADR-019): the old "semantic.success.300" shape —
  //   a double dot matched no reference form — never resolved and always fell back to secondary (semantic
  //   highlighting silently never worked). With TDON-5.19 semantic roles resolve; the secondary fallback
  //   remains for themes without a derived semantic group.</lang>
  const str=col(dark?'success.300':'success.600')||col(dark?'secondary.200':'secondary.600');
  const num=col(dark?'warning.300':'warning.700')||col(dark?'secondary.200':'secondary.700');
  const kw=col(dark?'primary.200':'primary.500');
  // 注释：行内 // 之后全部注释色。
  // <lang en>A trailing comment colours the rest of the line.</lang>
  const ci=escapedLine.indexOf('//');
  if(ci>=0){
    return`<span style="color:${comment}">${escapedLine.slice(0,ci)}${escapedLine.slice(ci)}</span>`;
  }
  // 字符串：按引号对切（escapeTdonHtml 已处理危险字符）。
  // <lang en>String literals split by quote pairs on the already-escaped text.</lang>
  let out='',rest=escapedLine;
  const re=/("[^"]*"|'[^']*')/;
  while(rest.length){
    const m=re.exec(rest);
    if(!m){out+=plainWithKeywords(rest,kw,num);break;}
    out+=plainWithKeywords(rest.slice(0,m.index),kw,num);
    out+=`<span style="color:${str}">${m[0]}</span>`;
    rest=rest.slice((m.index??0)+m[0].length);
  }
  return out;
  // 片段内再着数字/关键字。
  // <lang en>Numbers and keywords are coloured within the non-string fragments.</lang>
  function plainWithKeywords(chunk:string,kwColor:string,numColor:string):string{
    const parts=chunk.split(/([A-Za-z_][A-Za-z0-9_]*|\d+(?:\.\d+)?)/);
    return parts.map(part=>{
      if(/^\d+(?:\.\d+)?$/.test(part))return`<span style="color:${numColor}">${part}</span>`;
      if(CODE_KEYWORDS.test(part))return`<span style="color:${kwColor}">${part}</span>`;
      return part;
    }).join('');
  }
}

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
export function renderTdonPreview(doc:TdonDocument,theme:Theme,opts?:{page?:string}):string{
  const preview=doc?.preview;
  if(!preview)return'';
  const title=preview.title?`<div class="tdon-preview-title">${escapeTdonHtml(preview.title)}</div>`:'';
  // 页选择（ADR-020 / TDON-5.22）：多页文档按 opts.page 取页（未知/缺省回退首页 = 落地页）；
  //   页级 layout 覆盖文档级缺省；单页文档行为与既有完全一致。
  // <lang en>Page selection (ADR-020 / TDON-5.22): multi-page docs pick by opts.page (unknown/absent
  //   falls back to the first page = landing); page layout overrides the document default; single-page
  //   behaviour is unchanged.</lang>
  let nodes:TdonNode[];
  let layout:TdonPreviewLayout=preview.layout;
  if(preview.pages&&preview.pages.length){
    const current=(opts?.page?preview.pages.find(pg=>pg.id===opts?.page):undefined)??preview.pages[0]!;
    nodes=current.nodes;
    layout=current.layout??preview.layout;
  }else{
    nodes=preview.nodes??[];
  }
  // 两栏布局（`T-tb-TDON-P1`/ADR-019/TDON-5.18；2026-11-20 语义门槛修订）：sidebar-left 首节点、
  //   sidebar-right 末节点**且该边界节点是 `tree`（侧栏语义节点）**时才两栏；否则单列流式。
  // <lang zh-CN>语义门槛是必要的：后台仪表盘等目标的首节点常是 nav（顶部导航条）——机械地"首个节点
  //   进侧栏列"会把顶部导航塞进 220px 窄列（维护者截图反馈的实际缺陷）。单节点文档退化为 stack。
  //   DOM 顺序与视觉左右一致：sidebar-left = aside,main；sidebar-right = main,aside。</lang>
  // <lang en>Two-column layouts (`T-tb-TDON-P1`/ADR-019/TDON-5.18; semantic gate refined 2026-11-20):
  //   wrap aside/main only when the edge node (first for sidebar-left, last for sidebar-right) is a
  //   `tree` — the sidebar-semantics node. Otherwise flat flow: dashboards often start with a top nav,
  //   and mechanically assigning the first node to the aside column squeezes it into a 220px rail (the
  //   defect reported by the maintainer's screenshot). Single-node docs degrade to stack.</lang>
  const edgeIndex=layout==='sidebar-left'?0:nodes.length-1;
  const isSidebar=(layout==='sidebar-left'||layout==='sidebar-right')&&nodes.length>=2&&nodes[edgeIndex]?.type==='tree';
  if(isSidebar){
    const asideIndex=edgeIndex;
    const aside=renderNode(theme,nodes[asideIndex]!,doc,0);
    const rest=nodes.filter((_,i)=>i!==asideIndex).map(n=>renderNode(theme,n,doc,0)).join('\n');
    const asideHtml=`<div class="tdon-aside">${aside}</div>`;
    const mainHtml=`<div class="tdon-main">${rest}</div>`;
    return`<div class="tdon-preview tdon-layout-${layout} tdon-two-col">${title}${preview.layout==='sidebar-left'?asideHtml+mainHtml:mainHtml+asideHtml}</div>`;
  }
  const rendered=nodes.map(n=>renderNode(theme,n,doc,0)).join('\n');
  return`<div class="tdon-preview tdon-layout-${layout}">${title}${rendered}</div>`;
}

// 预览所需 CSS（随 core 分发，不含任何用户输入）。
// <lang zh-CN>特效 keyframes 为固定定义：只读 opacity 与 translateY（TDON-9.6），
//   prefers-reduced-motion 下整体关闭（TDON-9.5）。</lang>
// <lang en>Effect keyframes are fixed: opacity and translateY only (TDON-9.6), fully disabled under
//   prefers-reduced-motion (TDON-9.5).</lang>
export const TDON_PREVIEW_CSS=`
.tdon-preview{display:flex;flex-direction:column;gap:12px;font-family:var(--hia-font-body,system-ui,sans-serif);line-height:var(--hia-line-height-body,1.6)}
.tdon-preview-title{font-size:var(--hia-fs-h3,18px);font-weight:700}
/* 两栏布局（ADR-019 / TDON-5.18；2026-11-20 语义门槛修订）：网格仅在渲染器附加 .tdon-two-col
   （结构化 aside/main 包裹成立）时生效——sidebar 布局声明在语义门槛不满足时（如首节点为 nav）
   保持单列流式，不会被网格强行分栏。标题行横跨全宽；窄屏单列回退。
   <lang en>Two-column layout (ADR-019 / TDON-5.18; semantic gate refined 2026-11-20): the grid applies
   only when the renderer adds .tdon-two-col (structural aside/main wrapping) — a sidebar declaration
   whose edge node lacks sidebar semantics (e.g. a leading nav) stays flat instead of being force-split.
   Title spans full width; narrow screens fall back to one column.</lang> */
.tdon-layout-sidebar-left.tdon-two-col,.tdon-layout-sidebar-right.tdon-two-col{display:grid;grid-template-columns:220px minmax(0,1fr);gap:12px;align-items:start}
.tdon-layout-sidebar-right.tdon-two-col{grid-template-columns:minmax(0,1fr) 220px}
.tdon-layout-sidebar-left.tdon-two-col>.tdon-preview-title,.tdon-layout-sidebar-right.tdon-two-col>.tdon-preview-title{grid-column:1/-1}
.tdon-aside{min-width:0}
.tdon-main{min-width:0;display:flex;flex-direction:column;gap:12px}
@media (max-width:720px){.tdon-layout-sidebar-left.tdon-two-col,.tdon-layout-sidebar-right.tdon-two-col{grid-template-columns:1fr}}
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
/* code-editor：按真实编辑器观感——标题栏、行号栏（右对齐+右分隔线）、代码区、状态栏。
   行号与正文靠行号栏的右 padding + 1px 分隔线拉开，而不是紧贴。
   <lang en>code-editor mirrors a real editor: title bar, gutter (right-aligned with a 1px divider), code
   area and status bar. The gutter's right padding plus the divider separate line numbers from code.</lang> */
/* code-editor：真实编辑器观感 + **明暗两套并排**（维护者定案 2026-11-17）。
   两套同时呈现，便于直接对照主题在浅色/深色编辑器里的实际效果。
   <lang en>code-editor mirrors a real editor and shows **light and dark side by side** (maintainer decision,
   2026-11-17) so the theme's behaviour in both appearances can be compared directly.</lang> */
.tdon-code-pair{display:grid;grid-template-columns:1fr 1fr;gap:12px;align-items:start}
@media (max-width:720px){.tdon-code-pair{grid-template-columns:1fr}}
.tdon-code-editor{border:1px solid rgba(0,0,0,.14);border-radius:10px;overflow:hidden;font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;min-width:0}
.tdon-code-editor.is-dark{background:#0F172A;box-shadow:0 8px 24px rgba(15,23,42,.18)}
.tdon-code-editor.is-light{background:#FFFFFF;box-shadow:0 4px 14px rgba(15,23,42,.10);border-color:rgba(0,0,0,.10)}
.tdon-code-title{display:flex;align-items:center;gap:7px;padding:9px 12px}
.is-dark .tdon-code-title{background:rgba(0,0,0,.24);border-bottom:1px solid rgba(255,255,255,.08)}
.is-light .tdon-code-title{background:#F4F6F9;border-bottom:1px solid rgba(0,0,0,.07)}
.tdon-code-dot{width:11px;height:11px;border-radius:50%;flex:none}
.tdon-code-dot:nth-child(1){background:#FF5F57}
.tdon-code-dot:nth-child(2){background:#FEBC2E}
.tdon-code-dot:nth-child(3){background:#28C840}
.tdon-code-title-text{margin-left:8px;font:600 12px/1 inherit;font-family:inherit;letter-spacing:.02em}
.is-dark .tdon-code-title-text{color:rgba(255,255,255,.72)}
.is-light .tdon-code-title-text{color:#4A5A68}
.tdon-code-body{padding:12px 0}
.is-light .tdon-code-body{background:#FFFFFF}
.tdon-code-row{display:flex;align-items:baseline;font-size:13px;line-height:1.75}
.tdon-code-ln{flex:none;width:3.2em;padding-right:16px;text-align:right;margin-right:16px;user-select:none;font-variant-numeric:tabular-nums}
.is-dark .tdon-code-ln{color:rgba(255,255,255,.32);border-right:1px solid rgba(255,255,255,.09)}
.is-light .tdon-code-ln{color:#A9B6C1;border-right:1px solid rgba(0,0,0,.08)}
.tdon-code-text{flex:1;min-width:0;white-space:pre-wrap;word-break:break-word;padding-right:14px}
.is-dark .tdon-code-text{color:rgba(255,255,255,.9)}
.is-light .tdon-code-text{color:#22303C}
.tdon-code-status{display:flex;justify-content:space-between;gap:10px;padding:6px 12px;font:600 11px/1.4 inherit;font-family:inherit}
.is-dark .tdon-code-status{background:rgba(0,0,0,.26);border-top:1px solid rgba(255,255,255,.08);color:rgba(255,255,255,.6)}
.is-light .tdon-code-status{background:#F4F6F9;border-top:1px solid rgba(0,0,0,.07);color:#6B7A87}
.tdon-children{display:flex;flex-direction:column;gap:10px;margin-top:12px}
/* tree：分组导航树/文档树（ADR-019）——VitePress 侧栏观感：组标题小字弱化、项行左内边距留出强调条空间、
   激活项加粗 + 左侧 currentColor 强调条 + 同源浅底（浅底由渲染器内联，色值仍来自令牌）。
   <lang en>tree mirrors a VitePress sidebar: muted section headings, item rows with left padding room for
   the accent bar, active item bold with a currentColor rule and a token-derived tint (inlined by the renderer).</lang> */
.tdon-tree{padding:10px;background:rgba(0,0,0,.03)}
.tdon-tree-section+.tdon-tree-section{margin-top:10px}
.tdon-tree-heading{font-size:12px;font-weight:700;opacity:.6;padding:4px 8px 2px}
.tdon-tree-item{font-size:var(--hia-fs-small,14px);padding:5px 8px 5px 10px;border-radius:6px;border-left:2px solid transparent;opacity:.85}
.tdon-tree-item.is-active{font-weight:600;opacity:1;border-left-color:currentColor}
/* code-block：文档代码块（ADR-019）——VitePress 观感：浅灰圆角块、右上复制钮示意、右下语言标签；
   亮底恒用 light 档着色（与 code-editor 的明暗并排不同——文档代码块单形态）。
   <lang en>code-block mirrors a document code block: light rounded surface, copy affordance top-right,
   language badge bottom-right; always light-step colouring (single form, unlike the code-editor pair).</lang> */
.tdon-code-block{position:relative;background:#F6F6F7;border:1px solid rgba(0,0,0,.08);font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace}
.tdon-codeblock-bar{display:flex;justify-content:space-between;align-items:center;padding:8px 12px;border-bottom:1px solid rgba(0,0,0,.06)}
.tdon-codeblock-title{font:600 12px/1.4 inherit;font-family:inherit;color:#4A5A68;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.tdon-codeblock-copy{color:#8B98A4;font-size:13px;user-select:none}
.tdon-codeblock-body{padding:12px 14px}
.tdon-codeblock-row{font-size:13px;line-height:1.75;white-space:pre-wrap;word-break:break-word;color:#22303C}
.tdon-codeblock-lang{position:absolute;right:10px;bottom:8px;font-size:11px;color:#8B98A4;background:rgba(255,255,255,.75);padding:1px 6px;border-radius:6px}
/* callout：提示容器（ADR-019 / TDON-5.17）——左边线 + 浅底 + 标题着色；缺省 accent 由 kind 语义映射经
   解析器直取（渲染器内联），details 无 accent 走本缺省中性样式。
   <lang en>callout mirrors an admonition: left rule + tinted surface + coloured title; the default accent
   comes from the kind→role mapping through the resolver (inlined by the renderer); details has no accent
   and uses this neutral default.</lang> */
.tdon-callout{border-left:3px solid rgba(0,0,0,.25);background:rgba(0,0,0,.03);padding:12px 14px;border-radius:8px}
.tdon-callout.is-details{border-left-color:rgba(0,0,0,.14);background:rgba(0,0,0,.02)}
.tdon-callout-title{margin:0 0 4px;font-weight:700;font-size:var(--hia-fs-small,14px)}
.tdon-callout-text{margin:0;font-size:var(--hia-fs-small,14px)}
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
