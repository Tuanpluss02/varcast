import type { DiffSummary, ExportSummary } from './format';

export type UiToPluginMessage =
  | { type: 'export'; options: unknown }
  | { type: 'cancel' }
  | { type: 'continue' }
  | { type: 'download-zip' };

export type PluginToUiMessage =
  | { type: 'validation-errors'; errors: Array<{ type: string; path?: string[] }> }
  | {
      type: 'validation-warnings';
      warnings: Array<{ type: string; path?: string[] }>;
      diff?: Partial<DiffSummary>;
    }
  | { type: 'ready'; diff?: Partial<DiffSummary>; summary?: ExportSummary }
  | { type: 'exporting' }
  | {
      type: 'zip-ready';
      bytes: Uint8Array;
      filename?: string;
      changelog?: string;
      diff?: Partial<DiffSummary>;
      summary?: ExportSummary;
    }
  | { type: 'error'; message: string };

export function postToPlugin(msg: UiToPluginMessage) {
  parent.postMessage({ pluginMessage: msg }, '*');
}

