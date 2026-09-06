import { describe, it, expect } from 'vitest';
import { validate } from '../../ir/validate';
import type { IR, IRCollection, IRMode, IRVariable, IRValue } from '../../ir/types';

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

describe('multi-hop alias chains across collections', () => {
  it('A-B-C across 3 collections resolves without errors', () => {
    const ir = makeIR({
      collections: [
        makeCol('col:1', [M1], [
          makeVar('v:A', ['A'], { 'm:1': { kind: 'alias', targetVariableId: 'v:B' } }),
        ]),
        makeCol('col:2', [M1], [
          makeVar('v:B', ['B'], { 'm:1': { kind: 'alias', targetVariableId: 'v:C' } }),
        ]),
        makeCol('col:3', [M1], [
          makeVar('v:C', ['C'], { 'm:1': { kind: 'literal', value: { r: 1, g: 0, b: 0, a: 1 } } }),
        ]),
      ],
    });

    const result = validate(ir);
    expect(result.errors).toHaveLength(0);
    expect(result.warnings).toHaveLength(0);
  });

  it('A-B-C-D across 4 collections resolves without errors', () => {
    const ir = makeIR({
      collections: [
        makeCol('col:1', [M1], [
          makeVar('v:A', ['A'], { 'm:1': { kind: 'alias', targetVariableId: 'v:B' } }),
        ]),
        makeCol('col:2', [M1], [
          makeVar('v:B', ['B'], { 'm:1': { kind: 'alias', targetVariableId: 'v:C' } }),
        ]),
        makeCol('col:3', [M1], [
          makeVar('v:C', ['C'], { 'm:1': { kind: 'alias', targetVariableId: 'v:D' } }),
        ]),
        makeCol('col:4', [M1], [
          makeVar('v:D', ['D'], { 'm:1': { kind: 'literal', value: 42 } }, 'FLOAT'),
        ]),
      ],
    });

    const result = validate(ir);
    expect(result.errors).toHaveLength(0);
    expect(result.warnings).toHaveLength(0);
  });

  it('cross-collection chain: emitToPublic stays true for all hops when chain resolves', () => {
    const ir = makeIR({
      collections: [
        makeCol('col:1', [M1], [
          makeVar('v:A', ['A'], { 'm:1': { kind: 'alias', targetVariableId: 'v:B' } }),
        ]),
        makeCol('col:2', [M1], [
          makeVar('v:B', ['B'], { 'm:1': { kind: 'alias', targetVariableId: 'v:C' } }),
        ]),
        makeCol('col:3', [M1], [
          makeVar('v:C', ['C'], { 'm:1': { kind: 'literal', value: { r: 0, g: 0, b: 0, a: 1 } } }),
        ]),
      ],
    });

    validate(ir);
    expect(ir.collections[0].variables[0].emitToPublic).toBe(true);
    expect(ir.collections[1].variables[0].emitToPublic).toBe(true);
    expect(ir.collections[2].variables[0].emitToPublic).toBe(true);
  });

  it('intermediate hop points to missing id: warning on that hop, not on upstream variable', () => {
    const ir = makeIR({
      collections: [
        makeCol('col:1', [M1], [
          makeVar('v:A', ['A'], { 'm:1': { kind: 'alias', targetVariableId: 'v:B' } }),
        ]),
        makeCol('col:2', [M1], [
          makeVar('v:B', ['B'], { 'm:1': { kind: 'alias', targetVariableId: 'v:MISSING' } }),
        ]),
      ],
    });

    const result = validate(ir);
    const unresolvedWarnings = result.warnings.filter((w) => w.type === 'UNRESOLVED_ALIAS');
    expect(unresolvedWarnings).toHaveLength(1);
    expect(unresolvedWarnings[0]).toMatchObject({
      type: 'UNRESOLVED_ALIAS',
      variableId: 'v:B',
      targetId: 'v:MISSING',
    });
    expect(ir.collections[1].variables[0].emitToPublic).toBe(false);
    expect(ir.collections[0].variables[0].emitToPublic).toBe(true);
  });
});

