/**
 * @lang zh-CN 导出文件预览的轻量语法高亮（维护者反馈，`W-tb-P42` 后续）：
 *   「主题 Token 导出」与「自定义支持（TDON）」的文件清单预览此前是纯 `<textarea>`（单色文本），
 *   阅读不友好。本模块把导出内容渲染为**带行号与高亮的只读代码块**——浅色底（当前主题的浅阶），
 *   标记色取自当前主题（primary/secondary 系 CSS 变量），不硬编码颜色。
 *
 *   四类覆盖全部导出物：CSS/SCSS（含 Tailwind `@theme`）、JSON（含 DTCG `.tokens.json`）、
 *   标记语言（`.tmTheme` 的 XML plist、HTML/PHP）、通用（Vim/Emacs 脚本）。
 *
 *   安全性：输入先 `esc`，高亮只插入 `<span class="tok-*">`，绝不透传原始 HTML（同 TDON-5.4 原则）。
 * @lang en Lightweight syntax highlighting for export previews (maintainer feedback, follow-up to
 *   `W-tb-P42`): the file previews in both export areas used to be plain `<textarea>`s (single-colour text).
 *   This module renders them as **read-only code blocks with line numbers and highlighting** — light
 *   background (a light tint of the current theme), token colours from theme CSS variables, nothing
 *   hardcoded.
 *
 *   Four families cover every export: CSS/SCSS (incl. Tailwind `@theme`), JSON (incl. DTCG `.tokens.json`),
 *   markup (`.tmTheme` XML plist, HTML/PHP), generic (Vim/Emacs scripts).
 *
 *   Security: input is escaped first; highlighting only inserts `<span class="tok-*">` and never passes raw
 *   HTML through (same principle as TDON-5.4).
 */

/** @lang zh-CN 高亮语言族。 @lang en Highlight language families. */
export type PreviewLang = 'css' | 'json' | 'markup' | 'generic';

/** @lang zh-CN 按文件路径推断高亮族。 @lang en Infers the highlight family from a file path. */
export function previewLangFor(path: string): PreviewLang {
  const p = path.toLowerCase();
  if (/\.(css|scss|sass|less)$/.test(p)) return 'css';
  if (/\.(json|jsonc|json5|map)$/.test(p)) return 'json';
  // .tmTheme 是 XML plist；HTML/PHP 同属标记语言。
  // <lang en>.tmTheme is an XML plist; HTML/PHP are markup too.</lang>
  if (/\.(tmtheme|html|htm|xml|php)$/.test(p)) return 'markup';
  return 'generic';
}

/** @lang zh-CN 高亮前的唯一安全屏障。 @lang en The single safety barrier before highlighting. */
function esc(s: string): string {
  return s.replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch] ?? ch));
}

/** @lang zh-CN 一条匹配规则：类名 + 正则（在**已转义**文本上匹配，故用实体形式书写）。 @lang en One rule: class + regex (matched on **escaped** text, so patterns use entity forms). */
interface Rule { cls: string; re: RegExp }

