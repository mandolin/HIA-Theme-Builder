/**
 * @lang zh-CN 编辑器配色主题生成器（`W-tb-P42`，ADR-015）：把 HIA 主题映射为
 *   TextMate（`.tmTheme` XML plist）/ VSCode（`.color-theme.json`）/ Vim（`.vim`）/ Emacs（`.el`）
 *   四种格式。**scope→角色档位映射**是 HIA 的设计判断（登记于 ADR-015），逐 scope 独立取色——
 *   导出产物是精确的（与预览的"着色示意"分离）。明暗两套由 appearance 参数派生。
 *
 * @lang en Editor colour theme generators (`W-tb-P42`, ADR-015): map an HIA theme to
 *   TextMate (`.tmTheme` XML plist) / VSCode (`.color-theme.json`) / Vim (`.vim`) / Emacs (`.el`).
 *   The scope→role mapping is an HIA design judgement (registered in ADR-015); each scope resolves
 *   independently, so exports are exact (the preview remains an approximation, by design).
 */
import type{Theme,RoleColor}from'../types.js';
import{normalizeHex}from'../color/convert.js';

/** @lang zh-CN 外观档位：light/dark 各派生一套编辑器主题。 @lang en Appearance: light/dark each derive one editor theme. */
export type EditorAppearance='light'|'dark';

/** @lang zh-CN 单条 scope 映射：TextMate scope 名 + 前景（角色.档位）+ 可选背景。 @lang en One scope mapping: TextMate scope name + foreground (role.step) + optional background. */
interface ScopeMapping{scope:string;fg:(t:Theme)=>string;bg?:((t:Theme)=>string);}

// 角色档位取值（恒 HEX；缺失档位回退基色）。
// <lang en>Role/step lookup (always HEX; missing steps fall back to the base colour).</lang>
function step(t:Theme,role:'primary'|'secondary',shade:string):string{
  const r:RoleColor=t[role];
  // shade 是运行时拼出的档位键（'50'…'900'），ColorScale 索引签名按字符串键放行。
  // <lang en>shade is a runtime-built step key ('50'…'900'); index ColorScale by string key.</lang>
  return (r.scale as Record<string,string>)[shade]??r.value;
}
function thirdOr(t:Theme,fallback:string):string{return t.thirdColor?.value??fallback;}
function auxOr(t:Theme,i:number,fallback:string):string{return t.auxiliary[i]?.value??fallback;}

/**
 * @lang zh-CN scope 映射表（ADR-015 登记的 HIA 设计判断）。
 *   设计原则：注释退后（secondary.600 低刺激）、字符串/常量用语义间隔色（success/warning 系
 *   若语义色存在则优先——编辑器主题不自带语义组，故此处用 primary 系间隔档）、
 *   关键字用主色、函数名用主色深阶、变量用中性深墨、类型用第三色/辅助色。
 * @lang en The scope mapping (HIA design judgement, ADR-015): comments recede (secondary.600),
 *   strings/constants get semantic-interval shades, keywords use the primary, function names its darker
 *   step, variables neutral ink, types the third/aux colour.
 */
function scopeMappings(t:Theme):ScopeMapping[]{
  const hasSemantic=t.semantic;
  const stringHex=hasSemantic?t.semantic!.success.scale['600']??t.semantic!.success.value:step(t,'secondary','600');
  const numberHex=hasSemantic?t.semantic!.warning.scale['600']??t.semantic!.warning.value:step(t,'secondary','700');
  const typeHex=t.thirdColor?.value??auxOr(t,0,step(t,'primary','400'));
  return[
    {scope:'comment',fg:()=>step(t,'secondary','600')},
    {scope:'string',fg:()=>stringHex},
    {scope:'constant.numeric',fg:()=>numberHex},
    {scope:'constant.language',fg:()=>step(t,'primary','400')},
    {scope:'keyword',fg:()=>step(t,'primary','500')},
    {scope:'keyword.operator',fg:()=>step(t,'secondary','700')},
    {scope:'entity.name.function',fg:()=>step(t,'primary','600')},
    {scope:'entity.name.type',fg:()=>typeHex},
    {scope:'entity.name.tag',fg:()=>step(t,'primary','600')},
    {scope:'variable',fg:()=>step(t,'secondary','900')},
    {scope:'variable.parameter',fg:()=>step(t,'secondary','800')},
    {scope:'support.function',fg:()=>step(t,'primary','600')},
    {scope:'meta.tag',fg:()=>thirdOr(t,step(t,'primary','600'))},
    {scope:'markup.heading',fg:()=>step(t,'primary','700')}
  ];
}

