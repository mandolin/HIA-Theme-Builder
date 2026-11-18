/**
 * @lang zh-CN 知名企业品牌色数据（`W-tb-P18`）：brandcolors.net 全量 691 品牌官方色（每个品牌 1~n 色，
 *   439 个多色）。仅存品牌名+色值+官方来源 slug（不存 logo 图像——商标边界）。行业分组由人工映射
 *   （brand-industries.cjs），未收录品牌归 other。
 *   `country` 维度（`W-tb-P46` 维护者截图指示：视图可按行业/国家切换）——知名品牌人工考据总部/归属国
 *   （ISO 3166-1 alpha-2 小写；跨国/归属复杂标 'multi'）；**可选字段，分批补录**，未标注条目在
 *   国家视图归"未分类"。不新增导出（ADR-016 API 面保持 142）。
 *   套用语义（P19 定案）：依次填主/副/第三色，辅助色按规则补足。
 * @lang en Brand colors: 691 official brand palettes from brandcolors.net (names + hex + slug only).
 *   The `country` dimension (maintainer's screenshot request in `W-tb-P46`: industry/country view switch)
 *   records a manually curated HQ country for well-known brands (ISO 3166-1 alpha-2 lowercase; 'multi' for
 *   genuinely transnational). Optional and filled in batches — entries without it fall into the
 *   "uncategorized" group of the country view. No new exports (ADR-016 surface stays at 142).
 */
export type BrandIndustry='tech'|'auto'|'food'|'finance'|'retail'|'media'|'travel'|'apparel'|'other';
export interface BrandColorEntry{id:string;name:string;nameEn:string;industry:BrandIndustry;country?:'us'|'ca'|'mx'|'br'|'gb'|'ie'|'fr'|'de'|'nl'|'be'|'ch'|'at'|'es'|'it'|'se'|'no'|'fi'|'dk'|'cz'|'ru'|'pl'|'il'|'ir'|'pk'|'jp'|'kr'|'cn'|'sg'|'in'|'au'|'nz'|'multi';slug:string;colors:string[];bucket:string;hasLogo:boolean}

import{part0}from'./brand-colors-part0.js';
import{part1}from'./brand-colors-part1.js';
import{part2}from'./brand-colors-part2.js';
import{part3}from'./brand-colors-part3.js';
import{part4}from'./brand-colors-part4.js';
export const BRAND_COLORS:readonly BrandColorEntry[]=[...part0,...part1,...part2,...part3,...part4];
