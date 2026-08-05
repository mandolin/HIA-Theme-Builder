import{analyzeTheme,type ExtractResult,type ExtractSignals}from'@hia/theme-core';

/** Browser / Electron / Tauri runtime ports used by the shared DOM renderer. */
export interface StoragePort{getItem(key:string):string|null;setItem(key:string,value:string):void;removeItem(key:string):void;}
export interface ClipboardPort{writeText(value:string):Promise<void>;}
export interface ThemeExplorePort{exploreUrl(url:string):Promise<ExtractResult>;}
export interface ThemeManagerPlatform{storage:StoragePort;clipboard:ClipboardPort;now():number;alert(message:string):void;confirm(message:string):boolean;explorer?:ThemeExplorePort;}
export interface InjectedThemeBridge{storage?:StoragePort;clipboard?:ClipboardPort;now?:()=>number;alert?:(message:string)=>void;confirm?:(message:string)=>boolean;explorer?:ThemeExplorePort;}

interface LegacySuccess{ok:true;result:ExtractResult;}
interface LegacyFailure{ok:false;reason?:string;}
interface LegacyHiaBridge{extractFromUrl(url:string):Promise<LegacySuccess|LegacyFailure>;}
interface TauriSignalSuccess{ok:true;signals:ExtractSignals;}
interface TauriSignalFailure{ok:false;reason?:string;}
type TauriInvoke=(command:string,args?:unknown)=>Promise<unknown>;

declare global{
  interface Window{
    hiaThemeBridge?:InjectedThemeBridge;
    hia?:LegacyHiaBridge;
    __TAURI_INVOKE__?:TauriInvoke;
  }
}

function legacyElectronExplorer():ThemeExplorePort|undefined{
  if(!window.hia?.extractFromUrl)return undefined;
  return{async exploreUrl(url:string){
    const response=await window.hia!.extractFromUrl(url);
    if(!response.ok)throw new Error(response.reason||'网址主题探索失败。');
    return response.result;
  }};
}

function tauriExplorer():ThemeExplorePort|undefined{
  const invoke=window.__TAURI_INVOKE__;
  if(!invoke)return undefined;
  return{async exploreUrl(url:string){
    const response=await invoke('extract_signals',{url})as TauriSignalSuccess|TauriSignalFailure;
    if(!response.ok)throw new Error(response.reason||'网址主题探索失败。');
    return analyzeTheme(response.signals);
  }};
}

/**
 * Prefer an explicit bridge, then the current Electron legacy bridge, then the current Tauri invoke.
 * Plain browsers fall back to browser-native storage and clipboard only.
 */
export function createAdaptivePlatform():ThemeManagerPlatform{
  const bridge=window.hiaThemeBridge;
  const explorer=bridge?.explorer??legacyElectronExplorer()??tauriExplorer();
  return{
    storage:bridge?.storage??window.localStorage,
    clipboard:bridge?.clipboard??{writeText:async value=>navigator.clipboard.writeText(value)},
    now:bridge?.now??(()=>Date.now()),
    alert:bridge?.alert??(message=>window.alert(message)),
    confirm:bridge?.confirm??(message=>window.confirm(message)),
    ...(explorer?{explorer}:{})
  };
}
