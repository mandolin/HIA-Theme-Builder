/**
 * @lang zh-CN 知名企业品牌色数据（`W-tb-P18`）：brandcolors.net 全量 691 品牌官方色（每个品牌 1~n 色，
 *   439 个多色）。仅存品牌名+色值+官方来源 slug（不存 logo 图像——商标边界）。行业分组由人工映射
 *   （brand-industries.cjs），未收录品牌归 other。
 *   套用语义（P19 定案）：依次填主/副/第三色，辅助色按规则补足。
 * @lang en Brand colors: 691 official brand palettes from brandcolors.net (names + hex + slug only).
 */
export type BrandIndustry='tech'|'auto'|'food'|'finance'|'retail'|'media'|'travel'|'apparel'|'other';
export interface BrandColorEntry{id:string;name:string;nameEn:string;industry:BrandIndustry;slug:string;colors:string[];bucket:string;hasLogo:boolean}

import{part0}from'./brand-colors-part0.js';
import{part1}from'./brand-colors-part1.js';
import{part2}from'./brand-colors-part2.js';
import{part3}from'./brand-colors-part3.js';
import{part4}from'./brand-colors-part4.js';
export const BRAND_COLORS:readonly BrandColorEntry[]=[...part0,...part1,...part2,...part3,...part4];
