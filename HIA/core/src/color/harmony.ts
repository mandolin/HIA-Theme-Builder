import type{AuxiliaryModifier,SeriesMode,SeriesRelationId,HarmonyDef}from'../types.js';
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


// ===== 主色系关系规则推导（ADR-007 v2 / `W-tb-P11`） =====

// 关系规则定义：dual 模式的第二色角度/彩度；triad 模式的第三色推导策略。
// <lang zh-CN>对应配色宝典十种基本设计在主色系模式下的映射（single 无规则=恒主色系变体）。</lang>
// <lang en>Maps the ten classic designs onto series modes (single has no rule — always the primary-series variant).</lang>
export interface SeriesRelationDef{id:SeriesRelationId;name:string;en:string;modes:SeriesMode[];
  secondAngle?:number;secondChromaScale?:number;
  thirdFromSecondary?:boolean;thirdAngle?:number;thirdCombo?:number[];thirdChromaScale?:number;note:string;}

// 关系规则表（十种设计全映射）：thirdAngle 为相对主色的角差；thirdCombo 为组合型（绝对色相）。
// <lang zh-CN>角度核对：补色 180°、冲突 150°（补色±30°）、类比 ±30°、分裂补色 150°/210°、三元 120°/240°、
//   原色组合[25,100,250]、二次色组合[30,140,290]；pure 无推导（主色系变体）。</lang>
// <lang en>Angles verified against the color wheel; combo modes carry absolute hues.</lang>
export const SERIES_RELATION_DEFS:SeriesRelationDef[]=[
  {id:'manual',name:'手动（现行）',en:'Manual',modes:['dual'],note:'第二色由用户手动选择，不自动推导。'},
  {id:'complement',name:'互补 complement',en:'Complement',modes:['dual','triad'],secondAngle:180,thirdAngle:180,note:'色相环上全然相反的两色（180°）。'},
  {id:'clash',name:'冲突 clash',en:'Clash',modes:['dual','triad'],secondAngle:150,thirdAngle:150,note:'主色补色的左/右侧（+150°，半冲突）。'},
  {id:'neutral',name:'中性 neutral',en:'Neutral',modes:['dual','triad'],secondAngle:180,secondChromaScale:.4,thirdAngle:180,thirdChromaScale:.4,note:'补色低饱和化（彩度 ×0.4），中性过渡。'},
  {id:'analogous',name:'类比 analogous',en:'Analogous',modes:['triad'],thirdFromSecondary:true,note:'主色相两侧连续色（第二/第三色分居 ±30°，按副色相位取另一侧）。'},
  {id:'split-complement',name:'分裂补色 split-complement',en:'Split Complement',modes:['triad'],thirdFromSecondary:true,note:'主色补色两侧（150°/210°），副色占一侧时第三色取另一侧。'},
  {id:'tertiary',name:'三次色三色 tertiary',en:'Tertiary Triad',modes:['triad'],thirdFromSecondary:true,note:'等距三色（120°/240°），副色占一侧时第三色取剩余等距位。'},
  {id:'primary-combo',name:'原色组合 primary',en:'Primary Combo',modes:['triad'],thirdCombo:[25,100,250],note:'纯红、黄、蓝固定组合；主位取与主色相最近者，副色占次近位。'},
  {id:'secondary-combo',name:'二次色组合 secondary',en:'Secondary Combo',modes:['triad'],thirdCombo:[30,140,290],note:'绿、橙、紫固定组合；主位/副色位同上。'},
  {id:'pure',name:'纯色 pure',en:'Pure',modes:['single','dual','triad'],note:'单色系 1-3 色递变（无新色相；成员取主色系明暗变体）。'}];

// 按规则 id 查找定义；未登记/模式不匹配回退 manual。
// <lang zh-CN>外界输入防御：非法 id 或"规则与模式不匹配"均回退 manual（现行行为）。</lang>
// <lang en>Defensive fallback to manual for unknown ids or mode/relation mismatches.</lang>
export function getSeriesRelationDef(id:string,mode:SeriesMode):SeriesRelationDef{
  const def=SERIES_RELATION_DEFS.find(r=>r.id===id);
  return def&&def.modes.includes(mode)?def:SERIES_RELATION_DEFS.find(r=>r.id==='manual')!;
}

// 环形角差：两色相的最小角距（0..180）。
// <lang zh-CN>用于"最近组合色/另一侧"判定。</lang>
// <lang en>Circular distance = min(|Δ|, 360-|Δ|).</lang>
function hueDistance(a:number,b:number):number{
  const d=Math.abs(a-b)%360;
  return Math.min(d,360-d);
}

// dual 模式：按规则推导第二色 HEX（manual 返回 null=用户手动色）。
// <lang zh-CN>角度/彩度按规则定义；complement 180°、clash 150°、neutral 180°+彩度×0.4。</lang>
// <lang en>Derives the secondary hex per rule; manual yields null (user-picked).</lang>
export function deriveSecondaryByRelation(primaryHex:string,relation:SeriesRelationId):string|null{
  const def=getSeriesRelationDef(relation,'dual');
  if(def.id==='manual'||def.secondAngle===undefined)return null;
  const src=hexToOklch(primaryHex);
  const L=clamp(src.L+.08,.6,.76),
    C=clamp(src.C*(def.secondChromaScale??.88),.05,.16),
    hue=(src.h+def.secondAngle+360)%360;
  return gamutMapOklch(L,C,hue).hex;
}

