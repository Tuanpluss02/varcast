import { describe, it, expect } from 'vitest';
import type { IR } from '../../ir/types';
import { prepareIR } from '../../targets/flutter/generator/prepare';
import { emitCollection } from '../../targets/flutter/generator/collection';

function buildIr(): IR {
  return {
    version: '1.0',
    fileKey: 'test',
    generatedAt: new Date(0).toISOString(),
    collections: [
      {
        id: 'col:basic',
        name: 'Color Basic',
        kind: 'primitive',
        modes: [{ id: 'm:1', name: 'Value' }],
        variables: [
          {
            id: 'var:black',
            figmaName: 'Background/Primary',
            groupPath: ['Background', 'Primary'],
            type: 'COLOR',
            scopes: ['ALL_FILLS'],
            hiddenFromPublishing: false,
            emitToPublic: true,
            valuesByMode: { 'm:1': { kind: 'literal', value: { r: 0, g: 0, b: 0, a: 1 } } },
          },
          {
            id: 'var:default',
            figmaName: 'Border/default',
            groupPath: ['Border', 'default'],
            type: 'COLOR',
            scopes: ['ALL_FILLS'],
            hiddenFromPublishing: false,
            emitToPublic: true,
            valuesByMode: { 'm:1': { kind: 'literal', value: { r: 1, g: 1, b: 1, a: 1 } } },
          },
        ],
      },
      {
        id: 'col:token',
        name: 'Color Token',
        kind: 'token',
        modes: [{ id: 'm:1', name: 'Light Mode' }],
        variables: [
          {
            id: 'var:bg-primary',
            figmaName: 'Background/Primary',
            groupPath: ['Background', 'Primary'],
            type: 'COLOR',
            scopes: ['ALL_FILLS'],
            hiddenFromPublishing: false,
            emitToPublic: true,
            valuesByMode: { 'm:1': { kind: 'alias', targetVariableId: 'var:black' } },
          },
        ],
      },
    ],
    composites: { paintStyles: [], effectStyles: [], textStyles: [] },
  };
}

describe('emitCollection (golden)', () => {
  it('emits primitive collection with nesting + reserved leaf', () => {
    const prepared = prepareIR(buildIr());
    const col = prepared.collections.find((c) => c.className === 'ColorBasic')!;
    const dart = emitCollection(col, prepared.varIndex);
    expect(dart).toMatchSnapshot();
  });

  it('emits token collection with AppTheme alias getters (non-const concretes)', () => {
    const prepared = prepareIR(buildIr());
    const col = prepared.collections.find((c) => c.className === 'ColorToken')!;
    const dart = emitCollection(col, prepared.varIndex);
    expect(dart).toMatchSnapshot();
    expect(dart).toContain('AppTheme.colorBasic');
  });
});

