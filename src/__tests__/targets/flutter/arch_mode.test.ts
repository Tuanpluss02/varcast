import { describe, it, expect } from 'vitest';
import type { IR } from '../../../ir/types';
import { emitPackage } from '../../../targets/flutter/generator/emit';

function buildIr(): IR {
  return {
    version: '1.0',
    fileKey: 'test',
    generatedAt: new Date(0).toISOString(),
    collections: [
      {
        id: 'col:basic',
        name: 'Color Basic',
        kind: 'primitive',
        modes: [{ id: 'm:1', name: 'Value' }],
        variables: [
          {
            id: 'var:black',
            figmaName: 'Background/Primary',
            groupPath: ['Background', 'Primary'],
            type: 'COLOR',
            scopes: ['ALL_FILLS'],
            hiddenFromPublishing: false,
            emitToPublic: true,
            valuesByMode: { 'm:1': { kind: 'literal', value: { r: 0, g: 0, b: 0, a: 1 } } },
          },
        ],
      },
      {
        id: 'col:token',
        name: 'Color Token',
        kind: 'token',
        modes: [{ id: 'm:1', name: 'Light Mode' }],
        variables: [
          {
            id: 'var:bg-primary',
            figmaName: 'Background/Primary',
            groupPath: ['Background', 'Primary'],
            type: 'COLOR',
            scopes: ['ALL_FILLS'],
            hiddenFromPublishing: false,
            emitToPublic: true,
            valuesByMode: { 'm:1': { kind: 'alias', targetVariableId: 'var:black' } },
          },
        ],
      },
    ],
    composites: {
      paintStyles: [
        {
          id: 'paint:bg',
          figmaName: 'Surface/Bg',
          groupPath: ['Surface'],
          type: 'SOLID',
          color: { kind: 'alias', targetVariableId: 'var:bg-primary' },
        },
      ],
      effectStyles: [],
      textStyles: [],
    },
  };
}

function fileMap(files: { path: string; contents: string }[]): Map<string, string> {
  return new Map(files.map((f) => [f.path, f.contents]));
}

describe('Flutter static non-context emission', () => {
  const out = emitPackage(buildIr());
  const files = fileMap(out.files);

  it('does NOT emit scope.dart or extensions.dart', () => {
    expect(files.has('lib/src/_internal/scope.dart')).toBe(false);
    expect(files.has('lib/src/extensions.dart')).toBe(false);
  });

  it('AppTheme has static collection getters; no AppThemeData or of(context)', () => {
    const theme = files.get('lib/src/theme.dart')!;
    expect(theme).toContain('static ColorBasic get colorBasic');
    expect(theme).toContain('static ColorToken get colorToken');
    expect(theme).not.toContain('AppThemeData');
    expect(theme).not.toContain('static AppThemeData of(BuildContext');
    expect(theme).toContain('static void setColorTokenMode');
    expect(theme).toContain('static ColorTokenMode get currentColorTokenMode');
  });

  it('wrapper uses ListenableBuilder without DesignSystemScope', () => {
    const wrap = files.get('lib/src/wrapper.dart')!;
    expect(wrap).toContain('ListenableBuilder(');
    expect(wrap).toContain('listenable: DesignSystemController.instance');
    expect(wrap).not.toContain('DesignSystemScope(');
  });

  it('alias references in token concrete classes go through AppTheme', () => {
    const lightFile = files.get('lib/src/collections/color_token/light_mode.dart')!;
    expect(lightFile).toContain('AppTheme.colorBasic.backgroundPrimary');
    expect(lightFile).not.toContain('_c.colorBasic');
    expect(lightFile).not.toContain('final DesignSystemController _c;');
  });

  it('composites stay const with zero constructor args', () => {
    const colorStyles = files.get('lib/src/composites/color_styles.dart')!;
    expect(colorStyles).toContain('const DSColorStyles();');
    expect(colorStyles).not.toContain('this._c');
    expect(colorStyles).toContain('AppTheme.colorToken.backgroundPrimary');
  });

  it('controller field initializers are non-late and constructor calls have no args', () => {
    const ctrl = files.get('lib/src/_internal/controller.dart')!;
    expect(ctrl).toMatch(/ColorToken _colorToken = ColorTokenLightMode\(\);/);
    expect(ctrl).not.toContain('late ColorToken');
    expect(ctrl).toContain('ColorTokenMode.lightMode => ColorTokenLightMode()');
  });

  it('barrel exports only AppTheme (no AppThemeData / AppThemeContext)', () => {
    const barrel = files.get('lib/design_system.dart')!;
    expect(barrel).toContain("export 'src/theme.dart' show AppTheme;");
    expect(barrel).not.toContain('AppThemeData');
    expect(barrel).not.toContain('AppThemeContext');
  });

  it('collection files are placed under lib/src/collections/ with snake_case naming', () => {
    expect(files.has('lib/src/collections/color_basic/color_basic.dart')).toBe(true);
    expect(files.has('lib/src/collections/color_basic/value.dart')).toBe(true);
    expect(files.has('lib/src/collections/color_token/color_token.dart')).toBe(true);
    expect(files.has('lib/src/collections/color_token/light_mode.dart')).toBe(true);
  });
});
