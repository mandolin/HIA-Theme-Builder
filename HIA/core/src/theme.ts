import type{RoleColor,Theme,ThemeInput,TypographyTokens,SpacingTokens,SeriesMode,SeriesRelationId}from'./types.js';
import{DEFAULT_TYPOGRAPHY,DEFAULT_SPACING}from'./token/typography.js';
import{nameColor}from'./color/color-name.js';

// 字体令牌深拷贝（ADR-006）：阻断外部对象与内部状态的隐含耦合。
// <lang zh-CN>fontFamily/scale/overrides 逐层复制；overrides 为 undefined 时不显式写入键，
//   保证 deepEqual 语义（`W-tb-P9` 转接备忘的坑）。</lang>
// <lang en>Deep-copies fontFamily/scale/overrides; an undefined overrides is NOT written explicitly,
//   preserving deepEqual semantics (pitfall from the `W-tb-P9` handoff notes).</lang>
export function cloneTypography(t:TypographyTokens):TypographyTokens{const r:TypographyTokens={fontFamily:{...t.fontFamily},fontSizeScale:{...t.fontSizeScale},lineHeightBody:t.lineHeightBody};if(t.fontSizeScale.overrides)r.fontSizeScale.overrides={...t.fontSizeScale.overrides};return r;}
// 间距令牌深拷贝。
// <lang zh-CN>overrides 按索引键复制；undefined 同样不显式写入。</lang>
// <lang en>Copies overrides keyed by level index; undefined is likewise not written explicitly.</lang>
export function cloneSpacing(s:SpacingTokens):SpacingTokens{const r:SpacingTokens={...s};if(s.overrides)r.overrides={...s.overrides};return r;}
import{bestOnColor}from'./color/contrast.js';
import{cloneRadiusTokens,cloneShadowTokens}from'./token/radius.js';
import{cloneSemanticTokens}from'./color/semantic.js';
import{normalizeHex}from'./color/convert.js';
import{tonalScale}from'./color/scale.js';
import{cloneGradientSettings}from'./data/gradients.js';
import{deriveSecondaryByRelation,deriveThirdByRelation,getSeriesRelationDef}from'./color/harmony.js';

// 由单个基色构建一个完整角色色：规范化色值、生成色阶并选择最佳前景色。
// <lang zh-CN>纯函数，无副作用；name 缺省时用 `nameColor` 的**真实色名**兜底（如"强蓝"），
//   而不是"主色"这类占位词——占位词会让 UI 显示"主色 #0047AB"，用户仍不知道这是什么色。</lang>
// <lang en>Pure, side-effect-free. An empty name falls back to the **real** color name from `nameColor`
//   (e.g. "Strong Blue") rather than a placeholder like "主色" — a placeholder leaves the UI showing
//   "主色 #0047AB" without telling the user what color it actually is.</lang>
function buildRoleColor(value:string,name:string):RoleColor{
  const hex=normalizeHex(value);
  // 色名兜底：`nameColor` 是纯函数（ISCC-NBS 修饰语 + 色相），对任意 HEX 都有结果。
  // <lang en>The fallback is pure (ISCC-NBS modifier + hue) and defined for any HEX.</lang>
  return{name:name||nameColor(hex).zh,value:hex,scale:tonalScale(hex),on:bestOnColor(hex).hex};
}
// 角色色深拷贝：阻断外部对象与内部状态的隐含耦合（scale 对象逐键复制）。
// <lang zh-CN>用于第三角色与辅助槽位入参与 Theme 装配的隔离。</lang>
// <lang en>Used to isolate third/auxiliary inputs and Theme assembly.</lang>
function cloneRoleColor(color:RoleColor):RoleColor{
  return{name:color.name,value:color.value,scale:{...color.scale},on:color.on};
}

