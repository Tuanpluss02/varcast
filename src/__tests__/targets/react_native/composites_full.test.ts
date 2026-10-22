/**
 * Full composite emission tests.
 * Covers linear gradient stops, multiple drop shadows, and
 * text styles with explicit letterSpacing / lineHeight values.
 */

import { describe, expect, it } from 'vitest';
import { runEngine } from '../../../core/emit_engine';
import type { IR } from '../../../ir/types';
import { reactNativeTarget } from '../../../targets/react_native';

function fileMap(files: { path: string; contents: string }[]) {
  const m = new Map<string, string>();
  for (const f of files) m.set(f.path, f.contents);
  return m;
}

/** Minimal IR with a single-mode collection so composites have a mode context. */
function baseCollections(): IR['collections'] {
  return [
    {
      id: 'col:base',
      name: 'Base',
      kind: 'primitive',
      modes: [{ id: 'm:base', name: 'Base' }],
      variables: [],
    },
  ];
}


describe('Linear Gradient with 2+ stops emits correct colorStyles.ts', () => {
  const ir: IR = {
    version: '1.0',
    fileKey: 'k',
    generatedAt: new Date(0).toISOString(),
    collections: baseCollections(),
    composites: {
      paintStyles: [
        {
          id: 'P:grad',
          figmaName: 'Brand/Gradient',
          groupPath: ['Brand', 'Gradient'],
          type: 'GRADIENT_LINEAR',
          angleRadians: Math.PI / 4,
          stops: [
            { position: 0, color: { kind: 'literal', rgba: { r: 1, g: 0, b: 0, a: 1 } } },
            { position: 0.5, color: { kind: 'literal', rgba: { r: 0, g: 1, b: 0, a: 1 } } },
            { position: 1, color: { kind: 'literal', rgba: { r: 0, g: 0, b: 1, a: 1 } } },
          ],
        },
      ],
      effectStyles: [],
      textStyles: [],
    },
  };

  const out = runEngine(ir, [reactNativeTarget], null, { react_native: { packageName: 'ds' } });
  const files = fileMap(out.files);

  it('emits colorStyles.ts', () => {
    expect(files.has('src/composites/colorStyles.ts')).toBe(true);
  });

  it('places linear gradient in the unsupported bucket with type GRADIENT_LINEAR', () => {
    const content = files.get('src/composites/colorStyles.ts')!;
    expect(content).toContain('"unsupported"');
    expect(content).toContain('"GRADIENT_LINEAR"');
  });

  it('exports colorStyles const', () => {
    const content = files.get('src/composites/colorStyles.ts')!;
    expect(content).toContain('export const colorStyles =');
  });
});


describe('Drop Shadow — multiple shadows emit correctly into shadows.ts', () => {
  const ir: IR = {
    version: '1.0',
    fileKey: 'k',
    generatedAt: new Date(0).toISOString(),
    collections: baseCollections(),
    composites: {
      paintStyles: [],
      effectStyles: [
        {
          id: 'E:sm',
          figmaName: 'Elevation/Small',
          groupPath: ['Elevation', 'Small'],
          type: 'DROP_SHADOW',
          color: { kind: 'literal', rgba: { r: 0, g: 0, b: 0, a: 0.12 } },
          offsetX: 0,
          offsetY: 1,
          blurRadius: 4,
          spreadRadius: 0,
        },
        {
          id: 'E:lg',
          figmaName: 'Elevation/Large',
          groupPath: ['Elevation', 'Large'],
          type: 'DROP_SHADOW',
          color: { kind: 'literal', rgba: { r: 0, g: 0, b: 0, a: 0.5 } },
          offsetX: 0,
          offsetY: 8,
          blurRadius: 24,
          spreadRadius: 0,
        },
      ],
      textStyles: [],
    },
  };

  const out = runEngine(ir, [reactNativeTarget], null, { react_native: { packageName: 'ds' } });
  const files = fileMap(out.files);
  const shadow = files.get('src/composites/shadows.ts')!;

  it('emits shadows.ts', () => {
    expect(shadow).toBeDefined();
  });

  it('exports shadows const', () => {
    expect(shadow).toContain('export const shadows =');
  });

  it('places both shadows in the drop bucket', () => {
    expect(shadow).toContain('"drop"');
    expect(shadow).toContain('"elevationSmall"');
    expect(shadow).toContain('"elevationLarge"');
  });

  it('small shadow has correct shadowRadius', () => {
    expect(shadow).toContain('"shadowRadius": 4');
  });

  it('small shadow has correct shadowOffset height', () => {
    expect(shadow).toContain('"height": 1');
  });

  it('large shadow has correct blurRadius', () => {
    expect(shadow).toContain('"shadowRadius": 24');
  });

  it('large shadow has correct shadowOffset height', () => {
    expect(shadow).toContain('"height": 8');
  });

  it('large shadow hex encodes 0.5 alpha as #00000080', () => {
    expect(shadow).toContain('#00000080');
  });

  it('small shadow shadowOpacity is derived from the alpha channel (around 0.12)', () => {
    const parsed = JSON.parse(
      shadow.replace(/.*export const shadows = /s, '').replace(/ as const;[\s\S]*/s, '').trim(),
    );
    const opacity: number = parsed.drop.elevationSmall.baseMode.shadowOpacity;
    expect(opacity).toBeGreaterThan(0);
    expect(opacity).toBeLessThan(0.2);
  });
});


