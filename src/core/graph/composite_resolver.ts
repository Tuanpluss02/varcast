import type {
  IRColorValue,
  IRComposites,
  IREffectStyle,
  IRPaintStyle,
  IRTextStyle,
  IRTextValue,
  IRTextValueWithUnit,
} from '../../ir/types';
import { processSegment, splitWords, toCamelCase } from '../sanitize_base';
import { clamp01, isRGBA, roundFloat6, toRGBAValue } from './alias_resolver';
import type {
  Mode,
  ResolvedComposites,
  ResolvedEffectStyle,
  ResolvedPaintStyle,
  ResolvedTextStyle,
  ResolvedVariable,
  RGBAValue,
} from './types';

function sanitizeCompositeName(raw: string): string {
  const normalized = raw.replace(/[/_.-]+/g, ' ');
  return toCamelCase(splitWords(processSegment(normalized)).join(' '));
}

function resolveColorAndOpacity(
  color: IRColorValue | undefined,
  modeId: string,
  variableIndex: Map<string, ResolvedVariable>,
): { hex: string | null; opacity: number; rgba: RGBAValue | null } {
  if (!color) return { hex: null, opacity: 1, rgba: null };

  if (color.kind === 'literal') {
    const rgba = toRGBAValue(color.rgba);
    const hex = rgba.hex;
    const opacity = roundFloat6(clamp01(color.rgba.a));
    return { hex, opacity, rgba };
  }

  const target = variableIndex.get(color.targetVariableId);
  if (!target) return { hex: null, opacity: 1, rgba: null };

  let resolved = target.resolvedValuesByMode[modeId];
  if (resolved === undefined) {
    const keys = Object.keys(target.resolvedValuesByMode);
    if (keys.length > 0) resolved = target.resolvedValuesByMode[keys[0]];
  }

  if (resolved && typeof resolved === 'object' && isRGBA(resolved)) {
    const rgba: RGBAValue =
      'hex' in resolved &&
      typeof resolved.hex === 'string' &&
      'rgbaString' in resolved &&
      typeof resolved.rgbaString === 'string'
        ? (resolved as RGBAValue)
        : toRGBAValue(resolved);
    const opacity = roundFloat6(clamp01(rgba.a));
    return { hex: rgba.hex, opacity, rgba };
  }

  if (typeof resolved === 'string' && resolved.startsWith('#')) {
    let opacity = 1;
    let rgba: RGBAValue | null = null;
    if (resolved.length === 9) {
      const rr = parseInt(resolved.slice(1, 3), 16) / 255;
      const gg = parseInt(resolved.slice(3, 5), 16) / 255;
      const bb = parseInt(resolved.slice(5, 7), 16) / 255;
      const aa = parseInt(resolved.slice(7, 9), 16) / 255;
      if (Number.isFinite(aa)) opacity = roundFloat6(clamp01(aa));
      rgba = toRGBAValue({ r: rr, g: gg, b: bb, a: Number.isFinite(aa) ? aa : 1 });
    } else if (resolved.length === 7) {
      const rr = parseInt(resolved.slice(1, 3), 16) / 255;
      const gg = parseInt(resolved.slice(3, 5), 16) / 255;
      const bb = parseInt(resolved.slice(5, 7), 16) / 255;
      rgba = toRGBAValue({ r: rr, g: gg, b: bb, a: 1 });
    }
    return { hex: resolved, opacity, rgba };
  }

  return { hex: null, opacity: 1, rgba: null };
}

function resolvePaintStyle(
  style: IRPaintStyle,
  modes: Mode[],
  variableIndex: Map<string, ResolvedVariable>,
): ResolvedPaintStyle {
  const name =
    (style as { name?: string }).name ??
    sanitizeCompositeName(style.figmaName || 'unnamed');
  const valuesByMode: ResolvedPaintStyle['valuesByMode'] = {};

  for (const mode of modes) {
    switch (style.type) {
      case 'SOLID': {
        const { hex, rgba } = resolveColorAndOpacity(style.color, mode.id, variableIndex);
        valuesByMode[mode.id] = { hex, rgba };
        break;
      }
      case 'GRADIENT_LINEAR':
      case 'GRADIENT_RADIAL':
      case 'GRADIENT_ANGULAR':
      case 'GRADIENT_DIAMOND': {
        const stops = (style.stops ?? []).map((stop) => {
          const { hex, rgba } = resolveColorAndOpacity(stop.color, mode.id, variableIndex);
          return {
            hex,
            rgba,
            position: stop.position,
          };
        });
        valuesByMode[mode.id] = {
          hex: stops[0]?.hex ?? null,
          rgba: stops[0]?.rgba ?? null,
          stops,
        };
        break;
      }
      case 'IMAGE': {
        valuesByMode[mode.id] = {
          hex: null,
          rgba: null,
          assetName: style.assetName,
        };
        break;
      }
      default: {
        valuesByMode[mode.id] = { hex: null, rgba: null };
        break;
      }
    }
  }

  return {
    id: style.id,
    name,
    figmaName: style.figmaName,
    groupPath: style.groupPath,
    type: style.type,
    raw: style,
    valuesByMode,
  };
}

