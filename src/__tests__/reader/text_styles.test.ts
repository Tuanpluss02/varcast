import { describe, it, expect, beforeEach } from 'vitest';
import { installTextStylesMock, clearFigmaMock } from '../_helpers/figma';
import { readTextStyles } from '../../reader/text_styles';

beforeEach(() => clearFigmaMock());

describe('readTextStyles', () => {
  it('all literal fields → IR with values + units preserved', async () => {
    installTextStylesMock([
      {
        id: 'T:1',
        name: 'Display/Large',
        fontName: { family: 'Inter', style: 'Bold' },
        fontSize: 48,
        lineHeight: { value: 56, unit: 'PIXELS' },
        letterSpacing: { value: -1, unit: 'PIXELS' },
      },
    ]);

    const result = await readTextStyles();
    expect(result[0]).toMatchObject({
      figmaName: 'Display/Large',
      fontFamily: { kind: 'literal', value: 'Inter' },
      fontSize: { kind: 'literal', value: 48 },
      fontWeight: { kind: 'literal', value: 700 },
      lineHeight: { kind: 'literal', value: 56, unit: 'PIXELS' },
      letterSpacing: { kind: 'literal', value: -1, unit: 'PIXELS' },
    });
  });

  it('lineHeight unit AUTO → preserved with value=0', async () => {
    installTextStylesMock([
      {
        id: 'T:2',
        name: 'Body/Auto',
        fontName: { family: 'Inter', style: 'Regular' },
        fontSize: 16,
        lineHeight: { unit: 'AUTO' },
        letterSpacing: { value: 0, unit: 'PIXELS' },
      },
    ]);

    const result = await readTextStyles();
    expect(result[0].lineHeight).toEqual({
      kind: 'literal',
      value: 0,
      unit: 'AUTO',
    });
    expect(result[0].fontWeight).toEqual({ kind: 'literal', value: 400 });
  });

  it('lineHeight unit PERCENT → preserved', async () => {
    installTextStylesMock([
      {
        id: 'T:3',
        name: 'Body/Percent',
        fontName: { family: 'Inter', style: 'Regular' },
        fontSize: 16,
        lineHeight: { value: 150, unit: 'PERCENT' },
        letterSpacing: { value: 0, unit: 'PIXELS' },
      },
    ]);

    const result = await readTextStyles();
    expect(result[0].lineHeight).toEqual({
      kind: 'literal',
      value: 150,
      unit: 'PERCENT',
    });
  });

  it('letterSpacing unit PERCENT → preserved', async () => {
    installTextStylesMock([
      {
        id: 'T:4',
        name: 'Caption',
        fontName: { family: 'Inter', style: 'Medium' },
        fontSize: 12,
        lineHeight: { value: 16, unit: 'PIXELS' },
        letterSpacing: { value: 2, unit: 'PERCENT' },
      },
    ]);

    const result = await readTextStyles();
    expect(result[0].letterSpacing).toEqual({
      kind: 'literal',
      value: 2,
      unit: 'PERCENT',
    });
    expect(result[0].fontWeight).toEqual({ kind: 'literal', value: 500 });
  });

  it('variable-bound fields → kind=alias (not flattened)', async () => {
    installTextStylesMock([
      {
        id: 'T:5',
        name: 'Bound',
        fontName: { family: 'Inter', style: 'Regular' },
        fontSize: 16,
        lineHeight: { value: 20, unit: 'PIXELS' },
        letterSpacing: { value: 0, unit: 'PIXELS' },
        boundVariables: {
          fontFamily: { type: 'VARIABLE_ALIAS', id: 'var:family' },
          fontSize: { type: 'VARIABLE_ALIAS', id: 'var:size' },
          fontWeight: { type: 'VARIABLE_ALIAS', id: 'var:weight' },
          lineHeight: { type: 'VARIABLE_ALIAS', id: 'var:lh' },
          letterSpacing: { type: 'VARIABLE_ALIAS', id: 'var:ls' },
        },
      },
    ]);

    const result = await readTextStyles();
    expect(result[0]).toMatchObject({
      fontFamily: { kind: 'alias', targetVariableId: 'var:family' },
      fontSize: { kind: 'alias', targetVariableId: 'var:size' },
      fontWeight: { kind: 'alias', targetVariableId: 'var:weight' },
      lineHeight: { kind: 'alias', targetVariableId: 'var:lh' },
      letterSpacing: { kind: 'alias', targetVariableId: 'var:ls' },
    });
  });

  it('missing lineHeight/letterSpacing fields → safe defaults (no undefined)', async () => {
    installTextStylesMock([
      {
        id: 'T:safe',
        name: 'Sketch',
        // No fontName, no lineHeight, no letterSpacing — minimal style.
        fontSize: 14,
      },
    ]);

    const result = await readTextStyles();
    const s = result[0];
    expect(s.fontFamily).toEqual({ kind: 'literal', value: '' });
    expect(s.fontWeight).toEqual({ kind: 'literal', value: 400 });
    expect(s.lineHeight).toEqual({ kind: 'literal', value: 0, unit: 'AUTO' });
    expect(s.letterSpacing).toEqual({ kind: 'literal', value: 0, unit: 'PIXELS' });
  });

  it('explicit numeric fontWeight wins over fontName.style heuristic', async () => {
    installTextStylesMock([
      {
        id: 'T:weight',
        name: 'Custom',
        fontName: { family: 'Inter', style: 'Regular' },
        fontWeight: 950,
        fontSize: 16,
        lineHeight: { value: 24, unit: 'PIXELS' },
        letterSpacing: { value: 0, unit: 'PIXELS' },
      },
    ]);

    const result = await readTextStyles();
    expect(result[0].fontWeight).toEqual({ kind: 'literal', value: 950 });
  });

  it('groupPath drops empty segments (leading/trailing slash)', async () => {
    installTextStylesMock([
      {
        id: 'T:slash',
        name: '/Display/H1/',
        fontName: { family: 'Inter', style: 'Bold' },
        fontSize: 32,
        lineHeight: { value: 40, unit: 'PIXELS' },
        letterSpacing: { value: 0, unit: 'PIXELS' },
      },
    ]);

    const result = await readTextStyles();
    expect(result[0].groupPath).toEqual(['Display', 'H1']);
  });

  it('groupPath split on /', async () => {
    installTextStylesMock([
      {
        id: 'T:6',
        name: 'Display/Heading/H1',
        fontName: { family: 'Inter', style: 'Bold' },
        fontSize: 32,
        lineHeight: { value: 40, unit: 'PIXELS' },
        letterSpacing: { value: 0, unit: 'PIXELS' },
      },
    ]);

    const result = await readTextStyles();
    expect(result[0].groupPath).toEqual(['Display', 'Heading', 'H1']);
  });
});
