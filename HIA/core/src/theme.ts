import type{RoleColor,Theme,ThemeInput,TypographyTokens,SpacingTokens}from'./types.js';
import{DEFAULT_TYPOGRAPHY,DEFAULT_SPACING}from'./token/typography.js';

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
import{normalizeHex}from'./color/convert.js';
import{tonalScale}from'./color/scale.js';
import{cloneGradientSettings}from'./data/gradients.js';

// 由单个基色构建一个完整角色色：规范化色值、生成色阶并选择最佳前景色。
// <lang zh-CN>纯函数，无副作用；name 缺省回退“主色”，on 由对比度自动决定白/深。</lang>
// <lang en>Pure, side-effect-free; falls back to "主色" when name is empty, and `on` is auto white/dark by contrast.</lang>
function buildRoleColor(value:string,name:string):RoleColor{
  const hex=normalizeHex(value);
  return{name:name||'主色',value:hex,scale:tonalScale(hex),on:bestOnColor(hex).hex};
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
  // 分别构建主色与副色两套角色色。
  // <lang zh-CN>主副色独立生成，保证各自色阶与前景色自洽。</lang>
  // <lang en>Primary and secondary are generated independently so their scales/foregrounds stay self-consistent.</lang>
  const primary=buildRoleColor(input.primary,input.primaryName||'主色'),
    secondary=buildRoleColor(input.secondary,input.secondaryName||'副色');
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
    note:input.note
  };
}
