import { describe, it, expect } from 'vitest';
import type { IR } from '../../../ir/types';
import { emitPackage } from '../../../targets/flutter/generator/emit';
import { DEFAULT_EXPORT_OPTIONS } from '../../../targets/flutter/generator/options';
import type { ExportOptions } from '../../../targets/flutter/generator/options';

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

function withMode(archMode: 'context' | 'static'): ExportOptions {
  return { ...DEFAULT_EXPORT_OPTIONS, archMode };
}

describe('Flutter archMode emission', () => {
  describe('context mode', () => {
    const out = emitPackage(buildIr(), null, withMode('context'));
    const files = fileMap(out.files);

    it('emits the InheritedNotifier scope file', () => {
      const scope = files.get('lib/src/_internal/scope.dart');
      expect(scope).toBeDefined();
      expect(scope!).toContain(
        'class DesignSystemScope extends InheritedNotifier<DesignSystemController>',
      );
      expect(scope!).toContain('dependOnInheritedWidgetOfExactType<DesignSystemScope>');
    });

    it('emits the BuildContext extension', () => {
      const ext = files.get('lib/src/extensions.dart');
      expect(ext).toBeDefined();
      expect(ext!).toContain('extension AppThemeContext on BuildContext');
      // Per-collection getter routes through AppTheme.of(this) so the
      // InheritedNotifier dependency is registered.
      expect(ext!).toContain('ColorBasic get colorBasic => AppTheme.of(this).colorBasic');
      expect(ext!).toContain('ColorToken get colorToken => AppTheme.of(this).colorToken');
    });

    it('emits AppTheme.of(context) and AppThemeData; drops static collection getters', () => {
      const theme = files.get('lib/src/theme.dart')!;
      expect(theme).toContain('class AppThemeData');
      expect(theme).toContain('static AppThemeData of(BuildContext context)');
      expect(theme).toContain('DesignSystemScope.of(context)');
      // Static collection facade is gone in context mode.
      expect(theme).not.toMatch(/static\s+ColorBasic\s+get\s+colorBasic/);
      expect(theme).not.toMatch(/static\s+ColorToken\s+get\s+colorToken/);
      // Imperative APIs survive.
      expect(theme).toContain('static void setColorTokenMode');
      expect(theme).toContain('static ColorTokenMode get currentColorTokenMode');
    });

    it('wrapper uses DesignSystemScope (no ListenableBuilder)', () => {
      const wrap = files.get('lib/src/wrapper.dart')!;
      expect(wrap).toContain('DesignSystemScope(');
      expect(wrap).not.toContain('ListenableBuilder(');
    });

    it('token concrete classes hold an injected controller — no singleton reads', () => {
      const tokenFile = files.get('lib/src/tokens/color_token.dart')!;
      // Concrete class takes the controller via ctor and stores it as `_c`.
      expect(tokenFile).toMatch(/ColorTokenLightMode\(this\._c\);/);
      expect(tokenFile).toContain('final DesignSystemController _c;');
      // Alias goes through the field, not `DesignSystemController.instance`
      // and not the static `AppTheme` facade.
      expect(tokenFile).toContain('_c.colorBasic.backgroundPrimary');
      expect(tokenFile).not.toContain('DesignSystemController.instance');
      expect(tokenFile).not.toContain('AppTheme.colorBasic');
    });

    it('primitive concrete classes stay const (no _c needed)', () => {
      const basicFile = files.get('lib/src/primitives/color_basic.dart')!;
      // Primitive collection is literal-only — must remain const-constructible.
      expect(basicFile).toContain('const ColorBasicValue();');
      expect(basicFile).not.toContain('final DesignSystemController _c;');
    });

    it('controller passes `this` when constructing token concretes', () => {
      const ctrl = files.get('lib/src/_internal/controller.dart')!;
      // `late` because field initializers may reference `this` only when
      // the field is `late`.
      expect(ctrl).toMatch(/late ColorToken _colorToken = ColorTokenLightMode\(this\);/);
      expect(ctrl).toMatch(/late ColorToken _colorTokenPrev = ColorTokenLightMode\(this\);/);
      // Switch arm in setColorTokenMode also passes `this`.
      expect(ctrl).toContain('ColorTokenMode.lightMode => ColorTokenLightMode(this)');
      // Primitives don't need injection — no `late` and no `(this)` for them.
      expect(ctrl).toMatch(/ColorBasic _colorBasic = ColorBasicValue\(\);/);
      expect(ctrl).not.toMatch(/late ColorBasic _colorBasic/);
    });

    it('composites (paint with alias) get _c injected and AppThemeData constructs them with _c', () => {
      const colorStyles = files.get('lib/src/composites/color_styles.dart')!;
      expect(colorStyles).toMatch(/const DSColorStyles\(this\._c\);/);
      expect(colorStyles).toContain('final DesignSystemController _c;');
      // Alias uses `_c.x` — no singleton, no AppTheme.x.
      // The paint style "Surface/Bg" emits getter `surfaceBg`, whose body
      // resolves the alias to the token getter `backgroundPrimary`.
      expect(colorStyles).toContain('Color get surfaceBg => _c.colorToken.backgroundPrimary');
      expect(colorStyles).not.toContain('DesignSystemController.instance');
      expect(colorStyles).not.toContain('AppTheme.colorToken');

      const theme = files.get('lib/src/theme.dart')!;
      // AppThemeData passes its own `_c` when handing out the composite.
      expect(theme).toContain('DSColorStyles get colorStyle => DSColorStyles(_c)');
      expect(theme).not.toContain('const DSColorStyles()');
    });

    it('barrel exports AppTheme, AppThemeData, AppThemeContext', () => {
      const barrel = files.get('lib/design_system.dart')!;
      expect(barrel).toContain('show AppTheme, AppThemeData');
      expect(barrel).toContain("export 'src/extensions.dart' show AppThemeContext");
    });
  });

  describe('static mode (regression: behavior unchanged)', () => {
    const out = emitPackage(buildIr(), null, withMode('static'));
    const files = fileMap(out.files);

    it('does NOT emit scope.dart or extensions.dart', () => {
      expect(files.has('lib/src/_internal/scope.dart')).toBe(false);
      expect(files.has('lib/src/extensions.dart')).toBe(false);
    });

    it('AppTheme retains static collection getters; no AppThemeData / of(context)', () => {
      const theme = files.get('lib/src/theme.dart')!;
      expect(theme).toContain('static ColorBasic get colorBasic');
      expect(theme).toContain('static ColorToken get colorToken');
      expect(theme).not.toContain('AppThemeData');
      expect(theme).not.toContain('static AppThemeData of(BuildContext');
    });

    it('wrapper uses ListenableBuilder', () => {
      const wrap = files.get('lib/src/wrapper.dart')!;
      expect(wrap).toContain('ListenableBuilder(');
      expect(wrap).not.toContain('DesignSystemScope(');
    });

    it('alias references in token concrete classes still go through AppTheme; no _c injection', () => {
      const tokenFile = files.get('lib/src/tokens/color_token.dart')!;
      expect(tokenFile).toContain('AppTheme.colorBasic');
      expect(tokenFile).not.toContain('_c.colorBasic');
      expect(tokenFile).not.toContain('final DesignSystemController _c;');
    });

    it('composites stay const; no controller injection', () => {
      const colorStyles = files.get('lib/src/composites/color_styles.dart')!;
      expect(colorStyles).toContain('const DSColorStyles();');
      expect(colorStyles).not.toContain('this._c');
      expect(colorStyles).toContain('AppTheme.colorToken');
    });

    it('controller field initializers stay non-late and ctor calls have no args', () => {
      const ctrl = files.get('lib/src/_internal/controller.dart')!;
      expect(ctrl).toMatch(/ColorToken _colorToken = ColorTokenLightMode\(\);/);
      expect(ctrl).not.toContain('late ColorToken');
      expect(ctrl).toContain('ColorTokenMode.lightMode => ColorTokenLightMode()');
    });

    it('barrel exports only AppTheme (no AppThemeData / extension)', () => {
      const barrel = files.get('lib/design_system.dart')!;
      expect(barrel).toContain('show AppTheme;');
      expect(barrel).not.toContain('AppThemeData');
      expect(barrel).not.toContain('AppThemeContext');
    });
  });

  it('context mode is the default when archMode is not provided', () => {
    expect(DEFAULT_EXPORT_OPTIONS.archMode).toBe('context');
  });
});
