import type{Theme}from'../types.js';

// 将完整主题导出为格式化 JSON（名称/分类/行业 + 主副角色色与色阶 + 渐变配置）。
// <lang zh-CN>industry 缺失回退空串；便于程序化消费、导入导出与版本比对。</lang>
// <lang en>industry falls back to ''; suited for programmatic consumption, import/export and diffing.</lang>
export function exportThemeJson(theme:Theme):string{
  return JSON.stringify({
    name:theme.name,
    category:theme.category,
    industry:theme.industry||'',
    primary:{name:theme.primary.name,value:theme.primary.value,scale:theme.primary.scale,on:theme.primary.on},
    secondary:{name:theme.secondary.name,value:theme.secondary.value,scale:theme.secondary.scale,on:theme.secondary.on},
    gradients:theme.gradients
  },null,2);
}
