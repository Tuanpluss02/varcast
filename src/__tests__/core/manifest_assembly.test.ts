import { describe, it, expect } from 'vitest';
import { normalizeManifest } from '../../core/manifest/types';
import { runEngine } from '../../core/emit_engine';
import { flutterTarget } from '../../targets/flutter';
import type { IR } from '../../ir/types';
import type { Target } from '../../core/target';

function createDummyIR(): IR {
  return {
    version: '1.0',
    fileKey: 'file_assembly_test',
    generatedAt: new Date(0).toISOString(),
    collections: [
      {
        id: 'col_1',
        name: 'Colors',
        kind: 'primitive',
        modes: [{ id: 'm_1', name: 'Default' }],
        variables: [
          {
            id: 'v_1',
            figmaName: 'Primary',
            groupPath: ['Primary'],
            type: 'COLOR',
            scopes: ['ALL_FILLS'],
            hiddenFromPublishing: false,
            emitToPublic: true,
            valuesByMode: {
              m_1: { kind: 'literal', value: { r: 1, g: 0, b: 0, a: 1 } },
            },
          },
        ],
      },
    ],
    composites: { paintStyles: [], effectStyles: [], textStyles: [] },
  };
}

describe('Manifest Assembly & Deep Validation', () => {
  it('rejects manifest when a target section is not an object', () => {
    const raw = {
      version: '2.0',
      fileKey: 'file_1',
      lastExportedAt: '2026-10-21T00:00:00Z',
      targets: {
        flutter: 'not_an_object',
      },
    };
    expect(normalizeManifest(raw)).toBeNull();
  });

  it('rejects manifest when a target section has invalid variables field', () => {
    const raw = {
      version: '2.0',
      fileKey: 'file_1',
      lastExportedAt: '2026-10-21T00:00:00Z',
      targets: {
        flutter: {
          variables: 'not_an_object',
          collections: {},
        },
      },
    };
    expect(normalizeManifest(raw)).toBeNull();
  });

  it('rejects manifest when a target section has invalid collections field', () => {
    const raw = {
      version: '2.0',
      fileKey: 'file_1',
      lastExportedAt: '2026-10-21T00:00:00Z',
      targets: {
        flutter: {
          variables: {},
          collections: 'not_an_object',
        },
      },
    };
    expect(normalizeManifest(raw)).toBeNull();
  });

  it('rejects manifest when a target section has invalid composites field', () => {
    const raw = {
      version: '2.0',
      fileKey: 'file_1',
      lastExportedAt: '2026-10-21T00:00:00Z',
      targets: {
        flutter: {
          variables: {},
          collections: {},
          composites: 'not_an_object',
        },
      },
    };
    expect(normalizeManifest(raw)).toBeNull();
  });

  it('rejects manifest when a target section has invalid figmaNames field', () => {
    const raw = {
      version: '2.0',
      fileKey: 'file_1',
      lastExportedAt: '2026-10-21T00:00:00Z',
      targets: {
        flutter: {
          variables: {},
          collections: {},
          figmaNames: 'not_an_object',
        },
      },
    };
    expect(normalizeManifest(raw)).toBeNull();
  });

  it('accepts valid manifest with well-formed target sections', () => {
    const raw = {
      version: '2.0',
      fileKey: 'file_1',
      lastExportedAt: '2026-10-21T00:00:00Z',
      targets: {
        flutter: {
          variables: { '1:1': 'primary' },
          collections: { col1: 'Colors' },
          composites: { '2:1': 'heading1' },
          figmaNames: { variables: {}, collections: {}, composites: {} },
        },
      },
    };
    const norm = normalizeManifest(raw);
    expect(norm).not.toBeNull();
    expect(norm?.targets.flutter.variables['1:1']).toBe('primary');
  });

  it('validates target options in runEngine and collects INVALID_OPTIONS warnings', () => {
    const mockTarget: Target<{ name?: string }> = {
      id: 'mock_target',
      displayName: 'Mock',
      defaultPackageName: 'mock_pkg',
      validateOptions: (opts) => {
        const o = opts as { name?: string } | undefined;
        if (!o?.name) {
          return ['Package name must be provided'];
        }
        return null;
      },
      prepare: () => ({
        nextManifestSection: { variables: {}, collections: {} },
        warnings: [],
      }),
      emit: () => [],
    };

    const ir = createDummyIR();
    const result = runEngine(ir, [mockTarget], null, {
      mock_target: {},
    });

    const optWarning = result.warnings.find((w) => w.code === 'INVALID_OPTIONS');
    expect(optWarning).toBeDefined();
    expect(optWarning?.targetId).toBe('mock_target');
    expect(optWarning?.message).toBe('Package name must be provided');
  });

  it('assembles final manifest from target nextManifestSection while preserving unexported targets', () => {
    const ir = createDummyIR();
    const existingManifest = {
      version: '2.0' as const,
      fileKey: 'file_assembly_test',
      lastExportedAt: '2026-01-01T00:00:00Z',
      targets: {
        other_target: {
          variables: { 'v_old': 'oldVal' },
          collections: { 'c_old': 'OldCol' },
        },
      },
    };

    const result = runEngine(ir, [flutterTarget], existingManifest);

    expect(result.nextManifest.version).toBe('2.0');
    expect(result.nextManifest.fileKey).toBe('file_assembly_test');
    expect(result.nextManifest.targets.other_target).toEqual({
      variables: { 'v_old': 'oldVal' },
      collections: { 'c_old': 'OldCol' },
    });
    expect(result.nextManifest.targets.flutter).toBeDefined();
    expect(result.nextManifest.targets.flutter.variables['v_1']).toBe('primary');
  });
});
