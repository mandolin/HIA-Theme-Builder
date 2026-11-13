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

// 色相角 → 色相名（含棕与品红/粉的明度区分）。
//   **分区锚点是 OKLCH 色相角，不是 sRGB 色相角**——两者的零点与刻度都不同：
//   纯红 sRGB 0° / OKLCH 29°，纯黄 60° / 110°，纯绿 120° / 143°，纯蓝 240° / 264°。
//   早前版本按 sRGB 分区（`<15` 判红等）却传入 OKLCH 角，导致整环错位约 30°：
//   纯红 `#FF0000` 被叫成"强橙"、纯黄 `#FFFF00` 被叫成"亮绿"。分区锚点即以标准色的 OKLCH 角为准。
// <lang en>Hue angle → hue name (brown/pink resolved by lightness). **The sector anchors are OKLCH hue angles,
//   not sRGB ones** — the two differ in both origin and spacing: pure red is sRGB 0° but OKLCH 29°, yellow 60° vs
//   110°, green 120° vs 143°, blue 240° vs 264°. An earlier version used sRGB sectors on OKLCH angles, shifting
//   the whole ring by ~30° so pure red `#FF0000` was named "strong orange" and pure yellow "brilliant green".
//   The anchors below are the OKLCH angles of the canonical hues.</lang>
export function hueNameFor(h:number,L:number,C:number):HueName{
  if(C<0.04)return L>0.9?'white':L>0.35?'grey':'black';
  const deg=((h%360)+360)%360;
  // 红 29° / 橙 53° / 黄 110° / 绿 143° / 青 195° / 蓝 264° / 紫 294° / 品红 328°。
  //   区间边界取相邻锚点的中点：红↔橙 41、橙↔黄 82、黄↔绿 126、绿↔青 169、青↔蓝 230、蓝↔紫 279、紫↔品红 311。
  //   红与品红在 360/0 处首尾相接：品红锚点 328° 到红锚点 29°，中点 358.5°——
  //   故 ≥358.5 归品红、18–41 归红。这样洋红 `#A2007C`（342°）读作品红而不是"深红"。
  // <lang en>Sector boundaries are midpoints between adjacent anchors: red↔orange 41, orange↔yellow 82,
  //   yellow↔green 126, green↔cyan 169, cyan↔blue 230, blue↔purple 279, purple↔magenta 311. Red and magenta
  //   meet across 360/0: magenta 328° to red 29° has its midpoint at 358.5°, so ≥358.5 reads magenta and 18–41
  //   reads red. That keeps magenta `#A2007C` (342°) out of the red sector.</lang>
  if(deg<18)return L<0.45?'brown':'red';
  if(deg<41)return L<0.45?'brown':'red';
  if(deg<82)return L<0.5?'brown':'orange';
  if(deg<126)return'yellow';
  if(deg<169)return'green';
  if(deg<230)return'cyan';
  if(deg<279)return'blue';
  if(deg<311)return'purple';
  if(deg<358.5)return L>0.7?'pink':'magenta';
  return L<0.45?'brown':'red';
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
