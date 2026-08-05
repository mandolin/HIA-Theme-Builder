import type{GradientConfig,GradientSettings}from'../types.js';
export const GRADIENT_DEFS=[
{key:'carousel',label:'轮播图卡片渐变设置',desc:'PC 轮播头图、重点展示区。默认主色深阶占大头。'},
{key:'banner',label:'Banner 卡片渐变设置',desc:'活动 Banner 与次级重点入口。默认副色占大头。'},
{key:'textLarge',label:'文字大卡片渐变设置',desc:'欢迎区、重点说明与页面头部文字卡片。'},
{key:'textSmall',label:'文字小卡片渐变设置',desc:'轻提示、状态说明与辅助信息。默认浅色占大头。'},
{key:'metric',label:'数据强调卡片渐变设置',desc:'KPI、重点数字与强调统计卡片。默认副色浅阶占大头。'},
{key:'image',label:'图片 / 缩略图渐变设置',desc:'无图占位、封面和缩略图视觉区域。'},
{key:'profile',label:'个人信息卡片渐变设置',desc:'小程序“我的”、用户摘要与个人中心头部。'},
{key:'callout',label:'提示说明卡片渐变设置',desc:'说明、帮助、提示和 Callout 区域。默认浅色占大头。'}]as const;
export const GRADIENT_DEFAULTS:GradientSettings={carousel:{enabled:true,family:'primary',start:'700',end:'300',direction:'135deg',bias:'front75'},banner:{enabled:true,family:'secondary',start:'500',end:'200',direction:'120deg',bias:'front65'},textLarge:{enabled:true,family:'primary',start:'600',end:'200',direction:'110deg',bias:'front65'},textSmall:{enabled:true,family:'secondary',start:'100',end:'50',direction:'90deg',bias:'end75'},metric:{enabled:true,family:'secondary',start:'500',end:'200',direction:'135deg',bias:'front65'},image:{enabled:true,family:'primary',start:'400',end:'100',direction:'135deg',bias:'front65'},profile:{enabled:true,family:'primary',start:'600',end:'300',direction:'135deg',bias:'front75'},callout:{enabled:true,family:'primary',start:'50',end:'100',direction:'90deg',bias:'end75'}};
export function cloneGradientSettings(value?:GradientSettings):GradientSettings{const result:GradientSettings={};for(const def of GRADIENT_DEFS){const merged:GradientConfig={...GRADIENT_DEFAULTS[def.key]!,...(value?.[def.key]||{})};if((merged.bias as string)==='balanced')merged.bias='front65';result[def.key]=merged;}return result;}
