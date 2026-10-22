import { describe, it, expect } from 'vitest';
import type { IR } from '../../ir/types';
import { runEngine } from '../../core/emit_engine';
import { prepareIR as prepareFlutterIR } from '../../targets/flutter/generator/prepare';
import { flutterTarget } from '../../targets/flutter';
import { prepareRN } from '../../targets/react_native/generator/prepare';
import { reactNativeTarget } from '../../targets/react_native';
import { diffManifestForTarget } from '../../core/manifest/diff';
import { buildSemanticGraph } from '../../core/graph/build_graph';

function createTestIR(overrides?: {
  paintFigmaName?: string;
  effectFigmaName?: string;
  textFigmaName?: string;
}): IR {
  return {
    version: '1.0',
    fileKey: 'test_file_key',
    generatedAt: new Date(0).toISOString(),
    collections: [
      {
        id: 'col_1',
        name: 'Colors',
        kind: 'primitive',
        modes: [{ id: 'm_1', name: 'Default' }],
        variables: [
          {
            id: 'var_1',
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
    composites: {
      paintStyles: [
        {
          id: 'paint_123',
          figmaName: overrides?.paintFigmaName ?? 'Brand / Primary Old',
          groupPath: ['Brand', 'Primary Old'],
          type: 'SOLID',
          color: { kind: 'literal', rgba: { r: 1, g: 0, b: 0, a: 1 } },
        },
      ],
      effectStyles: [
        {
          id: 'effect_456',
          figmaName: overrides?.effectFigmaName ?? 'Elevation / Low Old',
          groupPath: ['Elevation', 'Low Old'],
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
          id: 'text_789',
          figmaName: overrides?.textFigmaName ?? 'Typography / Heading Old',
          groupPath: ['Typography', 'Heading Old'],
          fontSize: { kind: 'literal', value: 24 },
          fontFamily: { kind: 'literal', value: 'Inter' },
          fontWeight: { kind: 'literal', value: 700 },
          lineHeight: { kind: 'literal', value: 32, unit: 'PIXELS' },
          letterSpacing: { kind: 'literal', value: 0, unit: 'PIXELS' },
        },
      ],
    },
  };
}

describe('Composites in Manifest — Flutter', () => {
  it('records composites and figmaNames in nextManifestSection on first export (null manifest)', () => {
    const ir = createTestIR();
    const prepared = prepareFlutterIR(ir, null);

    expect(prepared.nextManifestSection.composites).toBeDefined();
    expect(prepared.nextManifestSection.composites).toEqual({
      paint_123: 'brandPrimaryOld',
      effect_456: 'elevationLowOld',
      text_789: 'typographyHeadingOld',
    });

    expect(prepared.nextManifestSection.figmaNames?.composites).toEqual({
      paint_123: 'Brand / Primary Old',
      effect_456: 'Elevation / Low Old',
      text_789: 'Typography / Heading Old',
    });

    const engineOut = runEngine(ir, [flutterTarget], null);
    expect(engineOut.nextManifest.targets.flutter.composites).toEqual(
      prepared.nextManifestSection.composites,
    );
  });

  it('preserves previously pinned getterName across re-exports when Figma style is renamed', () => {
    const initialIR = createTestIR({
      paintFigmaName: 'Brand / Primary Old',
      effectFigmaName: 'Elevation / Low Old',
      textFigmaName: 'Typography / Heading Old',
    });
    const firstExport = runEngine(initialIR, [flutterTarget], null);

    // Re-export with renamed Figma style names
    const renamedIR = createTestIR({
      paintFigmaName: 'Brand / Primary New Renamed',
      effectFigmaName: 'Elevation / Low New Renamed',
      textFigmaName: 'Typography / Heading New Renamed',
    });

    // 1. Pass the full manifest to engine
    const secondExportWithManifest = runEngine(renamedIR, [flutterTarget], firstExport.nextManifest);
    const flutterSec = secondExportWithManifest.nextManifest.targets.flutter;
    expect(flutterSec.composites).toEqual({
      paint_123: 'brandPrimaryOld',
      effect_456: 'elevationLowOld',
      text_789: 'typographyHeadingOld',
    });
    expect(flutterSec.figmaNames?.composites).toEqual({
      paint_123: 'Brand / Primary New Renamed',
      effect_456: 'Elevation / Low New Renamed',
      text_789: 'Typography / Heading New Renamed',
    });

    // 2. Pass just the manifest section to prepareFlutterIR
    const secondExportWithSection = prepareFlutterIR(renamedIR, firstExport.nextManifest.targets.flutter);
    expect(secondExportWithSection.paintStyles[0].getterName).toBe('brandPrimaryOld');
    expect(secondExportWithSection.effectStyles[0].getterName).toBe('elevationLowOld');
    expect(secondExportWithSection.textStyles[0].getterName).toBe('typographyHeadingOld');

    // 3. Verify manifest diff detects renames
    const diff = diffManifestForTarget(firstExport.nextManifest, secondExportWithManifest.nextManifest, 'flutter');
    expect(diff.composites.renamed).toEqual([
      {
        id: 'paint_123',
        name: 'brandPrimaryOld',
        oldFigmaName: 'Brand / Primary Old',
        newFigmaName: 'Brand / Primary New Renamed',
      },
      {
        id: 'effect_456',
        name: 'elevationLowOld',
        oldFigmaName: 'Elevation / Low Old',
        newFigmaName: 'Elevation / Low New Renamed',
      },
      {
        id: 'text_789',
        name: 'typographyHeadingOld',
        oldFigmaName: 'Typography / Heading Old',
        newFigmaName: 'Typography / Heading New Renamed',
      },
    ]);
    expect(diff.composites.added).toHaveLength(0);
    expect(diff.composites.removed).toHaveLength(0);
  });

  it('flutterTarget.prepare integrates nextManifestSection with composites', () => {
    const ir = createTestIR();
    const result = flutterTarget.prepare(buildSemanticGraph(ir), null);

    expect(result.nextManifestSection.composites).toEqual({
      paint_123: 'brandPrimaryOld',
      effect_456: 'elevationLowOld',
      text_789: 'typographyHeadingOld',
    });
  });
});

describe('Composites in Manifest — React Native', () => {
  it('records composites and figmaNames in nextManifestSection on first export (null manifest)', () => {
    const ir = createTestIR();
    const prepared = prepareRN(ir, null);

    expect(prepared.nextManifestSection.composites).toBeDefined();
    expect(prepared.nextManifestSection.composites).toEqual({
      paint_123: 'brandPrimaryOld',
      effect_456: 'elevationLowOld',
      text_789: 'headingOld',
    });

    expect(prepared.nextManifestSection.figmaNames?.composites).toEqual({
      paint_123: 'Brand / Primary Old',
      effect_456: 'Elevation / Low Old',
      text_789: 'Typography / Heading Old',
    });

    const engineOut = runEngine(ir, [reactNativeTarget], null);
    expect(engineOut.nextManifest?.targets.react_native.composites).toEqual(
      prepared.nextManifestSection.composites,
    );
  });

  it('preserves previously pinned getterName across re-exports when Figma style is renamed', () => {
    const initialIR = createTestIR({
      paintFigmaName: 'Brand / Primary Old',
      effectFigmaName: 'Elevation / Low Old',
      textFigmaName: 'Typography / Heading Old',
    });
    const firstExport = runEngine(initialIR, [reactNativeTarget], null);

    // Re-export with renamed Figma style names
    const renamedIR = createTestIR({
      paintFigmaName: 'Brand / Primary New Renamed',
      effectFigmaName: 'Elevation / Low New Renamed',
      textFigmaName: 'Typography / Heading New Renamed',
    });

    // 1. Pass the full manifest to engine
    const secondExportWithManifest = runEngine(renamedIR, [reactNativeTarget], firstExport.nextManifest);
    const rnSec = secondExportWithManifest.nextManifest.targets.react_native;
    expect(rnSec.composites).toEqual({
      paint_123: 'brandPrimaryOld',
      effect_456: 'elevationLowOld',
      text_789: 'headingOld',
    });
    expect(rnSec.figmaNames?.composites).toEqual({
      paint_123: 'Brand / Primary New Renamed',
      effect_456: 'Elevation / Low New Renamed',
      text_789: 'Typography / Heading New Renamed',
    });

    // 2. Pass just the manifest section to prepareRN
    const secondExportWithSection = prepareRN(renamedIR, firstExport.nextManifest.targets.react_native);
    expect(secondExportWithSection.paintStyles[0].getterName).toBe('brandPrimaryOld');
    expect(secondExportWithSection.effectStyles[0].getterName).toBe('elevationLowOld');
    expect(secondExportWithSection.textStyles[0].getterName).toBe('headingOld');

    // 3. Verify manifest diff detects renames
    const diff = diffManifestForTarget(firstExport.nextManifest!, secondExportWithManifest.nextManifest!, 'react_native');
    expect(diff.composites.renamed).toEqual([
      {
        id: 'paint_123',
        name: 'brandPrimaryOld',
        oldFigmaName: 'Brand / Primary Old',
        newFigmaName: 'Brand / Primary New Renamed',
      },
      {
        id: 'effect_456',
        name: 'elevationLowOld',
        oldFigmaName: 'Elevation / Low Old',
        newFigmaName: 'Elevation / Low New Renamed',
      },
      {
        id: 'text_789',
        name: 'headingOld',
        oldFigmaName: 'Typography / Heading Old',
        newFigmaName: 'Typography / Heading New Renamed',
      },
    ]);
    expect(diff.composites.added).toHaveLength(0);
    expect(diff.composites.removed).toHaveLength(0);
  });

  it('reactNativeTarget.prepare integrates nextManifestSection with composites', () => {
    const ir = createTestIR();
    const result = reactNativeTarget.prepare(buildSemanticGraph(ir), null);

    expect(result.nextManifestSection.composites).toEqual({
      paint_123: 'brandPrimaryOld',
      effect_456: 'elevationLowOld',
      text_789: 'headingOld',
    });
  });

  it('guarantees stable pinned composite getter is not renamed when a new colliding style appears earlier in array', () => {
    const baseIR = createTestIR();
    // Suppose in manifest, paint_123 is pinned to 'primary'
    const manifestSection = {
      variables: {},
      collections: {},
      composites: {
        paint_123: 'primary',
      },
    };

    // A designer adds a NEW paint style before paint_123, whose derived name is also 'primary'
    const irWithNewFirst: IR = {
      ...baseIR,
      composites: {
        ...baseIR.composites,
        paintStyles: [
          {
            id: 'paint_new',
            figmaName: 'Primary',
            groupPath: ['Primary'],
            type: 'SOLID',
            color: { kind: 'literal', rgba: { r: 0, g: 0, b: 1, a: 1 } },
          },
          ...baseIR.composites.paintStyles, // paint_123 comes second
        ],
      },
    };

    const flutterPrepared = prepareFlutterIR(irWithNewFirst, manifestSection);
    const flutterStable = flutterPrepared.paintStyles.find((p) => p.id === 'paint_123');
    const flutterNew = flutterPrepared.paintStyles.find((p) => p.id === 'paint_new');
    expect(flutterStable?.getterName).toBe('primary');
    expect(flutterNew?.getterName).toBe('primary2');

    const rnPrepared = prepareRN(irWithNewFirst, manifestSection);
    const rnStable = rnPrepared.paintStyles.find((p) => p.id === 'paint_123');
    const rnNew = rnPrepared.paintStyles.find((p) => p.id === 'paint_new');
    expect(rnStable?.getterName).toBe('primary');
    expect(rnNew?.getterName).toBe('primary2');
  });
});
