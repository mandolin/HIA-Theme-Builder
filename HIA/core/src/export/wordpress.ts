/**
 * @lang zh-CN WordPress 子主题适配器（`ADR-005` / `W-tb-P9`）：把主题导出为 WP 块主题"上传即可启用"的
 *   子主题四件套（style.css / theme.json / functions.php / readme.txt）。纯函数，无 IO。
 *   WP 口径核对（2026-11-08 官方手册）：theme.json 顶层字段为 `version`；v2 兼容 WP 5.9+ 且 WP 6.6+ 自动迁移；
 *   palette/gradients 条目字段为 {name, slug, color|gradient}；settings.custom 键不得含 `--`。
 * @lang en WordPress child-theme adapter (`ADR-005` / `W-tb-P9`): exports the theme as an installable WP block-theme
 *   child bundle (style.css / theme.json / functions.php / readme.txt). Pure, IO-free.
 *   WP contract verified against the official handbook (2026-11-08): top-level field is `version`;
 *   v2 works on WP 5.9+ and is auto-migrated on 6.6+; palette/gradient entries are {name, slug, color|gradient};
 *   settings.custom keys must not contain `--`.
 */
import type{ExportAdapterOptions,ExportTarget,VirtualFile}from'./types.js';
import type{Theme}from'../types.js';
import{SHADE_KEYS}from'../types.js';
import{collectCustomShades,gradientCss}from'../gradient/render.js';
import{exportThemeCss}from'../token/css.js';
import{slugifyThemeName,fullTokenCss,commentSafe}from'./shared.js';
import{typographySpacingVars,FONT_SIZE_STEPS}from'../token/typography.js';
import{GRADIENT_DEFS}from'../data/gradients.js';

// 默认父主题：WP 自带块主题（TT4，WP 6.4+ 内置且任意 6.x 可安装）。
// <lang zh-CN>子主题 style.css 的 Template 头必须指向父主题目录 slug；调用方可用 options.parentTemplate 覆盖。</lang>
// <lang en>The child style.css Template header must point at the parent theme dir slug; callers may override
//   via options.parentTemplate.</lang>
const DEFAULT_PARENT_TEMPLATE='twentytwentyfour';

// 生成 WP 颜色面板条目：slug 统一 hia- 前缀隔离，避免与核心/父主题预设冲突（`W-tb-P9` 计划 §3.2 风险缓解）。
// <lang zh-CN>slug 仅由 [a-z0-9-] 组成，满足 WP 生成 --wp--preset--color--<slug> 与 .has-<slug>-color 的合法性要求。</lang>
// <lang en>Slugs use [a-z0-9-] only, keeping --wp--preset--color--<slug> and .has-<slug>-color valid.</lang>
function paletteEntry(role:'primary'|'secondary',shade:string,color:string,roleName:string):{name:string;slug:string;color:string}{
  return{name:`${roleName} ${shade}`,slug:`hia-${role}-${shade}`,color};
}

// 生成 theme.json 的 settings.custom 子树：HIA 令牌透传为 --wp--custom--hia--* 变量。
// <lang zh-CN>键不含 `--`（官方保留分隔符）；camelCase 由 WP 自动转 kebab-case；数字级键（如 "0"）合法。</lang>
// <lang en>Keys contain no `--` (official reserved separator); camelCase is kebab-cased by WP; numeric keys ("0") are valid.</lang>
function buildCustomSection(theme:Theme):Record<string,unknown>{
  // 字体/间距变量映射：--hia-fs-display 等键名去掉 --hia- 前缀后按层级归位。
  // <lang zh-CN>fs/space 分别拆出，保持 custom 子树语义清晰。</lang>
  // <lang en>fs/space are split out to keep the custom subtree semantically clear.</lang>
  const vars=typographySpacingVars(theme);
  const fs:Record<string,string>={},space:Record<string,string>={};
  for(const step of FONT_SIZE_STEPS){const v=vars[`--hia-fs-${step}`];if(v!==undefined)fs[step]=v;}
  for(const[k,v]of Object.entries(vars)){if(k.startsWith('--hia-space-'))space[k.slice('--hia-space-'.length)]=v;}
  return{
    hia:{
      onPrimary:theme.primary.on,
      onSecondary:theme.secondary.on,
      font:{body:theme.typography.fontFamily.body,heading:theme.typography.fontFamily.heading,mono:theme.typography.fontFamily.mono},
      lineHeightBody:theme.typography.lineHeightBody,
      fs,
      space
    }
  };
}

