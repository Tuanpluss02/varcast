import { describe, expect, it } from 'vitest';
import type { IR, IRVariable } from '../../ir/types';
import { buildSemanticGraph } from '../../core/graph/build_graph';
import { flutterTarget } from '../../targets/flutter';
import { reactNativeTarget } from '../../targets/react_native';
import type { Manifest } from '../../core/manifest';

function createIntegrationTestIR(): IR {
  const primitiveVars: IRVariable[] = [
    {
      id: 'var:red500',
      figmaName: 'red/500',
      groupPath: ['red', '500'],
      type: 'COLOR',
      scopes: ['ALL_FILLS'],
      hiddenFromPublishing: false,
      emitToPublic: true,
      valuesByMode: {
        'm:light': { kind: 'literal', value: { r: 1, g: 0, b: 0, a: 1 } },
        'm:dark': { kind: 'literal', value: { r: 0.8, g: 0, b: 0, a: 1 } },
      },
    },
    {
      id: 'var:blue500',
      figmaName: 'blue/500',
      groupPath: ['blue', '500'],
      type: 'COLOR',
      scopes: ['ALL_FILLS'],
      hiddenFromPublishing: false,
      emitToPublic: true,
      valuesByMode: {
        'm:light': { kind: 'literal', value: { r: 0, g: 0, b: 1, a: 1 } },
        'm:dark': { kind: 'literal', value: { r: 0, g: 0, b: 0.8, a: 1 } },
      },
    },
  ];

  const tokenVars: IRVariable[] = [
    {
      id: 'var:bg_primary',
      figmaName: 'background/primary',
      groupPath: ['background', 'primary'],
      type: 'COLOR',
      scopes: ['ALL_FILLS'],
      hiddenFromPublishing: false,
      emitToPublic: true,
      valuesByMode: {
        'm:light': { kind: 'alias', targetVariableId: 'var:red500' },
        'm:dark': { kind: 'alias', targetVariableId: 'var:blue500' },
      },
    },
    {
      id: 'var:bg_primary_dup',
      figmaName: 'background/primary',
      groupPath: ['background', 'primary'],
      type: 'COLOR',
      scopes: ['ALL_FILLS'],
      hiddenFromPublishing: false,
      emitToPublic: true,
      valuesByMode: {
        'm:light': { kind: 'alias', targetVariableId: 'var:blue500' },
        'm:dark': { kind: 'alias', targetVariableId: 'var:red500' },
      },
    },
    {
      id: 'var:fg_primary',
      figmaName: 'foreground/primary',
      groupPath: ['foreground', 'primary'],
      type: 'COLOR',
      scopes: ['ALL_FILLS'],
      hiddenFromPublishing: false,
      emitToPublic: true,
      valuesByMode: {
        'm:light': { kind: 'alias', targetVariableId: 'var:blue500' },
        'm:dark': { kind: 'alias', targetVariableId: 'var:red500' },
      },
    },
  ];

  return {
    version: '1.0',
    fileKey: 'toolkit-test-file',
    generatedAt: '2026-10-21T00:00:00.000Z',
    collections: [
      {
        id: 'col:primitives',
        name: '01_Colors_Primitive',
        kind: 'primitive',
        modes: [
          { id: 'm:light', name: 'Light' },
          { id: 'm:dark', name: 'Dark' },
        ],
        variables: primitiveVars,
      },
      {
        id: 'col:tokens',
        name: '02_Theme_Tokens',
        kind: 'token',
        modes: [
          { id: 'm:light', name: 'Light' },
          { id: 'm:dark', name: 'Dark' },
        ],
        variables: tokenVars,
      },
    ],
    composites: {
      paintStyles: [
        {
          id: 'paint:brand',
          figmaName: 'Brand / Primary Paint',
          groupPath: ['Brand', 'Primary Paint'],
          type: 'SOLID',
          color: { kind: 'alias', targetVariableId: 'var:bg_primary' },
        },
      ],
      effectStyles: [
        {
          id: 'effect:elevation_low',
          figmaName: 'Elevation / Low Shadow',
          groupPath: ['Elevation', 'Low Shadow'],
          type: 'DROP_SHADOW',
          color: { kind: 'literal', rgba: { r: 0, g: 0, b: 0, a: 0.1 } },
          offsetX: 0,
          offsetY: 2,
          blurRadius: 4,
          spreadRadius: 0,
        },
      ],
      textStyles: [
        {
          id: 'text:heading_large',
          figmaName: 'Typography / Heading Large',
          groupPath: ['Typography', 'Heading Large'],
          fontFamily: { kind: 'literal', value: 'Roboto' },
          fontSize: { kind: 'literal', value: 24 },
          fontWeight: { kind: 'literal', value: 700 },
          lineHeight: { kind: 'literal', value: 32, unit: 'PIXELS' },
          letterSpacing: { kind: 'literal', value: 0, unit: 'PIXELS' },
        },
      ],
    },
  };
}

