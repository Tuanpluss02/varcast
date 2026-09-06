/**
 * Emission option flag tests.
 * Verifies that each include flag correctly drops or retains files in the output.
 */

import { describe, expect, it } from 'vitest';
import { runEngine } from '../../../core/emit_engine';
import type { IR } from '../../../ir/types';
import { reactNativeTarget } from '../../../targets/react_native';

function paths(files: { path: string; contents: string }[]) {
  return files.map((f) => f.path);
}

/** IR with one primitive collection, one token collection, and all composite types. */
function fullIR(): IR {
  return {
    version: '1.0',
    fileKey: 'k',
    generatedAt: new Date(0).toISOString(),
    collections: [
      {
        id: 'col:prim',
        name: 'Colors',
        kind: 'primitive',
        modes: [{ id: 'm:base', name: 'Base' }],
        variables: [
          {
            id: 'v:white',
            figmaName: 'white',
            groupPath: ['white'],
            type: 'COLOR',
            scopes: [],
            hiddenFromPublishing: false,
            emitToPublic: true,
            valuesByMode: { 'm:base': { kind: 'literal', value: { r: 1, g: 1, b: 1, a: 1 } } },
          },
        ],
      },
      {
        id: 'col:token',
        name: 'Semantic',
        kind: 'token',
        modes: [
          { id: 'm:light', name: 'Light' },
          { id: 'm:dark', name: 'Dark' },
        ],
        variables: [
          {
            id: 'v:bg',
            figmaName: 'bg',
            groupPath: ['bg'],
            type: 'COLOR',
            scopes: [],
            hiddenFromPublishing: false,
            emitToPublic: true,
            valuesByMode: {
              'm:light': { kind: 'literal', value: { r: 1, g: 1, b: 1, a: 1 } },
              'm:dark': { kind: 'literal', value: { r: 0, g: 0, b: 0, a: 1 } },
            },
          },
        ],
      },
    ],
    composites: {
      paintStyles: [
        {
          id: 'P:1',
          figmaName: 'Brand/Primary',
          groupPath: ['Brand', 'Primary'],
          type: 'SOLID',
          color: { kind: 'literal', rgba: { r: 1, g: 0, b: 0, a: 1 } },
        },
      ],
      effectStyles: [
        {
          id: 'E:1',
          figmaName: 'Elevation/Default',
          groupPath: ['Elevation', 'Default'],
          type: 'DROP_SHADOW',
          color: { kind: 'literal', rgba: { r: 0, g: 0, b: 0, a: 0.3 } },
          offsetX: 0,
          offsetY: 4,
          blurRadius: 8,
          spreadRadius: 0,
        },
      ],
      textStyles: [
        {
          id: 'T:1',
          figmaName: 'Body/Regular',
          groupPath: ['Body', 'Regular'],
          fontFamily: { kind: 'literal', value: 'Inter' },
          fontSize: { kind: 'literal', value: 14 },
          fontWeight: { kind: 'literal', value: 400 },
          lineHeight: { kind: 'literal', value: 20, unit: 'PIXELS' },
          letterSpacing: { kind: 'literal', value: 0, unit: 'PIXELS' },
        },
      ],
    },
  };
}


describe('include.primitives = false drops all primitive collection files', () => {
  const out = runEngine(fullIR(), [reactNativeTarget], null, {
    react_native: {
      packageName: 'ds',
      include: { primitives: false, tokens: true, composites: { colorStyles: true, shadows: true, textStyles: true } },
    },
  });
  const ps = paths(out.files);

  it('does not emit primitive token files', () => {
    const primitiveFiles = ps.filter((p) => p.startsWith('src/tokens/primitives/'));
    expect(primitiveFiles).toHaveLength(0);
  });

  it('still emits token files', () => {
    expect(ps.some((p) => p.startsWith('src/tokens/tokens/'))).toBe(true);
  });

  it('still emits base static files', () => {
    expect(ps).toContain('package.json');
    expect(ps).toContain('src/index.ts');
  });
});