function resolveEffectStyle(
  style: IREffectStyle,
  modes: Mode[],
  variableIndex: Map<string, ResolvedVariable>,
): ResolvedEffectStyle {
  const name =
    (style as { name?: string }).name ??
    sanitizeCompositeName(style.figmaName || 'unnamed');
  const valuesByMode: ResolvedEffectStyle['valuesByMode'] = {};

  for (const mode of modes) {
    switch (style.type) {
      case 'DROP_SHADOW':
      case 'INNER_SHADOW': {
        const { hex, opacity: resolvedOpacity, rgba } = resolveColorAndOpacity(
          style.color,
          mode.id,
          variableIndex,
        );
        const opacity =
          typeof (style as { opacity?: number }).opacity === 'number'
            ? (style as { opacity?: number }).opacity!
            : resolvedOpacity;

        valuesByMode[mode.id] = {
          shadowColor: hex,
          rgba,
          offsetX: style.offsetX ?? 0,
          offsetY: style.offsetY ?? 0,
          blurRadius: style.blurRadius ?? 0,
          spread: style.spreadRadius ?? 0,
          opacity,
        };
        break;
      }
      case 'LAYER_BLUR':
      case 'BACKGROUND_BLUR': {
        const blurRadius =
          (style as { sigmaX?: number; sigmaY?: number }).sigmaX ??
          (style as { sigmaX?: number; sigmaY?: number }).sigmaY ??
          0;
        valuesByMode[mode.id] = {
          shadowColor: null,
          rgba: null,
          offsetX: 0,
          offsetY: 0,
          blurRadius,
          spread: 0,
          opacity: 0,
        };
        break;
      }
      default: {
        valuesByMode[mode.id] = {
          shadowColor: null,
          rgba: null,
          offsetX: 0,
          offsetY: 0,
          blurRadius: 0,
          spread: 0,
          opacity: 0,
        };
        break;
      }
    }
  }

  return {
    id: style.id,
    name,
    figmaName: style.figmaName,
    groupPath: style.groupPath,
    type: style.type,
    raw: style,
    valuesByMode,
  };
}

function resolveTextString(
  val: IRTextValue<string> | undefined,
  modeId: string,
  variableIndex: Map<string, ResolvedVariable>,
): string | null {
  if (!val) return null;
  if (val.kind === 'literal') return String(val.value);
  const target = variableIndex.get(val.targetVariableId);
  if (!target) return null;
  let resolved = target.resolvedValuesByMode[modeId];
  if (resolved === undefined) {
    const keys = Object.keys(target.resolvedValuesByMode);
    if (keys.length > 0) resolved = target.resolvedValuesByMode[keys[0]];
  }
  if (resolved === undefined || resolved === null) return null;
  if (typeof resolved === 'string') return resolved;
  return String(resolved);
}

