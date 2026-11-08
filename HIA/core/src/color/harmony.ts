import type{AuxiliaryModifier,HarmonyModeId,HarmonyDef}from'../types.js';
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

// ===== 配色关系模式与辅助色（ADR-007 / `W-tb-P11`） =====

// 模式定义：色数/槽位数/生成规则（角度型=相对主色角差；组合型=固定三色组合取最近者为主位）。
// <lang zh-CN>对应配色宝典十种基本设计 + 'auto'（现行行为）；槽位数即辅助色默认推导数量。</lang>
// <lang en>Maps the ten classic designs plus 'auto'; slot count is the default number of derived auxiliary colors.</lang>
export interface HarmonyModeDef{id:HarmonyModeId;name:string;en:string;slots:number;angles?:number[];combo?:number[];chromaScale?:number;note:string;}
// 十种基本设计 + auto：角度核对——补色 180°，冲突=补色±30°（默认 150°），分裂补色 150°+210°，
// 类比 ±30°（连续三色），三元等距 120°/240°；组合型 primary=红黄蓝、secondary=绿橙紫（近似色相）。
// <lang zh-CN>chromaScale 仅 neutral 使用（补色低饱和化）。</lang>
// <lang en>chromaScale applies to neutral only (desaturated complement).</lang>
export const HARMONY_MODE_DEFS:HarmonyModeDef[]=[
  {id:'auto',name:'自动',en:'Auto',slots:0,note:'现行行为：主副色独立编辑，无辅助槽位。'},
  {id:'achromatic',name:'无色设计',en:'Achromatic',slots:0,note:'黑、白、灰组合；主色可自选灰系，不生成辅助槽位。'},
  {id:'monochromatic',name:'单色设计',en:'Monochromatic',slots:0,note:'主色 + 自身全部明暗变体即全部，无辅助色相。'},
  {id:'analogous',name:'类比设计',en:'Analogous',slots:2,angles:[-30,30],note:'主色相两侧连续色，构成色相环连续三色。'},
  {id:'clash',name:'冲突设计',en:'Clash',slots:1,angles:[150],note:'主色补色的左/右侧（半冲突，默认 +150°）。'},
  {id:'complement',name:'互补设计',en:'Complement',slots:1,angles:[180],note:'色相环上全然相反的两色。'},
  {id:'neutral',name:'中性设计',en:'Neutral',slots:1,angles:[180],chromaScale:.4,note:'补色低饱和化，形成中性过渡色。'},
  {id:'primary-combo',name:'原色设计',en:'Primary Combo',slots:2,combo:[25,100,250],note:'纯红、黄、蓝组合；主位取与主色相最近者。'},
  {id:'secondary-combo',name:'二次色设计',en:'Secondary Combo',slots:2,combo:[30,140,290],note:'绿、橙、紫组合；主位取与主色相最近者。'},
  {id:'tertiary',name:'三次色三色设计',en:'Tertiary Triad',slots:2,angles:[120,240],note:'等距三色（主色相 +120°/+240°）。'},
  {id:'split-complement',name:'分裂补色设计',en:'Split Complement',slots:2,angles:[150,210],note:'主色补色两侧的色。'}];

// 按模式 id 查找定义；未登记 id 回退 'auto'。
// <lang zh-CN>外界输入的 mode 不可信，防御性回退。</lang>
// <lang en>External mode ids are untrusted; fall back defensively.</lang>
export function getHarmonyModeDef(id:string):HarmonyModeDef{
  return HARMONY_MODE_DEFS.find(m=>m.id===id)??HARMONY_MODE_DEFS[0]!;
}

// 单个辅助色候选：色值 + 展示名 + 生成参数（供 UI 重生成/修饰语切换）。
// <lang zh-CN>name 含修饰语（如"辅助 1 · Vivid"）；angle 为相对主色角差（组合型为绝对色相）。</lang>
// <lang en>name carries the modifier ("Aux 1 · Vivid"); angle is the delta from primary (absolute hue for combo modes).</lang>
export interface AuxiliaryCandidate{hex:string;name:string;en:string;angle:number;modifier:AuxiliaryModifier;}

