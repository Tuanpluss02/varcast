// Tests for React Native collection-based output structure.
// Verifies that:
// 1. NativeWind preset uses collection-based class names
// 2. Unistyles themes organized by collection
// 3. Alias references preserved in JS/TS output

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

describe('NativeWind collection-based output', () => {
  const out = runEngine(collectionBasedIR(), [reactNativeTarget], null, {
    react_native: { flavor: 'nativewind', packageName: 'ds-nw' },
  });
  const files = fileMap(out.files);

  it('emits collection-based JS files with collection names', () => {
    // Each collection gets its own file
    expect(files.has('themes/color-basic.js')).toBe(true);
    expect(files.has('themes/color-token.js')).toBe(true);
  });

  it('collection file exports object with collection name', () => {
    const colorBasic = files.get('themes/color-basic.js')!;
    expect(colorBasic).toContain('export const ColorBasic = {');
    expect(colorBasic).toContain("'white':");
    expect(colorBasic).toContain("'neutral-900':");
    expect(colorBasic).toContain('#FFFFFFFF');
  });

  it('collection file preserves alias references as CollectionName.variableName format', () => {
    const colorToken = files.get('themes/color-token.js')!;
    // Alias should be preserved as cross-collection reference
    expect(colorToken).toContain('ColorBasic.neutral900');
  });

  it('emits barrel file exporting all collections', () => {
    const collections = files.get('themes/collections.js')!;
    expect(collections).toContain('ColorBasic');
    expect(collections).toContain('ColorToken');
    expect(collections).toContain("require('./color-basic.js')");
    expect(collections).toContain("require('./color-token.js')");
  });
});

describe('Unistyles collection-based output', () => {
  const out = runEngine(collectionBasedIR(), [reactNativeTarget], null, {
    react_native: { flavor: 'unistyles', packageName: 'ds-uni' },
  });
  const files = fileMap(out.files);

  it('emits collection-based theme files with collection names', () => {
    // Each collection gets its own theme file
    expect(files.has('src/themes/ColorBasic.ts')).toBe(true);
    expect(files.has('src/themes/ColorToken.ts')).toBe(true);
  });

  it('collection theme file exports mode-specific themes', () => {
    const colorToken = files.get('src/themes/ColorToken.ts')!;
    expect(colorToken).toContain('export const ColorTokenLight = {');
    expect(colorToken).toContain('export const ColorTokenDark = {');
  });

  it('single-mode collection emits single theme object', () => {
    const colorBasic = files.get('src/themes/ColorBasic.ts')!;
    // Single-mode collection uses 'BaseMode' suffix
    expect(colorBasic).toContain('export const ColorBasicBaseMode = {');
  });

  it('alias references are preserved with variable ID', () => {
    const colorToken = files.get('src/themes/ColorToken.ts')!;
    // Alias should include the target variable ID
    expect(colorToken).toContain("kind: 'alias'");
    expect(colorToken).toContain('target: "v:neutral900"');
  });
});

describe('Alias resolution across collections', () => {
  it('NativeWind preserves cross-collection alias references', () => {
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

    // NativeWind
    const nwOut = runEngine(ir, [reactNativeTarget], null, {
      react_native: { flavor: 'nativewind', packageName: 'ds-nw' },
    });
    const nwFiles = fileMap(nwOut.files);

    const semantic = nwFiles.get('themes/semantic.js')!;
    expect(semantic).toContain('Primitives.red500');

    // Unistyles
    const uniOut = runEngine(ir, [reactNativeTarget], null, {
      react_native: { flavor: 'unistyles', packageName: 'ds-uni' },
    });
    const uniFiles = fileMap(uniOut.files);

    const uniSemantic = uniFiles.get('src/themes/Semantic.ts')!;
    expect(uniSemantic).toContain("target: \"v:prim-red\"");
  });
});

describe('Collection naming preserved from Figma', () => {
  it('preserves exact collection name as PascalCase', () => {
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

    // NativeWind
    const nwOut = runEngine(ir, [reactNativeTarget], null, {
      react_native: { flavor: 'nativewind', packageName: 'ds-nw' },
    });
    const nwFiles = fileMap(nwOut.files);

    expect(nwFiles.has('themes/my-fancy-collection.js')).toBe(true);
    const collectionFile = nwFiles.get('themes/my-fancy-collection.js')!;
    expect(collectionFile).toContain('export const MyFancyCollection = {');

    // Unistyles
    const uniOut = runEngine(ir, [reactNativeTarget], null, {
      react_native: { flavor: 'unistyles', packageName: 'ds-uni' },
    });
    const uniFiles = fileMap(uniOut.files);

    expect(uniFiles.has('src/themes/MyFancyCollection.ts')).toBe(true);
  });
});
