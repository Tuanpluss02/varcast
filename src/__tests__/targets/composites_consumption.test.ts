import { describe, it, expect } from 'vitest';
import { buildSemanticGraph } from '../../core/graph/build_graph';
import { flutterTarget } from '../../targets/flutter';
import { reactNativeTarget } from '../../targets/react_native';
import type { IR } from '../../ir/types';

describe('Targets Consume Resolved Composites', () => {
  const ir: IR = {
    version: '1.0',
    fileKey: 'f1',
    generatedAt: '2026-10-21T00:00:00Z',
    collections: [
      {
        id: 'c1',
        name: 'Colors',
        kind: 'primitive',
        modes: [
          { id: 'm1', name: 'Light' },
          { id: 'm2', name: 'Dark' },
        ],
        variables: [
          {
            id: 'v1',
            figmaName: 'surface',
            groupPath: ['surface'],
            type: 'COLOR',
            scopes: ['ALL_FILLS'],
            hiddenFromPublishing: false,
            emitToPublic: true,
            valuesByMode: {
              m1: { kind: 'literal', value: { r: 1, g: 1, b: 1, a: 1 } },
              m2: { kind: 'literal', value: { r: 0.1, g: 0.1, b: 0.1, a: 1 } },
            },
          },
          {
            id: 'v_shadow',
            figmaName: 'shadow/color',
            groupPath: ['shadow', 'color'],
            type: 'COLOR',
            scopes: ['ALL_FILLS'],
            hiddenFromPublishing: false,
            emitToPublic: true,
            valuesByMode: {
              m1: { kind: 'literal', value: { r: 0, g: 0, b: 0, a: 0.2 } },
              m2: { kind: 'literal', value: { r: 0, g: 0, b: 0, a: 0.8 } },
            },
          },
        ],
      },
      {
        id: 'c2',
        name: 'Typography',
        kind: 'primitive',
        modes: [
          { id: 'm1', name: 'Light' },
          { id: 'm2', name: 'Dark' },
        ],
        variables: [
          {
            id: 'v_font',
            figmaName: 'font/family',
            groupPath: ['font', 'family'],
            type: 'STRING',
            scopes: ['TEXT_CONTENT'],
            hiddenFromPublishing: false,
            emitToPublic: true,
            valuesByMode: {
              m1: { kind: 'literal', value: 'Inter' },
              m2: { kind: 'literal', value: 'Roboto' },
            },
          },
          {
            id: 'v_size',
            figmaName: 'font/size',
            groupPath: ['font', 'size'],
            type: 'FLOAT',
            scopes: ['FONT_SIZE'],
            hiddenFromPublishing: false,
            emitToPublic: true,
            valuesByMode: {
              m1: { kind: 'literal', value: 24 },
              m2: { kind: 'literal', value: 28 },
            },
          },
        ],
      },
    ],
    composites: {
      paintStyles: [
        {
          id: 'p1',
          figmaName: 'Card / Bg',
          groupPath: ['Card', 'Bg'],
          type: 'SOLID',
          color: { kind: 'alias', targetVariableId: 'v1' },
        },
      ],
      effectStyles: [
        {
          id: 'e1',
          figmaName: 'Card / Shadow',
          groupPath: ['Card', 'Shadow'],
          type: 'DROP_SHADOW',
          color: { kind: 'alias', targetVariableId: 'v_shadow' },
          offsetX: 0,
          offsetY: 4,
          blurRadius: 8,
          spreadRadius: 2,
        },
      ],
      textStyles: [
        {
          id: 't1',
          figmaName: 'Card / Heading',
          groupPath: ['Card', 'Heading'],
          fontFamily: { kind: 'alias', targetVariableId: 'v_font' },
          fontSize: { kind: 'alias', targetVariableId: 'v_size' },
          fontWeight: { kind: 'literal', value: 700 },
          lineHeight: { kind: 'literal', value: 32, unit: 'PIXELS' },
          letterSpacing: { kind: 'literal', value: 0.5, unit: 'PIXELS' },
        },
      ],
    },
  };

  it('React Native emits valid composites using pre-resolved data across modes', () => {
    const graph = buildSemanticGraph(ir);
    const prepared = reactNativeTarget.prepare(graph, null);
    const files = reactNativeTarget.emit(prepared);

    const colorStylesFile = files.find((f) => f.path.includes('colorStyles.ts'));
    expect(colorStylesFile).toBeDefined();
    expect(colorStylesFile?.contents).toContain('#FFFFFFFF'); // Light mode
    expect(colorStylesFile?.contents).toContain('#1A1A1AFF'); // Dark mode

    const shadowsFile = files.find((f) => f.path.includes('shadows.ts'));
    expect(shadowsFile).toBeDefined();
    expect(shadowsFile?.contents).toContain('cardShadow');
    expect(shadowsFile?.contents).toContain('"shadowRadius": 8');
    expect(shadowsFile?.contents).toContain('"lightMode"');
    expect(shadowsFile?.contents).toContain('"darkMode"');

    const textStylesFile = files.find((f) => f.path.includes('textStyles.ts'));
    expect(textStylesFile).toBeDefined();
    expect(textStylesFile?.contents).toContain('heading');
    expect(textStylesFile?.contents).toContain('Inter');
    expect(textStylesFile?.contents).toContain('Roboto');
    expect(textStylesFile?.contents).toContain('"fontSize": 24');
    expect(textStylesFile?.contents).toContain('"fontSize": 28');
    expect(textStylesFile?.contents).toContain('"fontWeight": "700"');
  });

  it('Flutter emits valid color styles using pre-resolved graph', () => {
    const graph = buildSemanticGraph(ir);
    const prepared = flutterTarget.prepare(graph, null);
    const files = flutterTarget.emit(prepared);
    const colorStylesFile = files.find((f) => f.path.includes('color_styles.dart'));
    expect(colorStylesFile).toBeDefined();
    expect(colorStylesFile?.contents).toContain('cardBg');

    const shadowsFile = files.find((f) => f.path.includes('shadows.dart'));
    expect(shadowsFile).toBeDefined();
    expect(shadowsFile?.contents).toContain('cardShadow');

    const textStylesFile = files.find((f) => f.path.includes('text_styles.dart'));
    expect(textStylesFile).toBeDefined();
    expect(textStylesFile?.contents).toContain('cardHeading');
  });
});
