import { describe, it, expect, beforeEach } from 'vitest';
import { installEffectStylesMock, clearFigmaMock } from '../_helpers/figma';
import { readEffectStyles } from '../../reader/effect_styles';

beforeEach(() => clearFigmaMock());

describe('readEffectStyles', () => {
  it('DROP_SHADOW with literal color → IRDropShadow', async () => {
    installEffectStylesMock([
      {
        id: 'E:1',
        name: 'Card/Elevated',
        effects: [
          {
            type: 'DROP_SHADOW',
            color: { r: 0, g: 0, b: 0, a: 0.25 },
            offset: { x: 0, y: 4 },
            radius: 8,
            spread: 0,
            visible: true,
            blendMode: 'NORMAL',
          },
        ],
      },
    ]);

    const result = await readEffectStyles();
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      type: 'DROP_SHADOW',
      figmaName: 'Card/Elevated',
      color: { kind: 'literal', rgba: { r: 0, g: 0, b: 0, a: 0.25 } },
      offsetX: 0,
      offsetY: 4,
      blurRadius: 8,
      spreadRadius: 0,
    });
  });

  it('DROP_SHADOW with bound variable color → alias preserved', async () => {
    installEffectStylesMock([
      {
        id: 'E:2',
        name: 'Card/Bound',
        effects: [
          {
            type: 'DROP_SHADOW',
            color: { r: 0, g: 0, b: 0, a: 1 },
            offset: { x: 0, y: 2 },
            radius: 4,
            boundVariables: { color: { type: 'VARIABLE_ALIAS', id: 'var:shadow' } },
          },
        ],
      },
    ]);

    const result = await readEffectStyles();
    expect(result[0]).toMatchObject({
      type: 'DROP_SHADOW',
      color: { kind: 'alias', targetVariableId: 'var:shadow' },
    });
  });

  it('INNER_SHADOW → IRInnerShadow', async () => {
    installEffectStylesMock([
      {
        id: 'E:3',
        name: 'Inset/Pressed',
        effects: [
          {
            type: 'INNER_SHADOW',
            color: { r: 0, g: 0, b: 0, a: 0.5 },
            offset: { x: 1, y: 2 },
            radius: 3,
            spread: 1,
          },
        ],
      },
    ]);

    const result = await readEffectStyles();
    expect(result[0]).toMatchObject({
      type: 'INNER_SHADOW',
      offsetX: 1,
      offsetY: 2,
      blurRadius: 3,
      spreadRadius: 1,
    });
  });

  it('LAYER_BLUR → IRLayerBlur with sigmaX/sigmaY = radius', async () => {
    installEffectStylesMock([
      {
        id: 'E:4',
        name: 'Blur/Heavy',
        effects: [{ type: 'LAYER_BLUR', radius: 12 }],
      },
    ]);

    const result = await readEffectStyles();
    expect(result[0]).toMatchObject({
      type: 'LAYER_BLUR',
      sigmaX: 12,
      sigmaY: 12,
    });
  });

  it('BACKGROUND_BLUR → IRBackgroundBlur', async () => {
    installEffectStylesMock([
      {
        id: 'E:5',
        name: 'Frosted',
        effects: [{ type: 'BACKGROUND_BLUR', radius: 20 }],
      },
    ]);

    const result = await readEffectStyles();
    expect(result[0]).toMatchObject({
      type: 'BACKGROUND_BLUR',
      sigmaX: 20,
      sigmaY: 20,
    });
  });

  it('multiple effects on one style → emits one IR entry per effect', async () => {
    installEffectStylesMock([
      {
        id: 'E:6',
        name: 'Layered',
        effects: [
          {
            type: 'DROP_SHADOW',
            color: { r: 0, g: 0, b: 0, a: 0.1 },
            offset: { x: 0, y: 1 },
            radius: 2,
          },
          {
            type: 'DROP_SHADOW',
            color: { r: 0, g: 0, b: 0, a: 0.2 },
            offset: { x: 0, y: 4 },
            radius: 8,
          },
        ],
      },
    ]);

    const result = await readEffectStyles();
    expect(result).toHaveLength(2);
    expect(result.every((e) => e.figmaName === 'Layered')).toBe(true);
  });
});
