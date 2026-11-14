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
    // 配色关系扩展（ADR-007）：模式与辅助槽位全量输出（含色阶，消费方免重建）。
    // <lang zh-CN>auto 模式下 harmonyMode='auto'、auxiliary=[]，旧消费方按未知键容忍。</lang>
    // <lang en>Under 'auto' these are 'auto' and []; legacy consumers tolerate unknown keys.</lang>
    seriesMode:theme.seriesMode,
    seriesRelation:theme.seriesRelation,
    ...(theme.thirdColor?{thirdColor:{name:theme.thirdColor.name,value:theme.thirdColor.value,scale:theme.thirdColor.scale,on:theme.thirdColor.on}}:{}),
    auxiliary:theme.auxiliary.map(a=>({name:a.name,value:a.value,scale:a.scale,on:a.on})),
    typography:theme.typography,
    spacing:theme.spacing,
    // 语义状态色 + 圆角/阴影（`W-tb-P37`，ADR-012）：可选组，携带时全量输出（消费方免重建）。
    // <lang en>Semantic statuses + radius/shadow (`W-tb-P37`, ADR-012): optional groups emitted in full when
    //   present, so consumers need no rebuild.</lang>
    ...(theme.semantic?{semantic:theme.semantic}:{}),
    ...(theme.radius?{radius:theme.radius}:{}),
    ...(theme.shadow?{shadow:theme.shadow}:{}),
    gradients:theme.gradients
  },null,2);
}
