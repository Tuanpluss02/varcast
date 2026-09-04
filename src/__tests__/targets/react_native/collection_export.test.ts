// Tests for React Native collection-based output structure.
// Verifies that:
// 1. Collections are placed under src/tokens/primitives/ and src/tokens/tokens/
// 2. Token files export typed collections and mode types
// 3. Alias references are preserved with variable ID

import { describe, expect, it } from 'vitest';
import { runEngine } from '../../../core/emit_engine';
import type { IR } from '../../../ir/types';
import { reactNativeTarget } from '../../../targets/react_native';

function fileMap(files: { path: string; contents: string }[]) {
  const m = new Map<string, string>();
  for (const f of files) m.set(f.path, f.contents);
  return m;
}

// IR with ColorBasic (primitive) and ColorToken (with aliases)
function collectionBasedIR(): IR {
  return {
    version: '1.0',
    fileKey: 'k',
    generatedAt: new Date(0).toISOString(),
    collections: [
      {
        id: 'col:basic',
        name: 'ColorBasic',
        kind: 'primitive',
        modes: [{ id: 'm:base', name: 'Base' }],
        variables: [
          {
            id: 'v:white',
            figmaName: 'white',
            groupPath: ['white'],
            type: 'COLOR',
            scopes: ['ALL_FILLS'],
            hiddenFromPublishing: false,
            emitToPublic: true,
            valuesByMode: { 'm:base': { kind: 'literal', value: { r: 1, g: 1, b: 1, a: 1 } } },
          },
          {
            id: 'v:neutral900',
            figmaName: 'neutral-900',
            groupPath: ['neutral-900'],
            type: 'COLOR',
            scopes: ['ALL_FILLS'],
            hiddenFromPublishing: false,
            emitToPublic: true,
            valuesByMode: { 'm:base': { kind: 'literal', value: { r: 0.1, g: 0.1, b: 0.1, a: 1 } } },
          },
        ],
      },
      {
        id: 'col:token',
        name: 'ColorToken',
        kind: 'token',
        modes: [
          { id: 'm:light', name: 'Light' },
          { id: 'm:dark', name: 'Dark' },
        ],
        variables: [
          {
            id: 'v:heading',
            figmaName: 'text-heading-primary',
            groupPath: ['text', 'heading', 'primary'],
            type: 'COLOR',
            scopes: ['ALL_FILLS'],
            hiddenFromPublishing: false,
            emitToPublic: true,
            valuesByMode: {
              'm:light': { kind: 'alias', targetVariableId: 'v:neutral900' },
              'm:dark': { kind: 'alias', targetVariableId: 'v:neutral900' },
            },
          },
        ],
      },
    ],
    composites: { paintStyles: [], effectStyles: [], textStyles: [] },
  };
}

describe('React Native collection-based output', () => {
  const out = runEngine(collectionBasedIR(), [reactNativeTarget], null, {
    react_native: { packageName: 'ds-rn' },
  });
  const files = fileMap(out.files);

  it('emits collection-based TS files with proper paths', () => {
    expect(files.has('src/tokens/primitives/color-basic.ts')).toBe(true);
    expect(files.has('src/tokens/tokens/color-token.ts')).toBe(true);
  });

  it('collection file exports object with camelCase name and PascalCase type', () => {
    const colorBasic = files.get('src/tokens/primitives/color-basic.ts')!;
    expect(colorBasic).toContain('export const colorBasic =');
    expect(colorBasic).toContain('export type ColorBasicMode =');
    expect(colorBasic).toContain('export type ColorBasic =');
    expect(colorBasic).toContain('"white":');
    expect(colorBasic).toContain('"neutral900":');
  });

  it('collection file preserves alias references in raw data', () => {
    const colorToken = files.get('src/tokens/tokens/color-token.ts')!;
    expect(colorToken).toContain('export const colorToken =');
    expect(colorToken).toContain('export type ColorTokenMode =');
    expect(colorToken).toContain('export type ColorToken =');
    expect(colorToken).toContain('"v:neutral900"');
  });

  it('emits runtime files and package manifest', () => {
    expect(files.has('package.json')).toBe(true);
    expect(files.has('tsconfig.json')).toBe(true);
    expect(files.has('src/index.ts')).toBe(true);
    expect(files.has('src/runtime/createTheme.ts')).toBe(true);
    expect(files.has('src/runtime/modes.ts')).toBe(true);
    expect(files.has('src/runtime/ThemeProvider.tsx')).toBe(true);
  });
});