/** @lang zh-CN 编辑器 chrome：背景/前景/行号/选区/当前行——明暗两套各自取色。 @lang en Editor chrome: background, foreground, line numbers, selection, current line — per appearance. */
function chrome(t:Theme,appearance:EditorAppearance){
  // light：主色 50 阶底 + 深墨字；dark：主色 900 阶底 + 主色 50 字。
  // <lang en>light: primary-50 bg + ink text; dark: primary-900 bg + primary-50 text.</lang>
  if(appearance==='dark'){
    return{bg:t.primary.scale['900']??'#101A2B',fg:t.primary.scale['50']??'#E8EEF7',line:t.primary.scale['800']??'#182540',selection:t.primary.scale['700']??'#243B5E',current:t.primary.scale['800']??'#182540',comment:step(t,'secondary','400')};
  }
  return{bg:t.primary.scale['50']??'#F4F8FD',fg:t.primary.scale['900']??'#0F1E33',line:t.primary.scale['100']??'#DCE8F4',selection:t.primary.scale['100']??'#DCE8F4',current:t.primary.scale['100']??'#DCE8F4',comment:step(t,'secondary','600')};
}

/** @lang zh-CN 主题名规范化（编辑器主题名不含空格/特殊字符）。 @lang en Normalises the theme name for editor theme titles. */
function editorName(t:Theme,appearance:EditorAppearance):string{
  const base=t.name.replace(/[^\w\u4e00-\u9fa5-]+/g,' ').trim();
  return`${base} (${appearance})`;
}

/**
 * @lang zh-CN 生成 TextMate 主题（`.tmTheme`，XML plist 格式）。
 *   scope 按"父 scope"粒度输出（TextMate 匹配前缀，子 scope 继承）。
 * @lang en TextMate theme (`.tmTheme`, XML plist). Scopes emit at parent granularity (TextMate matches by
 *   prefix, children inherit).
 */
export function textmateTheme(t:Theme,appearance:EditorAppearance='light'):string{
  const c=chrome(t,appearance);
  const items=scopeMappings(t).map(m=>`		<dict>
			<key>name</key><string>${m.scope}</string>
			<key>scope</key><string>${m.scope}</string>
			<key>settings</key><dict>
				<key>foreground</key><string>${m.fg(t)}</string>${m.bg?`\n				<key>background</key><string>${m.bg(t)}`:''}
			</dict>
		</dict>`).join('\n');
  return`<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
	<key>name</key><string>${editorName(t,appearance)}</string>
	<key>semanticClass</key><string>theme.${appearance}.${editorName(t,appearance)}</string>
	<key>settings</key><array>
		<dict>
			<key>settings</key><dict>
				<key>background</key><string>${c.bg}</string>
				<key>foreground</key><string>${c.fg}</string>
				<key>lineHighlight</key><string>${c.current}</string>
				<key>selection</key><string>${c.selection}</string>
			</dict>
		</dict>
${items}
	</array>
</dict>
</plist>
`;
}

/**
 * @lang zh-CN 生成 VSCode 主题（`.color-theme.json`）：tokenColors（scope 数组）+ colors
 *   （workbench chrome：editorBackground/lineNumber/selection 等）。
 * @lang en VSCode theme (`.color-theme.json`): tokenColors (scope array) + workbench colors
 *   (editorBackground, lineNumber, selection…).
 */
export function vscodeTheme(t:Theme,appearance:EditorAppearance='light'):string{
  const c=chrome(t,appearance);
  const tokenColors=scopeMappings(t).map(m=>({
    scope:m.scope,
    settings:{foreground:m.fg(t),...(m.bg?{background:m.bg(t)}:{})}
  }));
  const doc={
    name:editorName(t,appearance),
    type:appearance==='dark'?'dark':'light',
    semanticHighlighting:true,
    colors:{
      'editor.background':c.bg,
      'editor.foreground':c.fg,
      'editorLineNumber.foreground':c.line,
      'editor.selectionBackground':c.selection,
      'editor.lineHighlightBackground':c.current
    },
    tokenColors
  };
  return JSON.stringify(doc,null,2)+'\n';
}

/**
 * @lang zh-CN 生成 Vim 主题（`.vim` 脚本）：highlight 组映射——
 *   Comment/String/Number/Keyword/Function/Type/Normal/Visual/LineNr。
 * @lang en Vim theme (`.vim` script): highlight groups Comment/String/Number/Keyword/Function/Type/Normal/
 *   Visual/LineNr.
 */
