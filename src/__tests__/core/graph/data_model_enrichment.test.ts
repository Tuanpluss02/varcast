import { describe, it, expect } from 'vitest';
import { buildSemanticGraph } from '../../../core/graph/build_graph';
import type { IR } from '../../../ir/types';

describe('Data Model Enrichment', () => {
  const ir: IR = {
    version: '1.0',
    fileKey: 'f1',
    generatedAt: '2026-10-21T00:00:00Z',
    collections: [
      {
        id: 'col_colors',
        name: 'Colors',
        kind: 'primitive',
        modes: [{ id: 'm1', name: 'Light' }],
        variables: [
          {
            id: 'v_blue',
            figmaName: 'blue/500',
            groupPath: ['blue', '500'],
            type: 'COLOR',
            scopes: [],
            hiddenFromPublishing: false,
            emitToPublic: true,
            valuesByMode: { m1: { kind: 'literal', value: { r: 0.1, g: 0.2, b: 0.8, a: 1 } } },
          },
        ],
      },
    ],
    composites: {
      paintStyles: [
        {
          id: 'ps_card',
          figmaName: 'card/bg',
          groupPath: ['card', 'bg'],
          type: 'SOLID',
          color: { kind: 'literal', rgba: { r: 0.5, g: 0.5, b: 0.5, a: 0.8 } },
        },
        {
          id: 'ps_gradient',
          figmaName: 'gradient/primary',
          groupPath: ['gradient', 'primary'],
          type: 'GRADIENT_LINEAR',
          angleRadians: 0,
          stops: [
            { position: 0, color: { kind: 'literal', rgba: { r: 1, g: 0, b: 0, a: 1 } } },
            { position: 1, color: { kind: 'alias', targetVariableId: 'v_blue' } },
          ],
        },
      ],
      effectStyles: [
        {
          id: 'eff_shadow',
          figmaName: 'elevation/card',
          groupPath: ['elevation', 'card'],
          type: 'DROP_SHADOW',
          color: { kind: 'alias', targetVariableId: 'v_blue' },
          offsetX: 0,
          offsetY: 4,
          blurRadius: 8,
          spreadRadius: 2,
        },
      ],
      textStyles: [],
    },
  };

  it('populates collection provenance on ResolvedVariable', () => {
    const graph = buildSemanticGraph(ir);
    const v = graph.variableIndex.get('v_blue');
    expect(v).toBeDefined();
    expect(v?.collectionId).toBe('col_colors');
    expect(v?.collectionName).toBe('Colors');
    expect(v?.collectionKind).toBe('primitive');
  });

  it('populates lossless rgba structure on ResolvedPaintStyle', () => {
    const graph = buildSemanticGraph(ir);
    const paint = graph.composites.paintStyles[0];
    expect(paint.valuesByMode.m1.rgba).toBeDefined();
    expect(paint.valuesByMode.m1.rgba?.r).toBe(0.5);
    expect(paint.valuesByMode.m1.rgba?.a).toBe(0.8);
    expect(paint.valuesByMode.m1.rgba?.hex).toBe('#808080CC');
  });

  it('populates lossless rgba structure on gradient stops', () => {
    const graph = buildSemanticGraph(ir);
    const grad = graph.composites.paintStyles[1];
    expect(grad.valuesByMode.m1.stops).toBeDefined();
    expect(grad.valuesByMode.m1.stops?.[0].rgba).toEqual({
      r: 1,
      g: 0,
      b: 0,
      a: 1,
      hex: '#FF0000FF',
      rgbaString: 'rgba(255, 0, 0, 1)',
    });
    expect(grad.valuesByMode.m1.stops?.[1].rgba).toEqual({
      r: 0.1,
      g: 0.2,
      b: 0.8,
      a: 1,
      hex: '#1A33CCFF',
      rgbaString: 'rgba(26, 51, 204, 1)',
    });
  });

  it('populates lossless rgba structure on ResolvedEffectStyle', () => {
    const graph = buildSemanticGraph(ir);
    const shadow = graph.composites.effectStyles[0];
    expect(shadow.valuesByMode.m1.rgba).toEqual({
      r: 0.1,
      g: 0.2,
      b: 0.8,
      a: 1,
      hex: '#1A33CCFF',
      rgbaString: 'rgba(26, 51, 204, 1)',
    });
  });
});