describe('Alias resolution across collections', () => {
  it('preserves cross-collection alias references with variable ID', () => {
    const ir: IR = {
      version: '1.0',
      fileKey: 'k',
      generatedAt: new Date(0).toISOString(),
      collections: [
        {
          id: 'col:prim',
          name: 'Primitives',
          kind: 'primitive',
          modes: [{ id: 'm:base', name: 'Base' }],
          variables: [
            {
              id: 'v:prim-red',
              figmaName: 'red-500',
              groupPath: ['red-500'],
              type: 'COLOR',
              scopes: ['ALL_FILLS'],
              hiddenFromPublishing: false,
              emitToPublic: true,
              valuesByMode: { 'm:base': { kind: 'literal', value: { r: 1, g: 0, b: 0, a: 1 } } },
            },
          ],
        },
        {
          id: 'col:semantic',
          name: 'Semantic',
          kind: 'token',
          modes: [{ id: 'm:light', name: 'Light' }],
          variables: [
            {
              id: 'v:sem-error',
              figmaName: 'error',
              groupPath: ['error'],
              type: 'COLOR',
              scopes: ['ALL_FILLS'],
              hiddenFromPublishing: false,
              emitToPublic: true,
              valuesByMode: {
                'm:light': { kind: 'alias', targetVariableId: 'v:prim-red' },
              },
            },
          ],
        },
      ],
      composites: { paintStyles: [], effectStyles: [], textStyles: [] },
    };

    const out = runEngine(ir, [reactNativeTarget], null, {
      react_native: { packageName: 'ds-rn' },
    });
    const files = fileMap(out.files);

    const semantic = files.get('src/tokens/tokens/semantic.ts')!;
    expect(semantic).toContain('"v:prim-red"');
  });
});

describe('Collection naming preserved from Figma', () => {
  it('preserves exact collection name as kebab-case file path and PascalCase type', () => {
    const ir: IR = {
      version: '1.0',
      fileKey: 'k',
      generatedAt: new Date(0).toISOString(),
      collections: [
        {
          id: 'col:myCollection',
          name: 'MyFancyCollection',
          kind: 'primitive',
          modes: [{ id: 'm:base', name: 'Base' }],
          variables: [
            {
              id: 'v:myVar',
              figmaName: 'value',
              groupPath: ['value'],
              type: 'COLOR',
              scopes: ['ALL_FILLS'],
              hiddenFromPublishing: false,
              emitToPublic: true,
              valuesByMode: { 'm:base': { kind: 'literal', value: { r: 0, g: 0, b: 0, a: 1 } } },
            },
          ],
        },
      ],
      composites: { paintStyles: [], effectStyles: [], textStyles: [] },
    };

    const out = runEngine(ir, [reactNativeTarget], null, {
      react_native: { packageName: 'ds-rn' },
    });
    const files = fileMap(out.files);

    expect(files.has('src/tokens/primitives/my-fancy-collection.ts')).toBe(true);
    const collectionFile = files.get('src/tokens/primitives/my-fancy-collection.ts')!;
    expect(collectionFile).toContain('export const myFancyCollection =');
    expect(collectionFile).toContain('export type MyFancyCollectionMode =');
    expect(collectionFile).toContain('export type MyFancyCollection =');
  });
});
