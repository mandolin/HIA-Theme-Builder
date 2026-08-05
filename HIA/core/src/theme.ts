import type{RoleColor,Theme,ThemeInput}from'./types.js';
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
    note:input.note
  };
}
