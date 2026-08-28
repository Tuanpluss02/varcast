// Tests for Flutter collection-based output structure.
// Verifies that:
// 1. Collections are placed under lib/src/collections/<collection_name>/
// 2. Mode files and base files use snake_case naming
// 3. Base class is in main collection file
// 4. Mode classes in separate files for multi-mode collections
// 5. Alias references preserved via AppTheme (static non-context)
// 6. Dynamic collection selection & dependency-aware value inlining

import { describe, expect, it } from 'vitest';
import { emitPackage } from '../../../targets/flutter/generator/emit';
import type { IR } from '../../../ir/types';

function fileMap(files: { path: string; contents: string }[]): Map<string, string> {
  return new Map(files.map((f) => [f.path, f.contents]));
}

// IR with ColorBasic (primitive) and ColorToken (with aliases)
function multiCollectionIR(): IR {
  return {
    version: '1.0',
    fileKey: 'test',
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
          { id: 'm:light', name: 'Light Mode' },
          { id: 'm:dark', name: 'Dark Mode' },
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
              'm:dark': { kind: 'alias', targetVariableId: 'v:white' },
            },
          },
        ],
      },
    ],
    composites: {
      paintStyles: [
        {
          id: 'paint:header',
          figmaName: 'Header/Bg',
          groupPath: ['Header'],
          type: 'SOLID',
          color: { kind: 'alias', targetVariableId: 'v:heading' },
        },
      ],
      effectStyles: [],
      textStyles: [],
    },
  };
}

describe('Flutter collection folder structure', () => {
  const out = emitPackage(multiCollectionIR());
  const files = fileMap(out.files);

  it('creates one folder per collection under lib/src/collections/', () => {
    expect(files.has('lib/src/collections/color_basic/color_basic.dart')).toBe(true);
    expect(files.has('lib/src/collections/color_token/color_token.dart')).toBe(true);
  });

  it('single-mode collection creates separate mode file with snake_case', () => {
    expect(files.has('lib/src/collections/color_basic/color_basic.dart')).toBe(true);
    expect(files.has('lib/src/collections/color_basic/base.dart')).toBe(true);
  });

  it('multi-mode collection creates separate mode files in snake_case', () => {
    expect(files.has('lib/src/collections/color_token/color_token.dart')).toBe(true);
    expect(files.has('lib/src/collections/color_token/light_mode.dart')).toBe(true);
    expect(files.has('lib/src/collections/color_token/dark_mode.dart')).toBe(true);
  });
});

describe('Flutter collection base class structure', () => {
  const out = emitPackage(multiCollectionIR());
  const files = fileMap(out.files);

  it('base class file contains abstract base class and exports mode files', () => {
    const basicFile = files.get('lib/src/collections/color_basic/color_basic.dart')!;
    const tokenFile = files.get('lib/src/collections/color_token/color_token.dart')!;

    expect(basicFile).toContain('abstract class ColorBasic');
    expect(tokenFile).toContain('abstract class ColorToken');
    expect(tokenFile).toContain("export 'light_mode.dart';");
    expect(tokenFile).toContain("export 'dark_mode.dart';");
  });

  it('base class declares all getters as abstract', () => {
    const basicFile = files.get('lib/src/collections/color_basic/color_basic.dart')!;

    expect(basicFile).toContain('Color get white');
    expect(basicFile).toContain('Color get neutral900');
  });

  it('base class contains lerp method', () => {
    const basicFile = files.get('lib/src/collections/color_basic/color_basic.dart')!;

    expect(basicFile).toContain('static ColorBasic lerp');
    expect(basicFile).toContain('_ColorBasicLerp');
  });
});

describe('Flutter collection mode class structure', () => {
  const out = emitPackage(multiCollectionIR());
  const files = fileMap(out.files);

  it('single-mode collection has mode class in separate file', () => {
    const baseFile = files.get('lib/src/collections/color_basic/base.dart')!;
    expect(baseFile).toContain('class ColorBasicBaseMode extends ColorBasic');
    expect(baseFile).toContain("import 'package:flutter/painting.dart';");
    expect(baseFile).toContain("import 'color_basic.dart';");
  });

  it('multi-mode collection has mode classes in separate files', () => {
    const lightModeFile = files.get('lib/src/collections/color_token/light_mode.dart')!;
    const darkModeFile = files.get('lib/src/collections/color_token/dark_mode.dart')!;

    expect(lightModeFile).toContain('class ColorTokenLightMode extends ColorToken');
    expect(darkModeFile).toContain('class ColorTokenDarkMode extends ColorToken');
  });

  it('mode class contains correct getter implementations', () => {
    const lightModeFile = files.get('lib/src/collections/color_token/light_mode.dart')!;
    expect(lightModeFile).toContain('Color get textHeadingPrimary');
    expect(lightModeFile).toContain('=> AppTheme.colorBasic.neutral900');
  });
});

