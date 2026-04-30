// Minimal Figma plugin API surface used by readers.
// Tests assign `(global as any).figma` to one of these mocks before importing
// the module under test (so static imports resolve against the mock).

import { vi } from 'vitest';

export interface VarsMock {
  collections: unknown[];
  variables: unknown[];
}

export function installVariablesMock(state: VarsMock) {
  (global as unknown as { figma: unknown }).figma = {
    variables: {
      getLocalVariableCollectionsAsync: vi.fn(async () => state.collections),
      getLocalVariablesAsync: vi.fn(async () => state.variables),
    },
  };
}

export function installPaintStylesMock(styles: unknown[]) {
  (global as unknown as { figma: unknown }).figma = {
    getLocalPaintStylesAsync: vi.fn(async () => styles),
  };
}

export function installEffectStylesMock(styles: unknown[]) {
  (global as unknown as { figma: unknown }).figma = {
    getLocalEffectStylesAsync: vi.fn(async () => styles),
  };
}

export function installTextStylesMock(styles: unknown[]) {
  (global as unknown as { figma: unknown }).figma = {
    getLocalTextStylesAsync: vi.fn(async () => styles),
  };
}

export function clearFigmaMock() {
  delete (global as unknown as { figma?: unknown }).figma;
}
