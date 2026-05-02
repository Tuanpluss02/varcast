import { describe, it, expect, beforeEach } from 'vitest';
import { installPaintStylesMock, clearFigmaMock } from '../_helpers/figma';
import { readPaintStyles } from '../../reader/paint_styles';

beforeEach(() => clearFigmaMock());

describe('readPaintStyles', () => {
  it('SOLID with bare color → literal RGBA (opacity defaults to 1)', async () => {
    installPaintStylesMock([
      {
        id: 'S:1',
        name: 'Brand/Primary',
        paints: [{ type: 'SOLID', color: { r: 0.1, g: 0.2, b: 0.3 } }],
      },
    ]);

    const result = await readPaintStyles();
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      type: 'SOLID',
      figmaName: 'Brand/Primary',
      color: { kind: 'literal', rgba: { r: 0.1, g: 0.2, b: 0.3, a: 1 } },
    });
  });

  it('SOLID with bound variable → kind=alias (not flattened)', async () => {
    installPaintStylesMock([
      {
        id: 'S:2',
        name: 'Surface/Card',
        paints: [
          {
            type: 'SOLID',
            color: { r: 1, g: 1, b: 1 },
            opacity: 0.5,
            boundVariables: { color: { type: 'VARIABLE_ALIAS', id: 'var:bg' } },
          },
        ],
      },
    ]);

    const result = await readPaintStyles();
    expect(result[0]).toMatchObject({
      type: 'SOLID',
      color: { kind: 'alias', targetVariableId: 'var:bg' },
    });
  });

  it('GRADIENT_LINEAR → angleRadians + stops with positions', async () => {
    installPaintStylesMock([
      {
        id: 'S:3',
        name: 'Gradient/Sunset',
        paints: [
          {
            type: 'GRADIENT_LINEAR',
            // Identity transform → angle 0
            gradientTransform: [
              [1, 0, 0],
              [0, 1, 0],
            ],
            gradientStops: [
              { position: 0, color: { r: 1, g: 0, b: 0, a: 1 } },
              { position: 1, color: { r: 0, g: 0, b: 1, a: 1 } },
            ],
          },
        ],
      },
    ]);

    const result = await readPaintStyles();
    expect(result[0]).toMatchObject({
      type: 'GRADIENT_LINEAR',
      angleRadians: expect.any(Number),
      stops: [
        { position: 0, color: { kind: 'literal', rgba: { r: 1, g: 0, b: 0, a: 1 } } },
        { position: 1, color: { kind: 'literal', rgba: { r: 0, g: 0, b: 1, a: 1 } } },
      ],
    });
  });

  it('GRADIENT_LINEAR with variable-bound stop color → alias preserved', async () => {
    installPaintStylesMock([
      {
        id: 'S:3b',
        name: 'Gradient/Bound',
        paints: [
          {
            type: 'GRADIENT_LINEAR',
            gradientTransform: [
              [1, 0, 0],
              [0, 1, 0],
            ],
            gradientStops: [
              {
                position: 0,
                color: { r: 0, g: 0, b: 0, a: 1 },
                boundVariables: { color: { type: 'VARIABLE_ALIAS', id: 'var:start' } },
              },
              { position: 1, color: { r: 1, g: 1, b: 1, a: 1 } },
            ],
          },
        ],
      },
    ]);

    const result = await readPaintStyles();
    expect(result[0]).toMatchObject({
      type: 'GRADIENT_LINEAR',
      stops: [
        { position: 0, color: { kind: 'alias', targetVariableId: 'var:start' } },
        { position: 1, color: { kind: 'literal', rgba: { r: 1, g: 1, b: 1, a: 1 } } },
      ],
    });
  });

  it('GRADIENT_RADIAL → emitted with center & radius', async () => {
    installPaintStylesMock([
      {
        id: 'S:4',
        name: 'Gradient/Radial',
        paints: [
          {
            type: 'GRADIENT_RADIAL',
            gradientTransform: [
              [1, 0, 0],
              [0, 1, 0],
            ],
            gradientStops: [{ position: 0, color: { r: 0, g: 0, b: 0, a: 1 } }],
          },
        ],
      },
    ]);

    const result = await readPaintStyles();
    expect(result[0]).toMatchObject({
      type: 'GRADIENT_RADIAL',
      center: { x: 0.5, y: 0.5 },
      radius: 0.5,
    });
  });

  it('GRADIENT_ANGULAR / GRADIENT_DIAMOND → typed correctly, diamond carries note', async () => {
    installPaintStylesMock([
      {
        id: 'S:5',
        name: 'A',
        paints: [
          {
            type: 'GRADIENT_ANGULAR',
            gradientTransform: [
              [1, 0, 0],
              [0, 1, 0],
            ],
            gradientStops: [{ position: 0, color: { r: 0, g: 0, b: 0, a: 1 } }],
          },
        ],
      },
      {
        id: 'S:6',
        name: 'D',
        paints: [
          {
            type: 'GRADIENT_DIAMOND',
            gradientTransform: [
              [1, 0, 0],
              [0, 1, 0],
            ],
            gradientStops: [{ position: 0, color: { r: 0, g: 0, b: 0, a: 1 } }],
          },
        ],
      },
    ]);

    const result = await readPaintStyles();
    expect(result[0].type).toBe('GRADIENT_ANGULAR');
    expect(result[1]).toMatchObject({
      type: 'GRADIENT_DIAMOND',
      note: 'approximated_as_radial',
    });
  });

  it('GRADIENT_RADIAL with non-identity transform → center & radius scale accordingly', async () => {
    // A transform that doubles object-space (scale 2) shrinks the gradient
    // ellipse in layer space — the inverse maps (0.5, 0.5) → (0.25, 0.25)
    // with half-axes of 0.25 each.
    installPaintStylesMock([
      {
        id: 'S:r2',
        name: 'Gradient/Radial Offset',
        paints: [
          {
            type: 'GRADIENT_RADIAL',
            gradientTransform: [
              [2, 0, 0],
              [0, 2, 0],
            ],
            gradientStops: [{ position: 0, color: { r: 0, g: 0, b: 0, a: 1 } }],
          },
        ],
      },
    ]);

    const result = await readPaintStyles();
    const r = result[0] as Extract<typeof result[0], { type: 'GRADIENT_RADIAL' }>;
    expect(r.center.x).toBeCloseTo(0.25, 4);
    expect(r.center.y).toBeCloseTo(0.25, 4);
    expect(r.radius).toBeCloseTo(0.25, 4);
  });

  it('GRADIENT_ANGULAR transform encodes start angle', async () => {
    // Rotate 90° → first column = (cos90, sin90) = (0, 1) → start = atan2(1,0) = π/2.
    installPaintStylesMock([
      {
        id: 'S:a90',
        name: 'Gradient/Sweep90',
        paints: [
          {
            type: 'GRADIENT_ANGULAR',
            gradientTransform: [
              [0, -1, 0],
              [1, 0, 0],
            ],
            gradientStops: [{ position: 0, color: { r: 0, g: 0, b: 0, a: 1 } }],
          },
        ],
      },
    ]);

    const result = await readPaintStyles();
    const r = result[0] as Extract<typeof result[0], { type: 'GRADIENT_ANGULAR' }>;
    expect(r.startAngle).toBeCloseTo(Math.PI / 2, 4);
    expect(r.endAngle).toBeCloseTo(Math.PI / 2 + 2 * Math.PI, 4);
  });

  it('IMAGE styles are skipped (no asset export)', async () => {
    installPaintStylesMock([
      {
        id: 'S:7',
        name: 'Backgrounds/Hero Image',
        paints: [{ type: 'IMAGE', imageHash: 'abc' }],
      },
    ]);

    const result = await readPaintStyles();
    expect(result).toEqual([]);
  });

  it('style with empty paints array → skipped', async () => {
    installPaintStylesMock([{ id: 'S:8', name: 'Empty', paints: [] }]);
    const result = await readPaintStyles();
    expect(result).toEqual([]);
  });
});
