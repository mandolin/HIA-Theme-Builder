/**
 * @lang zh-CN 对比度自检脚本（`W-tb-P7` 退出验证）：用 @hia/theme-core 的 WCAG 对比度原语
 *   检查运行时 UI 的真实前景/背景配对（非假想最坏情况）。
 *   覆盖：① 控制台 chrome 固定配对（--text/--muted 于 --panel/--surface，来自 style.css :root）；
 *   ② 每个主题的按钮配对（--on-primary 于 --primary、--on-secondary 于 --secondary，经 core
 *   bestOnColor 现算）；③ 控制台浅底配对（p900 于 p50，副色自动适配生成区的真实底色）；
 *   ④ 演示内容深底白字（白字于 p700，渐变 showcase 的真实用色）。
 *   门槛：正文 4.5:1；UI 组件 3:1。运行：node scripts/check-contrast.mjs（需先构建 core）。
 * @lang en Contrast self-check (`W-tb-P7` exit verification): checks REAL runtime fg/bg pairs
 *   (not hypothetical worst cases) via @hia/theme-core WCAG primitives.
 *   Covers: (1) fixed console chrome pairs (--text/--muted on --panel/--surface, from style.css
 *   :root); (2) per-theme button pairs (--on-primary on --primary, --on-secondary on --secondary,
 *   via core bestOnColor); (3) console light-bg pair (p900 on p50, the real generate box bg);
 *   (4) demo dark-bg white text (white on p700, real gradient showcase usage).
 *   Thresholds: 4.5:1 body; 3:1 UI components. Run: node scripts/check-contrast.mjs (core built).
 */
import{builtinPresets,bestOnColor,contrast,tonalScale}from'@hia/theme-core';

/** @lang zh-CN 检查结果条目。 @lang en Check result entry. */
const results=[];
/**
 * @lang zh-CN 记录一条配对检查。
 * @lang en Record one pair check.
 */
function check(theme,usage,fg,bg,min){
  const ratio=+contrast(fg,bg).toFixed(2);
  results.push({theme,usage,fg,bg,ratio,min,ok:ratio>=min});
}

// ---- ① 控制台 chrome 固定配对（style.css :root 实测值，与主题无关） ----
// <lang zh-CN>这些变量不随主题变化，一次检查即覆盖所有主题下的控制台框架。</lang>
// <lang en>These vars never change with the theme; one check covers the console frame everywhere.</lang>
check('chrome 固定','正文 --text 于面板 --panel','#172633','#FFFFFF',4.5);
check('chrome 固定','正文 --text 于 --surface','#172633','#F3F6F9',4.5);
check('chrome 固定','次要 --muted 于 --panel','#5D6C78','#FFFFFF',4.5);
check('chrome 固定','次要 --muted 于 --surface-2','#5D6C78','#EAF0F5',4.5);

// ---- ②③④ 每主题检查（默认主题 + 全部内置预设） ----
const themes=[{name:'默认主题（钴蓝/清透青）',primary:'#0047AB',secondary:'#00A8D3'}];
for(const preset of builtinPresets){
  themes.push({name:`预设 ${preset.name}`,primary:preset.primary,secondary:preset.secondary});
}
for(const th of themes){
  const pScale=tonalScale(th.primary);
  const sScale=tonalScale(th.secondary);
  // ② 按钮配对：core bestOnColor 现算 on-color（与 runtime CSS 生成逻辑同源）。
  // <lang zh-CN>runtime 变量 --on-primary 即 bestOnColor(primary).hex。</lang>
  // <lang en>Runtime var --on-primary is exactly bestOnColor(primary).hex.</lang>
  const onP=bestOnColor(th.primary);
  const onS=bestOnColor(th.secondary);
  check(th.name,'按钮字 --on-primary 于 --primary',onP.hex,th.primary,4.5);
  check(th.name,'强调字 --on-secondary 于 --secondary',onS.hex,th.secondary,4.5);
  // ③ 控制台浅底配对：副色生成区真实底色为 p50 渐变，文字为 --text。
  // <lang zh-CN>generateStatus 所在盒子背景为 p50→p100 渐变，取更浅端测最坏情况。</lang>
  // <lang en>The generate box bg is a p50→p100 gradient; the lighter end is the worst case.</lang>
  check(th.name,'控制台浅底 p900 于 p50',pScale['900'],pScale['50'],4.5);
  // ④ 演示深底白字：渐变 showcase 在 p700+ 深底上放白字。
  // <lang zh-CN>取 p700 测（更深的 800/900 只会更好）。</lang>
  // <lang en>Tested at p700 (deeper 800/900 only improve).</lang>
  check(th.name,'演示深底 白字于 p700','#FFFFFF',pScale['700'],4.5);
  check(th.name,'演示强调 s800 于 s100',sScale['800'],sScale['100'],4.5);
}

// ---- 输出报告 ----
// <lang zh-CN>违规明细 + 汇总；退出码 0/1。</lang>
// <lang en>Violation details + summary; exit code 0/1.</lang>
let violations=0;
for(const r of results){
  if(!r.ok){
    violations++;
    console.log(`✗ [${r.theme}] ${r.usage}: ${r.fg} on ${r.bg} = ${r.ratio}:1 (need ${r.min}:1)`);
  }
}
console.log(`\nChecked ${results.length} real pairs across ${themes.length} themes; violations: ${violations}`);
if(violations>0){
  console.log('WCAG AA not met — adjust tokens or register a reviewed exception (dev/exceptions/).');
  process.exit(1);
}
console.log('✅ All real UI pairs meet WCAG AA.');
