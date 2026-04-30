import { describe, it, expect } from 'vitest';
import type { Manifest } from '../manifest';
import { diffManifest, resolveStableName } from '../manifest';

describe('manifest', () => {
  it('resolveStableName: rename in Figma keeps dartName stable by id', () => {
    const m: Manifest = {
      version: '1.0',
      fileKey: 'k',
      lastExportedAt: new Date(0).toISOString(),
      variables: { 'var:1': 'n900' },
      collections: {},
    };
    expect(resolveStableName('var:1', 'charcoal', m)).toBe('n900');
    expect(resolveStableName('var:2', 'n800', m)).toBe('n800');
  });

  it('resolveStableName: migrates legacy _2 suffix to Dart-style digit suffix', () => {
    const m: Manifest = {
      version: '1.0',
      fileKey: 'k',
      lastExportedAt: new Date(0).toISOString(),
      variables: { 'var:1': 'bgSecondary_2', 'var:2': 'default_' },
      collections: {},
    };
    expect(resolveStableName('var:1', 'bgSecondary', m)).toBe('bgSecondary2');
    // keyword fix stays as-is
    expect(resolveStableName('var:2', 'default', m)).toBe('default_');
  });

  it('diffManifest: added/removed detected by variable id', () => {
    const oldM: Manifest = {
      version: '1.0',
      fileKey: 'k',
      lastExportedAt: new Date(0).toISOString(),
      variables: { 'var:1': 'n900', 'var:2': 'n800' },
      collections: {},
      figmaNames: { variables: { 'var:1': 'neutral/900', 'var:2': 'neutral/800' }, collections: {} },
    };
    const nextM: Manifest = {
      version: '1.0',
      fileKey: 'k',
      lastExportedAt: new Date(0).toISOString(),
      variables: { 'var:1': 'n900', 'var:3': 'n700' },
      collections: {},
      figmaNames: { variables: { 'var:1': 'neutral/charcoal', 'var:3': 'neutral/700' }, collections: {} },
    };

    const d = diffManifest(oldM, nextM);
    expect(d.added.map((x) => x.id)).toEqual(['var:3']);
    expect(d.removed.map((x) => x.id)).toEqual(['var:2']);
    expect(d.renamed.map((x) => x.id)).toEqual(['var:1']);
  });
});

