import { describe, it, expect } from 'vitest';
import { emitTheme } from '../../../targets/compose/generator/emit_theme';
import {
  androidManifestXml,
  buildGradleKts,
  readmeMd,
} from '../../../targets/compose/generator/static_files';
import type { PreparedCompose } from '../../../targets/compose/generator/prepare';

describe('Compose Theming & Gradle Static Files', () => {
  describe('static files', () => {
    it('generates valid build.gradle.kts with Compose BOM', () => {
      const gradle = buildGradleKts('com.example.designsystem');
      expect(gradle).toContain('plugins {');
      expect(gradle).toContain('id("com.android.library")');
      expect(gradle).toContain('id("org.jetbrains.kotlin.android")');
      expect(gradle).toContain('id("org.jetbrains.kotlin.plugin.compose")');
      expect(gradle).toContain('namespace = "com.example.designsystem"');
      expect(gradle).toContain('compileSdk = 35');
      expect(gradle).toContain('minSdk = 24');
      expect(gradle).toContain('compose = true');
      expect(gradle).toContain('androidx.compose:compose-bom:2024.10.01');
      expect(gradle).toContain('androidx.compose.ui:ui');
      expect(gradle).toContain('androidx.compose.ui:ui-graphics');
      expect(gradle).toContain('androidx.compose.foundation:foundation');
      expect(gradle).toContain('androidx.compose.runtime:runtime');
    });

    it('generates valid AndroidManifest.xml', () => {
      const manifest = androidManifestXml('com.example.designsystem');
      expect(manifest).toContain('<?xml version="1.0" encoding="utf-8"?>');
      expect(manifest).toContain('<manifest xmlns:android="http://schemas.android.com/apk/res/android"');
      expect(manifest).toContain('/>');
    });

    it('generates informative README.md', () => {
      const readme = readmeMd('com.example.designsystem');
      expect(readme).toContain('# com.example.designsystem');
      expect(readme).toContain('settings.gradle.kts');
      expect(readme).toContain('DesignSystemTheme');
      expect(readme).toContain('AppTheme');
    });
  });

  describe('emitTheme with empty collections', () => {
    it('generates CompositionLocalProvider and DesignSystemTheme composable', () => {
      const mockPrepared: PreparedCompose = {
        targetId: 'compose',
        collections: [],
        modes: [],
        paintStyles: [],
        effectStyles: [],
        textStyles: [],
        nextManifestSection: {
          collections: {},
          variables: {},
          composites: {},
        },
        warnings: [],
      };

      const files = emitTheme(
        mockPrepared,
        'com/example/designsystem',
        'com.example.designsystem',
      );

      expect(files).toHaveLength(4);

      const themeModeFile = files.find((f) => f.path.endsWith('ThemeMode.kt'));
      const controllerFile = files.find((f) =>
        f.path.endsWith('DesignSystemController.kt'),
      );
      const themeFile = files.find((f) => f.path.endsWith('Theme.kt'));
      const appThemeFile = files.find((f) => f.path.endsWith('AppTheme.kt'));

      expect(themeModeFile).toBeDefined();
      expect(controllerFile).toBeDefined();
      expect(themeFile).toBeDefined();
      expect(appThemeFile).toBeDefined();

      // Theme.kt
      expect(themeFile!.contents).toContain('package com.example.designsystem.theme');
      expect(themeFile!.contents).toContain('staticCompositionLocalOf');
      expect(themeFile!.contents).toContain('LocalDSColorStyles');
      expect(themeFile!.contents).toContain('LocalDSTextStyles');
      expect(themeFile!.contents).toContain('LocalDSShadows');
      expect(themeFile!.contents).toContain('fun DesignSystemTheme');
      expect(themeFile!.contents).toContain('CompositionLocalProvider');
      expect(themeFile!.contents).toContain('object DesignSystemTheme');
      expect(themeFile!.contents).toContain('@ReadOnlyComposable');

      // DesignSystemController.kt
      expect(controllerFile!.contents).toContain('package com.example.designsystem.theme');
      expect(controllerFile!.contents).toContain('object DesignSystemController');
      expect(controllerFile!.contents).toContain('mutableStateOf');

      // AppTheme.kt
      expect(appThemeFile!.contents).toContain('package com.example.designsystem.theme');
      expect(appThemeFile!.contents).toContain('object AppTheme');
    });
  });

  describe('emitTheme with populated collections and modes', () => {
    it('generates mode enums, controller state, theme locals, and AppTheme facade', () => {
      const mockPrepared: PreparedCompose = {
        targetId: 'compose',
        collections: [
          {
            id: 'col:1',
            name: 'ColorTokens',
            figmaName: 'ColorTokens',
            className: 'ColorTokens',
            accessor: 'colorTokens',
            kind: 'token',
            defaultModeIndex: 0,
            fileBaseName: 'ColorTokens',
            modes: [
              { id: 'm:1', name: 'Light', key: 'light', pascalName: 'Light' },
              { id: 'm:2', name: 'Dark', key: 'dark', pascalName: 'Dark' },
            ],
            variables: [
              {
                id: 'v:1',
                figmaName: 'brandPrimary',
                groupPath: [],
                leafName: 'brandPrimary',
                stableLeafKey: 'brandPrimary',
                propertyName: 'brandPrimary',
                kotlinType: 'Color',
                emitToPublic: true,
                valuesByMode: {
                  'm:1': { kind: 'literal', value: 'Color(0xFF1E40AF)' },
                  'm:2': { kind: 'literal', value: 'Color(0xFF60A5FA)' },
                },
              },
            ],
          },
          {
            id: 'col:2',
            name: 'SpacingTokens',
            figmaName: 'SpacingTokens',
            className: 'SpacingTokens',
            accessor: 'spacingTokens',
            kind: 'primitive',
            defaultModeIndex: 0,
            fileBaseName: 'SpacingTokens',
            modes: [
              { id: 'm:3', name: 'Default', key: 'default', pascalName: 'Default' },
            ],
            variables: [
              {
                id: 'v:2',
                figmaName: 'sm',
                groupPath: [],
                leafName: 'sm',
                stableLeafKey: 'sm',
                propertyName: 'sm',
                kotlinType: 'Dp',
                emitToPublic: true,
                valuesByMode: {
                  'm:3': { kind: 'literal', value: '8.dp' },
                },
              },
            ],
          },
        ],
        modes: [],
        paintStyles: [],
        effectStyles: [],
        textStyles: [],
        nextManifestSection: {
          collections: {},
          variables: {},
          composites: {},
        },
        warnings: [],
      };

      const files = emitTheme(
        mockPrepared,
        'com/example/designsystem',
        'com.example.designsystem',
      );

      const themeModeFile = files.find((f) => f.path.endsWith('ThemeMode.kt'))!;
      const controllerFile = files.find((f) =>
        f.path.endsWith('DesignSystemController.kt'),
      )!;
      const themeFile = files.find((f) => f.path.endsWith('Theme.kt'))!;
      const appThemeFile = files.find((f) => f.path.endsWith('AppTheme.kt'))!;

      // 1. ThemeMode.kt
      expect(themeModeFile.contents).toContain('enum class ColorTokensMode {');
      expect(themeModeFile.contents).toContain('Light,');
      expect(themeModeFile.contents).toContain('Dark,');
      expect(themeModeFile.contents).toContain('enum class SpacingTokensMode {');
      expect(themeModeFile.contents).toContain('Default,');

      // 2. DesignSystemController.kt
      expect(controllerFile.contents).toContain('var currentColorTokensMode');
      expect(controllerFile.contents).toContain('var currentSpacingTokensMode');
      expect(controllerFile.contents).toContain('var colorTokens');
      expect(controllerFile.contents).toContain('var spacingTokens');
      expect(controllerFile.contents).toContain('fun setColorTokensMode(');
      expect(controllerFile.contents).toContain('ColorTokens.lerp(');
      expect(controllerFile.contents).toContain('fun setSpacingTokensMode(');
      expect(controllerFile.contents).toContain('var defaultDurationMillis');

      // 3. Theme.kt
      expect(themeFile.contents).toContain(
        'val LocalColorTokens = staticCompositionLocalOf<ColorTokens>',
      );
      expect(themeFile.contents).toContain(
        'val LocalSpacingTokens = staticCompositionLocalOf<SpacingTokens>',
      );
      expect(themeFile.contents).toContain('LocalColorTokens provides colorTokens');
      expect(themeFile.contents).toContain('LocalSpacingTokens provides spacingTokens');
      expect(themeFile.contents).toContain('val colorTokens: ColorTokens');
      expect(themeFile.contents).toContain('val spacingTokens: SpacingTokens');
      expect(themeFile.contents).toContain('val colors: ColorTokens');

      // 4. AppTheme.kt
      expect(appThemeFile.contents).toContain('val colorTokens: ColorTokens');
      expect(appThemeFile.contents).toContain('val spacingTokens: SpacingTokens');
      expect(appThemeFile.contents).toContain('fun setColorTokensMode(');
      expect(appThemeFile.contents).toContain('fun setSpacingTokensMode(');
      expect(appThemeFile.contents).toContain('val currentColorTokensMode: ColorTokensMode');
      expect(appThemeFile.contents).toContain('val currentSpacingTokensMode: SpacingTokensMode');
      expect(appThemeFile.contents).toContain('var defaultDurationMillis: Int');
      expect(appThemeFile.contents).toContain('fun resetForTest()');
    });
  });
});
