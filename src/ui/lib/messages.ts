export type UiToPluginMessage =
  | { type: 'export'; options: unknown }
  | { type: 'cancel' }
  | { type: 'download-zip' };

export type ValidationErrorMsg = { type: 'CYCLE'; path: string[] };

export type PreviewFile = {
  path: string;
  contents: string;
  size: number;
};

export type DiffSummary = {
  added: number;
  removed: number;
  renamed: number;
};

export type ExportSummary = {
  fileCount: number;
  totalBytes: number;
};

export type PluginToUiMessage =
  | { type: 'validation-errors'; errors: ValidationErrorMsg[] }
  | { type: 'exporting' }
  | {
      type: 'preview-ready';
      files: PreviewFile[];
      diff: DiffSummary;
      summary: ExportSummary;
    }
  | { type: 'zip-ready'; bytes: Uint8Array; filename?: string }
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