describe('cycle detection in alias chains', () => {
  it('self-referencing alias (A points to itself) is reported as a cycle', () => {
    const ir = makeIR({
      collections: [
        makeCol('col:1', [M1], [
          makeVar('v:A', ['A'], { 'm:1': { kind: 'alias', targetVariableId: 'v:A' } }),
        ]),
      ],
    });

    const result = validate(ir);
    const cycles = result.errors.filter((e) => e.type === 'CYCLE');
    expect(cycles).toHaveLength(1);
    expect(cycles[0].path).toContain('v:A');
  });

  it('A-B-A cycle across two collections is detected', () => {
    const ir = makeIR({
      collections: [
        makeCol('col:1', [M1], [
          makeVar('v:A', ['A'], { 'm:1': { kind: 'alias', targetVariableId: 'v:B' } }),
        ]),
        makeCol('col:2', [M1], [
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

  it('A-B-C-A cycle across 3 collections is detected', () => {
    const ir = makeIR({
      collections: [
        makeCol('col:1', [M1], [
          makeVar('v:A', ['A'], { 'm:1': { kind: 'alias', targetVariableId: 'v:B' } }),
        ]),
        makeCol('col:2', [M1], [
          makeVar('v:B', ['B'], { 'm:1': { kind: 'alias', targetVariableId: 'v:C' } }),
        ]),
        makeCol('col:3', [M1], [
          makeVar('v:C', ['C'], { 'm:1': { kind: 'alias', targetVariableId: 'v:A' } }),
        ]),
      ],
    });

    const result = validate(ir);
    const cycles = result.errors.filter((e) => e.type === 'CYCLE');
    expect(cycles).toHaveLength(1);
    expect(cycles[0].path).toEqual(expect.arrayContaining(['v:A', 'v:B', 'v:C']));
  });

  it('cycle nodes all exist in allVars: no UNRESOLVED_ALIAS warnings emitted', () => {
    const ir = makeIR({
      collections: [
        makeCol('col:1', [M1], [
          makeVar('v:A', ['A'], { 'm:1': { kind: 'alias', targetVariableId: 'v:B' } }),
          makeVar('v:B', ['B'], { 'm:1': { kind: 'alias', targetVariableId: 'v:A' } }),
        ]),
      ],
    });

    const result = validate(ir);
    expect(result.errors.filter((e) => e.type === 'CYCLE')).toHaveLength(1);
    expect(result.warnings.filter((w) => w.type === 'UNRESOLVED_ALIAS')).toHaveLength(0);
  });

  it('chain leading into a cycle: the pre-cycle node is not included in the cycle path', () => {
    const ir = makeIR({
      collections: [
        makeCol('col:1', [M1], [
          makeVar('v:D', ['D'], { 'm:1': { kind: 'alias', targetVariableId: 'v:A' } }),
          makeVar('v:A', ['A'], { 'm:1': { kind: 'alias', targetVariableId: 'v:B' } }),
          makeVar('v:B', ['B'], { 'm:1': { kind: 'alias', targetVariableId: 'v:A' } }),
        ]),
      ],
    });

    const result = validate(ir);
    const cycles = result.errors.filter((e) => e.type === 'CYCLE');
    expect(cycles).toHaveLength(1);
    expect(cycles[0].path).toEqual(expect.arrayContaining(['v:A', 'v:B']));
    expect(cycles[0].path).not.toContain('v:D');
  });
});

describe('alias targeting non-existent variable id', () => {
  it('single dangling alias emits UNRESOLVED_ALIAS warning and suppresses emitToPublic', () => {
    const ir = makeIR({
      collections: [
        makeCol('col:1', [M1], [
          makeVar('v:A', ['A'], { 'm:1': { kind: 'alias', targetVariableId: 'v:does-not-exist' } }),
        ]),
      ],
    });

    const result = validate(ir);
    expect(result.errors).toHaveLength(0);
    const warning = result.warnings.find((w) => w.type === 'UNRESOLVED_ALIAS');
    expect(warning).toBeDefined();
    expect(warning).toMatchObject({
      type: 'UNRESOLVED_ALIAS',
      variableId: 'v:A',
      targetId: 'v:does-not-exist',
    });
    expect(ir.collections[0].variables[0].emitToPublic).toBe(false);
  });

  it('multiple dangling aliases each produce their own UNRESOLVED_ALIAS warning', () => {
    const ir = makeIR({
      collections: [
        makeCol('col:1', [M1], [
          makeVar('v:X', ['X'], { 'm:1': { kind: 'alias', targetVariableId: 'v:ghost1' } }),
          makeVar('v:Y', ['Y'], { 'm:1': { kind: 'alias', targetVariableId: 'v:ghost2' } }),
        ]),
      ],
    });

    const result = validate(ir);
    const unresolvedWarnings = result.warnings.filter((w) => w.type === 'UNRESOLVED_ALIAS');
    expect(unresolvedWarnings).toHaveLength(2);
    const varIds = unresolvedWarnings.map((w) => (w as { variableId: string }).variableId);
    expect(varIds).toContain('v:X');
    expect(varIds).toContain('v:Y');
  });

  it('dangling alias in col:1 does not affect a valid literal variable in col:2', () => {
    const ir = makeIR({
      collections: [
        makeCol('col:1', [M1], [
          makeVar('v:A', ['A'], { 'm:1': { kind: 'alias', targetVariableId: 'v:GHOST' } }),
        ]),
        makeCol('col:2', [M1], [
          makeVar('v:B', ['B'], { 'm:1': { kind: 'literal', value: { r: 0, g: 1, b: 0, a: 1 } } }),
        ]),
      ],
    });

    validate(ir);
    expect(ir.collections[0].variables[0].emitToPublic).toBe(false);
    expect(ir.collections[1].variables[0].emitToPublic).toBe(true);
  });

  it('multi-mode variable with one mode aliasing a missing id suppresses emitToPublic', () => {
    const M2: IRMode = { id: 'm:2', name: 'Dark' };
    const ir = makeIR({
      collections: [
        makeCol('col:1', [M1, M2], [
          makeVar('v:A', ['A'], {
            'm:1': { kind: 'literal', value: { r: 0, g: 0, b: 0, a: 1 } },
            'm:2': { kind: 'alias', targetVariableId: 'v:GHOST' },
          }),
        ]),
      ],
    });

    validate(ir);
    expect(ir.collections[0].variables[0].emitToPublic).toBe(false);
  });
});
