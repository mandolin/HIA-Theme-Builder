/**
 * @lang zh-CN 浏览器端 scanner：在页面中注入执行，采集 meta/manifest、CSS 变量、computed 颜色、SVG、渐变、
 *   伪元素、可见性面积与语义上下文，本地聚合为 ColorEvidence[]。Electron 与 Tauri 执行同一份编译产物。
 *   本文件依赖 DOM/Canvas API，页面端运行；纯逻辑（归一化/语义/聚合）在同级模块，可在 Node 单测。
 * @lang en In-page scanner: runs injected in a page, collecting meta/manifest, CSS vars, computed colors, SVG,
 *   gradients, pseudo-elements, visibility area and semantic context, aggregated locally to ColorEvidence[].
 *   Electron/Tauri run the same build. Depends on DOM/Canvas (in-page); pure logic lives in sibling modules.
 */

import type { ColorEvidence, ColorSource, SemanticRole, CaptureWarning } from '@hia/theme-core';
import { normalizeBrowserColor, injectParseColor } from './color-normalize-browser.js';
import { resolveSemanticRole } from './semantic-context.js';
import { aggregateEvidence, type RawEvidence } from './aggregate.js';

// 最大扫描节点数与最大证据记录数（指令第十节默认）。
// <lang zh-CN>达到上限写入 warning，不阻断整体分析。</lang>
// <lang en>On hitting caps, write a warning instead of failing the whole analysis.</lang>
export const MAX_ELEMENTS=10000;
export const MAX_EVIDENCE=1000;

// 采集上下文：由适配器在注入前设置运行时解析器与 viewport 信息。
// <lang zh-CN>真实环境应注入利用浏览器原生 CSS 解析能力的解析器；colorScheme 标记当前采集的配色方案（dark mode 双模式）。</lang>
// <lang en>Real environments inject a native-CSS parser; colorScheme tags the active scheme (dark-mode dual capture).</lang>
export interface ScanContext{
  width:number;
  height:number;
  dpr:number;
  /** 当前采集的配色方案；dark mode 双模式时第二次采集为 'dark'。 */
  colorScheme?:'light'|'dark';
  parseColor?:(input:string)=>string|null;
}

