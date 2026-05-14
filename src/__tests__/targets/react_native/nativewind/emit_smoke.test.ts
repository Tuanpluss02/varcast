import { describe, expect, it } from 'vitest';
import { runEngine } from '../../../../core/emit_engine';
import type { IR } from '../../../../ir/types';
import { reactNativeTarget } from '../../../../targets/react_native';

function fileMap(files: { path: string; contents: string }[]) {
  const m = new Map<string, string>();
  for (const f of files) m.set(f.path, f.contents);
  return m;
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
            figmaName: 'background/primary',
            groupPath: ['background', 'primary'],
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
            figmaName: 'text/brand',
            groupPath: ['text', 'brand'],
            type: 'COLOR',
            scopes: ['ALL_FILLS'],
            hiddenFromPublishing: false,
            emitToPublic: true,
            valuesByMode: {
              'm:light': { kind: 'alias', targetVariableId: 'v:brand500' },
              'm:dark': { kind: 'alias', targetVariableId: 'v:brand500' },
            },
          },
          {
            id: 'v:radiusMd',
            figmaName: 'radius/md',
            groupPath: ['radius', 'md'],
            type: 'FLOAT',
            scopes: ['CORNER_RADIUS'],
            hiddenFromPublishing: false,
            emitToPublic: true,
            valuesByMode: {
              'm:light': { kind: 'literal', value: 8 },
              'm:dark': { kind: 'literal', value: 8 },
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
            figmaName: 'brand/default500',
            groupPath: ['brand', 'default500'],
            type: 'COLOR',
            scopes: ['ALL_FILLS'],
            hiddenFromPublishing: false,
            emitToPublic: true,
            valuesByMode: {
              'b:blue': { kind: 'literal', value: { r: 0, g: 0, b: 1, a: 1 } },
              'b:purple': { kind: 'literal', value: { r: 0.5, g: 0, b: 0.5, a: 1 } },
            },
          },
        ],
      },
      {
        id: 'col:primitives',
        name: 'Primitives',
        kind: 'primitive',
        modes: [{ id: 'p:base', name: 'Base' }],
        variables: [
          {
            id: 'v:space4',
            figmaName: 'space/4',
            groupPath: ['space', '4'],
            type: 'FLOAT',
            scopes: ['GAP', 'WIDTH_HEIGHT'],
            hiddenFromPublishing: false,
            emitToPublic: true,
            valuesByMode: { 'p:base': { kind: 'literal', value: 4 } },
          },
        ],
      },
    ],
    composites: { paintStyles: [], effectStyles: [], textStyles: [] },
  };
}

