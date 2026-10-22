import { describe, expect, it } from 'vitest';
import type { IR } from '../../ir/types';
import { buildSemanticGraph } from '../../core/graph/build_graph';
import {
  TargetRegistry,
  clearRegistry,
  getTarget,
  hasTarget,
  registerTarget,
} from '../../core/registry/target_registry';
import { flutterTarget } from '../../targets/flutter';
import type { FlutterOptions, PreparedFlutter } from '../../targets/flutter';
import { reactNativeTarget } from '../../targets/react_native';
import type { ReactNativeOptions, PreparedReactNative } from '../../targets/react_native';
import type { EmittedFile, PreparedTarget, Target } from '../../core/target';

function createTestIR(): IR {
  return {
    version: '1.0',
    fileKey: 'target-boundary-test',
    generatedAt: new Date(0).toISOString(),
    collections: [
      {
        id: 'col:brand',
        name: 'Brand',
        kind: 'primitive',
        modes: [{ id: 'm:default', name: 'Default' }],
        variables: [
          {
            id: 'v:primary',
            figmaName: 'primary',
            groupPath: ['primary'],
            type: 'COLOR',
            scopes: ['ALL_FILLS'],
            hiddenFromPublishing: false,
            emitToPublic: true,
            valuesByMode: {
              'm:default': {
                kind: 'literal',
                value: { r: 0.2, g: 0.4, b: 0.8, a: 1 },
              },
            },
          },
        ],
      },
    ],
    composites: {
      paintStyles: [],
      effectStyles: [],
      textStyles: [],
    },
  };
}

describe('Target Boundary Type-Safety & Elimination of as any', () => {
  it('flutterTarget.prepare returns strictly typed PreparedFlutter with flutterPrepared', () => {
    const ir = createTestIR();
    const prepared: PreparedFlutter = flutterTarget.prepare(buildSemanticGraph(ir), null, {
      packageName: 'my_flutter_ds',
    });

    expect(prepared.targetId).toBe('flutter');
    expect(prepared.flutterPrepared).toBeDefined();
    expect(prepared.flutterPrepared.collections).toHaveLength(1);
    expect(prepared.flutterPrepared.varIndex.has('v:primary')).toBe(true);
    expect(prepared.nextManifestSection).toBeDefined();
    expect(Array.isArray(prepared.warnings)).toBe(true);
  });

  it('flutterTarget.emit consumes PreparedFlutter directly without any cast', () => {
    const ir = createTestIR();
    const prepared = flutterTarget.prepare(buildSemanticGraph(ir), null, {
      packageName: 'my_flutter_ds',
    });

    const files: EmittedFile[] = flutterTarget.emit(prepared, {
      packageName: 'my_flutter_ds',
    });

    expect(files.length).toBeGreaterThan(0);
    const pubspec = files.find((f) => f.path === 'pubspec.yaml');
    expect(pubspec).toBeDefined();
    expect(pubspec?.contents).toContain('name: my_flutter_ds');
  });

  it('reactNativeTarget.prepare returns strictly typed PreparedReactNative', () => {
    const ir = createTestIR();
    const prepared: PreparedReactNative = reactNativeTarget.prepare(buildSemanticGraph(ir), null, {
      packageName: 'my-rn-ds',
    });

    expect(prepared.targetId).toBe('react_native');
    expect(prepared.collections).toHaveLength(1);
    expect(prepared.modes).toHaveLength(1);
    expect(prepared.nextManifestSection).toBeDefined();
  });

  it('reactNativeTarget.emit consumes PreparedReactNative cleanly without any cast', () => {
    const ir = createTestIR();
    const prepared = reactNativeTarget.prepare(buildSemanticGraph(ir), null);

    const files: EmittedFile[] = reactNativeTarget.emit(prepared, {
      packageName: 'my-rn-ds',
    });

    expect(files.length).toBeGreaterThan(0);
    const pkgJson = files.find((f) => f.path === 'package.json');
    expect(pkgJson).toBeDefined();
    expect(pkgJson?.contents).toContain('"name": "my-rn-ds"');
  });

  it('TargetRegistry supports generic get<TOptions, TPrepared>', () => {
    const registry = new TargetRegistry();
    registry.register(flutterTarget);
    registry.register(reactNativeTarget);

    const typedFlutter = registry.get<FlutterOptions, PreparedFlutter>('flutter');
    expect(typedFlutter.id).toBe('flutter');

    const ir = createTestIR();
    const flutterPrepared: PreparedFlutter = typedFlutter.prepare(buildSemanticGraph(ir), null);
    const flutterFiles: EmittedFile[] = typedFlutter.emit(flutterPrepared);
    expect(flutterFiles.length).toBeGreaterThan(0);

    const typedRN = registry.get<ReactNativeOptions, PreparedReactNative>('react_native');
    expect(typedRN.id).toBe('react_native');

    const rnPrepared: PreparedReactNative = typedRN.prepare(buildSemanticGraph(ir), null);
    const rnFiles: EmittedFile[] = typedRN.emit(rnPrepared);
    expect(rnFiles.length).toBeGreaterThan(0);
  });

  it('global getTarget supports generic retrieval with full pipeline round-trip', () => {
    const target = getTarget<FlutterOptions, PreparedFlutter>('flutter');
    const ir = createTestIR();

    const prepared = target.prepare(buildSemanticGraph(ir), null, { packageName: 'global_test_ds' });
    expect(prepared.targetId).toBe('flutter');
    expect(prepared.flutterPrepared).toBeDefined();

    const files = target.emit(prepared, { packageName: 'global_test_ds' });
    const pubspec = files.find((f) => f.path === 'pubspec.yaml');
    expect(pubspec?.contents).toContain('name: global_test_ds');
  });
});
