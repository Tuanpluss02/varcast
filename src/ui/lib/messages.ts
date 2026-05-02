import type { DiffSummary, ExportSummary } from './format';

export type UiToPluginMessage =
  | { type: 'export'; options: unknown }
  | { type: 'cancel' }
  | { type: 'continue'; options?: unknown }
  | { type: 'download-zip' };

export type ValidationWarningMsg =
  | { type: 'UNRESOLVED_ALIAS'; variableId: string; targetId: string }
  | { type: 'DIAMOND_APPROXIMATED'; styleId: string }
  | { type: 'IMAGE_ASSET_REQUIRED'; styleId: string; assetName: string }
  // Per-target prepare warnings forwarded to the UI.
  | { type: 'TARGET_WARNING'; targetId: string; code: string; message: string };

export type ValidationErrorMsg = { type: 'CYCLE'; path: string[] };

export type PluginToUiMessage =
  | { type: 'validation-errors'; errors: ValidationErrorMsg[] }
  | {
      type: 'validation-warnings';
      warnings: ValidationWarningMsg[];
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

// Render a warning into a single human-readable line. The shape depends on
// `type` (discriminated union) — never assume a `path` field exists.
export function formatWarning(w: ValidationWarningMsg): string {
  switch (w.type) {
    case 'UNRESOLVED_ALIAS':
      return `UNRESOLVED_ALIAS: variable ${w.variableId} → ${w.targetId} (target not found)`;
    case 'DIAMOND_APPROXIMATED':
      return `DIAMOND_APPROXIMATED: style ${w.styleId} (rendered as radial)`;
    case 'IMAGE_ASSET_REQUIRED':
      return `IMAGE_ASSET_REQUIRED: style ${w.styleId} expects asset "${w.assetName}"`;
    case 'TARGET_WARNING':
      return `${w.targetId}/${w.code}: ${w.message}`;
  }
}

export function formatError(e: ValidationErrorMsg): string {
  switch (e.type) {
    case 'CYCLE':
      return `CYCLE: ${e.path.join(' → ')}`;
  }
}

