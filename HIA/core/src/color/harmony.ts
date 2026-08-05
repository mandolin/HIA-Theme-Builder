import type{HarmonyDef}from'../types.js';
import{clamp,gamutMapOklch,hexToOklch,normalizeHex}from'./convert.js';

// 副色和谐方案库：每项为一种由主色推导副色的色彩理论策略。
// <lang zh-CN>offset 为相对主色相的角差；L/C 为目标亮度与彩度（缺失时按主色推算）。</lang>
// <lang en>offset is the hue delta from the primary; L/C are target lightness/chroma (inferred from primary if absent).</lang>
export const HARMONY_DEFS:HarmonyDef[]=[
  {id:'analog-cyan',name:'清透青',en:'Clear Cyan',scheme:'类比青',offset:-35,L:.68,C:.145,note:'协调统一、科技感强；适合作为默认副色思路。'},
  {id:'analog-violet',name:'柔紫',en:'Soft Violet',scheme:'类比色',offset:35,L:.68,C:.145,note:'更偏创意与前沿。'},
  {id:'complement-gold',name:'暖琥珀',en:'Warm Amber',scheme:'互补暖金',offset:180,L:.68,C:.145,note:'冷暖对比清晰。'},
  {id:'split-orange',name:'活力橙',en:'Vivid Orange',scheme:'分裂互补',offset:150,L:.67,C:.16,note:'活跃、适合营销入口。'},
  {id:'split-olive',name:'橄榄金',en:'Olive Gold',scheme:'分裂互补',offset:210,L:.66,C:.13,note:'更克制、自然。'},
  {id:'triad-coral',name:'珊瑚红',en:'Coral Red',scheme:'三角色',offset:120,L:.68,C:.155,note:'暖色强调明显。'},
  {id:'triad-green',name:'草木绿',en:'Botanical Green',scheme:'三角色',offset:-120,L:.67,C:.145,note:'自然、正向。'},
  {id:'mono-blue',name:'雾霭蓝',en:'Misty Blue',scheme:'单色扩展',offset:0,L:.7,C:.085,note:'稳妥但区分度较弱。'},
  {id:'muted-gold',name:'低彩金棕',en:'Muted Gold',scheme:'互补低彩',offset:180,L:.62,C:.095,note:'成熟、耐看。'}];

// 单个副色候选：由某和谐方案推导出的可用副色及其来源说明。
// <lang zh-CN>操作台“副色候选”面板的条目结构。</lang>
// <lang en>Item shape for the studio's "secondary candidates" panel.</lang>
export interface SecondaryCandidate{id:string;name:string;en:string;scheme:string;hex:string;note:string;offset:number;}

// 依据某和谐方案由主色生成单个副色候选。
// <lang zh-CN>目标 L/C 若定义缺失则按主色亮度+0.24、彩度*0.92 收敛，色相叠加 offset 后做色域映射。</lang>
// <lang en>When L/C undefined, infer L=primary.L+0.24 and C=primary.C*0.92; hue adds offset then gamut-maps.</lang>
export function harmonyCandidate(base:string,definition:HarmonyDef):SecondaryCandidate{
  const source=hexToOklch(base);
  // 目标亮度：优先用定义值，否则在主色基础上提亮并钳制在 .62..72。
  // <lang zh-CN>副色通常比主色更亮以形成层次。</lang>
  // <lang en>Secondaries are usually brighter than the primary to build layers.</lang>
  const targetL=definition.L??clamp(source.L+.24,.62,.72),
    // 目标彩度：优先用定义值，否则略低于主色并钳制在 .105..17。
    // <lang zh-CN>避免副色过艳抢主色风头。</lang>
    // <lang en>Avoids the secondary out-shouting the primary with excess chroma.</lang>
    targetC=definition.C??clamp(source.C*.92,.105,.17),
    // 目标色相 = 主色相 + 方案偏移，取模归一化到 0..360。
    // <lang zh-CN>offset 决定类比/互补/三角等关系。</lang>
    // <lang en>offset decides analogous/complementary/triadic relations.</lang>
    hue=(source.h+definition.offset+360)%360;
  return{id:definition.id,name:definition.name,en:definition.en,scheme:definition.scheme,hex:gamutMapOklch(targetL,targetC,hue).hex,note:definition.note,offset:definition.offset};
}

// 生成副色候选集：遍历全部和谐方案；若提供 preferred 且未命中现有候选则置顶其推荐副色。
// <lang zh-CN>preferred 用于把预设/当前副色排到首位并标记“推荐”，保证用户已选色可被复现。</lang>
// <lang en>preferred pins the preset/current secondary first and flags it "recommended" so user choice is reproducible.</lang>
export function generateSecondarySet(primaryHex:string,preferred:{hex:string;name?:string;scheme?:string}|null=null):SecondaryCandidate[]{
  // 先按所有方案生成基础候选集。
  // <lang zh-CN>保证至少覆盖九种和谐策略。</lang>
  // <lang en>Guarantees coverage of all nine harmony strategies.</lang>
  const candidates=HARMONY_DEFS.map(def=>harmonyCandidate(primaryHex,def));
  // 无推荐则直接返回基础集。
  // <lang zh-CN>纯自动推导场景。</lang>
  // <lang en>Pure auto-derivation path.</lang>
  if(!preferred?.hex)return candidates;
  // 构造推荐项：规范化为预设副色，offset 记 0 表示“主题配对”。
  // <lang zh-CN>note 说明这是主色对应的预设副色。</lang>
  // <lang en>note explains this is the preset secondary paired with the primary.</lang>
  const item:SecondaryCandidate={id:'preferred-secondary',name:preferred.name||'推荐副色',en:'Recommended Secondary',scheme:(preferred.scheme||'主题配对')+' · 预设',hex:normalizeHex(preferred.hex),note:'该主色对应的预设副色，用于形成完整主题色系。',offset:0};
  // 若候选集中已存在同色，则就地合并推荐信息并提到首位；否则插入首位。
  // <lang zh-CN>unshift+splice 实现“置顶”，保持用户可见的推荐在最前。</lang>
  // <lang en>unshift+splice pins it first so the recommended item is most visible.</lang>
  const index=candidates.findIndex(c=>normalizeHex(c.hex)===item.hex);
  if(index<0)return[item,...candidates];
  candidates[index]={...candidates[index],...item};
  candidates.unshift(candidates.splice(index,1)[0]!);
  return candidates;
}
