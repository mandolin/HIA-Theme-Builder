/**
 * @lang zh-CN 社会场景选色数据（`W-tb-P19`）：社会文化惯例用色——应急消防/医疗/邮政物流/交通/安全/行业惯例/文化礼仪七类。
 *   色值为行业规范或通行惯例色（note 说明惯例依据）。套用语义同国旗/企业：依次填主/副/第三。
 * @lang en Social convention palettes (emergency/medical/postal/transport/safety/industry/cultural).
 */
export type SocialCategory='emergency'|'medical'|'postal'|'transport'|'safety'|'industry'|'cultural';
export interface SocialColorEntry{id:string;name:string;nameEn:string;category:SocialCategory;colors:string[];bucket:string;note:string}

import{part0}from'./social-colors-part0.js';
export const SOCIAL_COLORS:readonly SocialColorEntry[]=[...part0];
