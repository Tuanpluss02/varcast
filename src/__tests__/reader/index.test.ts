import { describe, it, expect, beforeEach } from 'vitest';
import {
  installVariablesMock,
  installPaintStylesMock,
  installEffectStylesMock,
  installTextStylesMock,
  clearFigmaMock,
} from '../_helpers/figma';
import { readIR } from '../../reader/index';

beforeEach(() => clearFigmaMock());

describe('readIR', () => {
  it('aggregates variables, paint styles, effect styles, and text styles into an IR object', async () => {
    installVariablesMock({
      collections: [
        {
          id: 'col:1',
          name: 'Color/Basic',
          modes: [{ modeId: 'm:1', name: 'Value' }],
        },
      ],
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
    installPaintStylesMock([]);
    installEffectStylesMock([]);
    installTextStylesMock([]);

    const ir = await readIR('file_key_123');

    expect(ir.version).toBe('1.0');
    expect(ir.fileKey).toBe('file_key_123');
    expect(ir.collections).toHaveLength(1);
    expect(ir.composites.paintStyles).toHaveLength(0);
    expect(ir.composites.effectStyles).toHaveLength(0);
    expect(ir.composites.textStyles).toHaveLength(0);
  });
});