// 单元素属性采集：读取 computed style 的关键颜色属性并归一化。
// <lang zh-CN>返回该元素贡献的原始证据数组（可能多条：background/text/border/svg/gradient）。</lang>
// <lang en>Returns raw evidence from one element's key color props (may be several).</lang>
function collectElementColors(el:Element, ctx:ScanContext):RawEvidence[]{
  const out:RawEvidence[]=[];
  const cs=getComputedStyle(el);
  const rect=el.getBoundingClientRect();
  const areaRatio=Math.max(0,Math.min(1,(rect.width*rect.height)/(ctx.width*ctx.height||1)));
  const aboveFold=rect.top<ctx.height&&rect.bottom>0;
  // 上下文文本：class/id/role/data-* 拼接，供语义识别。
  // <lang zh-CN>只读属性名与少量 data-* 值，避免抓取值内容。</lang>
  // <lang en>Read attr names and a few data-* values, not their content.</lang>
  const cls=(el.getAttribute('class')||'');
  const id=(el.getAttribute('id')||'');
  const role=(el.getAttribute('role')||'');
  const datas=[...el.attributes].filter(a=>a.name.startsWith('data-')).map(a=>a.name).join(' ');
  // 祖先语义：向上最多 4 层，拼接 class/id/role 供 status/brand 等上下文判定。
  // <lang zh-CN>状态色必须靠上下文，不凭色相；祖先词命中提升上下文召回。</lang>
  // <lang en>Status is context-derived, never by hue; ancestor words raise context recall.</lang>
  let ancestorText='';
  let p=el.parentElement;
  for(let i=0;i<4&&p;i++,p=p.parentElement){
    ancestorText+=` ${p.getAttribute('class')||''} ${p.getAttribute('id')||''} ${p.getAttribute('role')||''}`;
  }
  const contextText=`${cls} ${id} ${role} ${datas}${ancestorText}`.toLowerCase();
  const semanticRole:SemanticRole=resolveSemanticRole(contextText,el.tagName);

  const push=(authorValue:string,source:ColorSource,propRole:SemanticRole)=>{
    const hex=normalizeBrowserColor(authorValue);
    if(!hex)return;
    out.push({ authorValue, hex, alpha:1, source, role:propRole, areaRatio, aboveFoldRatio:aboveFold?areaRatio:0, context:cls.slice(0,60), selector:`${el.tagName.toLowerCase()}.${cls.split(/\s+/)[0]||''}`.trim(), colorScheme:ctx.colorScheme });
  };

  push(cs.backgroundColor,'computed-background',semanticRole==='unknown'?'surface':semanticRole);
  push(cs.color,'computed-text',semanticRole==='unknown'?'text':semanticRole);
  // 四边 border color：累计出现过的非 0 宽边线色（取首次有效值）。
  // <lang zh-CN>四边可能不同色，逐边采集以保留差异边线的弱证据。</lang>
  // <lang en>Four sides may differ; collect each non-zero side to keep thin-border weak evidence.</lang>
  for(const side of ['Top','Right','Bottom','Left'] as const){
    const w=cs[`border${side}Width` as 'borderTopWidth'];
    const c=cs[`border${side}Color` as 'borderTopColor'];
    if(w&&w!=='0px')push(c,`computed-border`,semanticRole==='unknown'?'border':semanticRole);
  }
  push(cs.outlineColor,'computed-border',semanticRole);
  push(cs.textDecorationColor,'computed-text',semanticRole);
  // 渐变：backgroundImage 中的色标。
  // <lang zh-CN>正则抽取 linear/radial/conic 中的颜色函数参数。</lang>
  // <lang en>Regex picks color-function args inside linear/radial/conic gradients.</lang>
  const gi=cs.backgroundImage;
  if(/gradient\(/.test(gi)){
    for(const m of gi.matchAll(/(?:rgba?|hsla?|oklcha?|lab|lch|color)\s*\([^)]*\)/gi)){
      push(m[0]!,'gradient-stop',semanticRole);
    }
  }
  // SVG fill/stroke。
  // <lang zh-CN>SVG 元素单独处理 fill/stroke。</lang>
  // <lang en>SVG elements handled for fill/stroke.</lang>
  if(el instanceof SVGElement){
    const fill=(el as SVGElement).style.fill; const stroke=(el as SVGElement).style.stroke;
    if(fill)push(fill,'svg-fill',semanticRole==='unknown'?'icon':semanticRole);
    if(stroke)push(stroke,'svg-stroke',semanticRole);
  }
  // 伪元素 ::before/::after 的 content 颜色（渐变/背景/文字）。
  // <lang zh-CN>伪元素无法用 querySelector 选中，须用 getComputedStyle(el,'::before')。</lang>
  // <lang en>Pseudo-elements aren't selectable; use getComputedStyle(el,'::before').</lang>
  for(const pseudo of ['::before','::after'] as const){
    const ps=getComputedStyle(el,pseudo);
    if(ps.backgroundColor&&ps.backgroundColor!=='rgba(0, 0, 0, 0)')push(ps.backgroundColor,'computed-background',semanticRole);
    if(ps.color&&ps.color!=='rgba(0, 0, 0, 0)')push(ps.color,'computed-text',semanticRole);
  }
  return out;
}

// 采集 <meta name="theme-color"> 与 manifest 的 theme/background color。
// <lang zh-CN>meta 支持带 media 的 light/dark 变体；manifest 仅当链接可访问时采集。</lang>
// <lang en>meta supports media-based light/dark variants; manifest collected only when link is reachable.</lang>
function collectMetaAndManifest(doc:Document, ctx:ScanContext):RawEvidence[]{
  const out:RawEvidence[]=[];
  const pushMeta=(authorValue:string,role:SemanticRole)=>{
    const hex=normalizeBrowserColor(authorValue);
    if(!hex)return;
    out.push({ authorValue, hex, alpha:1, source:'meta-theme', role, areaRatio:1, aboveFoldRatio:1, context:'meta theme-color', selector:'meta[name=theme-color]' });
  };
  for(const m of Array.from(doc.querySelectorAll('meta[name="theme-color"]'))){
    pushMeta(m.getAttribute('content')||'','brand');
  }
  // manifest theme_color/background_color：fetch 解析，失败静默（跨域/不可达）。
  // <lang zh-CN>异步不便在此同步等待，适配器可单独传入；此处尝试同步 best-effort 已不可行，交给适配器层。</lang>
  // <lang en>Async fetch is impractical here; adapter layer supplies manifest separately.</lang>
  return out;
}

