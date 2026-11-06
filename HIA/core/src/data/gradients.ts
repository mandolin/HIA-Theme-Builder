import type{GradientConfig,GradientSettings}from'../types.js';

// 渐变角色定义：八张具名卡片渐变的使用场景与说明。
// <lang zh-CN>key 为全局固定索引，与 GRADIENT_DEFAULTS 及 UI data-gradient-* 属性一一对应。</lang>
// <lang en>key is the global fixed index, matching GRADIENT_DEFAULTS and the UI data-gradient-* attributes.</lang>
export const GRADIENT_DEFS=[
  {key:'carousel',label:'轮播图卡片渐变设置',desc:'PC 轮播头图、重点展示区。默认主色深阶占大头。'},
  {key:'banner',label:'Banner 卡片渐变设置',desc:'活动 Banner 与次级重点入口。默认副色占大头。'},
  {key:'textLarge',label:'文字大卡片渐变设置',desc:'欢迎区、重点说明与页面头部文字卡片。'},
  {key:'textSmall',label:'文字小卡片渐变设置',desc:'轻提示、状态说明与辅助信息。默认浅色占大头。'},
  {key:'metric',label:'数据强调卡片渐变设置',desc:'KPI、重点数字与强调统计卡片。默认副色浅阶占大头。'},
  {key:'image',label:'图片 / 缩略图渐变设置',desc:'无图占位、封面和缩略图视觉区域。'},
  {key:'profile',label:'个人信息卡片渐变设置',desc:'小程序“我的”、用户摘要与个人中心头部。'},
  {key:'callout',label:'提示说明卡片渐变设置',desc:'说明、帮助、提示和 Callout 区域。默认浅色占大头。'}]as const;

// 各渐变角色的出厂默认配置。
// <lang zh-CN>作为 cloneGradientSettings 的回退基线，保证任意主题都有完整可显示渐变。</lang>
// <lang en>Baseline for cloneGradientSettings, ensuring every theme has complete renderable gradients.</lang>
export const GRADIENT_DEFAULTS:GradientSettings={
  carousel:{enabled:true,family:'primary',start:'700',end:'300',direction:'135deg',bias:'front75'},
  banner:{enabled:true,family:'secondary',start:'500',end:'200',direction:'120deg',bias:'front65'},
  textLarge:{enabled:true,family:'primary',start:'600',end:'200',direction:'110deg',bias:'front65'},
  textSmall:{enabled:true,family:'secondary',start:'100',end:'50',direction:'90deg',bias:'end75'},
  metric:{enabled:true,family:'secondary',start:'500',end:'200',direction:'135deg',bias:'front65'},
  image:{enabled:true,family:'primary',start:'400',end:'100',direction:'135deg',bias:'front65'},
  profile:{enabled:true,family:'primary',start:'600',end:'300',direction:'135deg',bias:'front75'},
  callout:{enabled:true,family:'primary',start:'50',end:'100',direction:'90deg',bias:'end75'}
};

// 深拷贝并补全渐变配置：以默认值为基，叠加传入的局部覆盖，保证返回对象覆盖全部角色键。
// <lang zh-CN>将历史 'balanced' 占比兼容映射为 'front65'；缺失角色回退默认，避免 UI 读取 undefined。</lang>
// <lang en>Maps legacy 'balanced' bias to 'front65'; missing roles fall back so the UI never reads undefined.</lang>
export function cloneGradientSettings(value?:GradientSettings):GradientSettings{
  const result:GradientSettings={};
  // 遍历全部角色定义，确保输出含每个 key。
  // <lang zh-CN>即便传入值缺某角色，也用默认值补齐。</lang>
  // <lang en>Even if the input omits a role, defaults fill it in.</lang>
  for(const def of GRADIENT_DEFS){
    // 默认与局部覆盖合并；覆盖为空时仅取默认。
    // <lang zh-CN>非空合并保证不引入 undefined 字段。</lang>
    // <lang en>Nullish merge avoids introducing undefined fields.</lang>
    const merged:GradientConfig={...GRADIENT_DEFAULTS[def.key]!,...(value?.[def.key]||{})};
    // 兼容旧字段：'balanced' 无对应渲染策略，归并为 'front65'。
    // <lang zh-CN>防止无效 bias 进入渲染分支。</lang>
    // <lang en>Prevents an invalid bias from reaching the render switch.</lang>
    if((merged.bias as string)==='balanced')merged.bias='front65';
    // ADR-004 数值化校验：bias 须为 front/end + 0-100 整数；shade 须为 0-1000 整数。
    // <lang zh-CN>旧 4 枚举与 10 档值天然合法（向后兼容）；非法值回退该角色默认，保证渲染分支完备。</lang>
    // <lang en>Legacy 4 enums and 10 steps are naturally valid (backward compatible); invalid values
    //   fall back to the role default so render branches stay exhaustive.</lang>
    if(!/^(front|end)\d{1,3}$/.test(merged.bias)||!(parseInt(merged.bias.slice(5),10)>=0&&parseInt(merged.bias.slice(5),10)<=100))merged.bias=GRADIENT_DEFAULTS[def.key]!.bias;
    for(const field of['start','end'] as const){
      const v=merged[field] as string;
      if(!/^\d{1,4}$/.test(v)||parseInt(v,10)>1000)merged[field]=GRADIENT_DEFAULTS[def.key]![field];
    }
    result[def.key]=merged;
  }
  return result;
}