describe('NativeWind flavor — emit smoke', () => {
  const out = runEngine(multiAxisIR(), [reactNativeTarget], null, {
    react_native: { flavor: 'nativewind', packageName: 'ds-nw' },
  });
  const files = fileMap(out.files);

  it('emits the canonical file set', () => {
    const paths = [...files.keys()].sort();
    // Expected: package.json, README.md, tailwind.preset.cjs, src/index.ts,
    // themes/index.{js,d.ts}, themes/{base,light,dark,brand-blue,brand-purple}.{css,vars.js}
    expect(paths).toContain('package.json');
    expect(paths).toContain('README.md');
    expect(paths).toContain('tailwind.preset.cjs');
    expect(paths).toContain('src/index.ts');
    expect(paths).toContain('themes/index.js');
    expect(paths).toContain('themes/index.d.ts');
    expect(paths).toContain('themes/base.css');
    expect(paths).toContain('themes/base.vars.js');
    expect(paths).toContain('themes/light.css');
    expect(paths).toContain('themes/dark.css');
    expect(paths).toContain('themes/brand-blue.css');
    expect(paths).toContain('themes/brand-purple.css');
  });

  it('preset routes color tokens under colors and uses CSS-var references', () => {
    const preset = files.get('tailwind.preset.cjs')!;
    expect(preset).toContain('"colors":');
    expect(preset).toContain('"background":');
    expect(preset).toContain('"primary": "var(--ds-background-primary)"');
    expect(preset).toContain('"text":');
    expect(preset).toContain('"brand": "var(--ds-text-brand)"');
  });

  it('preset routes float tokens via scope-based bucket inference', () => {
    const preset = files.get('tailwind.preset.cjs')!;
    expect(preset).toContain('"borderRadius":');
    expect(preset).toContain('"md": "var(--ds-radius-md)"');
    expect(preset).toContain('"spacing":');
    expect(preset).toContain('"4": "var(--ds-space-4)"');
  });

  it('light.css scopes assignments under [data-theme="light"]', () => {
    const css = files.get('themes/light.css')!;
    expect(css).toContain(':root[data-theme="light"]');
    expect(css).toContain('--ds-background-primary: #FFFFFFFF;');
    // Aliases preserve cross-axis routing as var(--…) references.
    expect(css).toContain('--ds-text-brand: var(--ds-brand-default-500);');
  });

  it('dark.css carries the dark-mode literal', () => {
    const css = files.get('themes/dark.css')!;
    expect(css).toContain('--ds-background-primary: #000000FF;');
  });

  it('brand-blue.css carries the brand-axis literal', () => {
    const css = files.get('themes/brand-blue.css')!;
    expect(css).toContain('--ds-brand-default-500: #0000FFFF;');
  });

  it('base.css holds single-mode primitives under :root', () => {
    const css = files.get('themes/base.css')!;
    expect(css).toContain(':root {');
    expect(css).toContain('--ds-space-4: 4;');
  });

  it('numeric leaves stay as bare digits (no `n` prefix) for JS-friendly keys', () => {
    const preset = files.get('tailwind.preset.cjs')!;
    expect(preset).toContain('"4": "var(--ds-space-4)"');
    expect(preset).not.toContain('"n4":');
  });

  it('themes/index.js aggregates per-axis-mode vars maps (skipping base)', () => {
    const idx = files.get('themes/index.js')!;
    expect(idx).toContain("require('./light.vars.js')");
    expect(idx).toContain("require('./dark.vars.js')");
    expect(idx).toContain("require('./brand-blue.vars.js')");
    expect(idx).not.toContain("require('./base.vars.js')");
    expect(idx).toContain('"light":');
    expect(idx).toContain('"brand-blue":');
  });

  it('themes vars.js uses string keys + values (vars()-compatible)', () => {
    const vars = files.get('themes/dark.vars.js')!;
    expect(vars).toContain('"--ds-background-primary": "#000000FF"');
    expect(vars).toContain('"--ds-text-brand": "var(--ds-brand-default-500)"');
  });
});

describe('NativeWind flavor — composites', () => {
  it('bakes shadow into preset boxShadow + emits .type-* utility per text style', () => {
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
              id: 'v:size16',
              figmaName: 'size/16',
              groupPath: ['size', '16'],
              type: 'FLOAT',
              scopes: ['FONT_SIZE'],
              hiddenFromPublishing: false,
              emitToPublic: true,
              valuesByMode: { 'm:base': { kind: 'literal', value: 16 } },
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
            color: { kind: 'literal', rgba: { r: 0, g: 0, b: 0, a: 0.5 } },
            offsetX: 0,
            offsetY: 2,
            blurRadius: 8,
            spreadRadius: 0,
          },
        ],
        textStyles: [
          {
            id: 't:1',
            figmaName: 'heading/h3',
            groupPath: ['heading', 'h3'],
            fontFamily: { kind: 'literal', value: 'Inter' },
            fontSize: { kind: 'alias', targetVariableId: 'v:size16' },
            fontWeight: { kind: 'literal', value: 500 },
            lineHeight: { kind: 'literal', value: 150, unit: 'PERCENT' },
            letterSpacing: { kind: 'literal', value: 0, unit: 'PIXELS' },
          },
        ],
      },
    };
    const out = runEngine(ir, [reactNativeTarget], null, {
      react_native: { flavor: 'nativewind', packageName: 'ds' },
    });
    const files = fileMap(out.files);
    const preset = files.get('tailwind.preset.cjs')!;
    expect(preset).toContain('boxShadow:');
    expect(preset).toContain('"md": "0px 2px 8px #00000080"');
    expect(preset).toContain("'.type-h3':");
    expect(preset).toContain('fontFamily: "Inter"');
    expect(preset).toContain('fontSize: "16px"');
    expect(preset).toContain('lineHeight: "24px"'); // 150% of 16
  });
});
