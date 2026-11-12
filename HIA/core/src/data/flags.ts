/**
 * @lang zh-CN 国旗色组数据（`W-tb-P18`）：60+ 主要国家国旗官方色组（维基各国国旗条目通行色值，
 *   部分国家官方仅给 Pantone/CMYK，hex 为换算近似——已在来源登记说明）。每国 2~6 色，顺序=视觉主次。
 *   套用语义（P18 定案）：依次填主/副/第三色，辅助色按规则补足。
 * @lang en Flag color groups: 60+ countries, official colours (hex approximated where only Pantone given).
 */
export type Continent='asia'|'europe'|'americas'|'africa'|'oceania';
export interface FlagEntry{id:string;name:string;nameEn:string;continent:Continent;colors:string[];bucket:string}

import{part0}from'./flags-part0.js';
export const FLAG_COLORS:readonly FlagEntry[]=[...part0];
