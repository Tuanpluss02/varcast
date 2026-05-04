import type { DiffSummary, ExportSummary } from './format';

export type UiToPluginMessage =
  | { type: 'export'; options: unknown }
  | { type: 'cancel' };

export type ValidationWarningMsg =
  | { type: 'UNRESOLVED_ALIAS'; variableId: string; targetId: string }
  | { type: 'DIAMOND_APPROXIMATED'; styleId: string }
  | { type: 'IMAGE_ASSET_REQUIRED'; styleId: string; assetName: string }
  // Per-target prepare warnings forwarded to the UI.
  | { type: 'TARGET_WARNING'; targetId: string; code: string; message: string };

export type ValidationErrorMsg = { type: 'CYCLE'; path: string[] };

export type PluginToUiMessage =
  | { type: 'validation-errors'; errors: ValidationErrorMsg[] }
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

export function formatError(e: ValidationErrorMsg): string {
  switch (e.type) {
    case 'CYCLE':
      return `CYCLE: ${e.path.join(' → ')}`;
  }
}

