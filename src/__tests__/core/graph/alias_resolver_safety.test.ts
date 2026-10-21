import { describe, it, expect } from 'vitest';
import { isSemanticGraph } from '../../../core/graph/types';
import { buildSemanticGraph } from '../../../core/graph/build_graph';
import { runEngine } from '../../../core/emit_engine';
import type { Target } from '../../../core/target';
import type { IR, IRVariable } from '../../../ir/types';

function createTestVariable(
  id: string,
  figmaName: string,
  valuesByMode: IRVariable['valuesByMode'],
  type: IRVariable['type'] = 'COLOR',
): IRVariable {
  return {
    id,
    figmaName,
    groupPath: [figmaName],
    type,
    scopes: [],
    hiddenFromPublishing: false,
    emitToPublic: true,
    valuesByMode,
  };
}

describe('Alias Resolver Safety & Graph Type Guard', () => {
  it('isSemanticGraph accurately discriminates Graph vs IR', () => {
    expect(isSemanticGraph(null)).toBe(false);
    expect(isSemanticGraph({ fileKey: 'abc', collections: [] })).toBe(false);
    expect(isSemanticGraph({ fileKey: 'abc', collections: [], variableIndex: new Map(), allModes: [] })).toBe(true);
  });

  it('warns when cross-mode fallback occurs on a multi-mode target variable', () => {
    const ir: IR = {
      version: '1.0',
      fileKey: 'f1',
      generatedAt: '2026-10-21T00:00:00Z',
      collections: [
        {
          id: 'col_target',
          name: 'Colors',
          kind: 'primitive',
          modes: [{ id: 'm1', name: 'Light' }, { id: 'm2', name: 'Dark' }],
          variables: [
            createTestVariable('var_primitive', 'brand', {
              m1: { kind: 'literal', value: { r: 1, g: 0, b: 0, a: 1 } },
              m2: { kind: 'literal', value: { r: 0, g: 1, b: 0, a: 1 } },
            }),
          ],
        },
        {
          id: 'col_source',
          name: 'Components',
          kind: 'token',
          modes: [{ id: 'm_other', name: 'Default' }],
          variables: [
            createTestVariable('var_btn', 'btn_bg', {
              m_other: { kind: 'alias', targetVariableId: 'var_primitive' },
            }),
          ],
        },
      ],
      composites: { paintStyles: [], effectStyles: [], textStyles: [] },
    };

    const graph = buildSemanticGraph(ir);
    expect(graph.warnings.some((w) => w.code === 'MODE_FALLBACK_APPROXIMATED')).toBe(true);
  });

  it('does NOT warn when fallback occurs on a single-mode target variable', () => {
    const ir: IR = {
      version: '1.0',
      fileKey: 'f1',
      generatedAt: '2026-10-21T00:00:00Z',
      collections: [
        {
          id: 'col_target',
          name: 'Colors',
          kind: 'primitive',
          modes: [{ id: 'm1', name: 'Light' }],
          variables: [
            createTestVariable('var_primitive', 'brand', {
              m1: { kind: 'literal', value: { r: 1, g: 0, b: 0, a: 1 } },
            }),
          ],
        },
        {
          id: 'col_source',
          name: 'Components',
          kind: 'token',
          modes: [{ id: 'm_other', name: 'Default' }],
          variables: [
            createTestVariable('var_btn', 'btn_bg', {
              m_other: { kind: 'alias', targetVariableId: 'var_primitive' },
            }),
          ],
        },
      ],
      composites: { paintStyles: [], effectStyles: [], textStyles: [] },
    };

    const graph = buildSemanticGraph(ir);
    expect(graph.warnings.some((w) => w.code === 'MODE_FALLBACK_APPROXIMATED')).toBe(false);
  });

  it('runEngine collects graph warnings into output warnings', () => {
    const ir: IR = {
      version: '1.0',
      fileKey: 'f1',
      generatedAt: '2026-10-21T00:00:00Z',
      collections: [
        {
          id: 'col_target',
          name: 'Colors',
          kind: 'primitive',
          modes: [{ id: 'm1', name: 'Light' }, { id: 'm2', name: 'Dark' }],
          variables: [
            createTestVariable('var_primitive', 'brand', {
              m1: { kind: 'literal', value: { r: 1, g: 0, b: 0, a: 1 } },
              m2: { kind: 'literal', value: { r: 0, g: 1, b: 0, a: 1 } },
            }),
          ],
        },
        {
          id: 'col_source',
          name: 'Components',
          kind: 'token',
          modes: [{ id: 'm_other', name: 'Default' }],
          variables: [
            createTestVariable('var_btn', 'btn_bg', {
              m_other: { kind: 'alias', targetVariableId: 'var_primitive' },
            }),
          ],
        },
      ],
      composites: { paintStyles: [], effectStyles: [], textStyles: [] },
    };

    const mockTarget: Target<unknown> = {
      id: 'mock',
      displayName: 'Mock',
      defaultPackageName: 'mock',
      prepare: () => ({
        nextManifestSection: { collections: {}, variables: {} },
        warnings: [],
      }),
      emit: () => [],
    };

    const output = runEngine(ir, [mockTarget], null);
    expect(output.warnings.some((w) => w.code === 'MODE_FALLBACK_APPROXIMATED')).toBe(true);
  });
});
