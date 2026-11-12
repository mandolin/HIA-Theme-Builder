/**
 * @lang zh-CN 色名体系（`W-tb-P20`）：ISCC-NBS 修饰语 + 色相名 → 结构化色名（中英双语）。
 *   修饰语九档（Vivid/Strong/Deep/Light/Moderate/Dark/Pale/Grayish/Brilliant）由明度/彩度阈值判定，
 *   色相名按 12 分区（Red/Orange/Brown/Yellow/Green/Cyan/Blue/Purple/Magenta/Pink/White/Grey/Black）。
 *   用途：辅助色自动命名、色卡说明补充——纯函数、无副作用。
 * @lang en Color naming (`W-tb-P20`): ISCC-NBS-style modifier + hue name → structured bilingual color name.
 */
import{hexToOklch}from'./convert.js';

/** @lang zh-CN 修饰语类型（ISCC-NBS 九档）。
    @lang en ISCC-NBS modifier levels. */
export type ColorModifier='brilliant'|'vivid'|'strong'|'deep'|'light'|'moderate'|'dark'|'pale'|'grayish';

/** @lang zh-CN 修饰语中英映射。
    @lang en Modifier bilingual map. */
export const MODIFIER_NAMES:Record<ColorModifier,{zh:string;en:string}>={
  brilliant:{zh:'亮',en:'Brilliant'},vivid:{zh:'鲜',en:'Vivid'},strong:{zh:'强',en:'Strong'},
  deep:{zh:'深',en:'Deep'},light:{zh:'浅',en:'Light'},moderate:{zh:'中',en:'Moderate'},
  dark:{zh:'暗',en:'Dark'},pale:{zh:'淡',en:'Pale'},grayish:{zh:'灰',en:'Grayish'}
};

/** @lang zh-CN 色相名（12 分区 + 中性）。
    @lang en Hue names (12 sectors + neutrals). */
export type HueName='red'|'orange'|'brown'|'yellow'|'green'|'cyan'|'blue'|'purple'|'magenta'|'pink'|'white'|'grey'|'black';

/** @lang zh-CN 色相名中英映射。
    @lang en Hue bilingual map. */
export const HUE_NAMES:Record<HueName,{zh:string;en:string}>={
  red:{zh:'红',en:'Red'},orange:{zh:'橙',en:'Orange'},brown:{zh:'棕',en:'Brown'},
  yellow:{zh:'黄',en:'Yellow'},green:{zh:'绿',en:'Green'},cyan:{zh:'青',en:'Cyan'},
  blue:{zh:'蓝',en:'Blue'},purple:{zh:'紫',en:'Purple'},magenta:{zh:'品红',en:'Magenta'},
  pink:{zh:'粉',en:'Pink'},white:{zh:'白',en:'White'},grey:{zh:'灰',en:'Grey'},black:{zh:'黑',en:'Black'}
};

// 明度/彩度 → 修饰语（ISCC-NBS 阈值简化）。
// <lang en>Lightness/chroma → modifier (simplified ISCC-NBS thresholds).</lang>
export function modifierFor(L:number,C:number):ColorModifier{
  if(C<0.03)return L>0.9?'brilliant':L>0.65?'light':L>0.4?'moderate':'dark';
  if(L>0.86)return C>0.1?'brilliant':'pale';
  if(L>0.72)return C>0.13?'vivid':'light';
  if(L>0.55)return C>0.15?'strong':'moderate';
  if(L>0.36)return C>0.14?'deep':'dark';
  return C>0.12?'deep':'dark';
}

// 色相角 → 色相名（12 分区，含棕与品红/粉的明度区分）。
// <lang en>Hue angle → hue name (12 sectors; brown/pink resolved by lightness).</lang>
export function hueNameFor(h:number,L:number,C:number):HueName{
  if(C<0.04)return L>0.9?'white':L>0.35?'grey':'black';
  const deg=((h%360)+360)%360;
  if(deg<15||deg>=345)return L<0.45?'brown':'red';
  if(deg<45)return L<0.45?'brown':'orange';
  if(deg<70)return'yellow';
  if(deg<165)return'green';
  if(deg<195)return'cyan';
  if(deg<270)return'blue';
  if(deg<300)return'purple';
  if(deg<315)return L>0.7?'pink':'magenta';
  return L>0.7?'pink':'magenta';
}

/** @lang zh-CN 由 HEX 生成结构化色名（修饰语+色相，中英双语）。
 *   @lang en Builds a structured bilingual color name (modifier + hue) from hex. */
export function nameColor(hex:string):{modifier:ColorModifier;hue:HueName;zh:string;en:string}{
  const {L,C,h}=hexToOklch(hex);
  const modifier=modifierFor(L,C);
  const hue=hueNameFor(h,L,C);
  const mz=MODIFIER_NAMES[modifier],hz=HUE_NAMES[hue];
  // 中文：中性色不重复"灰灰/白白"；英文按 "Modifier Hue" 组合。
  // <lang en>Chinese collapses duplicate neutral words; English composes "Modifier Hue".</lang>
  const zh=(hz.zh===mz.zh?hz.zh:mz.zh+hz.zh);
  const en=(hz.en===mz.en?hz.en:mz.en+' '+hz.en);
  return{modifier,hue,zh,en};
}
