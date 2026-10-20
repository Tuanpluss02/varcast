import type {
  IRCollection,
  IRVariable,
  IRPaintStyle,
  IREffectStyle,
  IRTextStyle,
  RGBA,
} from '../ir/types';
import type {
  VariablePreview,
  PaintStylePreview,
  EffectStylePreview,
  TextStylePreview,
} from './lib/messages';
import { resolveVariableLiteral, isRGBA } from '../core/graph/alias_resolver';

export function toHex(rgba: RGBA): string {
  const r = Math.round(rgba.r * 255)
    .toString(16)
    .padStart(2, '0');
  const g = Math.round(rgba.g * 255)
    .toString(16)
    .padStart(2, '0');
  const b = Math.round(rgba.b * 255)
    .toString(16)
    .padStart(2, '0');
  if (rgba.a < 1) {
    const a = Math.round(rgba.a * 255)
      .toString(16)
      .padStart(2, '0');
    return `#${r}${g}${b}${a}`.toUpperCase();
  }
  return `#${r}${g}${b}`.toUpperCase();
}

export function toRgbaString(rgba: RGBA): string {
  return `rgba(${Math.round(rgba.r * 255)}, ${Math.round(rgba.g * 255)}, ${Math.round(rgba.b * 255)}, ${rgba.a.toFixed(2)})`;
}

export function resolveVarLiteral(
  targetId: string,
  collections: IRCollection[],
  visited = new Set<string>(),
): unknown {
  const resolved = resolveVariableLiteral(targetId, '', collections, visited);
  if (resolved === undefined) return undefined;
  if (isRGBA(resolved)) {
    return { r: resolved.r, g: resolved.g, b: resolved.b, a: resolved.a };
  }
  return resolved;
}

export function extractVariablePreview(
  v: IRVariable,
  irCollections: IRCollection[],
): VariablePreview {
  const modeKeys = Object.keys(v.valuesByMode);
  const firstVal = modeKeys.length > 0 ? v.valuesByMode[modeKeys[0]] : undefined;

  if (!firstVal) {
    return { id: v.id, name: v.figmaName, type: v.type, valuePreview: '-' };
  }

  if (firstVal.kind === 'alias') {
    let targetName = 'alias';
    let resolvedRgba: RGBA | undefined;
    for (const c of irCollections) {
      const tv = c.variables.find((x: IRVariable) => x.id === firstVal.targetVariableId);
      if (tv) {
        targetName = tv.figmaName;
        break;
      }
    }
    const resolved = resolveVariableLiteral(firstVal.targetVariableId, '', irCollections);
    if (isRGBA(resolved)) {
      resolvedRgba = { r: resolved.r, g: resolved.g, b: resolved.b, a: resolved.a };
    }
    return {
      id: v.id,
      name: v.figmaName,
      type: v.type,
      valuePreview: targetName,
      colorHex: resolvedRgba ? toHex(resolvedRgba) : undefined,
      colorRgba: resolvedRgba,
      isAlias: true,
    };
  }

  if (v.type === 'COLOR' && isRGBA(firstVal.value)) {
    return {
      id: v.id,
      name: v.figmaName,
      type: v.type,
      valuePreview: toHex(firstVal.value),
      colorHex: toHex(firstVal.value),
      colorRgba: firstVal.value,
      isAlias: false,
    };
  }

  if (v.type === 'FLOAT') {
    return {
      id: v.id,
      name: v.figmaName,
      type: v.type,
      valuePreview: `${firstVal.value}px`,
      isAlias: false,
    };
  }

  return {
    id: v.id,
    name: v.figmaName,
    type: v.type,
    valuePreview: String(firstVal.value),
    isAlias: false,
  };
}

