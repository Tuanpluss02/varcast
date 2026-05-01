import { describe, it, expect } from 'vitest';
import type { Manifest } from '../manifest';
import { diffManifest, resolveStableName } from '../manifest';
import { normalizeManifest } from '../core/manifest';

function flutterManifest(
  vars: Record<string, string> = {},
  figmaVars: Record<string, string> = {},
): Manifest {
  return {
    version: '2.0',
    fileKey: 'k',
    lastExportedAt: new Date(0).toISOString(),
    targets: {
      flutter: {
        variables: vars,
        collections: {},
        figmaNames: { variables: figmaVars, collections: {} },
      },
    },
  };
}

describe('manifest', () => {
  it('resolveStableName: rename in Figma keeps dartName stable by id', () => {
    const m = flutterManifest({ 'var:1': 'n900' });
    expect(resolveStableName('var:1', 'charcoal', m)).toBe('n900');
    expect(resolveStableName('var:2', 'n800', m)).toBe('n800');
  });

  it('resolveStableName: migrates legacy _2 suffix to Dart-style digit suffix', () => {
    const m = flutterManifest({
      'var:1': 'bgSecondary_2',
      'var:2': 'default_',
    });
    expect(resolveStableName('var:1', 'bgSecondary', m)).toBe('bgSecondary2');
    // keyword fix stays as-is
    expect(resolveStableName('var:2', 'default', m)).toBe('default_');
  });

  it('diffManifest: added/removed/renamed detected by variable id', () => {
    const oldM = flutterManifest(
      { 'var:1': 'n900', 'var:2': 'n800' },
      { 'var:1': 'neutral/900', 'var:2': 'neutral/800' },
    );
    const nextM = flutterManifest(
      { 'var:1': 'n900', 'var:3': 'n700' },
      { 'var:1': 'neutral/charcoal', 'var:3': 'neutral/700' },
    );

    const d = diffManifest(oldM, nextM);
    expect(d.added.map((x) => x.id)).toEqual(['var:3']);
    expect(d.removed.map((x) => x.id)).toEqual(['var:2']);
    expect(d.renamed.map((x) => x.id)).toEqual(['var:1']);
  });
});

describe('manifest migration', () => {
  it('normalizeManifest: v1 → v2 places everything under flutter target', () => {
    const v1 = {
      version: '1.0',
      fileKey: 'k',
      lastExportedAt: new Date(0).toISOString(),
      variables: { 'var:1': 'n900' },
      collections: { 'col:1': 'ColorBasic' },
      figmaNames: {
        variables: { 'var:1': 'neutral/900' },
        collections: { 'col:1': 'Color/Basic' },
      },
    };
    const m = normalizeManifest(v1);
    expect(m).toBeTruthy();
    expect(m!.version).toBe('2.0');
    expect(m!.targets.flutter.variables['var:1']).toBe('n900');
    expect(m!.targets.flutter.collections['col:1']).toBe('ColorBasic');
    expect(m!.targets.flutter.figmaNames?.variables['var:1']).toBe('neutral/900');
  });

  it('normalizeManifest: v2 passes through', () => {
    const v2 = flutterManifest({ 'var:1': 'n900' });
    const m = normalizeManifest(v2);
    expect(m).toEqual(v2);
  });

  it('normalizeManifest: unknown/garbage returns null', () => {
    expect(normalizeManifest(null)).toBeNull();
    expect(normalizeManifest({ version: '99.0' })).toBeNull();
    expect(normalizeManifest('not-an-object')).toBeNull();
  });

  it('preserves other-target sections across re-export of one target', () => {
    // Multi-target user: Flutter exported earlier, RN exported now.
    // Re-exporting RN must not wipe Flutter's stable names.
    const beforeRN: Manifest = {
      version: '2.0',
      fileKey: 'k',
      lastExportedAt: new Date(0).toISOString(),
      targets: {
        flutter: {
          variables: { 'var:1': 'n900' },
          collections: { 'col:1': 'ColorBasic' },
        },
      },
    };
    // Pretend RN target produces this section. Flutter section must remain.
    const afterRN: Manifest = {
      ...beforeRN,
      targets: {
        ...beforeRN.targets,
        react_native: {
          variables: { 'var:1': 'n900' },
          collections: { 'col:1': 'colorBasic' },
        },
      },
    };
    expect(afterRN.targets.flutter.variables['var:1']).toBe('n900');
    expect(afterRN.targets.react_native.variables['var:1']).toBe('n900');
  });
});
