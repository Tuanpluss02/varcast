import { describe, expect, it } from 'vitest';
import { runEngine } from '../../../core/emit_engine';
import type { IR } from '../../../ir/types';
import { androidTarget } from '../../../targets/android';

function fileMap(files: { path: string; contents: string }[]) {
  const m = new Map<string, string>();
  for (const f of files) m.set(f.path, f.contents);
  return m;
}

function androidIR(): IR {
  return {
    version: '1.0',
    fileKey: 'k',
    generatedAt: new Date(0).toISOString(),
    collections: [
      {
        id: 'c:basic',
        name: 'Color Basic',
        kind: 'primitive',
        modes: [{ id: 'm:base', name: 'Base' }],
        variables: [
          {
            id: 'v:brand500',
            figmaName: 'brand/500',
            groupPath: ['brand', '500'],
            type: 'COLOR',
            scopes: ['ALL_FILLS'],
            hiddenFromPublishing: false,
            emitToPublic: true,
            valuesByMode: {
              'm:base': { kind: 'literal', value: { r: 0, g: 0, b: 1, a: 1 } },
            },
          },
        ],
      },
      {
        id: 'c:token',
        name: 'Color Token',
        kind: 'token',
        modes: [
          { id: 'm:dark', name: 'Dark' },
          { id: 'm:light', name: 'Light' },
        ],
        variables: [
          {
            id: 'v:text',
            figmaName: 'text/primary',
            groupPath: ['text', 'primary'],
            type: 'COLOR',
            scopes: ['ALL_FILLS'],
            hiddenFromPublishing: false,
            emitToPublic: true,
            valuesByMode: {
              'm:dark': { kind: 'alias', targetVariableId: 'v:brand500' },
              'm:light': {
                kind: 'literal',
                value: { r: 1, g: 1, b: 1, a: 1 },
              },
            },
          },
        ],
      },
    ],
    composites: {
      paintStyles: [
        {
          id: 'p:1',
          figmaName: 'brand/primary',
          groupPath: ['brand', 'primary'],
          type: 'SOLID',
          color: { kind: 'alias', targetVariableId: 'v:brand500' },
        },
      ],
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
          figmaName: 'body/medium',
          groupPath: ['body', 'medium'],
          fontFamily: { kind: 'literal', value: 'Inter' },
          fontSize: { kind: 'literal', value: 16 },
          fontWeight: { kind: 'literal', value: 500 },
          lineHeight: { kind: 'literal', value: 150, unit: 'PERCENT' },
          letterSpacing: { kind: 'literal', value: 0, unit: 'PIXELS' },
        },
      ],
    },
  };
}

describe('Android Compose target — emit smoke', () => {
  const out = runEngine(androidIR(), [androidTarget], null, {
    android: {
      flavor: 'compose',
      packageName: 'ds_android',
      androidNamespace: 'com.example.designsystem',
    },
  });
  const files = fileMap(out.files);
  const root = 'src/main/kotlin/com/example/designsystem';

  it('emits the Android library file set under the namespace path', () => {
    expect(files.get('build.gradle.kts')).toContain(
      'namespace = "com.example.designsystem"',
    );
    expect(files.get('build.gradle.kts')).toContain('jvmTarget = "11"');
    expect(files.get('build.gradle.kts')).toContain('JavaVersion.VERSION_11');
    expect(files.has('settings.gradle.kts')).toBe(true);
    expect(files.has('src/main/AndroidManifest.xml')).toBe(true);
    expect(files.has(`${root}/AppTheme.kt`)).toBe(true);
    expect(files.has(`${root}/DesignSystemWrapper.kt`)).toBe(true);
    expect(files.has(`${root}/internal/DesignSystemController.kt`)).toBe(true);
    expect(files.has(`${root}/primitives/ColorBasic.kt`)).toBe(true);
    expect(files.has(`${root}/tokens/ColorToken.kt`)).toBe(true);
    expect(files.has(`${root}/composites/DSColorStyles.kt`)).toBe(true);
    expect(files.has(`${root}/composites/DSShadows.kt`)).toBe(true);
    expect(files.has(`${root}/composites/DSStyles.kt`)).toBe(true);
  });

  it('uses the selected namespace in generated Kotlin packages', () => {
    expect(files.get(`${root}/AppTheme.kt`)).toContain(
      'package com.example.designsystem',
    );
    expect(files.get(`${root}/tokens/ColorToken.kt`)).toContain(
      'package com.example.designsystem.tokens',
    );
  });

  it('emits Compose-friendly theme and mode APIs', () => {
    const theme = files.get(`${root}/AppTheme.kt`)!;
    expect(theme).toContain('val current: AppThemeData');
    expect(theme).toContain('fun setColorTokenMode(mode: ColorTokenMode)');
    expect(theme).toContain('val colorToken: ColorToken');
  });

  it('emits collection literals and aliases', () => {
    const primitive = files.get(`${root}/primitives/ColorBasic.kt`)!;
    const token = files.get(`${root}/tokens/ColorToken.kt`)!;
    expect(primitive).toContain('brand500');
    expect(primitive).toContain('Color(0xFF0000FF)');
    expect(token).toContain('enum class ColorTokenMode { DarkMode, LightMode }');
    expect(token).toContain('fun lerp(a: ColorToken, b: ColorToken, t: Float): ColorToken = LerpedColorToken(a, b, t)');
    expect(token).toContain('private class LerpedColorToken(');
    expect(token).toContain('private val a: ColorToken');
    expect(token).toContain('c.colorBasic.brand500');
    expect(token).toContain('Color(0xFFFFFFFF)');
  });

  it('filters primitives when include.primitives is false', () => {
    const filtered = fileMap(
      runEngine(androidIR(), [androidTarget], null, {
        android: {
          flavor: 'compose',
          packageName: 'ds_android',
          androidNamespace: 'com.example.designsystem',
          include: { primitives: false, tokens: true, composites: {} },
        },
      }).files,
    );
    expect(filtered.has(`${root}/primitives/ColorBasic.kt`)).toBe(false);
    expect(filtered.has(`${root}/tokens/ColorToken.kt`)).toBe(true);
  });

  it('records Android manifest state separately', () => {
    expect(out.nextManifest.targets.android.collections['c:token']).toBe('ColorToken');
    expect(out.nextManifest.targets.android.variables['v:text']).toBe('primary');
  });
});
