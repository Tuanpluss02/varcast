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
      '.npmrc',
      'README.md',
      'package.json',
      'src/build-theme.ts',
      'src/collections/brand.ts',
      'src/collections/mode.ts',
      'src/composites/color-styles.ts',
      'src/composites/shadows.ts',
      'src/composites/text-styles.ts',
      'src/data/index.ts',
      'src/data/types.ts',
      'src/index.ts',
      'src/themes.ts',
      'src/types.ts',
      'tsconfig.json',
    ]);
  });

  it('package.json declares the unistyles peer dependency', () => {
    const pkg = files.get('package.json')!;
    expect(pkg).toContain('react-native-unistyles');
    expect(pkg).toContain('"react-native-unistyles": "^3.0.0"');
  });

  it('package.json ships TypeScript source with no build step', () => {
    const pkg = JSON.parse(files.get('package.json')!);
    expect(pkg.main).toBe('src/index.ts');
    expect(pkg.types).toBe('src/index.ts');
    expect(pkg.files).toEqual(['src']);
    expect(pkg.scripts).toBeUndefined();
    expect(pkg.devDependencies).toBeUndefined();
  });

  it('emits an .npmrc that disables peer auto-install', () => {
    expect(files.get('.npmrc')).toBe('auto-install-peers=false\n');
  });

  it('README documents the Unistyles 3 configuration API', () => {
    const readme = files.get('README.md')!;
    expect(readme).toContain('react-native-unistyles` v3');
    expect(readme).toContain("import { StyleSheet } from 'react-native-unistyles'");
    expect(readme).toContain('StyleSheet.configure({');
    expect(readme).toContain('primary: buildTheme({ mode: "light", brand: "blue" })');
    expect(readme).toContain('alternate: buildTheme({ mode: "dark", brand: "purple" })');
    expect(readme).toContain('pnpm add ds-uni@workspace:*');
    expect(readme).toContain("themes: { designSystem: buildTheme() }");
    expect(readme).toContain("settings: { initialTheme: 'designSystem' }");
    expect(readme).toContain('setDesignSystemModes');
    expect(readme).toContain('setModeMode("dark")');
    expect(readme).toContain('setBrandMode("purple")');
    expect(readme).toContain(
      'Use `adaptiveThemes: true` when the OS should control reserved `light`/`dark` themes',
    );
    expect(readme).toContain('Do not run `pnpm install` inside this folder');
    expect(readme).toContain('TypeScript source under `src/`');
    // Augmentation is consumer-provided; README shows the required snippet.
    expect(readme).toContain('Setup — TypeScript augmentation (required)');
    expect(readme).toContain("declare module 'react-native-unistyles'");
    expect(readme).toContain('Compatibility');
    expect(readme).toContain('Troubleshooting');
    expect(readme).toContain('--install-links');
    // Nitro-modules version is intentionally unpinned now.
    expect(readme).not.toContain('react-native-nitro-modules@0.31.4');
    expect(readme).toContain('expo install react-native-unistyles');
    expect(readme).not.toContain('pnpm build');
    expect(readme).not.toContain('UnistylesRegistry');
    expect(readme).not.toContain('lightBlueRounded');
  });

  it('emits typed ThemeOptions with both axis unions', () => {
    const types = files.get('src/types.ts')!;
    expect(types).toContain('export interface ThemeOptions');
    expect(types).toContain('mode: "light" | "dark"');
    expect(types).toContain('brand: "blue" | "purple"');
  });

  it('Theme interface roots variables by collection to avoid collisions', () => {
    const types = files.get('src/types.ts')!;
    expect(types).toMatch(/"mode":\s*\{/);
    expect(types).toMatch(/"brand":\s*\{/);
    expect(types).toMatch(/"colorsBackgroundPrimary":\s*string/);
    expect(types).toMatch(/"colorsTextBrand":\s*string/);
    expect(types).toMatch(/"colorsBrandDefault500":\s*string/);
  });

  it('exposes light + dark + buildTheme + themes', () => {
    const idx = files.get('src/index.ts')!;
    expect(idx).not.toContain('/// <reference');
    // P0: no side-effect import of types — the package does not augment.
    expect(idx).not.toContain("import './types'");
    expect(idx).toContain('buildTheme');
    expect(idx).toContain('setDesignSystemModes');
    expect(idx).toContain('setModeMode');
    expect(idx).toContain('setBrandMode');
    expect(idx).toContain("export { light, dark, themes } from './themes'");
  });

  it('themes.ts pre-builds light and dark using the mode axis key', () => {
    const themes = files.get('src/themes.ts')!;
    expect(themes).toContain("buildTheme({ mode: 'light' })");
    expect(themes).toContain("buildTheme({ mode: 'dark' })");
    expect(themes).not.toContain('as any');
  });

  it('build-theme has a defaults object for every detected axis', () => {
    const bt = files.get('src/build-theme.ts')!;
    expect(bt).toContain('"mode": "light"');
    expect(bt).toContain('"brand": "blue"');
  });

  it('splits collection data and aggregate indexes into structured files', () => {
    const mode = files.get('src/collections/mode.ts')!;
    const dataIndex = files.get('src/data/index.ts')!;
    expect(mode).toContain('$alias');
    expect(mode).toContain('"v:brandDefault"');
    expect(dataIndex).toContain("from '../collections/mode'");
    expect(dataIndex).toContain("from '../collections/brand'");
    expect(dataIndex).toContain('export const _vars');
    expect(files.get('src/composites/text-styles.ts')!).toContain('export const _textStyles');
  });

  it('types.ts does NOT augment UnistylesThemes — consumer owns that', () => {
    const types = files.get('src/types.ts')!;
    expect(types).not.toContain("declare module 'react-native-unistyles'");
    expect(types).not.toContain('UnistylesThemes');
    // It still exports Theme and ThemeOptions for the consumer-side augmentation.
    expect(types).toContain('export interface Theme');
    expect(types).toContain('export interface ThemeOptions');
  });

  it('Theme types composites as objects keyed by getter name, not Record<string, ...>', () => {
    const types = files.get('src/types.ts')!;
    expect(types).not.toContain('Record<string, TextStyle>');
    expect(types).not.toContain('Record<string, string | null>');
    expect(types).toMatch(/textStyles:\s*\{/);
    expect(types).toMatch(/shadows:\s*\{/);
    expect(types).toMatch(/colorStyles:\s*\{/);
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
    const types = files.get('src/types.ts')!;
    expect(types).not.toContain("declare module 'react-native-unistyles'");
    // README shows consumer how to declare the single `theme` key.
    const readme = files.get('README.md')!;
    expect(readme).toContain('theme: Theme;');
  });
});

describe('Unistyles flavor — collection boundary collisions', () => {
  it('keeps same group/leaf names from different collections reachable', () => {
    const ir: IR = {
      version: '1.0',
      fileKey: 'k',
      generatedAt: new Date(0).toISOString(),
      collections: [
        {
          id: 'col:primitive',
          name: 'All Colors',
          kind: 'primitive',
          modes: [{ id: 'm:base', name: 'Base' }],
          variables: [
            {
              id: 'v:primitive-alpha',
              figmaName: 'alpha/white/100',
              groupPath: ['alpha', 'white', '100'],
              type: 'COLOR',
              scopes: ['ALL_FILLS'],
              hiddenFromPublishing: false,
              emitToPublic: true,
              valuesByMode: {
                'm:base': { kind: 'literal', value: { r: 1, g: 1, b: 1, a: 1 } },
              },
            },
          ],
        },
        {
          id: 'col:semantic',
          name: 'Theme',
          kind: 'token',
          modes: [{ id: 'm:light', name: 'Light' }],
          variables: [
            {
              id: 'v:semantic-alpha',
              figmaName: 'alpha/white/100',
              groupPath: ['alpha', 'white', '100'],
              type: 'COLOR',
              scopes: ['ALL_FILLS'],
              hiddenFromPublishing: false,
              emitToPublic: true,
              valuesByMode: {
                'm:light': { kind: 'literal', value: { r: 0, g: 0, b: 0, a: 1 } },
              },
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
    const types = files.get('src/types.ts')!;
    const allColors = files.get('src/collections/all-colors.ts')!;
    const theme = files.get('src/collections/theme.ts')!;

    expect(types).toMatch(/"allColors":\s*\{[\s\S]*"alphaWhite100":\s*string/);
    expect(types).toMatch(/"theme":\s*\{[\s\S]*"alphaWhite100":\s*string/);
    expect(allColors).toContain('"v:primitive-alpha"');
    expect(theme).toContain('"v:semantic-alpha"');
  });
});
