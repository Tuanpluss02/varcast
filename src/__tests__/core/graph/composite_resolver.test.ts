import { describe, it, expect } from 'vitest';
import { resolveComposites } from '../../../core/graph/composite_resolver';
import type { IRComposites } from '../../../ir/types';
import type { ResolvedVariable } from '../../../core/graph/types';

describe('Core Composite Resolution', () => {
  it('resolves paint style solid color aliases per mode', () => {
    const composites: IRComposites = {
      paintStyles: [
        {
          id: 'ps_1',
          name: 'brandPrimary',
          figmaName: 'brand/primary',
          type: 'SOLID',
          color: { kind: 'alias', targetVariableId: 'var_1' },
          opacity: 1,
        } as any,
      ],
      effectStyles: [],
      textStyles: [],
    };

    const varIndex = new Map<string, ResolvedVariable>([
      [
        'var_1',
        {
          id: 'var_1',
          figmaName: 'color/brand',
          type: 'COLOR',
          groupPath: ['color'],
          leafName: 'brand',
          scopes: [],
          emitToPublic: true,
          resolvedValuesByMode: {
            m1: { r: 1, g: 0, b: 0, a: 1, hex: '#FF0000FF', rgbaString: 'rgba(255, 0, 0, 1)' },
            m2: { r: 0, g: 0, b: 1, a: 1, hex: '#0000FFFF', rgbaString: 'rgba(0, 0, 255, 1)' },
          },
          rawValuesByMode: {},
        },
      ],
    ]);

    const modes = [
      { id: 'm1', name: 'Light', key: 'light' },
      { id: 'm2', name: 'Dark', key: 'dark' },
    ];

    const resolved = resolveComposites(composites, modes, varIndex);
    expect(resolved.paintStyles).toHaveLength(1);
    expect(resolved.paintStyles[0].valuesByMode.m1.hex).toBe('#FF0000FF');
    expect(resolved.paintStyles[0].valuesByMode.m2.hex).toBe('#0000FFFF');
  });

  it('resolves paint style gradients and images per mode', () => {
    const composites: IRComposites = {
      paintStyles: [
        {
          id: 'ps_grad',
          figmaName: 'gradients/sunset',
          groupPath: ['gradients'],
          type: 'GRADIENT_LINEAR',
          angleRadians: 0,
          stops: [
            { position: 0, color: { kind: 'literal', rgba: { r: 1, g: 0, b: 0, a: 1 } } },
            { position: 1, color: { kind: 'alias', targetVariableId: 'var_1' } },
          ],
        },
        {
          id: 'ps_img',
          figmaName: 'assets/hero',
          groupPath: ['assets'],
          type: 'IMAGE',
          assetName: 'hero_image.png',
        },
      ],
      effectStyles: [],
      textStyles: [],
    };

    const varIndex = new Map<string, ResolvedVariable>([
      [
        'var_1',
        {
          id: 'var_1',
          figmaName: 'color/brand',
          type: 'COLOR',
          groupPath: ['color'],
          leafName: 'brand',
          scopes: [],
          emitToPublic: true,
          resolvedValuesByMode: {
            m1: { r: 1, g: 1, b: 0, a: 1, hex: '#FFFF00FF', rgbaString: 'rgba(255, 255, 0, 1)' },
          },
          rawValuesByMode: {},
        },
      ],
    ]);

    const modes = [{ id: 'm1', name: 'Light', key: 'light' }];
    const resolved = resolveComposites(composites, modes, varIndex);

    expect(resolved.paintStyles).toHaveLength(2);
    // Gradient
    const grad = resolved.paintStyles[0];
    expect(grad.valuesByMode.m1.stops).toHaveLength(2);
    expect(grad.valuesByMode.m1.stops?.[0].hex).toBe('#FF0000FF');
    expect(grad.valuesByMode.m1.stops?.[1].hex).toBe('#FFFF00FF');

    // Image
    const img = resolved.paintStyles[1];
    expect(img.valuesByMode.m1.hex).toBeNull();
    expect(img.valuesByMode.m1.assetName).toBe('hero_image.png');
  });

  it('resolves effect styles (shadows and blurs) per mode', () => {
    const composites: IRComposites = {
      paintStyles: [],
      effectStyles: [
        {
          id: 'eff_drop',
          figmaName: 'elevation/card',
          groupPath: ['elevation'],
          type: 'DROP_SHADOW',
          color: { kind: 'alias', targetVariableId: 'var_shadow' },
          offsetX: 0,
          offsetY: 4,
          blurRadius: 8,
          spreadRadius: 2,
        },
        {
          id: 'eff_blur',
          figmaName: 'blur/background',
          groupPath: ['blur'],
          type: 'BACKGROUND_BLUR',
          sigmaX: 16,
          sigmaY: 16,
        },
      ],
      textStyles: [],
    };

    const varIndex = new Map<string, ResolvedVariable>([
      [
        'var_shadow',
        {
          id: 'var_shadow',
          figmaName: 'color/shadow',
          type: 'COLOR',
          groupPath: ['color'],
          leafName: 'shadow',
          scopes: [],
          emitToPublic: true,
          resolvedValuesByMode: {
            m1: { r: 0, g: 0, b: 0, a: 0.25, hex: '#00000040', rgbaString: 'rgba(0, 0, 0, 0.25)' },
          },
          rawValuesByMode: {},
        },
      ],
    ]);

    const modes = [{ id: 'm1', name: 'Light', key: 'light' }];
    const resolved = resolveComposites(composites, modes, varIndex);

    expect(resolved.effectStyles).toHaveLength(2);
    const drop = resolved.effectStyles[0];
    expect(drop.valuesByMode.m1.shadowColor).toBe('#00000040');
    expect(drop.valuesByMode.m1.offsetX).toBe(0);
    expect(drop.valuesByMode.m1.offsetY).toBe(4);
    expect(drop.valuesByMode.m1.blurRadius).toBe(8);
    expect(drop.valuesByMode.m1.spread).toBe(2);
    expect(drop.valuesByMode.m1.opacity).toBe(0.25);

    const blur = resolved.effectStyles[1];
    expect(blur.valuesByMode.m1.shadowColor).toBeNull();
    expect(blur.valuesByMode.m1.blurRadius).toBe(16);
  });

  it('resolves text styles per mode with aliases and literals', () => {
    const composites: IRComposites = {
      paintStyles: [],
      effectStyles: [],
      textStyles: [
        {
          id: 'text_h1',
          figmaName: 'typography/h1',
          groupPath: ['typography'],
          fontFamily: { kind: 'alias', targetVariableId: 'var_font' },
          fontSize: { kind: 'alias', targetVariableId: 'var_size' },
          fontWeight: { kind: 'literal', value: 700 },
          lineHeight: { kind: 'literal', value: 120, unit: 'PERCENT' },
          letterSpacing: { kind: 'literal', value: 0, unit: 'PIXELS' },
        },
      ],
    };

    const varIndex = new Map<string, ResolvedVariable>([
      [
        'var_font',
        {
          id: 'var_font',
          figmaName: 'font/family',
          type: 'STRING',
          groupPath: ['font'],
          leafName: 'family',
          scopes: [],
          emitToPublic: true,
          resolvedValuesByMode: { m1: 'Roboto' },
          rawValuesByMode: {},
        },
      ],
      [
        'var_size',
        {
          id: 'var_size',
          figmaName: 'font/size',
          type: 'FLOAT',
          groupPath: ['font'],
          leafName: 'size',
          scopes: [],
          emitToPublic: true,
          resolvedValuesByMode: { m1: 32 },
          rawValuesByMode: {},
        },
      ],
    ]);

    const modes = [{ id: 'm1', name: 'Light', key: 'light' }];
    const resolved = resolveComposites(composites, modes, varIndex);

    expect(resolved.textStyles).toHaveLength(1);
    const ts = resolved.textStyles[0];
    expect(ts.valuesByMode.m1.fontFamily).toBe('Roboto');
    expect(ts.valuesByMode.m1.fontSize).toBe(32);
    expect(ts.valuesByMode.m1.fontWeight).toBe('700');
    expect(ts.valuesByMode.m1.lineHeight).toEqual({ value: 120, unit: 'PERCENT' });
    expect(ts.valuesByMode.m1.letterSpacing).toEqual({ value: 0, unit: 'PIXELS' });
  });

  it('handles unresolvable aliases safely with null fallbacks', () => {
    const composites: IRComposites = {
      paintStyles: [
        {
          id: 'ps_missing',
          figmaName: 'brand/missing',
          groupPath: ['brand'],
          type: 'SOLID',
          color: { kind: 'alias', targetVariableId: 'non_existent_var' },
        },
      ],
      effectStyles: [
        {
          id: 'eff_missing',
          figmaName: 'shadow/missing',
          groupPath: ['shadow'],
          type: 'DROP_SHADOW',
          color: { kind: 'alias', targetVariableId: 'non_existent_var' },
          offsetX: 0,
          offsetY: 2,
          blurRadius: 4,
          spreadRadius: 0,
        },
      ],
      textStyles: [
        {
          id: 'ts_missing',
          figmaName: 'text/missing',
          groupPath: ['text'],
          fontFamily: { kind: 'alias', targetVariableId: 'non_existent_var' },
          fontSize: { kind: 'alias', targetVariableId: 'non_existent_var' },
          fontWeight: { kind: 'alias', targetVariableId: 'non_existent_var' },
          lineHeight: { kind: 'alias', targetVariableId: 'non_existent_var' },
          letterSpacing: { kind: 'alias', targetVariableId: 'non_existent_var' },
        },
      ],
    };

    const modes = [{ id: 'm1', name: 'Light', key: 'light' }];
    const resolved = resolveComposites(composites, modes, new Map());

    expect(resolved.paintStyles[0].valuesByMode.m1.hex).toBeNull();
    expect(resolved.effectStyles[0].valuesByMode.m1.shadowColor).toBeNull();
    expect(resolved.textStyles[0].valuesByMode.m1.fontFamily).toBeNull();
    expect(resolved.textStyles[0].valuesByMode.m1.fontSize).toBeNull();
    expect(resolved.textStyles[0].valuesByMode.m1.fontWeight).toBeNull();
    expect(resolved.textStyles[0].valuesByMode.m1.lineHeight).toBeNull();
    expect(resolved.textStyles[0].valuesByMode.m1.letterSpacing).toBeNull();
  });

  it('integrates into buildSemanticGraph seamlessly', async () => {
    const { buildSemanticGraph } = await import('../../../core/graph/build_graph');
    const ir = {
      version: '1.0' as const,
      fileKey: 'file_test',
      generatedAt: '2026-10-21T00:00:00Z',
      collections: [
        {
          id: 'col_1',
          name: 'Colors',
          kind: 'primitive' as const,
          modes: [{ id: 'm1', name: 'Light' }],
          variables: [
            {
              id: 'var_red',
              figmaName: 'red',
              groupPath: ['red'],
              type: 'COLOR' as const,
              scopes: [],
              hiddenFromPublishing: false,
              emitToPublic: true,
              valuesByMode: {
                m1: { kind: 'literal' as const, value: { r: 1, g: 0, b: 0, a: 1 } },
              },
            },
          ],
        },
      ],
      composites: {
        paintStyles: [
          {
            id: 'ps_solid',
            figmaName: 'Color/Red',
            groupPath: ['Color'],
            type: 'SOLID' as const,
            color: { kind: 'alias' as const, targetVariableId: 'var_red' },
          },
        ],
        effectStyles: [],
        textStyles: [],
      },
    };

    const graph = buildSemanticGraph(ir);
    expect(graph.composites.paintStyles).toHaveLength(1);
    expect(graph.composites.paintStyles[0].valuesByMode.m1.hex).toBe('#FF0000FF');
    expect(graph.composites.paintStyles[0].name).toBe('colorRed');
  });
});
