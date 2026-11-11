/**
 * @lang zh-CN 传统色数据（`W-tb-P17` 需求六扩充）：四文化源合并全量——en/cn/ja/kr，
 *   展示序 en→cn→ja→kr（维护者定案）；同名异色各档保留；套用语义=单色即主色（P17 定案）。
 *   数据体量 1637 条，分片注解数组规避 TS2590；生成器可复现（gen-traditional-ts-v2.cjs）。
 * @lang en Traditional colors: four culture sources, 1637 entries in annotated slices.
 */
export interface TraditionalColorEntry{id:string;name:string;nameEn:string;hex:string;culture:'en'|'cn'|'ja'|'kr';bucket:string;note?:string;caution?:string}
import{part0}from'./traditional-colors-part0.js';
import{part1}from'./traditional-colors-part1.js';
import{part2}from'./traditional-colors-part2.js';
import{part3}from'./traditional-colors-part3.js';
import{part4}from'./traditional-colors-part4.js';
import{part5}from'./traditional-colors-part5.js';
import{part6}from'./traditional-colors-part6.js';
import{part7}from'./traditional-colors-part7.js';
import{part8}from'./traditional-colors-part8.js';
export const TRADITIONAL_COLORS:readonly TraditionalColorEntry[]=[...part0,...part1,...part2,...part3,...part4,...part5,...part6,...part7,...part8];
