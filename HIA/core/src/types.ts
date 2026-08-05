/**
 * @lang zh-CN HIA 跨端共享主题模型。core 只描述数据与纯算法，不依赖 DOM、localStorage、Electron 或 Tauri。
 * @lang en HIA cross-platform theme models. Core is DOM/storage/runtime agnostic.
 */
export const SHADE_KEYS=['50','100','200','300','400','500','600','700','800','900'] as const;
export type ShadeKey=typeof SHADE_KEYS[number];
export type ColorFamily='primary'|'secondary';
export type GradientBias='front75'|'front65'|'end65'|'end75';
export type ColorScale=Record<ShadeKey,string>;
export interface RoleColor{name:string;value:string;scale:ColorScale;on:string;}
export interface GradientConfig{enabled:boolean;family:ColorFamily;start:ShadeKey;end:ShadeKey;direction:string;bias:GradientBias;}
export type GradientSettings=Record<string,GradientConfig>;
export interface Theme{name:string;category:string;industry:string;primary:RoleColor;secondary:RoleColor;gradients:GradientSettings;note?:string;}
export interface ThemeInput{name?:string;category?:string;industry?:string;primary:string;secondary:string;primaryName?:string;secondaryName?:string;gradients?:GradientSettings;note?:string;}
export interface PrimaryCandidate{id:string;name:string;en:string;hex:string;tag:string;group:string;desc:string;secondaryName:string;secondaryHex:string;secondaryScheme:string;category:string;}
export interface Preset{id:string;name:string;category:string;industry:string;primary:string;secondary:string;primaryName:string;secondaryName:string;note:string;gradients?:GradientSettings;}
export interface HarmonyDef{id:string;name:string;en:string;scheme:string;offset:number;L?:number;C?:number;note:string;}
export interface ThemeDraft{id?:string;name:string;category:string;industry:string;primary:string;secondary:string;primaryName:string;secondaryName:string;note:string;gradients:GradientSettings;}
export interface ThemeLibraryDocument{schemaVersion:1;presets:Preset[];}
export type CssVariableMap=Record<string,string>;
