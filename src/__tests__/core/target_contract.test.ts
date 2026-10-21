import { describe, it, expect } from 'vitest';
import { TargetRegistry } from '../../core/registry/target_registry';
import type { Target, PreparedTarget } from '../../core/target';

describe('Target Contract & Registry ID validation', () => {
  it('rejects target IDs with invalid characters', () => {
    const registry = new TargetRegistry();
    const invalidTarget = {
      id: 'Flutter Target',
      displayName: 'Flutter',
      defaultPackageName: 'tokens',
      prepare: () => ({ nextManifestSection: { variables: {}, collections: {} }, warnings: [] }),
      emit: () => [],
    } as unknown as Target;

    expect(() => registry.register(invalidTarget)).toThrow(/Invalid target ID format/);
  });

  it('accepts valid target IDs (kebab-case, snake_case, lowercase)', () => {
    const registry = new TargetRegistry();
    const t1 = {
      id: 'flutter',
      displayName: 'Flutter',
      defaultPackageName: 'tokens',
      prepare: () => ({ nextManifestSection: { variables: {}, collections: {} }, warnings: [] }),
      emit: () => [],
    };
    const t2 = {
      id: 'react_native',
      displayName: 'React Native',
      defaultPackageName: 'tokens',
      prepare: () => ({ nextManifestSection: { variables: {}, collections: {} }, warnings: [] }),
      emit: () => [],
    };
    expect(() => registry.register(t1)).not.toThrow();
    expect(() => registry.register(t2)).not.toThrow();
  });
});
