import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import { emitCollections } from '../../../targets/compose/generator/emit_collections';
import { prepareCompose } from '../../../targets/compose/generator/prepare';
import { buildSemanticGraph } from '../../../core/graph/build_graph';
import type { IR } from '../../../ir/types';
import type { PreparedCompose } from '../../../targets/compose/generator/prepare';

const GOLDEN_IR: IR = JSON.parse(
  fs.readFileSync(
    path.resolve(__dirname, '../../../../test_fixtures/golden_tokens.json'),
    'utf-8',
  ),
);

describe('Compose Collections Emitter', () => {
  it('emits @Immutable data class with mode objects and lerp function', () => {
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

    const files = emitCollections(
      mockPrepared,
      'com/example/designsystem',
      'com.example.designsystem',
    );

    expect(files.some((f) => f.path.endsWith('ColorTokens.kt'))).toBe(true);
    const file = files.find((f) => f.path.endsWith('ColorTokens.kt'))!;
    expect(file.path).toBe(
      'src/main/kotlin/com/example/designsystem/collections/ColorTokens.kt',
    );

    const content = file.contents;
    expect(content).toContain('package com.example.designsystem.collections');
    expect(content).toContain('import androidx.compose.runtime.Immutable');
    expect(content).toContain('import androidx.compose.ui.graphics.Color');
    expect(content).toContain('import androidx.compose.ui.graphics.lerp as lerpColor');
    expect(content).toContain('@Immutable');
    expect(content).toContain('data class ColorTokens(');
    expect(content).toContain('val brandPrimary: Color,');
    expect(content).toContain('val LightColorTokens = ColorTokens(');
    expect(content).toContain('val DarkColorTokens = ColorTokens(');
    expect(content).toContain('companion object {');
    expect(content).toContain(
      'fun lerp(start: ColorTokens, stop: ColorTokens, fraction: Float): ColorTokens',
    );
    expect(content).toContain(
      'lerpColor(start.brandPrimary, stop.brandPrimary, fraction)',
    );
  });

  it('correctly handles all primitive types (Color, Dp, TextUnit, Float, String, Boolean) and lerp math', () => {
    const mockPrepared: PreparedCompose = {
      targetId: 'compose',
      collections: [
        {
          id: 'col:all',
          name: 'AllPrimitives',
          figmaName: 'AllPrimitives',
          className: 'AllPrimitives',
          accessor: 'allPrimitives',
          kind: 'token',
          defaultModeIndex: 0,
          fileBaseName: 'AllPrimitives',
          modes: [
            { id: 'm:default', name: 'Default', key: 'default', pascalName: 'Default' },
            { id: 'm:alt', name: 'Alt', key: 'alt', pascalName: 'Alt' },
          ],
          variables: [
            {
              id: 'v:color',
              figmaName: 'accentColor',
              groupPath: [],
              leafName: 'accentColor',
              stableLeafKey: 'accentColor',
              propertyName: 'accentColor',
              kotlinType: 'Color',
              emitToPublic: true,
              valuesByMode: {
                'm:default': {
                  kind: 'literal',
                  value: { r: 1.0, g: 0.0, b: 0.0, a: 1.0 },
                },
                'm:alt': {
                  kind: 'literal',
                  value: { r: 0.0, g: 1.0, b: 0.0, a: 0.5 },
                },
              },
            },
            {
              id: 'v:dp',
              figmaName: 'spacing',
              groupPath: [],
              leafName: 'spacing',
              stableLeafKey: 'spacing',
              propertyName: 'spacing',
              kotlinType: 'Dp',
              emitToPublic: true,
              valuesByMode: {
                'm:default': { kind: 'literal', value: 16 },
                'm:alt': { kind: 'literal', value: 24.5 },
              },
            },
            {
              id: 'v:sp',
              figmaName: 'fontSize',
              groupPath: [],
              leafName: 'fontSize',
              stableLeafKey: 'fontSize',
              propertyName: 'fontSize',
              kotlinType: 'TextUnit',
              emitToPublic: true,
              valuesByMode: {
                'm:default': { kind: 'literal', value: 14 },
                'm:alt': { kind: 'literal', value: 18 },
              },
            },
            {
              id: 'v:float',
              figmaName: 'opacity',
              groupPath: [],
              leafName: 'opacity',
              stableLeafKey: 'opacity',
              propertyName: 'opacity',
              kotlinType: 'Float',
              emitToPublic: true,
              valuesByMode: {
                'm:default': { kind: 'literal', value: 0.8 },
                'm:alt': { kind: 'literal', value: 1.0 },
              },
            },
            {
              id: 'v:str',
              figmaName: 'fontFamily',
              groupPath: [],
              leafName: 'fontFamily',
              stableLeafKey: 'fontFamily',
              propertyName: 'fontFamily',
              kotlinType: 'String',
              emitToPublic: true,
              valuesByMode: {
                'm:default': { kind: 'literal', value: 'Inter $Variable' },
                'm:alt': { kind: 'literal', value: 'Roboto' },
              },
            },
            {
              id: 'v:bool',
              figmaName: 'isVisible',
              groupPath: [],
              leafName: 'isVisible',
              stableLeafKey: 'isVisible',
              propertyName: 'isVisible',
              kotlinType: 'Boolean',
              emitToPublic: true,
              valuesByMode: {
                'm:default': { kind: 'literal', value: true },
                'm:alt': { kind: 'literal', value: false },
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

    const files = emitCollections(
      mockPrepared,
      'com/example/designsystem',
      'com.example.designsystem',
    );

    const file = files[0];
    const content = file.contents;

    // Check imports
    expect(content).toContain('import androidx.compose.runtime.Immutable');
    expect(content).toContain('import androidx.compose.ui.graphics.Color');
    expect(content).toContain('import androidx.compose.ui.graphics.lerp as lerpColor');
    expect(content).toContain('import androidx.compose.ui.unit.Dp');
    expect(content).toContain('import androidx.compose.ui.unit.dp');
    expect(content).toContain('import androidx.compose.ui.unit.lerp as lerpDp');
    expect(content).toContain('import androidx.compose.ui.unit.TextUnit');
    expect(content).toContain('import androidx.compose.ui.unit.sp');
    expect(content).toContain('import androidx.compose.ui.unit.lerp as lerpTextUnit');

    // Check data class properties
    expect(content).toContain('val accentColor: Color,');
    expect(content).toContain('val spacing: Dp,');
    expect(content).toContain('val fontSize: TextUnit,');
    expect(content).toContain('val opacity: Float,');
    expect(content).toContain('val fontFamily: String,');
    expect(content).toContain('val isVisible: Boolean,');

    // Check mode singletons
    expect(content).toContain('val DefaultAllPrimitives = AllPrimitives(');
    expect(content).toContain('accentColor = Color(0xFFFF0000UL)');
    expect(content).toContain('spacing = 16.dp');
    expect(content).toContain('fontSize = 14.sp');
    expect(content).toContain('opacity = 0.8f');
    expect(content).toContain('fontFamily = "Inter \\$Variable"');
    expect(content).toContain('isVisible = true');

    expect(content).toContain('val AltAllPrimitives = AllPrimitives(');
    expect(content).toContain('accentColor = Color(0x8000FF00UL)');
    expect(content).toContain('spacing = 24.5.dp');
    expect(content).toContain('fontSize = 18.sp');
    expect(content).toContain('opacity = 1f');
    expect(content).toContain('fontFamily = "Roboto"');
    expect(content).toContain('isVisible = false');

    // Check lerp implementations
    expect(content).toContain(
      'accentColor = lerpColor(start.accentColor, stop.accentColor, fraction)',
    );
    expect(content).toContain(
      'spacing = lerpDp(start.spacing, stop.spacing, fraction)',
    );
    expect(content).toContain(
      'fontSize = lerpTextUnit(start.fontSize, stop.fontSize, fraction)',
    );
    expect(content).toContain(
      'opacity = start.opacity + (stop.opacity - start.opacity) * fraction',
    );
    expect(content).toContain(
      'fontFamily = if (fraction < 0.5f) start.fontFamily else stop.fontFamily',
    );
    expect(content).toContain(
      'isVisible = if (fraction < 0.5f) start.isVisible else stop.isVisible',
    );
  });

  it('only imports types actually used in the collection', () => {
    const mockPrepared: PreparedCompose = {
      targetId: 'compose',
      collections: [
        {
          id: 'col:dim',
          name: 'Dimensions',
          figmaName: 'Dimensions',
          className: 'Dimensions',
          accessor: 'dimensions',
          kind: 'token',
          defaultModeIndex: 0,
          fileBaseName: 'Dimensions',
          modes: [
            { id: 'm:1', name: 'Default', key: 'default', pascalName: 'Default' },
          ],
          variables: [
            {
              id: 'v:1',
              figmaName: 'spacingSmall',
              groupPath: [],
              leafName: 'spacingSmall',
              stableLeafKey: 'spacingSmall',
              propertyName: 'spacingSmall',
              kotlinType: 'Dp',
              emitToPublic: true,
              valuesByMode: {
                'm:1': { kind: 'literal', value: 8 },
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

    const files = emitCollections(
      mockPrepared,
      'com/example/designsystem',
      'com.example.designsystem',
    );

    const content = files[0].contents;
    expect(content).toContain('import androidx.compose.ui.unit.Dp');
    expect(content).toContain('import androidx.compose.ui.unit.dp');
    expect(content).toContain('import androidx.compose.ui.unit.lerp as lerpDp');
    expect(content).not.toContain('Color');
    expect(content).not.toContain('TextUnit');
    expect(content).not.toContain('import androidx.compose.ui.unit.sp');
  });

  it('handles empty collection with 0 variables cleanly', () => {
    const mockPrepared: PreparedCompose = {
      targetId: 'compose',
      collections: [
        {
          id: 'col:empty',
          name: 'EmptyTokens',
          figmaName: 'EmptyTokens',
          className: 'EmptyTokens',
          accessor: 'emptyTokens',
          kind: 'token',
          defaultModeIndex: 0,
          fileBaseName: 'EmptyTokens',
          modes: [
            { id: 'm:1', name: 'Default', key: 'default', pascalName: 'Default' },
          ],
          variables: [],
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

    const files = emitCollections(
      mockPrepared,
      'com/example/designsystem',
      'com.example.designsystem',
    );

    expect(files).toHaveLength(1);
    const content = files[0].contents;
    expect(content).toContain('@Immutable');
    expect(content).toContain('class EmptyTokens');
    expect(content).not.toContain('data class');
    expect(content).toContain('fun lerp(');
    expect(content).toContain('val DefaultEmptyTokens = EmptyTokens()');
    // Ensure no unused imports
    expect(content).not.toContain('Color');
    expect(content).not.toContain('Dp');
    expect(content).not.toContain('TextUnit');
  });

  it('escapes reserved Kotlin keywords for variable property names', () => {
    const mockPrepared: PreparedCompose = {
      targetId: 'compose',
      collections: [
        {
          id: 'col:res',
          name: 'ReservedTokens',
          figmaName: 'ReservedTokens',
          className: 'ReservedTokens',
          accessor: 'reservedTokens',
          kind: 'token',
          defaultModeIndex: 0,
          fileBaseName: 'ReservedTokens',
          modes: [
            { id: 'm:1', name: 'Default', key: 'default', pascalName: 'Default' },
          ],
          variables: [
            {
              id: 'v:val',
              figmaName: 'val',
              groupPath: [],
              leafName: 'val',
              stableLeafKey: 'val',
              propertyName: '`val`',
              kotlinType: 'Dp',
              emitToPublic: true,
              valuesByMode: {
                'm:1': { kind: 'literal', value: 12 },
              },
            },
            {
              id: 'v:when',
              figmaName: 'when',
              groupPath: [],
              leafName: 'when',
              stableLeafKey: 'when',
              propertyName: '`when`',
              kotlinType: 'Boolean',
              emitToPublic: true,
              valuesByMode: {
                'm:1': { kind: 'literal', value: true },
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

    const files = emitCollections(
      mockPrepared,
      'com/example/designsystem',
      'com.example.designsystem',
    );

    const content = files[0].contents;
    expect(content).toContain('val `val`: Dp,');
    expect(content).toContain('val `when`: Boolean,');
    expect(content).toContain('`val` = 12.dp,');
    expect(content).toContain('`when` = true,');
    expect(content).toContain('`val` = lerpDp(start.`val`, stop.`val`, fraction),');
    expect(content).toContain(
      '`when` = if (fraction < 0.5f) start.`when` else stop.`when`,',
    );
  });

  it('resolves aliased variables via resolvedValuesByMode', () => {
    const mockPrepared: PreparedCompose = {
      targetId: 'compose',
      collections: [
        {
          id: 'col:alias',
          name: 'AliasTokens',
          figmaName: 'AliasTokens',
          className: 'AliasTokens',
          accessor: 'aliasTokens',
          kind: 'token',
          defaultModeIndex: 0,
          fileBaseName: 'AliasTokens',
          modes: [
            { id: 'm:1', name: 'Light', key: 'light', pascalName: 'Light' },
          ],
          variables: [
            {
              id: 'v:alias',
              figmaName: 'brandAliased',
              groupPath: [],
              leafName: 'brandAliased',
              stableLeafKey: 'brandAliased',
              propertyName: 'brandAliased',
              kotlinType: 'Color',
              emitToPublic: true,
              valuesByMode: {
                'm:1': { kind: 'alias', targetVariableId: 'v:target' },
              },
              resolvedValuesByMode: {
                'm:1': {
                  r: 0.1,
                  g: 0.2,
                  b: 0.8,
                  a: 1.0,
                  hex: '#1A33CCFF',
                  rgbaString: 'rgba(26, 51, 204, 1)',
                },
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

    const files = emitCollections(
      mockPrepared,
      'com/example/designsystem',
      'com.example.designsystem',
    );

    const content = files[0].contents;
    expect(content).toContain('brandAliased = Color(0xFF1A33CCUL)');
  });

  it('works end-to-end with prepared pipeline on GOLDEN_IR', () => {
    const graph = buildSemanticGraph(GOLDEN_IR);
    const prepared = prepareCompose(graph, null);
    const files = emitCollections(
      prepared,
      'com/example/designsystem',
      'com.example.designsystem',
    );

    expect(files.length).toBeGreaterThan(0);
    for (const f of files) {
      expect(f.path).toMatch(/^src\/main\/kotlin\/com\/example\/designsystem\/collections\/[A-Za-z0-9_]+\.kt$/);
      expect(f.contents).toContain('package com.example.designsystem.collections');
      expect(f.contents).toContain('@Immutable');
      expect(f.contents).toContain('fun lerp(');

      // Verify no syntax balance corruption
      const openParens = (f.contents.match(/\(/g) || []).length;
      const closeParens = (f.contents.match(/\)/g) || []).length;
      expect(openParens).toBe(closeParens);

      const openBraces = (f.contents.match(/\{/g) || []).length;
      const closeBraces = (f.contents.match(/\}/g) || []).length;
      expect(openBraces).toBe(closeBraces);
    }
  });
});
