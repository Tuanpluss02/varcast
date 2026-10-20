import { describe, it, expect } from 'vitest';
import { validate } from '../../ir/validate';
import type { IR, IRCollection, IRMode, IRVariable, IRValue } from '../../ir/types';

function deepFreeze<T>(obj: T): T {
  if (obj === null || typeof obj !== 'object') {
    return obj;
  }
  Object.freeze(obj);
  for (const key of Object.keys(obj)) {
    const val = (obj as Record<string, unknown>)[key];
    if (val !== null && typeof val === 'object' && !Object.isFrozen(val)) {
      deepFreeze(val);
    }
  }
  return obj;
}

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
    emitToPublic: true,
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

describe('pure validation', () => {
  it('does not mutate IR when validating float values, unresolved aliases, and hidden flags', () => {
    const rawFloat = 0.30000001192092896;
    const ir: IR = makeIR({
      collections: [
        makeCol('col:1', [M1], [
          makeVar('v:float', ['spacing', 'sm'], { 'm:1': { kind: 'literal', value: rawFloat } }, 'FLOAT'),
          makeVar('v:dangling', ['color', 'missing'], { 'm:1': { kind: 'alias', targetVariableId: 'v:not_found' } }, 'COLOR'),
          makeVar('v:hidden', ['color', 'secret'], { 'm:1': { kind: 'literal', value: 'secret' } }, 'STRING', true),
        ]),
      ],
      composites: {
        paintStyles: [
          {
            id: 'S:diamond',
            figmaName: 'Diamond Gradient',
            groupPath: ['Diamond Gradient'],
            type: 'GRADIENT_DIAMOND',
            stops: [{ position: 0, color: { kind: 'literal', rgba: { r: 1, g: 1, b: 1, a: 1 } } }],
            note: 'approximated_as_radial',
          },
        ],
        effectStyles: [],
        textStyles: [],
      },
    });

    const snapshot = JSON.parse(JSON.stringify(ir));

    // Freeze deep so any mutation in validate() throws TypeError
    deepFreeze(ir);

    let result;
    expect(() => {
      result = validate(ir);
    }).not.toThrow();

    expect(result).toBeDefined();
    expect(result!.errors).toHaveLength(0);
    expect(result!.warnings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ type: 'UNRESOLVED_ALIAS', variableId: 'v:dangling', targetId: 'v:not_found' }),
        expect.objectContaining({ type: 'DIAMOND_APPROXIMATED', styleId: 'S:diamond' }),
      ]),
    );

    // Verify IR is strictly unchanged
    expect(ir).toEqual(snapshot);
  });
});
