// Per-mode literal resolver. Walks IR alias chains to a primitive value,
// stopping safely on cycles. Both RN flavors use this for composites
// (paint/effect/text styles) and for materializing token values into
// theme objects (Unistyles) or `vars()` JS maps (NativeWind).
//
// Primitive output:
//   - color  → '#RRGGBBAA' (uppercase, padded — matches type_mapping.rgbaToRRGGBBAA)
//   - number → number
//   - string → string
//   - bool   → boolean
//
// `null` means the value could not be resolved (alias to a missing variable
// or a cycle). Callers decide whether to skip, default, or error.

import type {
  IR,
  IRColorValue,
  IRTextValue,
  IRTextValueWithUnit,
  IRValue,
  IRVariable,
  RGBA,
} from '../../../ir/types';
import { rgbaToRRGGBBAA } from '../type_mapping';

export type ResolvedPrimitive = string | number | boolean;

export type ResolvedByMode = Record<
  string /* modeId */,
  Record<string /* variableId */, ResolvedPrimitive>
>;

/**
 * Build a `(modeId, varId) → primitive` lookup by resolving every variable in
 * every mode. Aliases are resolved per-mode (cross-collection allowed).
 */
export function resolveAllVariableLiterals(ir: IR): ResolvedByMode {
  const allVars = new Map<string, IRVariable>();
  for (const c of ir.collections) {
    for (const v of c.variables) allVars.set(v.id, v);
  }

  const modeIds = new Set<string>();
  for (const c of ir.collections) {
    for (const m of c.modes) modeIds.add(m.id);
  }

  const out: ResolvedByMode = {};
  for (const modeId of modeIds) {
    out[modeId] = {};
    for (const [, v] of allVars) {
      const val = v.valuesByMode[modeId];
      if (!val) continue;
      const resolved = resolveValue(modeId, val, allVars, new Set());
      if (resolved !== null) out[modeId][v.id] = resolved;
    }
  }
  return out;
}

function resolveValue(
  modeId: string,
  v: IRValue,
  allVars: Map<string, IRVariable>,
  seen: Set<string>,
): ResolvedPrimitive | null {
  if (v.kind === 'literal') return literalToPrimitive(v.value);

  const targetId = v.targetVariableId;
  if (seen.has(targetId)) return null;
  seen.add(targetId);
  const target = allVars.get(targetId);
  if (!target) return null;

  // Cross-collection alias: the target may belong to a different collection
  // whose mode set doesn't include `modeId`. Fall back to the target's first
  // available mode (deterministic — same convention the reader uses for the
  // collection's "default mode").
  const next =
    target.valuesByMode[modeId] ??
    target.valuesByMode[Object.keys(target.valuesByMode)[0]];
  if (!next) return null;
  return resolveValue(modeId, next, allVars, seen);
}

function literalToPrimitive(
  value: RGBA | number | string | boolean,
): ResolvedPrimitive {
  if (typeof value === 'number' || typeof value === 'string' || typeof value === 'boolean') {
    return value;
  }
  return rgbaToRRGGBBAA(value);
}

// ── Composite-shaped helpers ──────────────────────────────────────────────

export function resolveColorValue(
  modeId: string,
  c: IRColorValue,
  resolved: ResolvedByMode,
): string | null {
  if (c.kind === 'literal') return rgbaToRRGGBBAA(c.rgba);
  const v = resolved[modeId]?.[c.targetVariableId];
  return typeof v === 'string' ? v : null;
}

export function resolveTextValue<T extends ResolvedPrimitive>(
  modeId: string,
  v: IRTextValue<T>,
  resolved: ResolvedByMode,
): T | null {
  if (v.kind === 'literal') return v.value;
  const got = resolved[modeId]?.[v.targetVariableId];
  return (got as T | undefined) ?? null;
}

export interface ResolvedTextWithUnit {
  value: number;
  unit: 'PIXELS' | 'PERCENT' | 'AUTO';
}

export function resolveTextValueWithUnit(
  modeId: string,
  v: IRTextValueWithUnit<number>,
  resolved: ResolvedByMode,
): ResolvedTextWithUnit | null {
  if (v.kind === 'literal') return { value: v.value, unit: v.unit };
  const got = resolved[modeId]?.[v.targetVariableId];
  return typeof got === 'number' ? { value: got, unit: 'PIXELS' } : null;
}
