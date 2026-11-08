import type{Theme}from'../types.js';
import{collectCustomShades}from'../gradient/render.js';

// 将完整主题导出为格式化 JSON（名称/分类/行业 + 主副角色色与色阶 + 自定义色阶 + 渐变配置）。
// <lang zh-CN>industry 缺失回退空串；自定义色阶以附加键并入 scale 对象（ADR-004，解析端容忍未知键，
//   导入侧经基色重建标准 10 档、渐变配置经 cloneGradientSettings 校验保留）。
//   便于程序化消费、导入导出与版本比对。</lang>
// <lang en>industry falls back to ''; custom shades merge additively into the scale object (ADR-004;
//   parse side tolerates unknown keys — import rebuilds the standard 10 steps from base colors and
//   keeps gradient configs via cloneGradientSettings validation).</lang>
export function exportThemeJson(theme:Theme):string{
  // 自定义色阶并入 scale（附加键），消费方可直接取值而无需持有同版本 core。
  // <lang zh-CN>与 ADR-004 的向后兼容承诺一致：标准 10 档不变，附加键只增不改。</lang>
  // <lang en>Consistent with ADR-004's compatibility promise: standard steps unchanged, additive keys only.</lang>
  const custom=collectCustomShades(theme);
  const primaryScale={...theme.primary.scale,...custom.primary};
  const secondaryScale={...theme.secondary.scale,...custom.secondary};
  return JSON.stringify({
    name:theme.name,
    category:theme.category,
    industry:theme.industry||'',
    primary:{name:theme.primary.name,value:theme.primary.value,scale:primaryScale,on:theme.primary.on},
    secondary:{name:theme.secondary.name,value:theme.secondary.value,scale:secondaryScale,on:theme.secondary.on},
    typography:theme.typography,
    spacing:theme.spacing,
    gradients:theme.gradients
  },null,2);
}