export function vimTheme(t:Theme,appearance:EditorAppearance='light'):string{
  const c=chrome(t,appearance);
  const m=scopeMappings(t);
  const fg=(scope:string)=>m.find(x=>x.scope===scope)?.fg(t)??c.fg;
  const name=editorName(t,appearance).replace(/[^\w\u4e00-\u9fa5-]+/g,'_');
  return`" ${editorName(t,appearance)} — generated by HIA Theme Builder (W-tb-P42 / ADR-015)
" Usage: :colorscheme ${name}
if exists('g:syntax_on')
  syntax reset
endif
let g:colors_name = '${name}'

set background=${appearance==='dark'?'dark':'light'}
highlight clear

highlight Normal    guifg=${c.fg} guibg=${c.bg}
highlight Comment   guifg=${fg('comment')}
highlight String    guifg=${fg('string')}
highlight Number    guifg=${fg('constant.numeric')}
highlight Boolean   guifg=${fg('constant.language')}
highlight Keyword   guifg=${fg('keyword')}
highlight Operator  guifg=${fg('keyword.operator')}
highlight Function  guifg=${fg('entity.name.function')}
highlight Type      guifg=${fg('entity.name.type')}
highlight Tag       guifg=${fg('entity.name.tag')}
highlight Variable  guifg=${fg('variable')}
highlight Visual    guibg=${c.selection}
highlight LineNr    guifg=${c.line}
highlight CursorLine guibg=${c.current}
`;
}

/**
 * @lang zh-CN 生成 Emacs 主题（`.el` face 定义）：defface + deftheme，组与 Vim 对齐。
 * @lang en Emacs theme (`.el` face definitions): deftheme + defface, groups aligned with Vim.
 */
export function emacsTheme(t:Theme,appearance:EditorAppearance='light'):string{
  const c=chrome(t,appearance);
  const m=scopeMappings(t);
  const fg=(scope:string)=>m.find(x=>x.scope===scope)?.fg(t)??c.fg;
  const name=editorName(t,appearance).replace(/[^\w\u4e00-\u9fa5-]+/g,'-').toLowerCase();
  return`;;; ${editorName(t,appearance)} — generated by HIA Theme Builder (W-tb-P42 / ADR-015)
;;; Usage: (load-theme '${name})

(deftheme ${name}
  "HIA Theme Builder theme (${appearance}).")

(custom-theme-set-faces
 '${name}
 '(default ((t (:background "${c.bg}" :foreground "${c.fg}"))))
 '(font-lock-comment-face ((t (:foreground "${fg('comment')}"))))
 '(font-lock-string-face ((t (:foreground "${fg('string')}"))))
 '(font-lock-constant-face ((t (:foreground "${fg('constant.numeric')}"))))
 '(font-lock-keyword-face ((t (:foreground "${fg('keyword')}"))))
 '(font-lock-function-name-face ((t (:foreground "${fg('entity.name.function')}"))))
 '(font-lock-type-face ((t (:foreground "${fg('entity.name.type')}"))))
 '(font-lock-variable-name-face ((t (:foreground "${fg('variable')}"))))
 '(region ((t (:background "${c.selection}"))))
 '(line-number ((t (:foreground "${c.line}")))))
`;
}

/**
 * @lang zh-CN 生成器注册表：`builtin:` templateRef 名 → 生成函数与产物扩展名。
 *   TDON 文档经 `exportManifest.files[]` 以 `templateRef` 引用（与 `builtin:hia-tokens-css` 同构）。
 *   appearance 由调用方（导出链路）传入——TDON 文档可用同一路径声明两份（light/dark）。
 * @lang en Generator registry: `builtin:` templateRef name → generator + file extension. TDON documents
 *   reference them from `exportManifest.files[]` (isomorphic with `builtin:hia-tokens-css`); appearance is
 *   passed by the export pipeline, so a document can declare both light/dark files.
 */
export const EDITOR_THEME_GENERATORS:{
  ref:string;ext:string;label:string;generate:(t:Theme,appearance:EditorAppearance)=>string;
}[]=[
  {ref:'builtin:textmate-theme',ext:'.tmTheme',label:'TextMate',generate:textmateTheme},
  {ref:'builtin:vscode-theme',ext:'.color-theme.json',label:'VSCode',generate:vscodeTheme},
  {ref:'builtin:vim-theme',ext:'.vim',label:'Vim',generate:vimTheme},
  {ref:'builtin:emacs-theme',ext:'.el',label:'Emacs',generate:emacsTheme}
];

/** @lang zh-CN 按 ref 取生成器定义；未命中返回 undefined。 @lang en Looks up a generator by ref; undefined when missing. */
export function findEditorThemeGenerator(ref:string){return EDITOR_THEME_GENERATORS.find(g=>g.ref===ref);}