describe('Flutter alias references in collection export', () => {
  const out = emitPackage(multiCollectionIR());
  const files = fileMap(out.files);

  it('aliases resolve through AppTheme static facade', () => {
    const lightModeFile = files.get('lib/src/collections/color_token/light_mode.dart')!;
    expect(lightModeFile).toContain('AppTheme.colorBasic.neutral900');
    expect(lightModeFile).not.toContain('_c.');
    expect(lightModeFile).not.toContain('DesignSystemController _c');
  });

  it('mode classes are const-constructible', () => {
    const lightModeFile = files.get('lib/src/collections/color_token/light_mode.dart')!;
    expect(lightModeFile).toContain('const ColorTokenLightMode();');
  });
});

describe('Flutter dynamic collection selection & value inlining', () => {
  it('inlines literal values when referenced collection is omitted by user', () => {
    // Only select ColorToken ('col:token'), omit ColorBasic ('col:basic')
    const out = emitPackage(multiCollectionIR(), null, {
      packageName: 'design_system',
      include: {
        collections: ['col:token'],
        composites: { colorStyles: true, shadows: true, textStyles: true },
      },
    });
    const files = fileMap(out.files);

    // ColorBasic should NOT be emitted
    expect(files.has('lib/src/collections/color_basic/color_basic.dart')).toBe(false);
    expect(files.has('lib/src/collections/color_token/color_token.dart')).toBe(true);

    // Mode files should inline the literal colors directly!
    const lightModeFile = files.get('lib/src/collections/color_token/light_mode.dart')!;
    const darkModeFile = files.get('lib/src/collections/color_token/dark_mode.dart')!;

    // light mode referenced neutral900 (r=0.1, g=0.1, b=0.1 -> 0xFF191919 or 0xFF1A1A1A)
    expect(lightModeFile).toContain('Color get textHeadingPrimary => const Color(');
    expect(lightModeFile).not.toContain('AppTheme.colorBasic');
    // should not import theme.dart when there are no aliases to exported collections
    expect(lightModeFile).not.toContain("import '../../theme.dart';");

    // dark mode referenced white (r=1, g=1, b=1 -> 0xFFFFFFFF)
    expect(darkModeFile).toContain('Color get textHeadingPrimary => const Color(0xFFFFFFFF);');
    expect(darkModeFile).not.toContain('AppTheme.colorBasic');

    // AppTheme should only have colorToken
    const themeFile = files.get('lib/src/theme.dart')!;
    expect(themeFile).toContain('static ColorToken get colorToken');
    expect(themeFile).not.toContain('static ColorBasic get colorBasic');
  });

  it('handles multi-hop alias inlining across multiple omitted tiers', () => {
    const multiHopIR: IR = {
      version: '1.0',
      fileKey: 'test',
      generatedAt: new Date(0).toISOString(),
      collections: [
        {
          id: 'col:raw',
          name: 'RawColors',
          kind: 'primitive',
          modes: [{ id: 'm:1', name: 'Default' }],
          variables: [
            {
              id: 'v:blue500',
              figmaName: 'blue-500',
              groupPath: ['blue-500'],
              type: 'COLOR',
              scopes: ['ALL_FILLS'],
              hiddenFromPublishing: false,
              emitToPublic: true,
              valuesByMode: { 'm:1': { kind: 'literal', value: { r: 0, g: 0.4, b: 1, a: 1 } } },
            },
          ],
        },
        {
          id: 'col:semantic',
          name: 'SemanticColors',
          kind: 'token',
          modes: [{ id: 'm:1', name: 'Default' }],
          variables: [
            {
              id: 'v:brandPrimary',
              figmaName: 'brand-primary',
              groupPath: ['brand-primary'],
              type: 'COLOR',
              scopes: ['ALL_FILLS'],
              hiddenFromPublishing: false,
              emitToPublic: true,
              valuesByMode: { 'm:1': { kind: 'alias', targetVariableId: 'v:blue500' } },
            },
          ],
        },
        {
          id: 'col:component',
          name: 'ButtonTokens',
          kind: 'token',
          modes: [{ id: 'm:1', name: 'Default' }],
          variables: [
            {
              id: 'v:btnBg',
              figmaName: 'button-bg',
              groupPath: ['button-bg'],
              type: 'COLOR',
              scopes: ['ALL_FILLS'],
              hiddenFromPublishing: false,
              emitToPublic: true,
              valuesByMode: { 'm:1': { kind: 'alias', targetVariableId: 'v:brandPrimary' } },
            },
          ],
        },
      ],
      composites: { paintStyles: [], effectStyles: [], textStyles: [] },
    };

    // User only exports ButtonTokens (col:component), omitting both SemanticColors and RawColors
    const out = emitPackage(multiHopIR, null, {
      packageName: 'design_system',
      include: {
        collections: ['col:component'],
        composites: { colorStyles: true, shadows: true, textStyles: true },
      },
    });
    const files = fileMap(out.files);

    expect(files.has('lib/src/collections/button_tokens/button_tokens.dart')).toBe(true);
    expect(files.has('lib/src/collections/semantic_colors/semantic_colors.dart')).toBe(false);
    expect(files.has('lib/src/collections/raw_colors/raw_colors.dart')).toBe(false);

    // Multi-hop alias resolves all the way to blue500 literal!
    const defaultModeFile = files.get('lib/src/collections/button_tokens/default.dart')!;
    expect(defaultModeFile).toContain('Color get buttonBg => const Color(0xFF0066FF);');
    expect(defaultModeFile).not.toContain('AppTheme.');
  });
});

