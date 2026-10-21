import type { IR, IRCollection, IRValue, IRVariable, RGBA } from '../../ir/types';
import type { PrimitiveLiteral, RGBAValue, ResolvedLiteral } from './types';

export type VariableLookup =
  | IR
  | IRCollection[]
  | Map<string, IRVariable>
  | ((id: string) => IRVariable | undefined);

export function roundFloat6(n: number): number {
  return Math.round(n * 1e6) / 1e6;
}

export function clamp01(n: number): number {
  return n < 0 ? 0 : n > 1 ? 1 : n;
}

export function hex2(v: number): string {
  return Math.round(clamp01(v) * 255)
    .toString(16)
    .padStart(2, '0')
    .toUpperCase();
}

export function isRGBA(v: unknown): v is RGBA {
  return (
    typeof v === 'object' &&
    v !== null &&
    'r' in v &&
    'g' in v &&
    'b' in v &&
    'a' in v
  );
}

export function toRGBAValue(rgba: RGBA): RGBAValue {
  const rClamped = clamp01(rgba.r);
  const gClamped = clamp01(rgba.g);
  const bClamped = clamp01(rgba.b);
  const aClamped = clamp01(rgba.a);

  const r = roundFloat6(rClamped);
  const g = roundFloat6(gClamped);
  const b = roundFloat6(bClamped);
  const a = roundFloat6(aClamped);

  const r255 = Math.round(rClamped * 255);
  const g255 = Math.round(gClamped * 255);
  const b255 = Math.round(bClamped * 255);

  const hex = `#${hex2(rgba.r)}${hex2(rgba.g)}${hex2(rgba.b)}${hex2(rgba.a)}`;
  const rgbaString = `rgba(${r255}, ${g255}, ${b255}, ${a})`;

  return { r, g, b, a, hex, rgbaString };
}

export function resolveLiteralValue(val: RGBA | PrimitiveLiteral): ResolvedLiteral {
  if (isRGBA(val)) {
    return toRGBAValue(val);
  }
  if (typeof val === 'number') {
    return roundFloat6(val);
  }
  return val;
}

function findVariable(id: string, lookup: VariableLookup): IRVariable | undefined {
  if (typeof lookup === 'function') {
    return lookup(id);
  }
  if (lookup instanceof Map) {
    return lookup.get(id);
  }
  const collections = Array.isArray(lookup) ? lookup : lookup.collections;
  for (const col of collections) {
    const v = col.variables.find((x) => x.id === id);
    if (v) return v;
  }
  return undefined;
}

/**
 * Recursively resolves an IRValue or variable ID to a concrete ResolvedLiteral.
 * Protects against cycles and unresolvable aliases.
 */
export function resolveVariableLiteral(
  variableIdOrValue: string | IRValue,
  modeId: string,
  lookup: VariableLookup,
  onWarning?: (code: string, message: string) => void,
): ResolvedLiteral | undefined;
export function resolveVariableLiteral(
  variableIdOrValue: string | IRValue,
  modeId: string,
  lookup: VariableLookup,
  visited?: Set<string>,
  onWarning?: (code: string, message: string) => void,
): ResolvedLiteral | undefined;
export function resolveVariableLiteral(
  variableIdOrValue: string | IRValue,
  modeId: string,
  lookup: VariableLookup,
  visitedOrOnWarning?: Set<string> | ((code: string, message: string) => void),
  onWarning?: (code: string, message: string) => void,
): ResolvedLiteral | undefined {
  const visited =
    visitedOrOnWarning instanceof Set ? visitedOrOnWarning : new Set<string>();
  const warn =
    typeof visitedOrOnWarning === 'function' ? visitedOrOnWarning : onWarning;

  if (typeof variableIdOrValue !== 'string') {
    if (variableIdOrValue.kind === 'literal') {
      return resolveLiteralValue(variableIdOrValue.value);
    }
    const targetId = variableIdOrValue.targetVariableId;
    if (visited.has(targetId)) {
      warn?.('CYCLE', `Cycle detected in alias chain involving variable "${targetId}".`);
      return undefined;
    }
    visited.add(targetId);

    const targetVar = findVariable(targetId, lookup);
    if (!targetVar) {
      warn?.('UNRESOLVED_ALIAS', `Target variable "${targetId}" not found in lookup.`);
      return undefined;
    }

    let val = targetVar.valuesByMode[modeId];
    if (!val) {
      const modeKeys = Object.keys(targetVar.valuesByMode);
      if (modeKeys.length > 0) {
        val = targetVar.valuesByMode[modeKeys[0]];
        const totalModes = Object.keys(targetVar.valuesByMode).length;
        if (totalModes > 1) {
          warn?.(
            'MODE_FALLBACK_APPROXIMATED',
            `Target variable "${targetVar.figmaName}" has multiple modes, but mode "${modeId}" was not found; falling back to mode "${modeKeys[0]}".`,
          );
        }
      }
    }
    if (!val) return undefined;

    return resolveVariableLiteral(val, modeId, lookup, visited, warn);
  }

  const variableId = variableIdOrValue;
  if (visited.has(variableId)) {
    warn?.('CYCLE', `Cycle detected in alias chain involving variable "${variableId}".`);
    return undefined;
  }
  visited.add(variableId);

  const v = findVariable(variableId, lookup);
  if (!v) {
    warn?.('UNRESOLVED_ALIAS', `Target variable "${variableId}" not found in lookup.`);
    return undefined;
  }

  let val = v.valuesByMode[modeId];
  if (!val) {
    const modeKeys = Object.keys(v.valuesByMode);
    if (modeKeys.length > 0) {
      val = v.valuesByMode[modeKeys[0]];
      const totalModes = Object.keys(v.valuesByMode).length;
      if (totalModes > 1) {
        warn?.(
          'MODE_FALLBACK_APPROXIMATED',
          `Target variable "${v.figmaName}" has multiple modes, but mode "${modeId}" was not found; falling back to mode "${modeKeys[0]}".`,
        );
      }
    }
  }
  if (!val) return undefined;

  if (val.kind === 'literal') {
    return resolveLiteralValue(val.value);
  }

  return resolveVariableLiteral(val, modeId, lookup, visited, warn);
}
