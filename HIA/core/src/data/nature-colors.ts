/**
 * @lang zh-CN 自然选色数据（`W-tb-P19`）：天文地理场景约定俗成色组——天空天象/海洋水体/大地地貌/植物植被/气象/矿物六类。
 *   色值为自然现象的近似取样色（note 说明取样场景）。套用语义同国旗/企业：依次填主/副/第三。
 * @lang en Natural scene palettes (sky/ocean/land/plant/weather/mineral); note records the sampled scene.
 */
export type NatureCategory='sky'|'ocean'|'land'|'plant'|'weather'|'mineral';
export interface NatureColorEntry{id:string;name:string;nameEn:string;category:NatureCategory;colors:string[];bucket:string;note:string}

import{part0}from'./nature-colors-part0.js';
export const NATURE_COLORS:readonly NatureColorEntry[]=[...part0];