describe('Flutter collection naming edge cases', () => {
  it('handles mode names that already contain hyphens', () => {
    const ir: IR = {
      version: '1.0',
      fileKey: 'test',
      generatedAt: new Date(0).toISOString(),
      collections: [
        {
          id: 'col:spacing',
          name: 'Spacing',
          kind: 'primitive',
          modes: [
            { id: 'm:compact', name: 'Compact' },
            { id: 'm:expanded', name: 'Expanded' },
          ],
          variables: [
            {
              id: 'v:small',
              figmaName: 'small',
              groupPath: ['small'],
              type: 'FLOAT',
              scopes: ['GAP'],
              hiddenFromPublishing: false,
              emitToPublic: true,
              valuesByMode: {
                'm:compact': { kind: 'literal', value: 4 },
                'm:expanded': { kind: 'literal', value: 8 },
              },
            },
          ],
        },
      ],
      composites: { paintStyles: [], effectStyles: [], textStyles: [] },
    };

    const out = emitPackage(ir);
    const files = fileMap(out.files);

    expect(files.has('lib/src/collections/spacing/spacing.dart')).toBe(true);
    expect(files.has('lib/src/collections/spacing/compact.dart')).toBe(true);
    expect(files.has('lib/src/collections/spacing/expanded.dart')).toBe(true);
  });

  it('handles mode names ending with "Mode"', () => {
    const ir: IR = {
      version: '1.0',
      fileKey: 'test',
      generatedAt: new Date(0).toISOString(),
      collections: [
        {
          id: 'col:theme',
          name: 'Theme',
          kind: 'token',
          modes: [
            { id: 'm:light', name: 'Light Mode' },
            { id: 'm:dark', name: 'Dark Mode' },
          ],
          variables: [
            {
              id: 'v:bg',
              figmaName: 'background',
              groupPath: ['background'],
              type: 'COLOR',
              scopes: ['ALL_FILLS'],
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
      composites: { paintStyles: [], effectStyles: [], textStyles: [] },
    };

    const out = emitPackage(ir);
    const files = fileMap(out.files);

    const lightModeFile = files.get('lib/src/collections/theme/light_mode.dart')!;
    expect(lightModeFile).toContain('class ThemeLightMode extends Theme');
    expect(lightModeFile).not.toContain('ThemeLightModeMode');
  });
});

describe('Flutter collection export barrel file', () => {
  const out = emitPackage(multiCollectionIR());
  const files = fileMap(out.files);

  it('barrel file exists at root of lib/', () => {
    expect(files.has('lib/design_system.dart')).toBe(true);
  });

  it('barrel file exports collections from src/collections/', () => {
    const barrel = files.get('lib/design_system.dart')!;
    expect(barrel).toContain("export 'src/collections/color_basic/color_basic.dart';");
    expect(barrel).toContain("export 'src/collections/color_token/color_token.dart';");
    expect(barrel).toContain("export 'src/theme.dart' show AppTheme;");
    expect(barrel).not.toContain('AppThemeData');
    expect(barrel).not.toContain('AppThemeContext');
  });
});
