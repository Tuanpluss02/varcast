import { describe, expect, it } from 'vitest';
import { runEngine } from '../../../../core/emit_engine';
import type { IR } from '../../../../ir/types';
import { reactNativeTarget } from '../../../../targets/react_native';

function multiAxisIR(): IR {
  return {
    version: '1.0',
    fileKey: 'k',
    generatedAt: new Date(0).toISOString(),
    collections: [
      {
        id: 'col:mode',
        name: 'Mode',
        kind: 'token',
        modes: [
          { id: 'm:light', name: 'Light' },
          { id: 'm:dark', name: 'Dark' },
        ],
        variables: [
          {
            id: 'v:bgPrimary',
            figmaName: 'colors/background/primary',
            groupPath: ['colors', 'background', 'primary'],
            type: 'COLOR',
            scopes: ['ALL_FILLS'],
            hiddenFromPublishing: false,
            emitToPublic: true,
            valuesByMode: {
              'm:light': { kind: 'literal', value: { r: 1, g: 1, b: 1, a: 1 } },
              'm:dark': { kind: 'literal', value: { r: 0, g: 0, b: 0, a: 1 } },
            },
          },
          {
            id: 'v:textBrand',
            figmaName: 'colors/text/brand',
            groupPath: ['colors', 'text', 'brand'],
            type: 'COLOR',
            scopes: ['ALL_FILLS'],
            hiddenFromPublishing: false,
            emitToPublic: true,
            // Aliases the brand collection's default500.
            valuesByMode: {
              'm:light': { kind: 'alias', targetVariableId: 'v:brandDefault' },
              'm:dark': { kind: 'alias', targetVariableId: 'v:brandDefault' },
            },
          },
        ],
      },
      {
        id: 'col:brand',
        name: 'Brand',
        kind: 'token',
        modes: [
          { id: 'b:blue', name: 'Blue' },
          { id: 'b:purple', name: 'Purple' },
        ],
        variables: [
          {
            id: 'v:brandDefault',
            figmaName: 'colors/brand/default500',
            groupPath: ['colors', 'brand', 'default500'],
            type: 'COLOR',
            scopes: ['ALL_FILLS'],
            hiddenFromPublishing: false,
            emitToPublic: true,
            valuesByMode: {
              'b:blue': { kind: 'literal', value: { r: 0.23, g: 0.51, b: 0.96, a: 1 } },
              'b:purple': { kind: 'literal', value: { r: 0.49, g: 0.23, b: 0.93, a: 1 } },
            },
          },
        ],
      },
    ],
    composites: { paintStyles: [], effectStyles: [], textStyles: [] },
  };
}

function fileMap(files: { path: string; contents: string }[]) {
  const m = new Map<string, string>();
  for (const f of files) m.set(f.path, f.contents);
  return m;
}

describe('Unistyles flavor — emit smoke', () => {
  const out = runEngine(multiAxisIR(), [reactNativeTarget], null, {
    react_native: { flavor: 'unistyles', packageName: 'ds-uni' },
  });
  const files = fileMap(out.files);

  it('emits the canonical file set', () => {
    const paths = [...files.keys()].sort();
    expect(paths).toEqual([
      'README.md',
      'package.json',
      'src/build-theme.ts',
      'src/index.ts',
      'src/module-augmentation.d.ts',
      'src/raw.ts',
      'src/themes.ts',
      'src/types.ts',
      'tsconfig.json',
    ]);
  });

  it('package.json declares the unistyles peer dependency', () => {
    expect(files.get('package.json')!).toContain('react-native-unistyles');
  });

  it('emits typed ThemeOptions with both axis unions', () => {
    const types = files.get('src/types.ts')!;
    expect(types).toContain('export interface ThemeOptions');
    expect(types).toContain('mode: "light" | "dark"');
    expect(types).toContain('brand: "blue" | "purple"');
  });

  it('Theme interface mirrors merged groupPath shape', () => {
    const types = files.get('src/types.ts')!;
    // colors namespace appears at the root with nested groups
    expect(types).toMatch(/"colors":\s*\{/);
    expect(types).toMatch(/"background":\s*\{[^}]*"primary":\s*string/);
    expect(types).toMatch(/"brand":\s*\{[^}]*"default500":\s*string/);
  });

  it('exposes light + dark + buildTheme + themes', () => {
    const idx = files.get('src/index.ts')!;
    expect(idx).toContain("export { buildTheme } from './build-theme'");
    expect(idx).toContain("export { light, dark, themes } from './themes'");
  });

  it('themes.ts pre-builds light and dark using the mode axis key', () => {
    const themes = files.get('src/themes.ts')!;
    expect(themes).toContain("buildTheme({ mode: 'light' }");
    expect(themes).toContain("buildTheme({ mode: 'dark' }");
  });

  it('build-theme has a defaults object for every detected axis', () => {
    const bt = files.get('src/build-theme.ts')!;
    expect(bt).toContain('"mode": "light"');
    expect(bt).toContain('"brand": "blue"');
  });

  it('raw.ts encodes alias references with $alias markers', () => {
    const raw = files.get('src/raw.ts')!;
    expect(raw).toContain('$alias');
    expect(raw).toContain('"v:brandDefault"');
  });

  it('module augmentation declares both light and dark for UnistylesThemes', () => {
    const aug = files.get('src/module-augmentation.d.ts')!;
    expect(aug).toContain("declare module 'react-native-unistyles'");
    expect(aug).toContain('light: Theme');
    expect(aug).toContain('dark: Theme');
  });
});

describe('Unistyles flavor — single mode IR', () => {
  it('falls back to a single `theme` export when there is no light/dark axis', () => {
    const ir: IR = {
      version: '1.0',
      fileKey: 'k',
      generatedAt: new Date(0).toISOString(),
      collections: [
        {
          id: 'col:p',
          name: 'Primitives',
          kind: 'primitive',
          modes: [{ id: 'm:base', name: 'Base' }],
          variables: [
            {
              id: 'v:r',
              figmaName: 'spacing/4',
              groupPath: ['spacing', '4'],
              type: 'FLOAT',
              scopes: ['GAP'],
              hiddenFromPublishing: false,
              emitToPublic: true,
              valuesByMode: { 'm:base': { kind: 'literal', value: 4 } },
            },
          ],
        },
      ],
      composites: { paintStyles: [], effectStyles: [], textStyles: [] },
    };
    const out = runEngine(ir, [reactNativeTarget], null, {
      react_native: { flavor: 'unistyles', packageName: 'ds' },
    });
    const files = fileMap(out.files);
    expect(files.get('src/index.ts')!).toContain("export { theme } from './themes'");
    expect(files.get('src/themes.ts')!).toContain('export const theme: Theme = buildTheme()');
    expect(files.get('src/module-augmentation.d.ts')!).toContain('theme: Theme');
  });
});
