export type UiToPluginMessage =
  | { type: 'export'; options: unknown }
  | { type: 'cancel' };

export type ValidationErrorMsg = { type: 'CYCLE'; path: string[] };

export type PluginToUiMessage =
  | { type: 'validation-errors'; errors: ValidationErrorMsg[] }
  | { type: 'exporting' }
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
