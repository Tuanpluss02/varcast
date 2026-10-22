import type { Manifest } from './core/manifest';
import type { EmittedFile } from './core/target';
import { buildZip } from './zip';

export interface PendingExportData {
  nextManifest: Manifest;
  packageName: string;
  files: EmittedFile[];
}

export interface StorageLike {
  setAsync(key: string, value: unknown): Promise<void>;
}

export type PluginToUiMessage =
  | { type: 'exporting' }
  | { type: 'zip-ready'; bytes: Uint8Array; filename: string }
  | { type: 'warning'; message: string }
  | { type: 'error'; message: string };

export interface PostMessageLike {
  (msg: PluginToUiMessage): void;
}

export async function handleDownloadZip(
  pending: PendingExportData | null,
  storage: StorageLike,
  postMessage: PostMessageLike,
  buildZipFn?: (files: EmittedFile[]) => Uint8Array,
): Promise<void> {
  if (!pending) {
    postMessage({
      type: 'error',
      message: 'No pending export. Run Export again.',
    });
    return;
  }

  postMessage({ type: 'exporting' });

  try {
    await storage.setAsync('manifest_v2', pending.nextManifest);
  } catch (storageErr) {
    console.warn('Failed to save manifest to clientStorage:', storageErr);
    postMessage({
      type: 'warning',
      message:
        'Could not save token mapping to Figma local storage (quota exceeded). Downloads succeeded, but future renames in Figma might lose tracking.',
    });
  }

  try {
    const zipBytes = (buildZipFn ?? buildZip)(pending.files);
    postMessage({
      type: 'zip-ready',
      filename: `${pending.packageName}.zip`,
      bytes: zipBytes,
    });
  } catch (zipErr) {
    postMessage({
      type: 'error',
      message: `Export failed: ${zipErr instanceof Error ? zipErr.message : String(zipErr)}`,
    });
  }
}
