import type { DiffSummary, ExportSummary } from './lib/format';

export type UiState = {
  lastZip: Uint8Array | null;
  lastFilename: string;
  lastChangelog: string;
  lastDiff: Partial<DiffSummary>;
  lastSummary: ExportSummary | null;
};

export function createInitialState(): UiState {
  return {
    lastZip: null,
    lastFilename: 'design_system.zip',
    lastChangelog: '',
    lastDiff: { added: [], removed: [], renamed: [] },
    lastSummary: null,
  };
}