// WordPress 子主题适配器主体：产出四件套虚拟文件树。
// <lang zh-CN>theme.json 采用 version 2（兼容 WP 6.x 全系与 5.9+；WP 6.6+ 自动迁移 v3）；面板含基色 + 标准 10 档 +
//   ADR-004 自定义色阶；渐变仅收录启用角色并以字面量色值生成（WP 不理解 var() 引用的 HIA 变量嵌套语境）。</lang>
// <lang en>Main WP child adapter: emits the four-file virtual tree. theme.json uses version 2 (covers all of WP 6.x
//   and 5.9+; auto-migrated on 6.6+); palette holds base + standard 10 steps + ADR-004 custom shades; gradients
//   include enabled roles only, rendered with literal colors (WP cannot resolve HIA var() nesting).</lang>
function wordpressChildFiles(theme:Theme,options?:ExportAdapterOptions):VirtualFile[]{
  // 父主题 slug：缺省 TT4；显式空串回退默认，防止生成空 Template 头导致子主题无法识别父级。
  // <lang zh-CN>Template 头是 WP 判定子主题的唯一依据。</lang>
  // <lang en>The Template header is WP's sole basis for recognizing a child theme.</lang>
  const parent=options?.parentTemplate||DEFAULT_PARENT_TEMPLATE;
  // 主题名 slug：用于文本域与打包名，仅 ASCII。
  // <lang zh-CN>theme.name 保留原文进 Theme Name 头；slug 只做标识符。</lang>
  // <lang en>theme.name stays verbatim in the Theme Name header; the slug is identifier-only.</lang>
  const slug=slugifyThemeName(theme.name);
  // 自定义色阶（ADR-004）：渐变引用的任意档位，按色族附加进面板。
  // <lang zh-CN>与 CSS/JSON 导出同源（collectCustomShades），三处产物一致。</lang>
  // <lang en>Same source as CSS/JSON exports (collectCustomShades), keeping all three artifacts consistent.</lang>
  const custom=collectCustomShades(theme);
  // 面板条目：基色两条 + 主副各 10 档 + 自定义色阶附加键 + 辅助槽位（ADR-007）。
  // <lang zh-CN>基色 slug 无档位后缀（hia-primary/hia-secondary），便于块编辑器直选主题基色；
  //   辅助槽位 slug hia-aux<N>[-<shade>]（N 从 0），auto 模式下不产生条目。</lang>
  // <lang en>Aux slots use slug hia-aux<N>[-<shade>] (N from 0); none emitted under 'auto'.</lang>
  const palette=[
    {name:`${theme.primary.name}`,slug:'hia-primary',color:theme.primary.value},
    {name:`${theme.secondary.name}`,slug:'hia-secondary',color:theme.secondary.value},
    ...SHADE_KEYS.map(k=>paletteEntry('primary',k,theme.primary.scale[k]!,theme.primary.name)),
    ...SHADE_KEYS.map(k=>paletteEntry('secondary',k,theme.secondary.scale[k]!,theme.secondary.name)),
    ...Object.entries(custom.primary).map(([k,v])=>paletteEntry('primary',k,v,theme.primary.name)),
    ...Object.entries(custom.secondary).map(([k,v])=>paletteEntry('secondary',k,v,theme.secondary.name)),
    ...theme.auxiliary.flatMap((aux,i)=>[
      {name:aux.name,slug:`hia-aux${i}`,color:aux.value},
      ...SHADE_KEYS.map(k=>({name:`${aux.name} ${k}`,slug:`hia-aux${i}-${k}`,color:aux.scale[k]!}))
    ]),
    // 第三角色（ADR-007 v2）：仅三色模式存在（thirdColor 缺省 undefined → 不产生条目）。
    // <lang zh-CN>slug hia-third[-<shade>]，与主副色同构。</lang>
    // <lang en>Slug hia-third[-<shade>], same shape as primary/secondary.</lang>
    ...(theme.thirdColor?(()=>{
      const third=theme.thirdColor;
      return[
        {name:third.name,slug:'hia-third',color:third.value},
        ...SHADE_KEYS.map(k=>({name:`${third.name} ${k}`,slug:`hia-third-${k}`,color:third.scale[k]!}))
      ];
    })():[])
  ];
  // 渐变条目：仅启用角色；字面量色值（literal 模式经 resolveScaleColor 支持任意档位）。
  // <lang zh-CN>禁用角色 flatMap 丢弃，避免 WP 端出现死预设；角色键 camelCase（textLarge）转 kebab 保持 slug 全小写惯例。</lang>
  // <lang en>Disabled roles are dropped via flatMap, avoiding dead presets in WP; camelCase role keys (textLarge) become kebab for the all-lowercase slug convention.</lang>
  const gradients=GRADIENT_DEFS.flatMap(def=>{
    const config=theme.gradients[def.key];
    if(!config||config.enabled===false)return[];
    const roleSlug=def.key.replace(/([A-Z])/g,'-$1').toLowerCase();
    return[{name:def.label,slug:`hia-gradient-${roleSlug}`,gradient:gradientCss(config,'literal',theme)}];
  });
  // theme.json：WP 块主题全站编辑契约（$schema 便于编辑器补全，version 2 为兼容口径）。
  // <lang zh-CN>defaultPalette/defaultGradients 关闭核心默认，突出 HIA 面板；custom 透传排版/间距令牌。</lang>
  // <lang en>defaultPalette/defaultGradients off to foreground the HIA palette; custom passes typography/spacing tokens.</lang>
  const themeJson=JSON.stringify({
    $schema:'https://schemas.wp.org/trunk/theme.json',
    version:2,
    settings:{
      color:{defaultPalette:false,defaultGradients:false,palette,gradients},
      custom:buildCustomSection(theme)
    }
  },null,2);
  // style.css：WP 主题头（Template 指向父主题）+ HIA 变量注入 + 基础正文排版应用。
  // <lang zh-CN>变量块复用 fullTokenCss（颜色/渐变 + 字体/间距两个 :root 块）；body 规则给未经块主题处理的区域兜底。</lang>
  // <lang en>Var blocks reuse fullTokenCss (color/gradient + font/spacing :root blocks); the body rule backstops
  //   areas not covered by block theming.</lang>
  const styleCss=`/*
Theme Name: ${commentSafe(theme.name)} — HIA Child
Template: ${parent}
Description: HIA Theme Builder generated child theme (${commentSafe(theme.name)}; primary ${theme.primary.value}, secondary ${theme.secondary.value}).
Author: HIA Theme Builder
Version: 1.0.0
License: GNU General Public License v2 or later
Text Domain: hia-child-${slug}
*/

${fullTokenCss(theme,`/* HIA Theme Builder tokens — ${theme.name} */`)}

/* Apply base typography to non-block areas. */
body{font-family:var(--hia-font-body,inherit);line-height:var(--hia-line-height-body,1.65);}
`;
  // functions.php：静态引导脚本——保证父子样式加载顺序并声明基础主题支持。
  // <lang zh-CN>块主题自 WP 6.1 起自动加载父子 style.css，但显式 enqueue 对旧版本与顺序更稳；句柄名固定避免冲突。</lang>
  // <lang en>Static bootstrap: enforces parent→child style order and declares basic supports. Block themes auto-load
  //   styles since WP 6.1, but explicit enqueue is safer for older versions and ordering; fixed handles avoid clashes.</lang>
  const functionsPhp=`<?php
/**
 * HIA Theme Builder generated child theme bootstrap.
 *
 * @lang zh-CN 保证父主题样式先于子主题样式加载，并声明基础主题支持。
 * @lang en Ensures parent styles load before child styles and declares basic theme supports.
 *
 * @package hia-child-${slug}
 */

// 挂载样式入队回调（前台）。
// <lang zh-CN>依赖数组保证顺序：父样式 → 子样式（子样式可覆盖父样式变量）。</lang>
// <lang en>The dependency array enforces order: parent then child (child may override parent vars).</lang>
add_action( 'wp_enqueue_scripts', 'hia_child_enqueue_styles' );
/**
 * Enqueue parent and child stylesheets in order.
 *
 * @lang zh-CN 入队父主题与子主题样式表（保持先后依赖）。
 * @lang en Enqueues parent and child stylesheets with an explicit dependency.
 */
function hia_child_enqueue_styles() {
	wp_enqueue_style( 'hia-child-parent-style', get_template_directory_uri() . '/style.css', array(), '1.0.0' );
	wp_enqueue_style( 'hia-child-style', get_stylesheet_uri(), array( 'hia-child-parent-style' ), '1.0.0' );
}

// 声明基础主题支持（标题标签与缩略图），子主题保持最小职责。
// <lang zh-CN>其余全站编辑能力由 theme.json 提供，不在 PHP 中重复声明。</lang>
// <lang en>Full-site-editing capabilities come from theme.json; nothing is re-declared in PHP.</lang>
add_theme_support( 'title-tag' );
add_theme_support( 'post-thumbnails' );
`;
  // readme.txt：安装与使用说明（中英双语段），面向直接上传 ZIP 的维护者。
  // <lang zh-CN>列出四件套各自职责与 WP 后台路径；真机验证结论由 WorkZone 台账跟踪。</lang>
  // <lang en>Lists each file's responsibility and the WP admin path; real-install verification is tracked in the WorkZone ledger.</lang>
  const readme=`=== ${theme.name} — HIA Child Theme ===

== 中文说明 ==
由 HIA Theme Builder 生成的 WordPress 块主题子主题（父主题：${parent}）。

安装：
1. WordPress 后台 → 外观 → 主题 → 安装主题 → 上传主题，选择本 ZIP；
2. 启用"${theme.name} — HIA Child"；
3. 站点编辑器（外观 → 编辑）中即可使用 HIA 颜色面板与渐变。

文件清单：
- style.css    主题头（Template 指向父主题）+ HIA CSS 变量注入；
- theme.json   颜色面板/渐变预设/排版间距令牌（--wp--custom--hia--*）；
- functions.php 样式加载顺序与基础主题支持；
- readme.txt   本说明。

注意：父主题（${parent}）需已安装（WP 内置或应用商店可装）。

== English ==
WordPress block-theme child generated by HIA Theme Builder (parent: ${parent}).

Install:
1. WP Admin → Appearance → Themes → Add New → Upload Theme, pick this ZIP;
2. Activate "${theme.name} — HIA Child";
3. Open the Site Editor (Appearance → Editor) to use the HIA palette and gradients.

Files:
- style.css     theme header (Template points to parent) + HIA CSS variables;
- theme.json    color palette / gradient presets / typography & spacing tokens (--wp--custom--hia--*);
- functions.php style loading order and basic supports;
- readme.txt    this file.

Note: the parent theme (${parent}) must be installed (bundled with WP or installable from the directory).
`;
  // 返回四件套；路径为 ZIP 内相对根路径（WP 上传后直接构成主题根目录）。
  // <lang zh-CN>顺序固定：style → theme.json → functions.php → readme，保证 diff 与单测稳定。</lang>
  // <lang en>Fixed order: style → theme.json → functions.php → readme, keeping diffs and tests stable.</lang>
  return[
    {path:'style.css',content:styleCss},
    {path:'theme.json',content:themeJson},
    {path:'functions.php',content:functionsPhp},
    {path:'readme.txt',content:readme}
  ];
}

// WordPress 子主题导出目标（注册表条目）。
// <lang zh-CN>archiveName 用主题 slug 命名，WP 后台上传后主题目录即 hia-wp-child-<slug>。</lang>
// <lang en>archiveName uses the theme slug; after WP upload the theme dir becomes hia-wp-child-<slug>.</lang>
export const wordpressChildTarget:ExportTarget={
  id:'wordpress-child',
  name:'WordPress 子主题（ZIP）',
  nameEn:'WordPress Child Theme (ZIP)',
  notes:'生成 WP 块主题子主题四件套（style.css/theme.json/functions.php/readme.txt），WP 后台上传即可启用；含颜色面板、渐变预设与排版间距令牌。',
  notesEn:'Emits a WP block-theme child bundle (style.css/theme.json/functions.php/readme.txt), uploadable in WP Admin; includes palette, gradient presets and typography/spacing tokens.',
  archiveName:theme=>`hia-wp-child-${slugifyThemeName(theme.name)}.zip`,
  files:wordpressChildFiles
};