describe('Text styles with letterSpacing and lineHeight round-trip correctly', () => {
  const ir: IR = {
    version: '1.0',
    fileKey: 'k',
    generatedAt: new Date(0).toISOString(),
    collections: baseCollections(),
    composites: {
      paintStyles: [],
      effectStyles: [],
      textStyles: [
        {
          id: 'T:heading',
          figmaName: 'Heading/H1',
          groupPath: ['Heading', 'H1'],
          fontFamily: { kind: 'literal', value: 'Roboto' },
          fontSize: { kind: 'literal', value: 32 },
          fontWeight: { kind: 'literal', value: 700 },
          lineHeight: { kind: 'literal', value: 40, unit: 'PIXELS' },
          letterSpacing: { kind: 'literal', value: -0.5, unit: 'PIXELS' },
        },
        {
          id: 'T:body',
          figmaName: 'Body/Regular',
          groupPath: ['Body', 'Regular'],
          fontFamily: { kind: 'literal', value: 'Inter' },
          fontSize: { kind: 'literal', value: 16 },
          fontWeight: { kind: 'literal', value: 400 },
          lineHeight: { kind: 'literal', value: 150, unit: 'PERCENT' },
          letterSpacing: { kind: 'literal', value: 5, unit: 'PERCENT' },
        },
      ],
    },
  };

  const out = runEngine(ir, [reactNativeTarget], null, { react_native: { packageName: 'ds' } });
  const files = fileMap(out.files);
  const ts = files.get('src/composites/textStyles.ts')!;

  function parsedTextStyles() {
    return JSON.parse(
      ts.replace(/.*export const textStyles = /s, '').replace(/ as const;[\s\S]*/s, '').trim(),
    );
  }

  it('emits textStyles.ts', () => {
    expect(ts).toBeDefined();
  });

  it('exports textStyles const', () => {
    expect(ts).toContain('export const textStyles =');
  });

  it('Heading H1 — lineHeight PIXELS emits the raw pixel value 40', () => {
    const style = parsedTextStyles().Heading.h1.baseMode;
    expect(style.lineHeight).toBe(40);
  });

  it('Heading H1 — letterSpacing PIXELS emits the raw pixel value -0.5', () => {
    const style = parsedTextStyles().Heading.h1.baseMode;
    expect(style.letterSpacing).toBe(-0.5);
  });

  it('Body Regular — lineHeight PERCENT 150% of 16px resolves to 24', () => {
    const style = parsedTextStyles().Body.regular.baseMode;
    expect(style.lineHeight).toBeCloseTo(24, 5);
  });

  it('Body Regular — letterSpacing PERCENT 5% of 16px resolves to 0.8', () => {
    const style = parsedTextStyles().Body.regular.baseMode;
    expect(style.letterSpacing).toBeCloseTo(0.8, 5);
  });

  it('fontWeight 700 is emitted as the string "700"', () => {
    expect(ts).toContain('"fontWeight": "700"');
  });
});
