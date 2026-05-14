// Regression guard: Figma's plugin sandbox rejects any source code that
// contains the literal substring `import(` (it conservatively flags
// dynamic-import expressions even inside string literals). The NativeWind
// preset emitter previously emitted a `/** @type {import("tailwindcss")
// .Config} */` JSDoc tag whose substring slipped through esbuild's
// constant-folder and broke the built plugin at runtime.
//
// This test asserts that no generated NativeWind file ships the forbidden
// substring. If you add a new emitter, keep it free of the pattern.

import { describe, expect, it } from 'vitest';
import { runEngine } from '../../../../core/emit_engine';
import type { IR } from '../../../../ir/types';
import { reactNativeTarget } from '../../../../targets/react_native';

function tinyIR(): IR {
  return {
    version: '1.0',
    fileKey: 'k',
    generatedAt: new Date(0).toISOString(),
    collections: [
      {
        id: 'c:1',
        name: 'Mode',
        kind: 'token',
        modes: [
          { id: 'm:l', name: 'Light' },
          { id: 'm:d', name: 'Dark' },
        ],
        variables: [
          {
            id: 'v:1',
            figmaName: 'bg/primary',
            groupPath: ['bg', 'primary'],
            type: 'COLOR',
            scopes: ['ALL_FILLS'],
            hiddenFromPublishing: false,
            emitToPublic: true,
            valuesByMode: {
              'm:l': { kind: 'literal', value: { r: 1, g: 1, b: 1, a: 1 } },
              'm:d': { kind: 'literal', value: { r: 0, g: 0, b: 0, a: 1 } },
            },
          },
        ],
      },
    ],
    composites: {
      paintStyles: [],
      effectStyles: [
        {
          id: 'e:1',
          figmaName: 'shadow/md',
          groupPath: ['shadow', 'md'],
          type: 'DROP_SHADOW',
          color: { kind: 'literal', rgba: { r: 0, g: 0, b: 0, a: 0.25 } },
          offsetX: 0,
          offsetY: 2,
          blurRadius: 4,
          spreadRadius: 0,
        },
      ],
      textStyles: [
        {
          id: 't:1',
          figmaName: 'heading/h1',
          groupPath: ['heading', 'h1'],
          fontFamily: { kind: 'literal', value: 'Inter' },
          fontSize: { kind: 'literal', value: 24 },
          fontWeight: { kind: 'literal', value: 600 },
          lineHeight: { kind: 'literal', value: 32, unit: 'PIXELS' },
          letterSpacing: { kind: 'literal', value: 0, unit: 'PIXELS' },
        },
      ],
    },
  };
}

describe('NativeWind flavor — sandbox-safe output', () => {
  it('no emitted file contains the forbidden `import(` substring', () => {
    const out = runEngine(tinyIR(), [reactNativeTarget], null, {
      react_native: { flavor: 'nativewind', packageName: 'ds' },
    });
    for (const f of out.files) {
      expect(f.contents.includes('import('), `file ${f.path} contains import(`).toBe(false);
    }
  });
});
