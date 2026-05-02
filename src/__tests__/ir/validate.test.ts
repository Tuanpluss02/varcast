import { describe, it, expect } from 'vitest';
import { validate } from '../../ir/validate';
import type {
  IR,
  IRCollection,
  IRMode,
  IRVariable,
  IRValue,
  IRPaintStyle,
} from '../../ir/types';

function makeIR(overrides: Partial<IR> = {}): IR {
  return {
    version: '1.0',
    fileKey: 'test',
    generatedAt: '2026-04-30T00:00:00.000Z',
    collections: [],
    composites: { paintStyles: [], effectStyles: [], textStyles: [] },
    ...overrides,
  };
}

function makeVar(
  id: string,
  groupPath: string[],
  values: Record<string, IRValue>,
  type: IRVariable['type'] = 'COLOR',
  hidden = false,
): IRVariable {
  return {
    id,
    figmaName: groupPath.join('/'),
    groupPath: [...groupPath],
    type,
    scopes: [],
    hiddenFromPublishing: hidden,
    emitToPublic: !hidden,
    valuesByMode: values,
  };
}

function makeCol(
  id: string,
  modes: IRMode[],
  variables: IRVariable[],
  kind: IRCollection['kind'] = 'token',
): IRCollection {
  return { id, name: id, kind, modes, variables };
}

const M1: IRMode = { id: 'm:1', name: 'Value' };

// ── Rule 1: cycle detection ───────────────────────────────────────────────

describe('cycle detection', () => {
  it('detects a cycle of length 2', () => {
    const ir = makeIR({
      collections: [
        makeCol('col:1', [M1], [
          makeVar('v:A', ['A'], { 'm:1': { kind: 'alias', targetVariableId: 'v:B' } }),
          makeVar('v:B', ['B'], { 'm:1': { kind: 'alias', targetVariableId: 'v:A' } }),
        ]),
      ],
    });

    const result = validate(ir);
    const cycles = result.errors.filter((e) => e.type === 'CYCLE');
    expect(cycles).toHaveLength(1);
    expect(cycles[0].path).toContain('v:A');
    expect(cycles[0].path).toContain('v:B');
  });

  it('detects a cycle of length 3', () => {
    const ir = makeIR({
      collections: [
        makeCol('col:1', [M1], [
          makeVar('v:A', ['A'], { 'm:1': { kind: 'alias', targetVariableId: 'v:B' } }),
          makeVar('v:B', ['B'], { 'm:1': { kind: 'alias', targetVariableId: 'v:C' } }),
          makeVar('v:C', ['C'], { 'm:1': { kind: 'alias', targetVariableId: 'v:A' } }),
        ]),
      ],
    });

    const result = validate(ir);
    expect(result.errors.filter((e) => e.type === 'CYCLE')).toHaveLength(1);
    expect(result.errors[0].path).toEqual(
      expect.arrayContaining(['v:A', 'v:B', 'v:C']),
    );
  });

  it('detects cycle reachable via a non-entry chain', () => {
    // C → B → A → B forms a cycle (A↔B). Entry is C which is not on the cycle.
    const ir = makeIR({
      collections: [
        makeCol('col:1', [M1], [
          makeVar('v:C', ['C'], { 'm:1': { kind: 'alias', targetVariableId: 'v:B' } }),
          makeVar('v:B', ['B'], { 'm:1': { kind: 'alias', targetVariableId: 'v:A' } }),
          makeVar('v:A', ['A'], { 'm:1': { kind: 'alias', targetVariableId: 'v:B' } }),
        ]),
      ],
    });

    const result = validate(ir);
    const cycles = result.errors.filter((e) => e.type === 'CYCLE');
    expect(cycles).toHaveLength(1);
    expect(cycles[0].path).toEqual(expect.arrayContaining(['v:A', 'v:B']));
    expect(cycles[0].path).not.toContain('v:C');
  });

  it('two disjoint cycles in the same collection → reported separately', () => {
    const ir = makeIR({
      collections: [
        makeCol('col:1', [M1], [
          makeVar('v:A1', ['A1'], { 'm:1': { kind: 'alias', targetVariableId: 'v:A2' } }),
          makeVar('v:A2', ['A2'], { 'm:1': { kind: 'alias', targetVariableId: 'v:A1' } }),
          makeVar('v:B1', ['B1'], { 'm:1': { kind: 'alias', targetVariableId: 'v:B2' } }),
          makeVar('v:B2', ['B2'], { 'm:1': { kind: 'alias', targetVariableId: 'v:B1' } }),
        ]),
      ],
    });

    const result = validate(ir);
    const cycles = result.errors.filter((e) => e.type === 'CYCLE');
    expect(cycles).toHaveLength(2);
  });

  it('non-cyclic alias chain → no cycle', () => {
    const ir = makeIR({
      collections: [
        makeCol('col:1', [M1], [
          makeVar('v:A', ['A'], { 'm:1': { kind: 'alias', targetVariableId: 'v:B' } }),
          makeVar('v:B', ['B'], { 'm:1': { kind: 'literal', value: { r: 0, g: 0, b: 0, a: 1 } } }),
        ]),
      ],
    });

    const result = validate(ir);
    expect(result.errors).toHaveLength(0);
  });
});

