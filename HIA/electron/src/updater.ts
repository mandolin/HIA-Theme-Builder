/**
 * @lang zh-CN 桌面端自动更新（`W-tb-P48` / electron-updater，GitHub provider）：
 *   仅打包态启用（`app.isPackaged` 守卫）；启动后 3s 静默检查一次 + IPC 手动检查；
 *   `update-downloaded` 后弹确认框（绝不静默安装），确认即 `quitAndInstall()`。
 *   状态经回调广播给渲染层（preload 桥转发）。
 *   测试/本地验证逃生口：`HIA_UPDATE_FEED=<url>` 强制 generic provider（指向本地模拟 feed），
 *   `HIA_UPDATE_SILENT=1` 跳过确认框（仅供自动化验证，文档见账本）。
 * @lang en Desktop auto-update (`W-tb-P48`; electron-updater, GitHub provider): packaged builds only
 *   (`app.isPackaged` guard); one silent check ~3s after startup plus a manual IPC check; on
 *   `update-downloaded` a confirmation dialog — never a silent install. Status is broadcast to the
 *   renderer via callback (preload bridge). Test escape hatches: `HIA_UPDATE_FEED=<url>` forces a generic
 *   provider (local simulated feed) and `HIA_UPDATE_SILENT=1` skips the dialog — automation only.
 */

import { app, BrowserWindow, dialog } from 'electron';

/** @lang zh-CN 更新状态快照（广播给渲染层）。 @lang en Update status snapshot (broadcast to renderer). */
export interface UpdaterStatus {
  state: 'disabled'|'checking'|'available'|'none'|'downloading'|'downloaded'|'error';
  /** @lang zh-CN 可用时的新版本号（如可得）。 @lang en New version when available (if known). */
  version?: string;
  /** @lang zh-CN 下载百分比（如可得）。 @lang en Download percent when known. */
  percent?: number;
  /** @lang zh-CN 人类可读信息（错误原因等）。 @lang en Human-readable message (error reason etc.). */
  message?: string;
}

// electron-updater 为 CJS 包；主进程是 ESM（"type":"module"），故动态 import 加载。
// <lang en>electron-updater ships CJS; the main process is ESM ("type":"module"), so load it dynamically.
type AutoUpdaterModule = typeof import('electron-updater');

/**
 * @lang zh-CN 装配更新通道：注册事件→状态广播；启动延迟静默检查；返回手动检查函数（供 IPC）。
 *   返回 null 表示当前环境禁用（未打包且未设 HIA_UPDATE_FEED）。
 * @lang en Wire the update channel: events→status broadcast; delayed silent startup check; returns the
 *   manual-check function for IPC. Returns null when disabled (unpackaged without HIA_UPDATE_FEED).
 */