describe('include.tokens = false drops all token collection files', () => {
  const out = runEngine(fullIR(), [reactNativeTarget], null, {
    react_native: {
      packageName: 'ds',
      include: { primitives: true, tokens: false, composites: { colorStyles: true, shadows: true, textStyles: true } },
    },
  });
  const ps = paths(out.files);

  it('does not emit token collection files', () => {
    const tokenFiles = ps.filter((p) => p.startsWith('src/tokens/tokens/'));
    expect(tokenFiles).toHaveLength(0);
  });

  it('still emits primitive files', () => {
    expect(ps.some((p) => p.startsWith('src/tokens/primitives/'))).toBe(true);
  });
});


describe('include.composites.colorStyles = false drops colorStyles.ts', () => {
  const out = runEngine(fullIR(), [reactNativeTarget], null, {
    react_native: {
      packageName: 'ds',
      include: { primitives: true, tokens: true, composites: { colorStyles: false, shadows: true, textStyles: true } },
    },
  });
  const ps = paths(out.files);

  it('does not emit colorStyles.ts', () => {
    expect(ps).not.toContain('src/composites/colorStyles.ts');
  });

  it('still emits shadows.ts', () => {
    expect(ps).toContain('src/composites/shadows.ts');
  });

  it('still emits textStyles.ts', () => {
    expect(ps).toContain('src/composites/textStyles.ts');
  });
});


describe('include.composites.shadows = false drops shadows.ts', () => {
  const out = runEngine(fullIR(), [reactNativeTarget], null, {
    react_native: {
      packageName: 'ds',
      include: { primitives: true, tokens: true, composites: { colorStyles: true, shadows: false, textStyles: true } },
    },
  });
  const ps = paths(out.files);

  it('does not emit shadows.ts', () => {
    expect(ps).not.toContain('src/composites/shadows.ts');
  });

  it('still emits colorStyles.ts', () => {
    expect(ps).toContain('src/composites/colorStyles.ts');
  });

  it('still emits textStyles.ts', () => {
    expect(ps).toContain('src/composites/textStyles.ts');
  });
});


describe('include.composites.textStyles = false drops textStyles.ts', () => {
  const out = runEngine(fullIR(), [reactNativeTarget], null, {
    react_native: {
      packageName: 'ds',
      include: { primitives: true, tokens: true, composites: { colorStyles: true, shadows: true, textStyles: false } },
    },
  });
  const ps = paths(out.files);

  it('does not emit textStyles.ts', () => {
    expect(ps).not.toContain('src/composites/textStyles.ts');
  });

  it('still emits shadows.ts', () => {
    expect(ps).toContain('src/composites/shadows.ts');
  });

  it('still emits colorStyles.ts', () => {
    expect(ps).toContain('src/composites/colorStyles.ts');
  });
});


describe('enabling all options produces the expected full file set', () => {
  const out = runEngine(fullIR(), [reactNativeTarget], null, {
    react_native: {
      packageName: 'ds',
      include: { primitives: true, tokens: true, composites: { colorStyles: true, shadows: true, textStyles: true } },
    },
  });
  const ps = paths(out.files);

  it('emits base static files', () => {
    expect(ps).toContain('package.json');
    expect(ps).toContain('tsconfig.json');
    expect(ps).toContain('README.md');
    expect(ps).toContain('src/index.ts');
    expect(ps).toContain('src/runtime/ThemeProvider.tsx');
    expect(ps).toContain('src/runtime/modes.ts');
    expect(ps).toContain('src/react-shim.d.ts');
  });

  it('emits runtime createTheme.ts', () => {
    expect(ps).toContain('src/runtime/createTheme.ts');
  });

  it('emits primitive collection file', () => {
    expect(ps).toContain('src/tokens/primitives/colors.ts');
  });

  it('emits token collection file', () => {
    expect(ps).toContain('src/tokens/tokens/semantic.ts');
  });

  it('emits all three composite files', () => {
    expect(ps).toContain('src/composites/colorStyles.ts');
    expect(ps).toContain('src/composites/shadows.ts');
    expect(ps).toContain('src/composites/textStyles.ts');
  });
});