// 采集根元素 :root 的 CSS 自定义属性中的颜色值。
// <lang zh-CN>仅收录值可被解析为颜色的变量，保留 token 名与作者值。</lang>
// <lang en>Only color-valued custom properties; keep token name and author value.</lang>
function collectCssTokens(doc:Document, ctx:ScanContext):RawEvidence[]{
  const out:RawEvidence[]=[];
  const root=doc.documentElement;
  const cs=getComputedStyle(root);
  // CSS 变量以 -- 开头；通过 getPropertyValue 遍历已知键。
  // <lang zh-CN>无法枚举全部自定义属性名，故从样式表收集声明名。</lang>
  // <lang en>Cannot enumerate all custom prop names; collect declared names from stylesheets.</lang>
  const names=new Set<string>();
  for(const sheet of Array.from(doc.styleSheets)){
    let rules:CSSStyleRule[]=[];
    try{ rules=Array.from(sheet.cssRules||[]) as unknown as CSSStyleRule[]; }catch{ continue; }
    for(const r of rules){
      if(r.style){ for(let i=0;i<r.style.length;i++){ const n=r.style[i]; if(n&&n.startsWith('--'))names.add(n); } }
    }
  }
  for(const name of names){
    const val=cs.getPropertyValue(name).trim();
    if(!val)continue;
    const hex=normalizeBrowserColor(val);
    if(!hex)continue;
    // token 角色按变量名推断（refineRoleFromName 类似逻辑）。
    // <lang zh-CN>含 brand/primary 等词提升角色；否则按 neutral token 处理。</lang>
    // <lang en>Name-based role hint (brand/primary etc.); neutral otherwise.</lang>
    const lower=name.toLowerCase();
    const role:SemanticRole=/\b(brand|primary)\b/.test(lower)?'brand':/\b(secondary|accent)\b/.test(lower)?'accent':/\b(bg|surface|background)\b/.test(lower)?'surface':/\b(text|fg|color)\b/.test(lower)?'text':'unknown';
    out.push({ authorValue:val, hex, alpha:1, source:'css-token', role, areaRatio:1, aboveFoldRatio:1, tokenName:name, context:name, selector:`:root ${name}` });
  }
  return out;
}

// 扫描根文档（含 open shadow roots 与同源 frame），受节点上限约束。
// <lang zh-CN>same-origin frame 递归扫描并标记 frameKind='same-origin'；third-party 因同源策略不可访问而自然跳过。</lang>
// <lang en>same-origin frames are scanned recursively and tagged frameKind='same-origin'; third-party is unreachable by SOP and skipped.</lang>
export function scanDocument(root:Document|Element, ctx:ScanContext, options?:{ includeFrames?:boolean }):{ evidence:ColorEvidence[]; warnings:CaptureWarning[] }{
  const raw:RawEvidence[]=[];
  const warnings:CaptureWarning[]=[];
  const doc=root instanceof Document?root:(root.ownerDocument??document);
  // 元信息与 token 在文档级采集一次。
  // <lang zh-CN>page 级证据不计入节点上限。</lang>
  // <lang en>Page-level evidence not counted against node cap.</lang>
  if(doc)raw.push(...collectMetaAndManifest(doc,ctx),...collectCssTokens(doc,ctx));

  let scanned=0;
  const visit=(node:Element)=>{
    if(scanned>=MAX_ELEMENTS)return;
    scanned++;
    raw.push(...collectElementColors(node,ctx));
    // open shadow root 递归。
    // <lang zh-CN>ShadowRoot.mode==='open' 才可见。</lang>
    // <lang en>Only open shadow roots are visible.</lang>
    const sr=(node as Element&{shadowRoot?:ShadowRoot}).shadowRoot;
    if(sr&&sr.mode==='open'){ sr.querySelectorAll('*').forEach((c:Element)=>visit(c)); }
  };
  const rootEl=root as Document|Element;
  const all:Element[]=rootEl.querySelectorAll?Array.from(rootEl.querySelectorAll('*')):[rootEl as Element];
  all.forEach((n:Element)=>visit(n));

  // 同源 iframe 递归扫描（受限多页面采集）：仅同源可访问 contentDocument；跨域直接抛/返回 null 被 catch 忽略。
  // <lang zh-CN>第三方 frame 受同源策略保护，不采集其颜色，避免越权读取。</lang>
  // <lang en>Third-party frames are SOP-protected; not collected, no cross-origin read.</lang>
  if(options?.includeFrames!==false && doc){
    try{
      const iframes=Array.from(doc.querySelectorAll('iframe'));
      let skipped=0;
      for(const f of iframes){
        try{
          const fd=(f as HTMLIFrameElement).contentDocument;
          if(!fd) { skipped++; continue; }
          const sub=scanDocument(fd,ctx,{ includeFrames:false });
          for(const e of sub.evidence){
            raw.push({
              authorValue:e.value, hex:e.hex, alpha:e.alpha, source:e.source, role:e.role,
              count:e.count, areaRatio:e.areaRatio, aboveFoldRatio:e.aboveFoldRatio, pixelRatio:e.pixelRatio,
              tokenName:e.tokenNames?.[0], context:e.contexts?.[0], selector:e.selectors?.[0],
              frameKind:'same-origin', colorScheme:e.colorScheme
            });
          }
          if(sub.warnings.length)warnings.push(...sub.warnings);
        }catch{ skipped++; }
      }
      if(skipped>0)warnings.push({ code:'frame-skip', message:`跳过 ${skipped} 个不可访问（第三方/沙箱）frame`, scope:'scanner' });
    }catch{ /* ignore */ }
  }

  if(scanned>=MAX_ELEMENTS)warnings.push({ code:'node-cap', message:`扫描节点达上限 ${MAX_ELEMENTS}，已截断`, scope:'scanner' });
  const evidence=aggregateEvidence(raw).slice(0,MAX_EVIDENCE);
  if(evidence.length>=MAX_EVIDENCE)warnings.push({ code:'evidence-cap', message:`证据记录达上限 ${MAX_EVIDENCE}`, scope:'scanner' });
  return { evidence, warnings };
}

