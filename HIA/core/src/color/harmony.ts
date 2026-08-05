import type{HarmonyDef}from'../types.js';import{clamp,gamutMapOklch,hexToOklch,normalizeHex}from'./convert.js';
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
export interface SecondaryCandidate{id:string;name:string;en:string;scheme:string;hex:string;note:string;offset:number;}
export function harmonyCandidate(base:string,definition:HarmonyDef):SecondaryCandidate{const source=hexToOklch(base),targetL=definition.L??clamp(source.L+.24,.62,.72),targetC=definition.C??clamp(source.C*.92,.105,.17),hue=(source.h+definition.offset+360)%360;return{id:definition.id,name:definition.name,en:definition.en,scheme:definition.scheme,hex:gamutMapOklch(targetL,targetC,hue).hex,note:definition.note,offset:definition.offset};}
export function generateSecondarySet(primaryHex:string,preferred:{hex:string;name?:string;scheme?:string}|null=null):SecondaryCandidate[]{const candidates=HARMONY_DEFS.map(def=>harmonyCandidate(primaryHex,def));if(!preferred?.hex)return candidates;const item:SecondaryCandidate={id:'preferred-secondary',name:preferred.name||'推荐副色',en:'Recommended Secondary',scheme:(preferred.scheme||'主题配对')+' · 预设',hex:normalizeHex(preferred.hex),note:'该主色对应的预设副色，用于形成完整主题色系。',offset:0};const index=candidates.findIndex(c=>normalizeHex(c.hex)===item.hex);if(index<0)return[item,...candidates];candidates[index]={...candidates[index],...item};candidates.unshift(candidates.splice(index,1)[0]!);return candidates;}