describe('Toolkit Integration: Flutter & React Native Targets', () => {
  it('correctly prepares Flutter target and emits non-empty files', () => {
    const ir = createIntegrationTestIR();
    const graph = buildSemanticGraph(ir);

    const prepared = flutterTarget.prepare(graph, null);
    expect(prepared.targetId).toBe('flutter');

    const manifestSec = prepared.nextManifestSection;
    expect(manifestSec).toBeDefined();

    // Verify collections mapping
    expect(manifestSec.collections['col:primitives']).toBe('ColorsPrimitive');
    expect(manifestSec.collections['col:tokens']).toBe('ThemeTokens');

    // Verify variables mapping and sibling deduplication
    expect(manifestSec.variables['var:red500']).toBe('n500');
    expect(manifestSec.variables['var:blue500']).toBe('n500');
    expect(manifestSec.variables['var:bg_primary']).toBe('primary');
    expect(manifestSec.variables['var:bg_primary_dup']).toBe('primary2');
    expect(manifestSec.variables['var:fg_primary']).toBe('primary');

    // Verify composites mapping
    expect(manifestSec.composites?.['paint:brand']).toBe('brandPrimaryPaint');
    expect(manifestSec.composites?.['effect:elevation_low']).toBe('elevationLowShadow');
    expect(manifestSec.composites?.['text:heading_large']).toBe('typographyHeadingLarge');

    // Verify figmaNames mapping
    expect(manifestSec.figmaNames?.collections).toEqual({
      'col:primitives': '01_Colors_Primitive',
      'col:tokens': '02_Theme_Tokens',
    });
    expect(manifestSec.figmaNames?.variables?.['var:bg_primary']).toBe('background/primary');
    expect(manifestSec.figmaNames?.composites).toEqual({
      'paint:brand': 'Brand / Primary Paint',
      'effect:elevation_low': 'Elevation / Low Shadow',
      'text:heading_large': 'Typography / Heading Large',
    });

    // Verify emit generates non-empty files
    const emitted = flutterTarget.emit(prepared);
    expect(emitted.length).toBeGreaterThan(0);
    for (const f of emitted) {
      expect(f.path.length).toBeGreaterThan(0);
      expect(f.contents.length).toBeGreaterThan(0);
    }
  });

  it('correctly prepares React Native target and emits non-empty files', () => {
    const ir = createIntegrationTestIR();
    const graph = buildSemanticGraph(ir);

    const prepared = reactNativeTarget.prepare(graph, null);
    expect(prepared.targetId).toBe('react_native');

    const manifestSec = prepared.nextManifestSection;
    expect(manifestSec).toBeDefined();

    // Verify collections mapping
    expect(manifestSec.collections['col:primitives']).toBe('ColorsPrimitive');
    expect(manifestSec.collections['col:tokens']).toBe('ThemeTokens');

    // Verify variables mapping and sibling deduplication
    expect(manifestSec.variables['var:red500']).toBe('n500');
    expect(manifestSec.variables['var:blue500']).toBe('n500');
    expect(manifestSec.variables['var:bg_primary']).toBe('primary');
    expect(manifestSec.variables['var:bg_primary_dup']).toBe('primary2');
    expect(manifestSec.variables['var:fg_primary']).toBe('primary');

    // Verify composites mapping
    expect(manifestSec.composites?.['paint:brand']).toBe('brandPrimaryPaint');
    expect(manifestSec.composites?.['effect:elevation_low']).toBe('elevationLowShadow');
    expect(manifestSec.composites?.['text:heading_large']).toBe('headingLarge');

    // Verify figmaNames mapping
    expect(manifestSec.figmaNames?.collections).toEqual({
      'col:primitives': '01_Colors_Primitive',
      'col:tokens': '02_Theme_Tokens',
    });
    expect(manifestSec.figmaNames?.variables?.['var:bg_primary']).toBe('background/primary');
    expect(manifestSec.figmaNames?.composites).toEqual({
      'paint:brand': 'Brand / Primary Paint',
      'effect:elevation_low': 'Elevation / Low Shadow',
      'text:heading_large': 'Typography / Heading Large',
    });

    // Verify emit generates non-empty files
    const emitted = reactNativeTarget.emit(prepared);
    expect(emitted.length).toBeGreaterThan(0);
    for (const f of emitted) {
      expect(f.path.length).toBeGreaterThan(0);
      expect(f.contents.length).toBeGreaterThan(0);
    }
  });

  it('preserves pinned stable identifiers across re-exports when Figma names change', () => {
    const originalIR = createIntegrationTestIR();
    const graph1 = buildSemanticGraph(originalIR);

    const flutterFirst = flutterTarget.prepare(graph1, null);
    const rnFirst = reactNativeTarget.prepare(graph1, null);

    const manifest: Manifest = {
      version: '2.0',
      fileKey: 'toolkit-test-file',
      lastExportedAt: '2026-10-21T00:00:00.000Z',
      targets: {
        flutter: flutterFirst.nextManifestSection,
        react_native: rnFirst.nextManifestSection,
      },
    };

    // Simulate renaming in Figma
    const renamedIR = createIntegrationTestIR();
    // Rename var:bg_primary from background/primary to background/renamed_accent
    renamedIR.collections[1].variables[0].figmaName = 'background/renamed_accent';
    renamedIR.collections[1].variables[0].groupPath = ['background', 'renamed_accent'];

    const graph2 = buildSemanticGraph(renamedIR);

    const flutterSecond = flutterTarget.prepare(graph2, manifest.targets.flutter);
    const rnSecond = reactNativeTarget.prepare(graph2, manifest.targets.react_native);

    // Both targets must preserve the pinned stable identifier 'primary' for var:bg_primary
    expect(flutterSecond.nextManifestSection.variables['var:bg_primary']).toBe('primary');
    expect(rnSecond.nextManifestSection.variables['var:bg_primary']).toBe('primary');

    // Emitting both targets succeeds
    expect(flutterTarget.emit(flutterSecond).length).toBeGreaterThan(0);
    expect(reactNativeTarget.emit(rnSecond).length).toBeGreaterThan(0);
  });
});