// ── Rule 2: unresolved alias ──────────────────────────────────────────────

describe('unresolved alias', () => {
  it('marks variable emitToPublic=false and emits a warning', () => {
    const ir = makeIR({
      collections: [
        makeCol('col:1', [M1], [
          makeVar('v:A', ['A'], { 'm:1': { kind: 'alias', targetVariableId: 'v:missing' } }),
        ]),
      ],
    });

    const result = validate(ir);
    const warning = result.warnings.find((w) => w.type === 'UNRESOLVED_ALIAS');
    expect(warning).toBeDefined();
    expect(ir.collections[0].variables[0].emitToPublic).toBe(false);
  });
});

// ── Rule 3: float rounding ────────────────────────────────────────────────
// (keyword conflict + duplicate name dedup moved to generator/prepare.ts — see
//  __tests__/generator/prepare_stable_dedup.test.ts for coverage)

describe('float rounding', () => {
  it('rounds 0.30000001192092896 to 0.3', () => {
    const ir = makeIR({
      collections: [
        makeCol(
          'col:1',
          [M1],
          [
            makeVar(
              'v:1',
              ['spacing', 'sm'],
              { 'm:1': { kind: 'literal', value: 0.30000001192092896 } },
              'FLOAT',
            ),
          ],
          'primitive',
        ),
      ],
    });

    validate(ir);
    const val = ir.collections[0].variables[0].valuesByMode['m:1'];
    expect(val.kind === 'literal' && val.value).toBe(0.3);
  });

  it('does not touch COLOR / STRING / BOOLEAN', () => {
    const ir = makeIR({
      collections: [
        makeCol('col:1', [M1], [
          makeVar('v:c', ['c'], { 'm:1': { kind: 'literal', value: { r: 0.123456789, g: 0, b: 0, a: 1 } } }),
          makeVar('v:s', ['s'], { 'm:1': { kind: 'literal', value: 'Inter' } }, 'STRING'),
          makeVar('v:b', ['b'], { 'm:1': { kind: 'literal', value: true } }, 'BOOLEAN'),
        ]),
      ],
    });

    validate(ir);
    const c = ir.collections[0].variables[0].valuesByMode['m:1'];
    expect(c.kind === 'literal' && c.value).toEqual({ r: 0.123456789, g: 0, b: 0, a: 1 });
    expect((ir.collections[0].variables[1].valuesByMode['m:1'] as { value: string }).value).toBe('Inter');
    expect((ir.collections[0].variables[2].valuesByMode['m:1'] as { value: boolean }).value).toBe(true);
  });
});

// ── Rule 4: hidden flag ───────────────────────────────────────────────────

describe('hidden flag', () => {
  it('hidden variable → emitToPublic=false, no warning', () => {
    const ir = makeIR({
      collections: [
        makeCol(
          'col:1',
          [M1],
          [
            makeVar(
              'v:1',
              ['internal'],
              { 'm:1': { kind: 'literal', value: 8 } },
              'FLOAT',
              true,
            ),
          ],
        ),
      ],
    });

    const result = validate(ir);
    expect(ir.collections[0].variables[0].emitToPublic).toBe(false);
    expect(result.warnings).toHaveLength(0);
  });
});

// ── Composites: diamond + image warnings ──────────────────────────────────

describe('composite warnings', () => {
  it('GRADIENT_DIAMOND → DIAMOND_APPROXIMATED warning', () => {
    const style: IRPaintStyle = {
      id: 'S:d',
      figmaName: 'D',
      groupPath: ['D'],
      type: 'GRADIENT_DIAMOND',
      stops: [{ position: 0, color: { kind: 'literal', rgba: { r: 0, g: 0, b: 0, a: 1 } } }],
      note: 'approximated_as_radial',
    };
    const ir = makeIR({
      composites: { paintStyles: [style], effectStyles: [], textStyles: [] },
    });

    const result = validate(ir);
    expect(result.warnings.some((w) => w.type === 'DIAMOND_APPROXIMATED')).toBe(true);
  });

  // IMAGE paint styles are skipped at read-time; no validation warning emitted.
});
