import type {
  IRPaintStyle,
  IRGradientStop,
  IRColorValue,
  RGBA,
} from '../ir/types';

// Reads all local PaintStyles. Each style emits exactly one IR entry derived
// from its first paint (Figma styles can hold multiple paints, but we treat
// the style as the primary paint — secondary fills are rare and out of scope).
//
// Variable-bound stop colors are preserved as `{ kind: 'alias' }` so the
// generator can emit `AppTheme.xxx` references rather than baked-in literals.
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
    dartName: style.name,
    groupPath: style.name.split('/').map((s: any) => String(s).trim()),
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

    case 'GRADIENT_RADIAL':
      return {
        ...base,
        type: 'GRADIENT_RADIAL',
        center: { x: 0.5, y: 0.5 },
        radius: 0.5,
        stops: fill.gradientStops.map(buildStop),
      };

    case 'GRADIENT_ANGULAR':
      return {
        ...base,
        type: 'GRADIENT_ANGULAR',
        startAngle: 0,
        endAngle: 2 * Math.PI,
        stops: fill.gradientStops.map(buildStop),
      };

    case 'GRADIENT_DIAMOND':
      return {
        ...base,
        type: 'GRADIENT_DIAMOND',
        stops: fill.gradientStops.map(buildStop),
        note: 'approximated_as_radial',
      };

    case 'IMAGE':
      // Intentionally skipped: the plugin does not export binary assets yet.
      // If needed later, we can add an assets/ pipeline + pubspec.yaml entries.
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

function toRGBA(c: any): RGBA {
  return { r: c.r, g: c.g, b: c.b, a: c.a ?? 1 };
}

function imageAssetName(figmaName: string): string {
  return (
    figmaName
      .replace(/\//g, '_')
      .replace(/\s+/g, '_')
      .replace(/[^a-zA-Z0-9_]/g, '')
      .toLowerCase() + '.jpg'
  );
}

// Figma's gradientTransform is a 2x3 affine matrix mapping the gradient line
// from object-space [(0,0)→(1,0)] into the layer's [0..1] coordinate space.
// The direction vector of the gradient is the first column [t[0][0], t[1][0]].
// We return atan2(dx, -dy) so that 0 rad = top→bottom (Figma's default).
function extractLinearAngle(t: Transform): number {
  const dx = t[0][0];
  const dy = t[1][0];
  return Math.atan2(dx, -dy);
}