// 修饰语 → 明度/彩度调整（ISCC-NBS 词表基础子集，ADR-007）。
// <lang zh-CN>基线 L=主色+.08（.60..76）、C=主色*.88（.08..16）；各修饰语在其上微调。</lang>
// <lang en>Baseline L=primary+.08 (.60..76), C=primary*.88 (.08..16); modifiers tweak on top.</lang>
function applyModifier(L:number,C:number,modifier:AuxiliaryModifier):{L:number;C:number}{
  switch(modifier){
    case'vivid':return{L:clamp(L+.06,.5,.85),C:clamp(C*1.15,.08,.2)};
    case'deep':return{L:clamp(L-.08,.4,.7),C:clamp(C*.95,.07,.17)};
    case'pale':return{L:clamp(L+.14,.6,.88),C:clamp(C*.6,.05,.13)};
    case'grayish':return{L:clamp(L+.04,.55,.8),C:clamp(C*.45,.03,.1)};
    default:return{L:clamp(L,.6,.76),C:clamp(C,.08,.16)};
  }
}

// 单槽生成：oklch 色相 = 主相 + 角度（组合型角度即绝对色相），L/C 按修饰语调整后色域映射。
// <lang zh-CN>纯函数；gamutMapOklch 保证合法 sRGB 输出。</lang>
// <lang en>Pure; gamutMapOklch guarantees valid sRGB output.</lang>
function auxiliaryCandidate(primary:string,index:number,angle:number,modifier:AuxiliaryModifier,modeDef:HarmonyModeDef):AuxiliaryCandidate{
  const src=hexToOklch(primary);
  const baseL=clamp(src.L+.08,.6,.76),
    baseC=clamp(src.C*.88,.08,.16);
  const adjusted=applyModifier(baseL,baseC,modifier);
  // 组合型（combo 无 angles 字段）angle 即绝对色相；角度型为主相叠加。
  // <lang zh-CN>modeDef.angles 存在与否区分两种模式形态。</lang>
  // <lang en>Presence of modeDef.angles distinguishes the two mode shapes.</lang>
  const hue=modeDef.angles?((src.h+angle+360)%360):((angle+360)%360);
  const enLabel=`Aux ${index+1} · ${modifier} · ${modeDef.en}`;
  return{hex:gamutMapOklch(adjusted.L,adjusted.C,hue).hex,name:`辅助 ${index+1} · ${modifier[0]!.toUpperCase()+modifier.slice(1)} · ${modeDef.name}`,en:enLabel,angle,modifier};
}

// 按模式生成辅助色候选集：角度型按 angles 展开；组合型取非主位的其余两色。
// <lang zh-CN>modifiers 缺省每槽 'strong'；槽位数即 modeDef.slots；'auto'/0 槽模式返回 []。</lang>
// <lang en>modifiers default to 'strong' per slot; zero-slot modes yield [].</lang>
export function generateAuxiliarySet(primaryHex:string,mode:HarmonyModeId,modifiers?:AuxiliaryModifier[]):AuxiliaryCandidate[]{
  const modeDef=getHarmonyModeDef(mode);
  if(modeDef.slots===0)return[];
  // 组合型：找与主色相最近的组合色为主位，其余位为辅助（主色永不被模式改写）。
  // <lang zh-CN>主相与组合色相的环形距离取 min(|Δ|,360-|Δ|)。</lang>
  // <lang en>Circular distance = min(|Δ|, 360-|Δ|).</lang>
  if(modeDef.combo){
    const src=hexToOklch(primaryHex);
    const dist=(a:number,b:number)=>{const d=Math.abs(a-b)%360;return Math.min(d,360-d);};
    const sorted=[...modeDef.combo].sort((a,b)=>dist(src.h,a)-dist(src.h,b));
    // 主位=最近者；辅助=其余（保持组合内相对顺序，便于稳定命名）。
    // <lang zh-CN>auxHues 顺序按 combo 原序过滤主位，保证同输入同输出。</lang>
    // <lang en>auxHues keeps combo order minus the primary slot for deterministic output.</lang>
    const primaryHue=sorted[0]!;
    const auxHues=modeDef.combo.filter(h=>h!==primaryHue);
    return auxHues.slice(0,modeDef.slots).map((h,i)=>auxiliaryCandidate(primaryHex,i,h,modifiers?.[i]??'strong',modeDef));
  }
  // 角度型：angles 与槽位数一致，逐角生成。
  // <lang zh-CN>angles 缺失（定义错误）防御性返回空。</lang>
  // <lang en>Defensive [] when angles is missing (malformed definition).</lang>
  const angles=modeDef.angles??[];
  return angles.slice(0,modeDef.slots).map((a,i)=>auxiliaryCandidate(primaryHex,i,a,modifiers?.[i]??'strong',modeDef));
}
