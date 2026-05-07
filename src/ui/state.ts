import type { PreviewFile } from './lib/messages';

export type UiState = {
  lastZip: Uint8Array | null;
  lastFilename: string;
  previewFiles: PreviewFile[];
  selectedPath: string | null;
};

export function createInitialState(): UiState {
  return {
    lastZip: null,
    lastFilename: 'design_system.zip',
    previewFiles: [],
    selectedPath: null,
  };
}
