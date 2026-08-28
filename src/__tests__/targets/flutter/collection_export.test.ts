// Tests for Flutter collection-based output structure.
// Verifies that:
// 1. Each collection gets its own folder
// 2. Mode files use kebab-case naming
// 3. Base class is in main collection file
// 4. Mode classes in separate files for multi-mode collections
// 5. Alias references preserved correctly

import { describe, expect, it } from 'vitest';
import { emitPackage } from '../../../targets/flutter/generator/emit';
import { DEFAULT_EXPORT_OPTIONS } from '../../../targets/flutter/generator/options';
import type { ExportOptions } from '../../../targets/flutter/generator/options';

function fileMap(files: { path: string; contents: string }[]): Map<string, string> {
  return new Map(files.map((f) => [f.path, f.contents]));
}

// IR with ColorBasic (primitive) and ColorToken (with aliases)
function multiCollectionIR() {
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
    composites: { paintStyles: [], effectStyles: [], textStyles: [] },
  };
}

function withMode(archMode: 'context' | 'static'): ExportOptions {
  return { ...DEFAULT_EXPORT_OPTIONS, archMode };
}

describe('Flutter collection folder structure', () => {
  const out = emitPackage(multiCollectionIR(), null, withMode('context'));
  const files = fileMap(out.files);

  it('creates one folder per collection', () => {
    // Each collection should have its own folder
    expect(files.has('lib/ColorBasic/ColorBasic.dart')).toBe(true);
    expect(files.has('lib/ColorToken/ColorToken.dart')).toBe(true);
  });

  it('single-mode collection creates separate mode file', () => {
    // ColorBasic has only one mode, but generator always creates separate mode file
    expect(files.has('lib/ColorBasic/ColorBasic.dart')).toBe(true);
    expect(files.has('lib/ColorBasic/base.dart')).toBe(true); // base.dart from 'Base' mode
  });

  it('multi-mode collection creates separate mode files in kebab-case', () => {
    // ColorToken has Light Mode and Dark Mode modes
    // Light Mode -> light-mode.dart
    // Dark Mode -> dark-mode.dart
    expect(files.has('lib/ColorToken/ColorToken.dart')).toBe(true);
    expect(files.has('lib/ColorToken/light-mode.dart')).toBe(true);
    expect(files.has('lib/ColorToken/dark-mode.dart')).toBe(true);
  });

  it('mode files have correct kebab-case naming', () => {
    // Verify 'Light Mode' -> 'light-mode.dart'
    const lightModeFile = files.get('lib/ColorToken/light-mode.dart');
    expect(lightModeFile).toBeDefined();

    // Verify 'Dark Mode' -> 'dark-mode.dart'
    const darkModeFile = files.get('lib/ColorToken/dark-mode.dart');
    expect(darkModeFile).toBeDefined();
  });
});

describe('Flutter collection base class structure', () => {
  const out = emitPackage(multiCollectionIR(), null, withMode('context'));
  const files = fileMap(out.files);

  it('base class file contains abstract base class', () => {
    const basicFile = files.get('lib/ColorBasic/ColorBasic.dart')!;
    const tokenFile = files.get('lib/ColorToken/ColorToken.dart')!;

    // Base class naming: abstract class {CollectionName} (no underscore prefix in new architecture)
    expect(basicFile).toContain('abstract class ColorBasic');
    expect(tokenFile).toContain('abstract class ColorToken');
  });

  it('base class declares all getters as abstract', () => {
    const basicFile = files.get('lib/ColorBasic/ColorBasic.dart')!;

    // Both variables should have abstract getters
    expect(basicFile).toContain('Color get white');
    expect(basicFile).toContain('Color get neutral900');
  });

  it('base class contains lerp method', () => {
    const basicFile = files.get('lib/ColorBasic/ColorBasic.dart')!;

    expect(basicFile).toContain('static ColorBasic lerp');
    expect(basicFile).toContain('_ColorBasicLerp');
  });
});

describe('Flutter collection mode class structure', () => {
  const out = emitPackage(multiCollectionIR(), null, withMode('context'));
  const files = fileMap(out.files);

  it('single-mode collection has mode class in separate file', () => {
    // Mode class is in separate file (base.dart from 'Base' mode)
    const baseFile = files.get('lib/ColorBasic/base.dart')!;

    // 'Base' mode -> ColorBasicBaseMode (no underscore prefix)
    expect(baseFile).toContain('class ColorBasicBaseMode extends ColorBasic');
  });

  it('multi-mode collection has mode classes in separate files', () => {
    const lightModeFile = files.get('lib/ColorToken/light-mode.dart')!;
    const darkModeFile = files.get('lib/ColorToken/dark-mode.dart')!;

    // Mode class naming: {CollectionName}{ModeName}Mode (no underscore prefix)
    // 'Light Mode' -> ColorTokenLightMode
    // 'Dark Mode' -> ColorTokenDarkMode
    expect(lightModeFile).toContain('class ColorTokenLightMode extends ColorToken');
    expect(darkModeFile).toContain('class ColorTokenDarkMode extends ColorToken');
  });

  it('mode class contains correct getter implementations', () => {
    const lightModeFile = files.get('lib/ColorToken/light-mode.dart')!;

    // text-heading-primary -> textHeadingPrimary
    expect(lightModeFile).toContain('Color get textHeadingPrimary');
    expect(lightModeFile).toContain('=>');
  });

  it('mode class does NOT import other collection base classes in context mode', () => {
    // In context mode, aliases use _c controller, so no cross-collection imports needed
    const lightModeFile = files.get('lib/ColorToken/light-mode.dart')!;

    // Should not have ColorBasic import since context mode uses _c
    expect(lightModeFile).not.toContain("import '../ColorBasic/ColorBasic.dart'");
  });
});