function resolveTextNumber(
  val: IRTextValue<number> | undefined,
  modeId: string,
  variableIndex: Map<string, ResolvedVariable>,
): number | null {
  if (!val) return null;
  if (val.kind === 'literal') {
    return typeof val.value === 'number' && Number.isFinite(val.value) ? val.value : null;
  }
  const target = variableIndex.get(val.targetVariableId);
  if (!target) return null;
  let resolved = target.resolvedValuesByMode[modeId];
  if (resolved === undefined) {
    const keys = Object.keys(target.resolvedValuesByMode);
    if (keys.length > 0) resolved = target.resolvedValuesByMode[keys[0]];
  }
  if (typeof resolved === 'number' && Number.isFinite(resolved)) return resolved;
  if (typeof resolved === 'string') {
    const parsed = parseFloat(resolved);
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
}

function resolveTextWeight(
  val: IRTextValue<number> | undefined,
  modeId: string,
  variableIndex: Map<string, ResolvedVariable>,
): string | null {
  if (!val) return null;
  if (val.kind === 'literal') {
    return String(val.value);
  }
  const target = variableIndex.get(val.targetVariableId);
  if (!target) return null;
  let resolved = target.resolvedValuesByMode[modeId];
  if (resolved === undefined) {
    const keys = Object.keys(target.resolvedValuesByMode);
    if (keys.length > 0) resolved = target.resolvedValuesByMode[keys[0]];
  }
  if (resolved === undefined || resolved === null) return null;
  return String(resolved);
}

function resolveTextUnit(
  val: IRTextValueWithUnit<number> | undefined,
  modeId: string,
  variableIndex: Map<string, ResolvedVariable>,
): { value: number; unit: 'PIXELS' | 'PERCENT' | 'AUTO' } | null {
  if (!val) return null;
  if (val.kind === 'literal') {
    return { value: val.value, unit: val.unit };
  }
  const target = variableIndex.get(val.targetVariableId);
  if (!target) return null;
  let resolved = target.resolvedValuesByMode[modeId];
  if (resolved === undefined) {
    const keys = Object.keys(target.resolvedValuesByMode);
    if (keys.length > 0) resolved = target.resolvedValuesByMode[keys[0]];
  }
  if (typeof resolved === 'number' && Number.isFinite(resolved)) {
    return { value: resolved, unit: 'PIXELS' };
  }
  if (typeof resolved === 'object' && resolved !== null && 'value' in resolved) {
    const obj = resolved as { value: number; unit?: 'PIXELS' | 'PERCENT' | 'AUTO' };
    return { value: obj.value, unit: obj.unit ?? 'PIXELS' };
  }
  if (typeof resolved === 'string') {
    const parsed = parseFloat(resolved);
    if (Number.isFinite(parsed)) {
      return { value: parsed, unit: 'PIXELS' };
    }
  }
  return null;
}

function resolveTextStyle(
  style: IRTextStyle,
  modes: Mode[],
  variableIndex: Map<string, ResolvedVariable>,
): ResolvedTextStyle {
  const name =
    (style as { name?: string }).name ??
    sanitizeCompositeName(style.figmaName || 'unnamed');
  const valuesByMode: ResolvedTextStyle['valuesByMode'] = {};

  for (const mode of modes) {
    valuesByMode[mode.id] = {
      fontFamily: resolveTextString(style.fontFamily, mode.id, variableIndex),
      fontSize: resolveTextNumber(style.fontSize, mode.id, variableIndex),
      fontWeight: resolveTextWeight(style.fontWeight, mode.id, variableIndex),
      lineHeight: resolveTextUnit(style.lineHeight, mode.id, variableIndex),
      letterSpacing: resolveTextUnit(style.letterSpacing, mode.id, variableIndex),
    };
  }

  return {
    id: style.id,
    name,
    figmaName: style.figmaName,
    groupPath: style.groupPath,
    raw: style,
    valuesByMode,
  };
}

export function resolveComposites(
  irComposites: IRComposites,
  allModes: Mode[],
  variableIndex: Map<string, ResolvedVariable>,
): ResolvedComposites {
  let modes = allModes;
  if (!modes || modes.length === 0) {
    const discoveredModeIds = new Set<string>();
    for (const v of variableIndex.values()) {
      for (const mId of Object.keys(v.resolvedValuesByMode)) {
        discoveredModeIds.add(mId);
      }
    }
    if (discoveredModeIds.size > 0) {
      modes = Array.from(discoveredModeIds).map((id) => ({
        id,
        name: id,
        key: toCamelCase(id),
      }));
    } else {
      modes = [{ id: 'default', name: 'Default', key: 'default' }];
    }
  }

  const paintStyles = (irComposites?.paintStyles ?? []).map((p) =>
    resolvePaintStyle(p, modes, variableIndex),
  );
  const effectStyles = (irComposites?.effectStyles ?? []).map((e) =>
    resolveEffectStyle(e, modes, variableIndex),
  );
  const textStyles = (irComposites?.textStyles ?? []).map((t) =>
    resolveTextStyle(t, modes, variableIndex),
  );

  return {
    paintStyles,
    effectStyles,
    textStyles,
  };
}
