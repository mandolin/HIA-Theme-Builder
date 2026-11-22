/**
 * @lang zh-CN 传统色数据（`W-tb-P17` 需求六扩充）：四文化源合并全量——en/cn/ja/kr，
 *   展示序 en→cn→ja→kr（维护者定案）；同名异色各档保留；套用语义=单色即主色（P17 定案）。
 *   数据体量 1637 条，分片注解数组规避 TS2590；生成器可复现（gen-traditional-ts-v2.cjs）。
 * @lang en Traditional colors: four culture sources, 1637 entries in annotated slices.
 */
export interface TraditionalColorEntry{id:string;name:string;nameEn:string;hex:string;culture:'en'|'nbs'|'cn'|'ja'|'kr';bucket:string;note?:string;caution?:string}
import{part0}from'./traditional-colors-part0.js';
import{part1}from'./traditional-colors-part1.js';
import{part2}from'./traditional-colors-part2.js';
import{part3}from'./traditional-colors-part3.js';
import{part4}from'./traditional-colors-part4.js';
import{part5}from'./traditional-colors-part5.js';
import{part6}from'./traditional-colors-part6.js';
import{part7}from'./traditional-colors-part7.js';
import{part8}from'./traditional-colors-part8.js';
// ISCC-NBS 267（实得 260）色名分片（`W-tb-P50`）：数据源 Centore 2016 Table 3；
//   展示序 en→nbs→cn→ja→kr——置于英文命名色之后、中国传统色之前（维护者定案，可调）。
// <lang en>ISCC-NBS slice (260 of 267: seven categories have no sRGB points); display order
//   en → nbs → cn → ja → kr — right after English named colours.</lang>
import{nbsPart}from'./traditional-colors-nbs.js';
const _all=[...part0,...part1,...part2,...part3,...part4,...part5,...part6,...part7,...part8,...nbsPart];
// 按 culture 分源重排（stable）：en→nbs→cn→ja→kr——各源内部保持原数据序（不改条目的相对次序）。
// <lang en>Re-group by culture (stable sort): en→nbs→cn→ja→kr, preserving each source's internal order.</lang>
const _order:Record<TraditionalColorEntry['culture'],number>={en:0,nbs:1,cn:2,ja:3,kr:4};
export const TRADITIONAL_COLORS:readonly TraditionalColorEntry[]=_all.slice().sort((a,b)=>(_order[a.culture]??9)-(_order[b.culture]??9));
