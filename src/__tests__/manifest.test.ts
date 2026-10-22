import { describe, it, expect } from 'vitest';
import type { Manifest } from '../core/manifest';
import {
  diffManifestForTarget,
  normalizeManifest,
  resolveStableVariableName,
} from '../core/manifest';
import { resolveStableName } from '../targets/flutter/generator/prepare';

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
  it('resolveStableVariableName: rename in Figma keeps stable name by id', () => {
    const m = flutterManifest({ 'var:1': 'n900' });
    expect(resolveStableVariableName(m.targets.flutter, 'var:1', 'charcoal')).toBe('n900');
    expect(resolveStableVariableName(m.targets.flutter, 'var:2', 'n800')).toBe('n800');
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

  it('legacy `_2` rename keeps original when target name already used by sibling', () => {
    // Both `bgSecondary_2` and `bgSecondary2` exist in the manifest (e.g. one
    // legacy variable + one variable that was deduped after migration). The
    // rename must not silently merge them onto the same Dart identifier.
    const m = flutterManifest({
      'var:1': 'bgSecondary_2',
      'var:2': 'bgSecondary2',
    });
    expect(resolveStableName('var:1', 'bgSecondary', m)).toBe('bgSecondary_2');
    expect(resolveStableName('var:2', 'bgSecondary', m)).toBe('bgSecondary2');
  });

  it('diffManifestForTarget: added/removed/renamed detected by variable id', () => {
    const oldM = flutterManifest(
      { 'var:1': 'n900', 'var:2': 'n800' },
      { 'var:1': 'neutral/900', 'var:2': 'neutral/800' },
    );
    const nextM = flutterManifest(
      { 'var:1': 'n900', 'var:3': 'n700' },
      { 'var:1': 'neutral/charcoal', 'var:3': 'neutral/700' },
    );

    const d = diffManifestForTarget(oldM, nextM, 'flutter');
    expect(d.variables.added.map((x) => x.id)).toEqual(['var:3']);
    expect(d.variables.removed.map((x) => x.id)).toEqual(['var:2']);
    expect(d.variables.renamed.map((x) => x.id)).toEqual(['var:1']);
  });
});

describe('manifest migration', () => {
  it('normalizeManifest: v1 is unsupported and rejected', () => {
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
    expect(m).toBeNull();
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
