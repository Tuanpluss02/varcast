import { describe, it, expect } from 'vitest';
import { emitComposites } from '../../../targets/compose/generator/emit_composites';
import { prepareCompose } from '../../../targets/compose/generator/prepare';
import { buildSemanticGraph } from '../../../core/graph/build_graph';
import type { IR } from '../../../ir/types';

const GOLDEN_IR: IR = require('../../../../test_fixtures/golden_tokens.json');

describe('Compose Composites Emitter', () => {
  it('emits ColorStyles with Brushes, TextStyles with TextStyle, and Shadows', () => {
    const mockPrepared: any = {
      paintStyles: [
        {
          id: 'p:1',
          type: 'GRADIENT_LINEAR',
          getterName: 'primaryGradient',
          stops: [
            { position: 0, colorExpr: 'Color(0xFF000000)' },
            { position: 1, colorExpr: 'Color(0xFFFFFFFF)' },
          ],
          angleRadians: 0,
        },
      ],
      textStyles: [
        {
          id: 't:1',
          getterName: 'heading1',
          fontSizeSp: 32,
          fontWeight: 700,
          lineHeightSp: 40,
        },
      ],
      effectStyles: [
        {
          id: 'e:1',
          getterName: 'cardElevation',
          colorExpr: 'Color(0x33000000)',
          offsetX: 0,
          offsetY: 4,
          blurRadius: 8,
        },
      ],
    };

    const files = emitComposites(
      mockPrepared,
      'com/example/designsystem',
      'com.example.designsystem',
    );

    expect(files.some((f) => f.path.endsWith('ColorStyles.kt'))).toBe(true);
    expect(files.some((f) => f.path.endsWith('TextStyles.kt'))).toBe(true);
    expect(files.some((f) => f.path.endsWith('Shadows.kt'))).toBe(true);
  });

  describe('ColorStyles.kt generation', () => {
    it('supports SOLID, GRADIENT_LINEAR, GRADIENT_RADIAL, and GRADIENT_SWEEP / ANGULAR', () => {
      const mockPrepared: any = {
        paintStyles: [
          {
            id: 'p:solid',
            type: 'SOLID',
            getterName: 'surfaceColor',
            colorExpr: 'Color(0xFF1E293B)',
          },
          {
            id: 'p:linear',
            type: 'GRADIENT_LINEAR',
            getterName: 'horizontalGradient',
            stops: [
              { position: 0, colorExpr: 'Color(0xFF000000)' },
              { position: 1, colorExpr: 'Color(0xFFFFFFFF)' },
            ],
            angleRadians: 0,
          },
          {
            id: 'p:radial',
            type: 'GRADIENT_RADIAL',
            getterName: 'glowRadial',
            stops: [
              { position: 0, colorExpr: 'Color(0xFFFF0000)' },
              { position: 1, colorExpr: 'Color(0x00000000)' },
            ],
          },
          {
            id: 'p:sweep',
            type: 'GRADIENT_ANGULAR',
            getterName: 'rainbowSweep',
            stops: [
              { position: 0, colorExpr: 'Color(0xFFFF0000)' },
              { position: 0.5, colorExpr: 'Color(0xFF00FF00)' },
              { position: 1, colorExpr: 'Color(0xFF0000FF)' },
            ],
          },
        ],
        textStyles: [],
        effectStyles: [],
      };

      const files = emitComposites(
        mockPrepared,
        'com/example/designsystem',
        'com.example.designsystem',
      );
      const colorFile = files.find((f) => f.path.endsWith('ColorStyles.kt'))!;
      expect(colorFile).toBeDefined();

      const content = colorFile.contents;
      expect(content).toContain('package com.example.designsystem.composites');
      expect(content).toContain('@Immutable');
      expect(content).toContain('object DSColorStyles');

      // SolidColor check
      expect(content).toContain('val surfaceColor: SolidColor = SolidColor(Color(0xFF1E293BUL))');

      // LinearGradient with angle conversion check
      // For angleRadians = 0: cos(0)=1, sin(0)=0 -> start = Offset(0f, 0.5f), end = Offset(1f, 0.5f)
      expect(content).toContain('val horizontalGradient: Brush = Brush.linearGradient(');
      expect(content).toContain('colorStops = arrayOf(');
      expect(content).toContain('0f to Color(0xFF000000UL)');
      expect(content).toContain('1f to Color(0xFFFFFFFFUL)');
      expect(content).toContain('start = Offset(0f, 0.5f)');
      expect(content).toContain('end = Offset(1f, 0.5f)');

      // Radial gradient check
      expect(content).toContain('val glowRadial: Brush = Brush.radialGradient(');

      // Sweep gradient check
      expect(content).toContain('val rainbowSweep: Brush = Brush.sweepGradient(');
    });
  });

  describe('TextStyles.kt generation', () => {
    it('emits TextStyle with fontSize, fontWeight, lineHeight, letterSpacing, and fontFamily', () => {
      const mockPrepared: any = {
        paintStyles: [],
        textStyles: [
          {
            id: 't:1',
            getterName: 'headlineLarge',
            fontSizeSp: 32,
            fontWeight: 700,
            lineHeightSp: 40,
            letterSpacingSp: 0.5,
          },
          {
            id: 't:2',
            getterName: 'bodyMedium',
            fontSizeSp: 16,
            fontWeight: 400,
            lineHeightSp: 24,
          },
        ],
        effectStyles: [],
      };

      const files = emitComposites(
        mockPrepared,
        'com/example/designsystem',
        'com.example.designsystem',
      );
      const textFile = files.find((f) => f.path.endsWith('TextStyles.kt'))!;
      expect(textFile).toBeDefined();

      const content = textFile.contents;
      expect(content).toContain('package com.example.designsystem.composites');
      expect(content).toContain('@Immutable');
      expect(content).toContain('object DSTextStyles');

      // headlineLarge check
      expect(content).toContain('val headlineLarge: TextStyle = TextStyle(');
      expect(content).toContain('fontSize = 32.sp');
      expect(content).toContain('fontWeight = FontWeight(700)');
      expect(content).toContain('lineHeight = 40.sp');
      expect(content).toContain('letterSpacing = 0.5.sp');
      expect(content).toContain('fontFamily = FontFamily.Default');

      // bodyMedium check (default letterSpacing = 0.sp)
      expect(content).toContain('val bodyMedium: TextStyle = TextStyle(');
      expect(content).toContain('fontSize = 16.sp');
      expect(content).toContain('fontWeight = FontWeight(400)');
      expect(content).toContain('lineHeight = 24.sp');
      expect(content).toContain('letterSpacing = 0.sp');
    });
  });

  describe('Shadows.kt generation', () => {
    it('emits ShadowToken data class, modifier helper, and DSShadows object', () => {
      const mockPrepared: any = {
        paintStyles: [],
        textStyles: [],
        effectStyles: [
          {
            id: 'e:1',
            getterName: 'elevationLow',
            colorExpr: 'Color(0x1A000000)',
            offsetX: 0,
            offsetY: 2,
            blurRadius: 4,
            spread: 0,
          },
          {
            id: 'e:2',
            getterName: 'elevationHigh',
            colorExpr: 'Color(0x33000000)',
            offsetX: 2,
            offsetY: 8,
            blurRadius: 16,
            spread: 4,
          },
        ],
      };

      const files = emitComposites(
        mockPrepared,
        'com/example/designsystem',
        'com.example.designsystem',
      );
      const shadowFile = files.find((f) => f.path.endsWith('Shadows.kt'))!;
      expect(shadowFile).toBeDefined();

      const content = shadowFile.contents;
      expect(content).toContain('package com.example.designsystem.composites');
      expect(content).toContain('@Immutable');
      expect(content).toContain('data class ShadowToken(');
      expect(content).toContain('val color: Color');
      expect(content).toContain('val offsetX: Dp');
      expect(content).toContain('val offsetY: Dp');
      expect(content).toContain('val blurRadius: Dp');
      expect(content).toContain('val spread: Dp = 0.dp');

      // Modifier helper
      expect(content).toContain('fun Modifier.dropShadow(');

      // DSShadows object
      expect(content).toContain('object DSShadows');
      expect(content).toContain('val elevationLow: ShadowToken = ShadowToken(');
      expect(content).toContain('color = Color(0x1A000000UL)');
      expect(content).toContain('offsetX = 0.dp');
      expect(content).toContain('offsetY = 2.dp');
      expect(content).toContain('blurRadius = 4.dp');
      expect(content).toContain('spread = 0.dp');

      expect(content).toContain('val elevationHigh: ShadowToken = ShadowToken(');
      expect(content).toContain('color = Color(0x33000000UL)');
      expect(content).toContain('offsetX = 2.dp');
      expect(content).toContain('offsetY = 8.dp');
      expect(content).toContain('blurRadius = 16.dp');
      expect(content).toContain('spread = 4.dp');
    });
  });

  describe('Empty composites handling', () => {
    it('emits empty DSColorStyles, DSTextStyles, and DSShadows objects gracefully', () => {
      const mockPrepared: any = {
        paintStyles: [],
        textStyles: [],
        effectStyles: [],
      };

      const files = emitComposites(
        mockPrepared,
        'com/example/designsystem',
        'com.example.designsystem',
      );
      expect(files).toHaveLength(3);

      const colorFile = files.find((f) => f.path.endsWith('ColorStyles.kt'))!;
      expect(colorFile.contents).toContain('object DSColorStyles');

      const textFile = files.find((f) => f.path.endsWith('TextStyles.kt'))!;
      expect(textFile.contents).toContain('object DSTextStyles');

      const shadowFile = files.find((f) => f.path.endsWith('Shadows.kt'))!;
      expect(shadowFile.contents).toContain('data class ShadowToken(');
      expect(shadowFile.contents).toContain('object DSShadows');
    });
  });

  describe('Golden tokens integration', () => {
    it('emits valid composites from real prepareCompose pipeline', () => {
      const graph = buildSemanticGraph(GOLDEN_IR);
      const prepared = prepareCompose(graph, null);

      const files = emitComposites(
        prepared,
        'com/example/designsystem',
        'com.example.designsystem',
      );

      expect(files).toHaveLength(3);

      const colorFile = files.find((f) => f.path.endsWith('ColorStyles.kt'))!;
      const textFile = files.find((f) => f.path.endsWith('TextStyles.kt'))!;
      const shadowFile = files.find((f) => f.path.endsWith('Shadows.kt'))!;

      expect(colorFile.contents).toContain('object DSColorStyles');
      expect(textFile.contents).toContain('object DSTextStyles');
      expect(shadowFile.contents).toContain('object DSShadows');

      // Verify that golden linear gradients were converted
      expect(colorFile.contents).toContain('Brush.linearGradient(');
      // Verify that golden text styles were converted
      expect(textFile.contents).toContain('TextStyle(');
      // Verify that golden shadows were converted
      expect(shadowFile.contents).toContain('ShadowToken(');
    });
  });

  describe('Kotlin keyword escaping', () => {
    it('escapes reserved Kotlin keywords in getter names', () => {
      const mockPrepared: any = {
        paintStyles: [
          {
            id: 'p:1',
            type: 'SOLID',
            getterName: 'val',
            colorExpr: 'Color(0xFF000000)',
          },
        ],
        textStyles: [
          {
            id: 't:1',
            getterName: 'class',
            fontSizeSp: 16,
            fontWeight: 400,
            lineHeightSp: 20,
          },
        ],
        effectStyles: [
          {
            id: 'e:1',
            getterName: 'package',
            colorExpr: 'Color(0x33000000)',
            offsetX: 0,
            offsetY: 2,
            blurRadius: 4,
          },
        ],
      };

      const files = emitComposites(
        mockPrepared,
        'com/example/designsystem',
        'com.example.designsystem',
      );

      const colorFile = files.find((f) => f.path.endsWith('ColorStyles.kt'))!;
      expect(colorFile.contents).toContain('val `val`: SolidColor =');

      const textFile = files.find((f) => f.path.endsWith('TextStyles.kt'))!;
      expect(textFile.contents).toContain('val `class`: TextStyle =');

      const shadowFile = files.find((f) => f.path.endsWith('Shadows.kt'))!;
      expect(shadowFile.contents).toContain('val `package`: ShadowToken =');
    });
  });
});
