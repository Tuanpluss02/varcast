// Materializes the generated data modules + `build-theme.ts` into a real JS
// module via esbuild and exercises `buildTheme(opts)` to verify the
// runtime resolver (axis-driven mode lookup + alias resolution +
// cross-axis aliases).

import { transformSync } from 'esbuild';
import { describe, expect, it } from 'vitest';
import { runEngine } from '../../../../core/emit_engine';
import type { IR } from '../../../../ir/types';
import { reactNativeTarget } from '../../../../targets/react_native';

function fileMap(files: { path: string; contents: string }[]) {
  const m = new Map<string, string>();
  for (const f of files) m.set(f.path, f.contents);
  return m;
}

/**
 * Compile a generated TS file to CommonJS via esbuild and `eval` it inside a
 * fresh module scope. We rewire relative imports (`./data`, `./build-theme`)
 * to module references the harness controls.
 */
function evalGenerated(
  src: string,
  imports: Record<string, unknown> = {},
): Record<string, unknown> {
  const { code } = transformSync(src, {
    loader: 'ts',
    format: 'cjs',
    target: 'es2020',
  });
  const moduleObj: any = { exports: {} };
  const requireFn = (name: string) => {
    if (name in imports) return imports[name];
    // The generated raw.ts imports `react-native` for a TextStyle type only;
    // at runtime nothing is read from it. Stub with an empty object.
    if (name === 'react-native') return {};
    if (name === 'react-native-unistyles') {
      return {
        UnistylesRuntime: {
          themeName: 'light',
          updateTheme() {
            // overwritten by individual tests when needed
          },
        },
      };
    }
    throw new Error(`Unexpected require('${name}') from generated code`);
  };
  // eslint-disable-next-line no-new-func
  const fn = new Function('module', 'exports', 'require', code);
  fn(moduleObj, moduleObj.exports, requireFn);
  return moduleObj.exports;
}

function loadGenerated(files: Map<string, string>): {
  buildTheme: (opts?: any) => any;
  getDesignSystemModes: () => any;
  setDesignSystemModes: (opts: any) => any;
  setBrandMode: (mode: any) => any;
  themes: Record<string, any>;
  runtime: { themeName?: string; updateTheme: (name: string, updater: (theme: any) => any) => void };
} {
  const modeCollection = evalGenerated(files.get('src/collections/mode.ts')!);
  const brandCollection = evalGenerated(files.get('src/collections/brand.ts')!);
  const data = evalGenerated(files.get('src/data/index.ts')!, {
    '../collections/mode': modeCollection,
    '../collections/brand': brandCollection,
  });
  const textStyles = evalGenerated(files.get('src/composites/text-styles.ts')!);
  const shadows = evalGenerated(files.get('src/composites/shadows.ts')!);
  const colorStyles = evalGenerated(files.get('src/composites/color-styles.ts')!);
  const runtime = {
    themeName: 'light' as string | undefined,
    updateTheme(_name: string, _updater: (theme: any) => any) {},
  };
  const bt = evalGenerated(files.get('src/build-theme.ts')!, {
    './data': data,
    './composites/text-styles': textStyles,
    './composites/shadows': shadows,
    './composites/color-styles': colorStyles,
    'react-native-unistyles': { UnistylesRuntime: runtime },
  });
  const themes = evalGenerated(files.get('src/themes.ts')!, { './build-theme': bt });
  return {
    buildTheme: bt.buildTheme as any,
    getDesignSystemModes: bt.getDesignSystemModes as any,
    setDesignSystemModes: bt.setDesignSystemModes as any,
    setBrandMode: bt.setBrandMode as any,
    themes: themes as any,
    runtime,
  };
}

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
            id: 'v:bg',
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
            valuesByMode: {
              'm:light': { kind: 'alias', targetVariableId: 'v:brand500' },
              'm:dark': { kind: 'alias', targetVariableId: 'v:brand500' },
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
            id: 'v:brand500',
            figmaName: 'colors/brand/default500',
            groupPath: ['colors', 'brand', 'default500'],
            type: 'COLOR',
            scopes: ['ALL_FILLS'],
            hiddenFromPublishing: false,
            emitToPublic: true,
            valuesByMode: {
              // Use neat hex values so assertions stay readable.
              'b:blue': { kind: 'literal', value: { r: 0, g: 0, b: 1, a: 1 } },
              'b:purple': { kind: 'literal', value: { r: 0.5, g: 0, b: 0.5, a: 1 } },
            },
          },
        ],
      },
    ],
    composites: { paintStyles: [], effectStyles: [], textStyles: [] },
  };
}

describe('Unistyles flavor — runtime buildTheme', () => {
  const out = runEngine(multiAxisIR(), [reactNativeTarget], null, {
    react_native: { flavor: 'unistyles', packageName: 'ds-uni' },
  });
  const generated = loadGenerated(fileMap(out.files));
  const { buildTheme, themes } = generated;

  it('builds a collection-rooted tree from all collections', () => {
    const t = buildTheme();
    expect(t.mode.colorsBackgroundPrimary).toBeDefined();
    expect(t.mode.colorsTextBrand).toBeDefined();
    expect(t.brand.colorsBrandDefault500).toBeDefined();
  });

  it('axis switch on `mode` flips axis-owned values', () => {
    expect(buildTheme({ mode: 'light' }).mode.colorsBackgroundPrimary).toBe('#FFFFFFFF');
    expect(buildTheme({ mode: 'dark' }).mode.colorsBackgroundPrimary).toBe('#000000FF');
  });

  it('cross-axis alias respects the target axis at runtime', () => {
    expect(buildTheme({ brand: 'blue' }).mode.colorsTextBrand).toBe('#0000FFFF');
    expect(buildTheme({ brand: 'purple' }).mode.colorsTextBrand).toBe('#800080FF');
    // Alias should not depend on the mode axis (textBrand aliases brand500
    // which only varies along the `brand` axis).
    expect(buildTheme({ mode: 'dark', brand: 'purple' }).mode.colorsTextBrand).toBe('#800080FF');
  });

  it('exposes light + dark as named exports computed from defaults', () => {
    expect(themes.light.mode.colorsBackgroundPrimary).toBe('#FFFFFFFF');
    expect(themes.dark.mode.colorsBackgroundPrimary).toBe('#000000FF');
  });

  it('updates the active Unistyles theme when generated mode setters are called', () => {
    const updates: Array<{ name: string; theme: any }> = [];
    generated.runtime.updateTheme = (name, updater) => {
      updates.push({ name, theme: updater({}) });
    };

    const next = generated.setDesignSystemModes({ mode: 'dark', brand: 'purple' });
    expect(next.mode.colorsBackgroundPrimary).toBe('#000000FF');
    expect(next.mode.colorsTextBrand).toBe('#800080FF');
    expect(updates[0].name).toBe('light');
    expect(updates[0].theme.mode.colorsTextBrand).toBe('#800080FF');
    expect(generated.getDesignSystemModes()).toEqual({ mode: 'dark', brand: 'purple' });

    generated.setBrandMode('blue');
    expect(updates[1].theme.mode.colorsTextBrand).toBe('#0000FFFF');
  });
});
