/**
 * @lang zh-CN `W-tb-P10` 新增界面词条：分享链接、主题库导入导出、远程预设源与本地/远程子 Tab。
 * @lang en `W-tb-P10` UI strings: share link, library import/export, remote preset sources and the local/remote sub-tabs.
 */
import { registerStrings } from './i18n.js';

registerStrings({
  // 本地/远程子 Tab 与库文件导入导出。
  // <lang zh-CN>预设库面板顶部的模式切换与文件搬运入口。</lang>
  // <lang en>Mode switch atop the library panel plus file import/export entries.</lang>
  'p10.tab.local': { zh: '本地库', en: 'Local' },
  'p10.tab.remote': { zh: '远程源', en: 'Remote sources' },
  'p10.export.lib': { zh: '导出主题库', en: 'Export library' },
  'p10.import.lib': { zh: '导入主题库', en: 'Import library' },
  'p10.import.done': { zh: '已导入 {count} 个预设（{renamed} 个因 id 冲突重命名），丢弃 {dropped} 条无效项。', en: 'Imported {count} presets ({renamed} renamed due to id clashes, {dropped} invalid dropped).' },
  'p10.import.empty': { zh: '文件中没有可导入的预设。', en: 'No importable presets in the file.' },
  'p10.import.fail': { zh: '导入失败：不是合法的主题库/主题包文件。', en: 'Import failed: not a valid theme library/pack file.' },
  'p10.export.done': { zh: '主题库已导出（{count} 个预设）。', en: 'Library exported ({count} presets).' },
  // 分享链接。
  // <lang zh-CN>操作台工具栏的分享入口与还原提示。</lang>
  // <lang en>Share entry in the console toolbar and restore feedback.</lang>
  'p10.share.action': { zh: '复制分享链接', en: 'Copy share link' },
  'p10.share.copied': { zh: '分享链接已复制——任何人打开即可还原本主题。', en: 'Share link copied — anyone opening it restores this theme.' },
  'p10.share.restored': { zh: '已还原分享主题"{name}"（预览态，尚未入库；满意请点"生成并导入主题库"）。', en: 'Shared theme "{name}" restored (preview only; use "Save to library" to keep it).' },
  'p10.share.invalid': { zh: '分享链接无效或已损坏。', en: 'The share link is invalid or corrupted.' },
  // 远程源。
  // <lang zh-CN>源管理、加载状态与导入动作。</lang>
  // <lang en>Source management, loading status and import actions.</lang>
  'p10.remote.load': { zh: '加载', en: 'Load' },
  'p10.remote.remove': { zh: '移除此源', en: 'Remove source' },
  'p10.remote.add': { zh: '添加源', en: 'Add source' },
  'p10.remote.add.placeholder': { zh: '添加新源：https://…/theme-pack.json', en: 'Add a source: https://…/theme-pack.json' },
  'p10.remote.status.loading': { zh: '正在加载远程源…', en: 'Loading remote source…' },
  'p10.remote.status.ok': { zh: '{source}：{count} 个预设{dropped}。', en: '{source}: {count} presets{dropped}.' },
  'p10.remote.status.droppedSuffix': { zh: '（丢弃 {n} 条无效）', en: ' ({n} invalid dropped)' },
  'p10.remote.status.empty': { zh: '该源没有预设。', en: 'This source has no presets.' },
  'p10.remote.status.fail': { zh: '加载失败：{reason}', en: 'Load failed: {reason}' },
  'p10.remote.count': { zh: '共 {count} 个远程预设', en: '{count} remote presets' },
  'p10.remote.importAll': { zh: '全部导入本地库', en: 'Import all to local' },
  'p10.remote.importOne': { zh: '导入', en: 'Import' },
  'p10.remote.importedOne': { zh: '"{name}" 已导入本地库。', en: '"{name}" imported to the local library.' },
  'p10.remote.importAllDone': { zh: '已导入 {count} 个预设（{renamed} 个重命名，{dropped} 条无效丢弃）。', en: 'Imported {count} presets ({renamed} renamed, {dropped} invalid dropped).' },
  'p10.remote.badUrl': { zh: '请输入以 http(s):// 开头的源地址。', en: 'Enter a source URL starting with http(s)://.' },
  'p10.remote.dupeSource': { zh: '该源已在列表中。', en: 'This source is already listed.' },
  'p10.remote.emptySelect': { zh: '暂无源，请先添加或加载默认源。', en: 'No sources yet; add one or load the default.' }
});
