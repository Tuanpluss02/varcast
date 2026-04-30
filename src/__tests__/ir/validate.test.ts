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
    dartName: groupPath[groupPath.length - 1],
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
  return { id, name: id, dartName: id, kind, modes, variables };
}

const M1: IRMode = { id: 'm:1', name: 'Value', dartName: 'value' };

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

// ── Rule 3: keyword conflict ──────────────────────────────────────────────

describe('keyword conflict', () => {
  it('renames "default" to "default_"', () => {
    const ir = makeIR({
      collections: [
        makeCol('col:1', [M1], [
          makeVar('v:1', ['Border', 'default'], {
            'm:1': { kind: 'literal', value: { r: 0, g: 0, b: 0, a: 1 } },
          }),
        ]),
      ],
    });

    const result = validate(ir);
    const w = result.warnings.find((w) => w.type === 'KEYWORD_CONFLICT');
    expect(w).toBeDefined();
    expect((w as { fixed: string }).fixed).toBe('default_');
    expect(ir.collections[0].variables[0].groupPath).toEqual(['Border', 'default_']);
  });

  it('renames "class" to "class_"', () => {
    const ir = makeIR({
      collections: [
        makeCol('col:1', [M1], [
          makeVar('v:1', ['utility', 'class'], {
            'm:1': { kind: 'literal', value: 1 },
          }, 'FLOAT'),
        ]),
      ],
    });

    const result = validate(ir);
    expect(ir.collections[0].variables[0].groupPath[1]).toBe('class_');
  });
});

// ── Rule 4: duplicate dartName ────────────────────────────────────────────

describe('duplicate dartName', () => {
  it('renames second/third occurrence with same full path to _2 / _3', () => {
    const ir = makeIR({
      collections: [
        makeCol('col:1', [M1], [
          makeVar('v:1', ['Background', 'primary'], {
            'm:1': { kind: 'literal', value: { r: 1, g: 1, b: 1, a: 1 } },
          }),
          makeVar('v:2', ['Background', 'primary'], {
            'm:1': { kind: 'literal', value: { r: 0, g: 0, b: 0, a: 1 } },
          }),
          makeVar('v:3', ['Background', 'primary'], {
            'm:1': { kind: 'literal', value: { r: 0.5, g: 0.5, b: 0.5, a: 1 } },
          }),
        ]),
      ],
    });

    const result = validate(ir);
    const dups = result.warnings.filter((w) => w.type === 'DUPLICATE_DART_NAME');
    expect(dups).toHaveLength(2);
    expect(ir.collections[0].variables[0].groupPath[1]).toBe('primary');
    expect(ir.collections[0].variables[1].groupPath[1]).toBe('primary_2');
    expect(ir.collections[0].variables[2].groupPath[1]).toBe('primary_3');
  });

  it('siblings with same leaf in different parent groups are NOT duplicates', () => {
    const ir = makeIR({
      collections: [
        makeCol('col:1', [M1], [
          makeVar('v:1', ['Background', 'primary'], {
            'm:1': { kind: 'literal', value: { r: 1, g: 1, b: 1, a: 1 } },
          }),
          makeVar('v:2', ['Action', 'primary'], {
            'm:1': { kind: 'literal', value: { r: 0, g: 0, b: 0, a: 1 } },
          }),
        ]),
      ],
    });

    const result = validate(ir);
    const dups = result.warnings.filter((w) => w.type === 'DUPLICATE_DART_NAME');
    expect(dups).toHaveLength(0);
    expect(ir.collections[0].variables[0].groupPath[1]).toBe('primary');
    expect(ir.collections[0].variables[1].groupPath[1]).toBe('primary');
  });
});

// ── Rule 5: float rounding ────────────────────────────────────────────────

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

// ── Rule 6: hidden flag ───────────────────────────────────────────────────

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
      dartName: 'D',
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

  it('IMAGE → IMAGE_ASSET_REQUIRED warning', () => {
    const style: IRPaintStyle = {
      id: 'S:i',
      figmaName: 'Hero',
      dartName: 'Hero',
      groupPath: ['Hero'],
      type: 'IMAGE',
      assetName: 'hero.jpg',
    };
    const ir = makeIR({
      composites: { paintStyles: [style], effectStyles: [], textStyles: [] },
    });

    const result = validate(ir);
    const w = result.warnings.find((w) => w.type === 'IMAGE_ASSET_REQUIRED');
    expect(w).toBeDefined();
    expect((w as { assetName: string }).assetName).toBe('hero.jpg');
  });
});
