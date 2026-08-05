/**
 * @lang zh-CN Token 导出工具：把 core 产出的 Theme 转 CSS/JSON 并提供复制与下载。
 * @lang en Token export utilities: turn core Theme into CSS/JSON with copy and download.
 */

import { exportThemeCss, exportThemeJson } from '@hia/theme-core';
import type { Theme } from '@hia/theme-core';

/** @lang zh-CN CSS 文本导出。 @lang en CSS text export. */
export function toCss(theme: Theme): string {
  return exportThemeCss(theme);
}

/** @lang zh-CN JSON 文本导出（pretty）。 @lang en JSON text export (pretty). */
export function toJson(theme: Theme): string {
  return exportThemeJson(theme);
}

/**
 * @lang zh-CN 复制到剪贴板，失败则回退到选区复制。
 * @lang en Copy to clipboard, fallback to selection on failure.
 */
export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    // <lang zh-CN>剪贴板不可用时，用隐藏 textarea + execCommand 兜底。</lang>
    // <lang en>Fallback to hidden textarea + execCommand when clipboard unavailable.</lang>
    const ta = document.createElement('textarea');
    ta.value = text;
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand('copy');
    document.body.removeChild(ta);
    return ok;
  }
}

/**
 * @lang zh-CN 触发浏览器下载文本文件。
 * @lang en Trigger browser download of a text file.
 */
export function downloadText(filename: string, text: string, mime = 'text/plain'): void {
  const blob = new Blob([text], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
