import { describe, it, expect, beforeEach } from 'vitest';
import { installVariablesMock, clearFigmaMock } from '../_helpers/figma';
import { readVariables } from '../../reader/variables';

const COL = {
  id: 'col:1',
  name: 'Color/Basic',
  modes: [{ modeId: 'm:1', name: 'Value' }],
};

beforeEach(() => clearFigmaMock());

describe('readVariables', () => {
  it('COLOR literal → kind=literal with RGBA value', async () => {
    installVariablesMock({
      collections: [COL],
      variables: [
        {
          id: 'var:1',
          name: 'neutral/900',
          variableCollectionId: 'col:1',
          resolvedType: 'COLOR',
          scopes: ['ALL_FILLS'],
          hiddenFromPublishing: false,
          valuesByMode: { 'm:1': { r: 0.09, g: 0.09, b: 0.09, a: 1 } },
        },
      ],
    });

    const result = await readVariables();
    expect(result).toHaveLength(1);
    expect(result[0].variables[0].valuesByMode['m:1']).toEqual({
      kind: 'literal',
      value: { r: 0.09, g: 0.09, b: 0.09, a: 1 },
    });
    expect(result[0].variables[0].groupPath).toEqual(['neutral', '900']);
  });

  it('VARIABLE_ALIAS → kind=alias with targetVariableId (not flattened)', async () => {
    installVariablesMock({
      collections: [COL],
      variables: [
        {
          id: 'var:2',
          name: 'Background/Primary',
          variableCollectionId: 'col:1',
          resolvedType: 'COLOR',
          scopes: ['ALL_FILLS'],
          hiddenFromPublishing: false,
          valuesByMode: {
            'm:1': { type: 'VARIABLE_ALIAS', id: 'var:1' },
          },
        },
      ],
    });

    const result = await readVariables();
    expect(result[0].variables[0].valuesByMode['m:1']).toEqual({
      kind: 'alias',
      targetVariableId: 'var:1',
    });
  });

  it('hiddenFromPublishing → emitToPublic=false', async () => {
    installVariablesMock({
      collections: [COL],
      variables: [
        {
          id: 'var:h',
          name: 'internal/scratch',
          variableCollectionId: 'col:1',
          resolvedType: 'FLOAT',
          scopes: [],
          hiddenFromPublishing: true,
          valuesByMode: { 'm:1': 8 },
        },
      ],
    });

    const result = await readVariables();
    expect(result[0].variables[0].hiddenFromPublishing).toBe(true);
    expect(result[0].variables[0].emitToPublic).toBe(false);
  });

  it('collection with any alias → kind=token', async () => {
    installVariablesMock({
      collections: [COL],
      variables: [
        {
          id: 'var:lit',
          name: 'a',
          variableCollectionId: 'col:1',
          resolvedType: 'COLOR',
          scopes: [],
          hiddenFromPublishing: false,
          valuesByMode: { 'm:1': { r: 0, g: 0, b: 0, a: 1 } },
        },
        {
          id: 'var:alias',
          name: 'b',
          variableCollectionId: 'col:1',
          resolvedType: 'COLOR',
          scopes: [],
          hiddenFromPublishing: false,
          valuesByMode: { 'm:1': { type: 'VARIABLE_ALIAS', id: 'var:lit' } },
        },
      ],
    });

    const result = await readVariables();
    expect(result[0].kind).toBe('token');
  });

  it('collection of all literals → kind=primitive', async () => {
    installVariablesMock({
      collections: [COL],
      variables: [
        {
          id: 'var:1',
          name: 'spacing/8',
          variableCollectionId: 'col:1',
          resolvedType: 'FLOAT',
          scopes: ['GAP'],
          hiddenFromPublishing: false,
          valuesByMode: { 'm:1': 8 },
        },
        {
          id: 'var:2',
          name: 'spacing/16',
          variableCollectionId: 'col:1',
          resolvedType: 'FLOAT',
          scopes: ['GAP'],
          hiddenFromPublishing: false,
          valuesByMode: { 'm:1': 16 },
        },
      ],
    });

    const result = await readVariables();
    expect(result[0].kind).toBe('primitive');
  });

  it('multi-mode variable → preserves both mode values', async () => {
    installVariablesMock({
      collections: [
        {
          id: 'col:1',
          name: 'Theme',
          modes: [
            { modeId: 'm:light', name: 'Light' },
            { modeId: 'm:dark', name: 'Dark' },
          ],
        },
      ],
      variables: [
        {
          id: 'var:bg',
          name: 'background/primary',
          variableCollectionId: 'col:1',
          resolvedType: 'COLOR',
          scopes: ['FILL_COLOR'],
          hiddenFromPublishing: false,
          valuesByMode: {
            'm:light': { r: 1, g: 1, b: 1, a: 1 },
            'm:dark': { r: 0, g: 0, b: 0, a: 1 },
          },
        },
      ],
    });

    const result = await readVariables();
    const v = result[0].variables[0];
    expect(v.valuesByMode['m:light']).toEqual({
      kind: 'literal',
      value: { r: 1, g: 1, b: 1, a: 1 },
    });
    expect(v.valuesByMode['m:dark']).toEqual({
      kind: 'literal',
      value: { r: 0, g: 0, b: 0, a: 1 },
    });
  });

  it('STRING and BOOLEAN literals carry through', async () => {
    installVariablesMock({
      collections: [COL],
      variables: [
        {
          id: 'var:s',
          name: 'fontFamily/body',
          variableCollectionId: 'col:1',
          resolvedType: 'STRING',
          scopes: ['FONT_FAMILY'],
          hiddenFromPublishing: false,
          valuesByMode: { 'm:1': 'Inter' },
        },
        {
          id: 'var:b',
          name: 'component/dense',
          variableCollectionId: 'col:1',
          resolvedType: 'BOOLEAN',
          scopes: [],
          hiddenFromPublishing: false,
          valuesByMode: { 'm:1': true },
        },
      ],
    });

    const result = await readVariables();
    expect(result[0].variables[0].valuesByMode['m:1']).toEqual({
      kind: 'literal',
      value: 'Inter',
    });
    expect(result[0].variables[1].valuesByMode['m:1']).toEqual({
      kind: 'literal',
      value: true,
    });
  });
});
