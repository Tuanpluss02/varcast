import type {
  IRPaintStyle,
  IRGradientStop,
  IRColorValue,
  RGBA,
} from '../ir/types';

/**
 * Reads local Figma paint styles into IR representations.
 */
export async function readPaintStyles(): Promise<IRPaintStyle[]> {
  const styles = await figma.getLocalPaintStylesAsync();
  const out: IRPaintStyle[] = [];
  for (const style of styles) {
    const built = buildPaintStyle(style);
    if (built) out.push(built);
  }
  return out;
}

function buildPaintStyle(style: PaintStyle): IRPaintStyle | null {
  const fill = style.paints[0];
  if (!fill) return null;

  const base = {
    id: style.id,
    figmaName: style.name,
    groupPath: String(style.name)
      .split('/')
      .map((s: string) => s.trim())
      .filter((s: string) => s.length > 0),
  };

  switch (fill.type) {
    case 'SOLID':
      return {
        ...base,
        type: 'SOLID',
        color: solidColorValue(fill),
      };

    case 'GRADIENT_LINEAR':
      return {
        ...base,
        type: 'GRADIENT_LINEAR',
        angleRadians: extractLinearAngle(fill.gradientTransform),
        stops: fill.gradientStops.map(buildStop),
      };

    case 'GRADIENT_RADIAL': {
      const radial = extractRadialGeometry(fill.gradientTransform);
      return {
        ...base,
        type: 'GRADIENT_RADIAL',
        center: radial.center,
        radius: radial.radius,
        stops: fill.gradientStops.map(buildStop),
      };
    }

    case 'GRADIENT_ANGULAR': {
      const sweep = extractAngularRange(fill.gradientTransform);
      return {
        ...base,
        type: 'GRADIENT_ANGULAR',
        startAngle: sweep.startAngle,
        endAngle: sweep.endAngle,
        stops: fill.gradientStops.map(buildStop),
      };
    }

    case 'GRADIENT_DIAMOND':
      return {
        ...base,
        type: 'GRADIENT_DIAMOND',
        stops: fill.gradientStops.map(buildStop),
        note: 'approximated_as_radial',
      };

    case 'IMAGE':
      return null;

    default:
      return null;
  }
}

function buildStop(stop: ColorStop): IRGradientStop {
  const binding = (stop as { boundVariables?: Record<string, VariableAlias> })
    .boundVariables?.['color'];
  return {
    position: stop.position,
    color: binding
      ? { kind: 'alias', targetVariableId: binding.id }
      : { kind: 'literal', rgba: toRGBA(stop.color) },
  };
}

function solidColorValue(fill: SolidPaint): IRColorValue {
  const binding = (fill as { boundVariables?: Record<string, VariableAlias> })
    .boundVariables?.['color'];
  if (binding) {
    return { kind: 'alias', targetVariableId: binding.id };
  }
  const opacity = fill.opacity ?? 1;
  return {
    kind: 'literal',
    rgba: { r: fill.color.r, g: fill.color.g, b: fill.color.b, a: opacity },
  };
}

function toRGBA(c: { r: number; g: number; b: number; a?: number }): RGBA {
  return { r: c.r, g: c.g, b: c.b, a: c.a ?? 1 };
}

/**
 * Extracts the rotation angle in radians from a 2x3 affine matrix.
 */
function extractLinearAngle(t: Transform): number {
  const dx = t[0][0];
  const dy = t[1][0];
  return Math.atan2(dx, -dy);
}

/**
 * Recovers radial/angular gradient center and radius from a 2x3 affine matrix.
 */
function extractRadialGeometry(t: Transform): {
  center: { x: number; y: number };
  radius: number;
} {
  const inv = invertAffine(t);
  if (!inv) return { center: { x: 0.5, y: 0.5 }, radius: 0.5 };
  const cx = inv[0][0] * 0.5 + inv[0][1] * 0.5 + inv[0][2];
  const cy = inv[1][0] * 0.5 + inv[1][1] * 0.5 + inv[1][2];
  const rx = Math.hypot(inv[0][0], inv[1][0]) * 0.5;
  const ry = Math.hypot(inv[0][1], inv[1][1]) * 0.5;
  return { center: { x: cx, y: cy }, radius: (rx + ry) / 2 };
}

/**
 * Extracts start and end angles for an angular/sweep gradient.
 */
function extractAngularRange(t: Transform): {
  startAngle: number;
  endAngle: number;
} {
  const dx = t[0][0];
  const dy = t[1][0];
  const start = Math.atan2(dy, dx);
  return { startAngle: start, endAngle: start + 2 * Math.PI };
}

function invertAffine(t: Transform): Transform | null {
  const a = t[0][0];
  const b = t[0][1];
  const c = t[0][2];
  const d = t[1][0];
  const e = t[1][1];
  const f = t[1][2];
  const det = a * e - b * d;
  if (!Number.isFinite(det) || Math.abs(det) < 1e-9) return null;
  const inv = 1 / det;
  return [
    [e * inv, -b * inv, (b * f - c * e) * inv],
    [-d * inv, a * inv, (c * d - a * f) * inv],
  ];
}