// triad 模式：按规则推导第三色 HEX（manual/pure 返回 null——pure 的第三色走主色系变体路径）。
// <lang zh-CN>角度型（analogous/split/tertiary）按副色相位取另一侧；组合型按组合占用推导剩余位；
//   语义：primary 与 secondary 是用户根基，第三色补全组合（补全值可手动覆写）。</lang>
// <lang en>Angle rules pick the free side relative to the secondary's hue; combo rules pick the remaining slot;
//   primary/secondary are user roots and the third completes the combo (overridable).</lang>
export function deriveThirdByRelation(primaryHex:string,secondaryHex:string,relation:SeriesRelationId):string|null{
  const def=getSeriesRelationDef(relation,'triad');
  if(def.id==='manual'||def.id==='pure')return null;
  const src=hexToOklch(primaryHex);
  const L=clamp(src.L+.06,.6,.76),
    C=clamp(src.C*(def.thirdChromaScale??.9),.05,.16);
  // 组合型：组合三色中，主位=最近主色相者，副位=其余中最近副色相者，第三位=最后剩余。
  // <lang zh-CN>两级"最近"分配保证主/副色语义不冲突；剩余位即第三色。</lang>
  // <lang en>Two-level nearest-slot assignment keeps primary/secondary semantics intact.</lang>
  if(def.thirdCombo){
    const sec=hexToOklch(secondaryHex);
    const primarySlot=def.thirdCombo.reduce((best,h)=>hueDistance(src.h,h)<hueDistance(src.h,best)?h:best,def.thirdCombo[0]!);
    const rest=def.thirdCombo.filter(h=>h!==primarySlot);
    const secondarySlot=rest.reduce((best,h)=>hueDistance(sec.h,h)<hueDistance(sec.h,best)?h:best,rest[0]!);
    const thirdHue=rest.find(h=>h!==secondarySlot)??rest[0]!;
    return gamutMapOklch(L,C,thirdHue).hex;
  }
  // 角度型（thirdFromSecondary）：候选两侧取"副色未占用的一侧"。
  // <lang zh-CN>analogous ±30：副色近 -30 则第三色 +30，反之亦然；split 150/210 与 tertiary 120/240 同理。</lang>
  // <lang en>For ±30 / 150-210 / 120-240 pairs, the third takes the side the secondary does not occupy.</lang>
  if(def.thirdFromSecondary){
    const sec=hexToOklch(secondaryHex);
    const candidates=def.id==='analogous'?[-30,30]:def.id==='split-complement'?[150,210]:[120,240];
    const used=candidates.reduce((best,h)=>hueDistance(sec.h,(src.h+h+360)%360)<hueDistance(sec.h,(src.h+best+360)%360)?h:best,candidates[0]!);
    const thirdHue=candidates.find(h=>h!==used)??candidates[0]!;
    return gamutMapOklch(L,C,(src.h+thirdHue+360)%360).hex;
  }
  // 固定角差（complement/clash/neutral 的第三色=第二色同款，triad 下无意义）→ null。
  // <lang zh-CN>triad 下这三规则不该出现，防御返回 null。</lang>
  // <lang en>Defensive null for rules not meaningful in triad.</lang>
  return null;
}

// 辅助色"按规则生成"候选（定案 3：手动为主 + 规则生成按钮）。
// <lang zh-CN>从主色推导三个强调候选（±60°/150°，比副色更收敛的 L/C），供挑选后手动加入槽位。</lang>
// <lang en>Derives three accent candidates from the primary for the "generate by rule" action.</lang>
export function generateAuxiliaryCandidates(primaryHex:string,modifiers?:AuxiliaryModifier[]):{hex:string;name:string;modifier:AuxiliaryModifier}[]{
  const mods:AuxiliaryModifier[]=modifiers??['strong','vivid','deep'];
  const angles=[60,150,-90];
  const src=hexToOklch(primaryHex);
  return angles.map((angle,i)=>{
    const modifier=mods[i]??'strong';
    const L=clamp(src.L+.08,.6,.76),
      C=clamp(src.C*.88,.08,.16),
      hue=(src.h+angle+360)%360;
    const adjusted=modifier==='vivid'?{L:clamp(L+.06,.5,.85),C:clamp(C*1.15,.08,.2)}
      :modifier==='deep'?{L:clamp(L-.08,.4,.7),C:clamp(C*.95,.07,.17)}
      :modifier==='pale'?{L:clamp(L+.14,.6,.88),C:clamp(C*.6,.05,.13)}
      :modifier==='grayish'?{L:clamp(L+.04,.55,.8),C:clamp(C*.45,.03,.1)}
      :{L,C};
    return{hex:gamutMapOklch(adjusted.L,adjusted.C,hue).hex,name:`规则强调 ${i+1}`,modifier};
  });
}