// 每族规则按优先级排列；先匹配者优先占位，后续规则只处理未占用的片段。
// <lang en>Rules are ordered by priority; earlier matches win and later rules only see free fragments.</lang>
const RULES: Record<PreviewLang, Rule[]> = {
  // CSS：自定义属性 → var() 引用 → at 规则 → 十六进制色 → 数值 → 字符串。
  css: [
    { cls: 'prop', re: /--[\w-]+/ },
    { cls: 'varref', re: /var\(--[\w-]+/ },
    { cls: 'atrule', re: /@[\w-]+/ },
    { cls: 'color', re: /#[0-9a-fA-F]{3,8}\b/ },
    { cls: 'number', re: /\b\d+(?:\.\d+)?(?:px|rem|em|%|deg|ms|s|fr)?\b/ },
    { cls: 'string', re: /&quot;[^\n]*?&quot;|'[^'\n]*'/ }
  ],
  // JSON：键（引号后跟冒号）→ 字符串值 → 数字 → 字面量。
  json: [
    { cls: 'key', re: /&quot;[^&\n]*?&quot;(?=\s*:)/ },
    { cls: 'string', re: /&quot;[^\n]*?&quot;/ },
    { cls: 'number', re: /\b-?\d+(?:\.\d+)?(?:[eE][-+]?\d+)?\b/ },
    { cls: 'literal', re: /\b(?:true|false|null)\b/ }
  ],
  // 标记：标签名 → 属性名 → 字符串（plist 的 <key> 文本由 generic 的高亮不覆盖，保持配色干净）。
  markup: [
    { cls: 'atrule', re: /&lt;\/?[\w:.-]+/ },
    { cls: 'prop', re: /[\w:.-]+(?==)/ },
    { cls: 'string', re: /&quot;[^\n]*?&quot;|'[^'\n]*'/ }
  ],
  // 通用（Vim/Emacs）：命令/关键字 → 字符串 → 数字。
  generic: [
    { cls: 'atrule', re: /\b(?:highlight|set|let|deftheme|defface|custom-theme-set-faces|guifg|guibg|colors_name)\b/ },
    { cls: 'string', re: /&quot;[^\n]*?&quot;|'[^'\n]*'/ },
    { cls: 'number', re: /\b\d+(?:\.\d+)?\b/ }
  ]
};

/**
 * @lang zh-CN 高亮单行：按规则优先级把行切成片段，命中片段包 `<span class="tok-*">`。
 *   规则在**已转义**文本上匹配，故所有 token 边界与 HTML 实体天然对齐。
 * @lang en Highlights one line: splits it by rule priority, wrapping matches in `<span class="tok-*">`.
 *   Matching happens on **escaped** text, so token boundaries align with HTML entities by construction.
 */
function highlightLine(line: string, rules: Rule[]): string {
  // 片段列表：`cls` 为空表示仍是普通文本，可继续被后续规则切分。
  // <lang en>Fragments: an empty `cls` means plain text that later rules may still split.</lang>
  let parts: Array<{ text: string; cls?: string }> = [{ text: esc(line) }];
  for (const rule of rules) {
    const next: typeof parts = [];
    for (const part of parts) {
      if (part.cls) { next.push(part); continue; }
      // 每条规则用独立正则实例（带 g），避免 lastIndex 在片段间串味。
      // <lang en>A fresh global regex per fragment avoids lastIndex leaking between fragments.</lang>
      const re = new RegExp(rule.re.source, 'g');
      let last = 0;
      let m: RegExpExecArray | null;
      while ((m = re.exec(part.text)) !== null) {
        if (m.index > last) next.push({ text: part.text.slice(last, m.index) });
        next.push({ text: m[0], cls: rule.cls });
        last = m.index + m[0].length;
        if (m[0].length === 0) re.lastIndex++; // 零宽匹配保护
      }
      if (last < part.text.length) next.push({ text: part.text.slice(last) });
    }
    parts = next;
  }
  return parts.map(p => (p.cls ? `<span class="tok-${p.cls}">${p.text}</span>` : p.text)).join('');
}

/**
 * @lang zh-CN 跨行注释预切分：`/* … *\/` 与 `<!-- … -->` 整块识别，避免被逐行规则撕开。
 *   返回"普通 / 注释"段序列，行数结构保持不变。
 * @lang en Cross-line comment pre-split: whole `/* … *\/` and `<!-- … -->` blocks are recognised so per-line
 *   rules cannot tear them apart. Returns plain/comment segments preserving line structure.
 */
function splitComments(content: string): Array<{ text: string; isComment: boolean }> {
  const out: Array<{ text: string; isComment: boolean }> = [];
  const re = /\/\*[\s\S]*?\*\/|<!--[\s\S]*?-->/g;
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(content)) !== null) {
    if (m.index > last) out.push({ text: content.slice(last, m.index), isComment: false });
    out.push({ text: m[0], isComment: true });
    last = m.index + m[0].length;
  }
  if (last < content.length) out.push({ text: content.slice(last), isComment: false });
  return out;
}

/**
 * @lang zh-CN 渲染完整预览块（两个导出区共用）：标题行（路径 + 语言/行数）+ 行号栏 + 代码区。
 *   行号栏与代码保持与 code-editor 一致的 16px 间距 + 1px 分隔线，全站观感统一。
 * @lang en Renders the full preview block (shared by both export areas): a head line (path + language/line
 *   count), the gutter and the code area. The gutter keeps the same 16px spacing + 1px divider as the
 *   code-editor for a consistent look.
 */
export function renderCodePreview(content: string, path: string): string {
  const lang = previewLangFor(path);
  const rules = RULES[lang];
  const lines: string[] = [];
  for (const block of splitComments(content)) {
    if (block.isComment) {
      // 块注释按行拆开，每行都套 comment 类（保留原始换行结构）。
      // <lang en>Block comments split per line, each wrapped in the comment class.</lang>
      for (const line of block.text.split('\n')) lines.push(`<span class="tok-comment">${esc(line)}</span>`);
    } else {
      for (const line of block.text.split('\n')) lines.push(highlightLine(line, rules));
    }
  }
  // 末尾因结尾换行产生的多余空行去掉（编辑器的通行做法）。
  // <lang en>Drop the extra empty line produced by a trailing newline (as editors do).</lang>
  if (lines.length > 1 && lines[lines.length - 1] === '' && content.endsWith('\n')) lines.pop();
  const body = lines
    .map((line, i) => `<div class="cv-row"><span class="cv-ln">${i + 1}</span><span class="cv-code">${line || ' '}</span></div>`)
    .join('');
  return `<div class="code-view" data-lang="${lang}"><div class="code-view-head"><span class="cv-path">${esc(path)}</span><span class="cv-meta">${lang.toUpperCase()} · ${lines.length} lines</span></div><div class="code-view-body">${body}</div></div>`;
}
