export type UiState = {
  lastZip: Uint8Array | null;
  lastFilename: string;
};

export function createInitialState(): UiState {
  return {
    lastZip: null,
    lastFilename: 'design_system.zip',
  };
}