// 将轻量 ThemeInput 构建为完整主题对象。
// <lang zh-CN>所有色阶/前景色在此计算完毕；名称、分类缺省有回退，渐变做深拷贝避免外部引用共享。</lang>
// <lang en>Computes all scales/foregrounds; name and category fall back to defaults, gradients are deep-cloned to avoid shared refs.</lang>
export function buildTheme(input:ThemeInput):Theme{
  // 字体/间距令牌：缺省补默认（ADR-006 向后兼容）；传入则整体采用（单档覆写在令牌组内部）。
  // <lang zh-CN>typography/spacing 为可选入参，保证旧调用点不受影响。</lang>
  // <lang en>typography/spacing are optional inputs so legacy call sites are unaffected.</lang>
  const typography=input.typography??DEFAULT_TYPOGRAPHY,
    spacing=input.spacing??DEFAULT_SPACING;
  // 主色系模式与关系规则（ADR-007 v2）：缺省 dual/manual（现行行为）；未登记组合回退 manual。
  // <lang zh-CN>getSeriesRelationDef 提供模式匹配校验（single 无规则、triad 六规则）。</lang>
  // <lang en>getSeriesRelationDef validates the mode/relation pairing (single has none; triad has six).</lang>
  const seriesMode:SeriesMode=input.seriesMode??'dual';
  const seriesRelation=getSeriesRelationDef(input.seriesRelation??'manual',seriesMode).id;
  // 分别构建主色与副色两套角色色。
  // <lang zh-CN>主副色独立生成，保证各自色阶与前景色自洽；单色模式下副色取主色系变体（primary 深档，
  //   定案：系统角色全链路照常，用户传入的 secondary 色相被变体替换）。</lang>
  // <lang en>Single mode replaces the user secondary hue with the primary-series variant (primary 700 step) per the ADR-007 v2 decision.</lang>
  // 不在此处用占位词兜底：空名称直接传给 buildRoleColor，由它用真实色名填充。
  // <lang en>No placeholder here: an empty name reaches buildRoleColor, which fills in the real colour name.</lang>
  const primary=buildRoleColor(input.primary,input.primaryName||'');
  let secondary:RoleColor;
  if(seriesMode==='single'){
    // 单色变体：取主色 700 档重建角色色（含色阶与前景色）。
    // <lang zh-CN>primary.scale['700'] 为推导基准；name 标注变体来源。</lang>
    // <lang en>Built from the primary 700 step with a variant name.</lang>
    const variantHex=primary.scale['700']!;
    secondary={name:(primary.name)+' · 系列变体',value:variantHex,scale:tonalScale(variantHex),on:bestOnColor(variantHex).hex};
  }else{
    secondary=buildRoleColor(input.secondary,input.secondaryName||'');
  }
  // 第三角色装配（ADR-007 v2）：仅 triad 存在；显式入参深拷贝保留，缺省按关系规则从主色推导（manual/pure 无推导）。
  // <lang zh-CN>推导语义：primary/secondary 为用户根基，第三色补全组合（可覆写）。</lang>
  // <lang en>triad only; explicit input wins, otherwise derived per relation (manual/pure derive nothing).</lang>
  let thirdColor:RoleColor|undefined;
  if(seriesMode==='triad'){
    if(input.thirdColor)thirdColor=cloneRoleColor(input.thirdColor);
    else{
      const derived=deriveThirdByRelation(primary.value,secondary.value,seriesRelation);
      if(derived)thirdColor=buildRoleColor(derived,'第三色（'+seriesRelation+' 推导）');
    }
  }
  // 辅助槽位装配（ADR-007 v2）：独立维度，缺省 []（手动添加/按规则生成由 UI 写入草稿）。
  // <lang zh-CN>显式入参深拷贝保留；undefined 与 [] 同为空（辅助色无自动推导装配）。</lang>
  // <lang en>Explicit inputs deep-cloned; absent and [] both mean empty (no auto-derivation for auxiliary).</lang>
  // 辅助槽位重建：入参可能为简形态（仅 value/name），统一经 buildRoleColor 补全色阶与前景色。
  // <lang zh-CN>与第三角色装配同构；空数组保持空。</lang>
  // <lang en>Same as third-role assembly; empty stays empty.</lang>
  const auxiliary=input.auxiliary?.length
    ?input.auxiliary.map(a=>buildRoleColor(a.value,a.name))
    :[];
  return{
    name:input.name||`${primary.name}·${secondary.name}`,
    category:input.category||'custom',
    industry:input.industry||'',
    primary,
    secondary,
    // 深拷贝渐变配置，防止调用方后续修改污染已构建主题。
    // <lang zh-CN>克隆可阻断外部对象与内部状态的隐含耦合。</lang>
    // <lang en>Cloning prevents implicit coupling between external objects and internal state.</lang>
    gradients:cloneGradientSettings(input.gradients),
    typography:cloneTypography(input.typography??typography),
    spacing:cloneSpacing(input.spacing??spacing),
    note:input.note,
    seriesMode,
    seriesRelation,
    ...(thirdColor?{thirdColor}:{}),
    auxiliary,
    // 圆角/阴影（`W-tb-P37`，ADR-006 契约位落地）：可选入参，缺省回退默认档——旧调用点不受影响。
    // <lang en>Radius/shadow (`W-tb-P37`, ADR-006 slot landed): optional inputs defaulting back — legacy call
    //   sites unaffected.</lang>
    radius:cloneRadiusTokens(input.radius),
    shadow:cloneShadowTokens(input.shadow),
    // 语义状态色（ADR-012）：仅透传显式提供的组；**不静默派生**——旧主题观感不因升级改变（决策 6）。
    // <lang en>Semantic tokens (ADR-012): only pass through explicit groups; **no silent derivation** — old
    //   themes must not change appearance on upgrade (decision 6).</lang>
    ...(input.semantic?{semantic:cloneSemanticTokens(input.semantic)}:{})
  };
}
