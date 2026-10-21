import { describe, it, expect } from 'vitest';
import { buildSemanticGraph } from '../../../core/graph/build_graph';
import type { IR } from '../../../ir/types';

describe('Unified Diagnostics Pipeline', () => {
  it('records UNRESOLVED_ALIAS warning on graph when alias points to non-existent variable', () => {
    const ir: IR = {
      version: '1.0',
      fileKey: 'f1',
      generatedAt: '2026-10-21T00:00:00Z',
      collections: [
        {
          id: 'c1',
          name: 'Tokens',
          kind: 'token',
          modes: [{ id: 'm1', name: 'Default' }],
          variables: [
            {
              id: 'v_dangling',
              figmaName: 'bg',
              groupPath: ['bg'],
              type: 'COLOR',
              scopes: [],
              hiddenFromPublishing: false,
              emitToPublic: true,
              valuesByMode: { m1: { kind: 'alias', targetVariableId: 'missing_var_id' } },
            },
          ],
        },
      ],
      composites: { paintStyles: [], effectStyles: [], textStyles: [] },
    };

    const graph = buildSemanticGraph(ir);
    const unresolvedWarn = graph.warnings.find((w) => w.code === 'UNRESOLVED_ALIAS');
    expect(unresolvedWarn).toBeDefined();
    expect(unresolvedWarn?.message).toContain('missing_var_id');
  });

  it('records CYCLE warning on graph when alias loop is detected', () => {
    const ir: IR = {
      version: '1.0',
      fileKey: 'f1',
      generatedAt: '2026-10-21T00:00:00Z',
      collections: [
        {
          id: 'c1',
          name: 'Tokens',
          kind: 'token',
          modes: [{ id: 'm1', name: 'Default' }],
          variables: [
            {
              id: 'v_a',
              figmaName: 'a',
              groupPath: ['a'],
              type: 'COLOR',
              scopes: [],
              hiddenFromPublishing: false,
              emitToPublic: true,
              valuesByMode: { m1: { kind: 'alias', targetVariableId: 'v_b' } },
            },
            {
              id: 'v_b',
              figmaName: 'b',
              groupPath: ['b'],
              type: 'COLOR',
              scopes: [],
              hiddenFromPublishing: false,
              emitToPublic: true,
              valuesByMode: { m1: { kind: 'alias', targetVariableId: 'v_a' } },
            },
          ],
        },
      ],
      composites: { paintStyles: [], effectStyles: [], textStyles: [] },
    };

    const graph = buildSemanticGraph(ir);
    const cycleWarn = graph.warnings.find((w) => w.code === 'CYCLE');
    expect(cycleWarn).toBeDefined();
  });
});
