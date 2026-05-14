import { describe, expect, it } from 'vitest';
import type { IR } from '../../../../ir/types';
import {
  resolveAllVariableLiterals,
  resolveColorValue,
  resolveTextValue,
  resolveTextValueWithUnit,
} from '../../../../targets/react_native/shared/composite_resolve';

function makeIR(): IR {
  return {
    version: '1.0',
    fileKey: 'k',
    generatedAt: new Date(0).toISOString(),
    collections: [
      {
        id: 'col:primitives',
        name: 'Color Primitives',
        kind: 'primitive',
        modes: [{ id: 'm:base', name: 'Base' }],
        variables: [
          {
            id: 'var:red500',
            figmaName: 'red/500',
            groupPath: ['red', '500'],
            type: 'COLOR',
            scopes: [],
            hiddenFromPublishing: false,
            emitToPublic: true,
            valuesByMode: {
              'm:base': { kind: 'literal', value: { r: 1, g: 0, b: 0, a: 1 } },
            },
          },
          {
            id: 'var:size16',
            figmaName: 'size/16',
            groupPath: ['size', '16'],
            type: 'FLOAT',
            scopes: [],
            hiddenFromPublishing: false,
            emitToPublic: true,
            valuesByMode: {
              'm:base': { kind: 'literal', value: 16 },
            },
          },
        ],
      },
      {
        id: 'col:tokens',
        name: 'Tokens',
        kind: 'token',
        modes: [
          { id: 'm:dark', name: 'Dark' },
          { id: 'm:light', name: 'Light' },
        ],
        variables: [
          {
            id: 'var:textBrand',
            figmaName: 'text/brand',
            groupPath: ['text', 'brand'],
            type: 'COLOR',
            scopes: [],
            hiddenFromPublishing: false,
            emitToPublic: true,
            valuesByMode: {
              'm:dark': { kind: 'alias', targetVariableId: 'var:red500' },
              'm:light': { kind: 'literal', value: { r: 0, g: 0, b: 1, a: 1 } },
            },
          },
          {
            id: 'var:cycleA',
            figmaName: 'cycle/a',
            groupPath: ['cycle', 'a'],
            type: 'COLOR',
            scopes: [],
            hiddenFromPublishing: false,
            emitToPublic: true,
            valuesByMode: {
              'm:dark': { kind: 'alias', targetVariableId: 'var:cycleB' },
              'm:light': { kind: 'alias', targetVariableId: 'var:cycleB' },
            },
          },
          {
            id: 'var:cycleB',
            figmaName: 'cycle/b',
            groupPath: ['cycle', 'b'],
            type: 'COLOR',
            scopes: [],
            hiddenFromPublishing: false,
            emitToPublic: true,
            valuesByMode: {
              'm:dark': { kind: 'alias', targetVariableId: 'var:cycleA' },
              'm:light': { kind: 'alias', targetVariableId: 'var:cycleA' },
            },
          },
        ],
      },
    ],
    composites: { paintStyles: [], effectStyles: [], textStyles: [] },
  };
}

describe('resolveAllVariableLiterals', () => {
  it('resolves literals across modes', () => {
    const out = resolveAllVariableLiterals(makeIR());
    expect(out['m:base']['var:red500']).toBe('#FF0000FF');
    expect(out['m:base']['var:size16']).toBe(16);
  });

  it('resolves cross-collection aliases per mode', () => {
    const out = resolveAllVariableLiterals(makeIR());
    expect(out['m:dark']['var:textBrand']).toBe('#FF0000FF');
    expect(out['m:light']['var:textBrand']).toBe('#0000FFFF');
  });

  it('drops cyclic aliases without throwing', () => {
    const out = resolveAllVariableLiterals(makeIR());
    expect(out['m:dark']['var:cycleA']).toBeUndefined();
    expect(out['m:dark']['var:cycleB']).toBeUndefined();
  });

  it('falls back to default mode value via reader (not this layer) — missing entries stay missing', () => {
    // The reader is responsible for back-filling missing-mode values from the
    // default mode. This resolver respects whatever it sees in IR.
    const ir = makeIR();
    // simulate a variable missing its m:dark value entirely
    ir.collections[1].variables[0].valuesByMode = {
      'm:light': { kind: 'literal', value: { r: 0, g: 1, b: 0, a: 1 } },
    };
    const out = resolveAllVariableLiterals(ir);
    expect(out['m:dark']['var:textBrand']).toBeUndefined();
    expect(out['m:light']['var:textBrand']).toBe('#00FF00FF');
  });
});

describe('resolveColorValue', () => {
  it('returns the literal hex when not aliased', () => {
    const ir = makeIR();
    const resolved = resolveAllVariableLiterals(ir);
    expect(
      resolveColorValue('m:base', { kind: 'literal', rgba: { r: 1, g: 1, b: 1, a: 1 } }, resolved),
    ).toBe('#FFFFFFFF');
  });

  it('follows an alias to a hex string', () => {
    const ir = makeIR();
    const resolved = resolveAllVariableLiterals(ir);
    expect(
      resolveColorValue('m:dark', { kind: 'alias', targetVariableId: 'var:textBrand' }, resolved),
    ).toBe('#FF0000FF');
  });

  it('returns null when alias target is missing', () => {
    const ir = makeIR();
    const resolved = resolveAllVariableLiterals(ir);
    expect(
      resolveColorValue('m:dark', { kind: 'alias', targetVariableId: 'var:nope' }, resolved),
    ).toBeNull();
  });
});

describe('resolveTextValue / resolveTextValueWithUnit', () => {
  it('returns literal text values directly', () => {
    const ir = makeIR();
    const resolved = resolveAllVariableLiterals(ir);
    expect(resolveTextValue('m:base', { kind: 'literal', value: 'Inter' }, resolved)).toBe('Inter');
    expect(
      resolveTextValueWithUnit(
        'm:base',
        { kind: 'literal', value: 150, unit: 'PERCENT' },
        resolved,
      ),
    ).toEqual({ value: 150, unit: 'PERCENT' });
  });

  it('resolves a numeric text alias as PIXELS unit', () => {
    const ir = makeIR();
    const resolved = resolveAllVariableLiterals(ir);
    expect(
      resolveTextValueWithUnit(
        'm:base',
        { kind: 'alias', targetVariableId: 'var:size16' },
        resolved,
      ),
    ).toEqual({ value: 16, unit: 'PIXELS' });
  });
});