// logo 检测：返回页面中疑似 logo 元素的视口包围盒（供适配器裁剪截图单独量化）。
// <lang zh-CN>候选来源：favicon(link[rel=icon])、header/brand 上下文内的 img/svg、首个较大 SVG。
//   返回可序列化数组（rect 为 page 坐标），适配器用 capturePage(rect) 裁剪。</lang>
// <lang en>Candidates: favicon, img/svg inside header/brand context, first sizable SVG. Returns serializable rects for capturePage crop.</lang>
export interface LogoRect{ rect:{ x:number;y:number;width:number;height:number }; kind:'favicon'|'brand-image'|'svg'; context:string; }
export function detectLogos(doc:Document):LogoRect[]{
  const out:LogoRect[]=[];
  try{
    // 收集候选元素：header/nav/brand 上下文内的 img 与 svg。
    // <lang zh-CN>上下文词命中 header/nav/logo/brand/brandmark 提升召回。</lang>
    // <lang en>Context words header/nav/logo/brand raise recall.</lang>
    const ctxWords=/header|nav|logo|brand|brandmark|site-identity|masthead/i;
    const candidates:Element[]=[];
    for(const el of Array.from(doc.querySelectorAll('img,svg,a>img,a>svg'))){
      const wrap=el.closest('header,nav,[class*="header" i],[class*="brand" i],[class*="logo" i],[id*="header" i],[id*="brand" i],[id*="logo" i]');
      if(wrap||ctxWords.test(el.getAttribute('class')||el.getAttribute('id')||el.parentElement?.getAttribute('class')||'')){
        candidates.push(el);
      }
    }
    // favicon：取首个尺寸明确的 icon link（无尺寸时取默认）。
    // <lang zh-CN>favicon 虽无页面包围盒，仍记录 kind 供适配器用文档图标域量化。</lang>
    // <lang en>Favicon recorded by kind; adapter quantizes via icon domain.</lang>
    const icon=doc.querySelector('link[rel="icon"],link[rel="shortcut icon"],link[rel="apple-touch-icon"]');
    if(icon)out.push({ rect:{x:0,y:0,width:0,height:0}, kind:'favicon', context:'link[rel=icon]' });

    for(const el of candidates.slice(0,8)){
      const r=el.getBoundingClientRect();
      if(r.width<8||r.height<8||r.width>600||r.height>600)continue; // 排除过小/过大（非 logo）
      out.push({ rect:{ x:Math.max(0,r.x), y:Math.max(0,r.y), width:r.width, height:r.height }, kind: el instanceof SVGElement?'svg':'brand-image', context:(el.getAttribute('class')||el.tagName).slice(0,60) });
    }
  }catch{ /* ignore */ }
  return out.slice(0,12);
}

// 在注入本 scanner 前调用一次，设置页面端颜色解析器。
// <lang zh-CN>适配器传入利用浏览器原生能力的解析函数。</lang>
// <lang en>Adapter passes a native-browser-capable parser before injection.</lang>
export function installScanner(parseColor:(input:string)=>string|null):void{
  injectParseColor(parseColor);
}

// 默认导出集合，供构建脚本打包为单一 browser bundle。
// <lang zh-CN>stable 入口，Tauri Rust 端 include_str! 引用其产物。</lang>
// <lang en>Stable entry; Tauri Rust side references its bundle via include_str!.</lang>
export const scanner={ scanDocument, detectLogos, installScanner, MAX_ELEMENTS, MAX_EVIDENCE };