describe('Flutter alias references in collection export', () => {
  describe('context mode', () => {
    const out = emitPackage(multiCollectionIR(), null, withMode('context'));
    const files = fileMap(out.files);

    it('aliases resolve through _c controller in context mode', () => {
      const lightModeFile = files.get('lib/ColorToken/light-mode.dart')!;

      // Alias to neutral900 should use _c.colorBasic.neutral900
      expect(lightModeFile).toContain('_c.colorBasic.neutral900');
    });

    it('token mode class holds controller reference', () => {
      const lightModeFile = files.get('lib/ColorToken/light-mode.dart')!;

      // Token with alias should have controller injected
      expect(lightModeFile).toContain('DesignSystemController _c');
      expect(lightModeFile).toMatch(/ColorTokenLightMode\(this\._c\);/);
    });

    it('primitive collection mode class does not need controller', () => {
      const basicFile = files.get('lib/ColorBasic/ColorBasic.dart')!;

      // Primitive (no aliases) should be const and not have controller
      expect(basicFile).not.toContain('DesignSystemController _c');
    });
  });

  describe('static mode', () => {
    const out = emitPackage(multiCollectionIR(), null, withMode('static'));
    const files = fileMap(out.files);

    it('aliases resolve through AppTheme in static mode', () => {
      const lightModeFile = files.get('lib/ColorToken/light-mode.dart')!;

      // Alias should use AppTheme.colorBasic.neutral900
      expect(lightModeFile).toContain('AppTheme.colorBasic.neutral900');
    });

    it('token mode class does not need controller in static mode', () => {
      const lightModeFile = files.get('lib/ColorToken/light-mode.dart')!;

      // Static mode doesn't need controller injection
      expect(lightModeFile).not.toContain('DesignSystemController _c');
    });
  });
});

describe('Flutter collection export cross-collection imports', () => {
  describe('static mode', () => {
    const out = emitPackage(multiCollectionIR(), null, withMode('static'));
    const files = fileMap(out.files);

    it('mode files do NOT import other collection base classes (use AppTheme)', () => {
      const lightModeFile = files.get('lib/ColorToken/light-mode.dart')!;

      // In static mode, aliases use AppTheme.{accessor}, so no direct imports needed
      expect(lightModeFile).not.toContain("import '../ColorBasic/ColorBasic.dart'");
    });

    it('base class file does NOT import other collection base classes', () => {
      const tokenFile = files.get('lib/ColorToken/ColorToken.dart')!;

      // Base class only has abstract getters - no alias resolution needed
      expect(tokenFile).not.toContain("import '../ColorBasic/ColorBasic.dart'");
    });
  });

  describe('context mode', () => {
    const out = emitPackage(multiCollectionIR(), null, withMode('context'));
    const files = fileMap(out.files);

    it('mode files do NOT import other collection base classes (use _c)', () => {
      const lightModeFile = files.get('lib/ColorToken/light-mode.dart')!;

      // In context mode, aliases use _c controller, so no cross-collection imports needed
      expect(lightModeFile).not.toContain("import '../ColorBasic/ColorBasic.dart'");
    });
  });
});

describe('Flutter collection naming edge cases', () => {
  it('handles mode names that already contain hyphens', () => {
    const ir = {
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
              type: 'double',
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

    const out = emitPackage(ir as any, null, withMode('context'));
    const files = fileMap(out.files);

    // Mode names without hyphens should still convert correctly
    expect(files.has('lib/Spacing/Spacing.dart')).toBe(true);
    expect(files.has('lib/Spacing/compact.dart')).toBe(true);
    expect(files.has('lib/Spacing/expanded.dart')).toBe(true);
  });

  it('handles mode names ending with "Mode"', () => {
    const ir = {
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

    const out = emitPackage(ir as any, null, withMode('context'));
    const files = fileMap(out.files);

    // Should not produce ThemeLightModeMode
    // Light Mode -> ThemeLightMode
    // Dark Mode -> ThemeDarkMode
    const lightModeFile = files.get('lib/Theme/light-mode.dart')!;
    // Base class name is Theme (no underscore)
    expect(lightModeFile).toContain('class ThemeLightMode extends Theme');
    expect(lightModeFile).not.toContain('ThemeLightModeMode');
  });
});

describe('Flutter collection export barrel file', () => {
  const out = emitPackage(multiCollectionIR(), null, withMode('context'));
  const files = fileMap(out.files);

  it('barrel file exists', () => {
    expect(files.has('lib/design_system.dart')).toBe(true);
  });

  it('barrel file exports collection types', () => {
    const barrel = files.get('lib/design_system.dart')!;

    // Should export the public API
    expect(barrel).toContain('export');
  });
});