export function extractPaintPreview(
  p: IRPaintStyle,
  collections: IRCollection[],
): PaintStylePreview {
  if (p.type === 'SOLID') {
    let rgba: RGBA | undefined;
    if (p.color.kind === 'literal') {
      rgba = p.color.rgba;
    } else if (p.color.kind === 'alias') {
      const resolved = resolveVarLiteral(p.color.targetVariableId, collections);
      if (isRGBA(resolved)) rgba = resolved;
    }
    return { id: p.id, name: p.figmaName, type: p.type, colorHex: rgba ? toHex(rgba) : '#7C5CFF' };
  }
  if (p.type === 'GRADIENT_LINEAR') {
    const stops = p.stops
      .map((st) => {
        let rgba = st.color.kind === 'literal' ? st.color.rgba : undefined;
        if (!rgba && st.color.kind === 'alias') {
          const resolved = resolveVarLiteral(st.color.targetVariableId, collections);
          if (isRGBA(resolved)) rgba = resolved;
        }
        const hex = rgba ? toRgbaString(rgba) : '#7C5CFF';
        return `${hex} ${Math.round(st.position * 100)}%`;
      })
      .join(', ');
    const deg = Math.round((p.angleRadians * 180) / Math.PI) + 90;
    return {
      id: p.id,
      name: p.figmaName,
      type: p.type,
      gradientCss: `linear-gradient(${deg}deg, ${stops})`,
    };
  }
  return { id: p.id, name: p.figmaName, type: p.type, colorHex: '#7C5CFF' };
}

export function extractEffectPreview(
  e: IREffectStyle,
  collections: IRCollection[],
): EffectStylePreview {
  if (e.type === 'DROP_SHADOW' || e.type === 'INNER_SHADOW') {
    let rgba = e.color.kind === 'literal' ? e.color.rgba : undefined;
    if (!rgba && e.color.kind === 'alias') {
      const resolved = resolveVarLiteral(e.color.targetVariableId, collections);
      if (isRGBA(resolved)) rgba = resolved;
    }
    const colorStr = rgba ? toRgbaString(rgba) : 'rgba(0,0,0,0.25)';
    const inset = e.type === 'INNER_SHADOW' ? 'inset ' : '';
    return {
      id: e.id,
      name: e.figmaName,
      type: e.type,
      boxShadowCss: `${inset}${e.offsetX}px ${e.offsetY}px ${e.blurRadius}px ${e.spreadRadius}px ${colorStr}`,
    };
  }
  return { id: e.id, name: e.figmaName, type: e.type };
}

export function extractTextPreview(
  t: IRTextStyle,
  collections: IRCollection[],
): TextStylePreview {
  let family = 'Inter';
  if (t.fontFamily.kind === 'literal') {
    family = String(t.fontFamily.value);
  } else if (t.fontFamily.kind === 'alias') {
    const resolved = resolveVarLiteral(t.fontFamily.targetVariableId, collections);
    if (typeof resolved === 'string') family = resolved;
  }

  let size = 14;
  if (t.fontSize.kind === 'literal') {
    size = Number(t.fontSize.value) || 14;
  } else if (t.fontSize.kind === 'alias') {
    const resolved = resolveVarLiteral(t.fontSize.targetVariableId, collections);
    if (typeof resolved === 'number') size = resolved;
  }

  let weight = 400;
  if (t.fontWeight.kind === 'literal') {
    weight = Number(t.fontWeight.value) || 400;
  } else if (t.fontWeight.kind === 'alias') {
    const resolved = resolveVarLiteral(t.fontWeight.targetVariableId, collections);
    if (typeof resolved === 'number') {
      weight = resolved;
    } else if (typeof resolved === 'string') {
      const parsed = parseInt(resolved, 10);
      if (!isNaN(parsed) && parsed >= 100 && parsed <= 900) {
        weight = parsed;
      } else if (/black|extra.*bold/i.test(resolved)) {
        weight = 900;
      } else if (/bold/i.test(resolved)) {
        weight = 700;
      } else if (/semi.*bold/i.test(resolved)) {
        weight = 600;
      } else if (/medium/i.test(resolved)) {
        weight = 500;
      } else if (/light/i.test(resolved)) {
        weight = 300;
      } else if (/thin/i.test(resolved)) {
        weight = 100;
      }
    }
  }

  return {
    id: t.id,
    name: t.figmaName,
    fontFamily: family,
    fontSize: size,
    fontWeight: weight,
  };
}
