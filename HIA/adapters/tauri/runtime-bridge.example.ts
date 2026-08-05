/** Tauri v1-style bridge example. The shared web platform also detects __TAURI_INVOKE__. */
import { analyzeTheme, type ExtractSignals } from '@hia/theme-core';

declare global {
  interface Window {
    __TAURI_INVOKE__?: (command: string, args?: unknown) => Promise<unknown>;
    hiaThemeBridge?: {
      explorer?: { exploreUrl(url: string): Promise<unknown> };
    };
  }
}

if (window.__TAURI_INVOKE__) {
  window.hiaThemeBridge = {
    explorer: {
      async exploreUrl(url: string) {
        const response = await window.__TAURI_INVOKE__!('extract_signals', { url }) as
          | { ok: true; signals: ExtractSignals }
          | { ok: false; reason?: string };
        if (!response.ok) throw new Error(response.reason || '网址主题探索失败。');
        return analyzeTheme(response.signals);
      }
    }
  };
}