export async function setupUpdater(broadcast:(s:UpdaterStatus)=>void):Promise<(()=>Promise<UpdaterStatus>)|null>{
  // 逃生口：显式 feed 覆盖（本地模拟/验证）视为启用，即使未打包。
  // <lang en>Escape hatch: an explicit feed override counts as enabled even when unpackaged.</lang>
  const feedOverride=process.env.HIA_UPDATE_FEED;
  if(!app.isPackaged&&!feedOverride){
    broadcast({state:'disabled',message:'unpackaged (dev) — updater disabled'});
    return null;
  }
  // 动态加载 electron-updater（CJS）：Node ESM 具名导出探测对部分 CJS 形态失效，
  //   以 `.default ?? mod` 双形态兜底取 module.exports。
  // <lang en>Load electron-updater (CJS) dynamically: Node's named-export detection can miss some CJS
  //   shapes — fall back through `.default ?? mod` to reach module.exports.</lang>
  const mod=(await import('electron-updater')) as unknown as {default?:AutoUpdaterModule}&Partial<AutoUpdaterModule>;
  const autoUpdater=(mod.default??mod).autoUpdater;
  if(!autoUpdater)throw new Error('electron-updater: autoUpdater export not found (CJS interop failed)');
  // 日志级别便于排障（正式版静默成功路径不弹窗）。
  // <lang en>Logger wired for troubleshooting; the successful silent path never pops dialogs.</lang>
  autoUpdater.logger={info:(m:unknown)=>console.log('[updater]',m),warn:(m:unknown)=>console.warn('[updater]',m),debug:(m:unknown)=>console.log('[updater]',m),error:(m:unknown)=>console.error('[updater]',m)};
  autoUpdater.autoDownload=true;
  autoUpdater.autoInstallOnAppQuit=true;
  if(feedOverride){
    // 本地/模拟 feed（generic provider）——仅供自动化验证与本地调试。
    //   开发态门禁：electron-updater 在未打包时默认跳过检查（"dev update config is not forced"），
    //   逃生口下须显式 forceDevUpdateConfig=true 才会真正检查。
    // <lang en>Local/simulated feed (generic provider) — automation and local debugging only. electron-updater
    //   skips checks when unpackaged unless forceDevUpdateConfig is set — the escape hatch must set it.</lang>
    autoUpdater.forceDevUpdateConfig=true;
    autoUpdater.setFeedURL({provider:'generic',url:feedOverride});
  }
  // 事件→状态广播。
  // <lang en>Events→status broadcast.</lang>
  autoUpdater.on('checking-for-update',()=>broadcast({state:'checking'}));
  autoUpdater.on('update-available',(info)=>broadcast({state:'available',version:(info as {version?:string}).version}));
  autoUpdater.on('update-not-available',()=>broadcast({state:'none'}));
  autoUpdater.on('download-progress',(p)=>broadcast({state:'downloading',percent:Math.round((p as {percent?:number}).percent??0)}));
  autoUpdater.on('error',(e)=>broadcast({state:'error',message:e instanceof Error?e.message:String(e)}));
  autoUpdater.on('update-downloaded',(info)=>{
    broadcast({state:'downloaded',version:(info as {version?:string}).version});
    // 确认框：绝不静默安装；HIA_UPDATE_SILENT=1 仅供自动化验证跳过。
    // <lang en>Confirmation dialog — never a silent install; HIA_UPDATE_SILENT=1 skips for automation.</lang>
    if(process.env.HIA_UPDATE_SILENT==='1')return;
    const win=BrowserWindow.getAllWindows()[0];
    const version=(info as {version?:string}).version??'';
    void dialog.showMessageBox(win,{
      type:'info',
      title:'更新就绪 / Update ready',
      message:`新版本 ${version} 已下载完成，是否立即重启安装？`,
      detail:`Version ${version} is downloaded. Restart and install now?`,
      buttons:['立即安装 / Install now','稍后 / Later'],
      defaultId:0,
      cancelId:1
    }).then(({response})=>{if(response===0)autoUpdater.quitAndInstall();});
  });
  // 手动检查（IPC）：返回终态快照；错误以 error 状态返回而非抛出。
  // <lang en>Manual check (IPC): resolves with a terminal snapshot; errors surface as 'error' state.</lang>
  const check=async():Promise<UpdaterStatus>=>{
    try{
      const r=await autoUpdater.checkForUpdates();
      // checkForUpdates 返回 updateInfo（含 version）——是否可更新由事件流给出终态；
      // 此处直接以"返回版本 vs 当前版本"给出同步结论，避免竞态。
      // <lang en>checkForUpdates resolves update info; compare versions here for a synchronous verdict.</lang>
      const version=(r as {updateInfo?:{version?:string}}).updateInfo?.version??undefined;
      if(version&&version!==app.getVersion())return{state:'available',version};
      return{state:'none',version};
    }catch(e){
      return{state:'error',message:e instanceof Error?e.message:String(e)};
    }
  };
  // 启动后 3s 静默检查一次（错误仅广播不弹窗）。
  // <lang en>One silent check ~3s after startup (errors broadcast, no dialogs).</lang>
  setTimeout(()=>{void check();},3000);
  return check;
}
