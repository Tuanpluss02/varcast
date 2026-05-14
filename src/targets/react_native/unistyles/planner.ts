// Unistyles theme planner. Translates the shared PreparedRN into a plan that
// the emitters can render directly into TypeScript.
//
// The plan answers two questions per export:
//
//   1. Theme shape — for each leaf in the merged groupPath tree, which
//      collection + variable owns it, and what's its TS type?
//   2. Axis layout — which collections drive `buildTheme` axes (any with
//      more than one mode), what default mode they each use, and which
//      axis (if any) is the canonical light/dark.
//
// Composites are resolved at codegen time using each variable's first
// available mode (limitation noted in the package README).

import type { Axis } from '../shared/axes';
import {
  resolveColorValue,
  resolveTextValue,
  resolveTextValueWithUnit,
  type ResolvedByMode,
} from '../shared/composite_resolve';
import type {
  PreparedRN,
  PreparedRNCollection,
  PreparedRNEffectStyle,
  PreparedRNPaintStyle,
  PreparedRNTextStyle,
  PreparedRNVariable,
} from '../shared/prepare';

export type LeafTSType = 'string' | 'number' | 'boolean';

export interface ThemeLeaf {
  /** Path segments from the merged tree root, e.g. ['colors','text','brand']. */
  path: string[];
  /** Final identifier under the path. */
  leaf: string;
  /** Variable id this leaf reads from. */
  varId: string;
  tsType: LeafTSType;
}

export interface CollectionPlan {
  id: string;
  /** Camel axis key — also matches `axes[i].keyCamel` when this collection is an axis. */
  axisKey: string | null;
  /** Mode keys, in declaration order (first = default). */
  modeKeys: string[];
  /** modeKey → modeId. */
  modeIds: Record<string, string>;
  defaultModeKey: string;
  defaultModeId: string;
  /** Variables owned by this collection, with their leaf path in the merged tree. */
  variables: Array<{
    id: string;
    path: string[];
    leaf: string;
    tsType: LeafTSType;
    /** Per-modeKey raw value (literal primitive) or alias marker. */
    rawByMode: Record<string, RawSlot>;
  }>;
}

export type RawSlot =
  | { kind: 'literal'; value: string | number | boolean }
  | { kind: 'alias'; varId: string };

// ── Composite plan (static — first-available-mode resolution) ─────────────

export interface CompositeShadowPlan {
  getterName: string;
  type: 'DROP_SHADOW' | 'INNER_SHADOW' | 'LAYER_BLUR' | 'BACKGROUND_BLUR';
  // For drop/inner shadows. Matches RN style props.
  shadowColor?: string;
  shadowOffset?: { width: number; height: number };
  shadowRadius?: number;
  shadowOpacity?: number;
  // For blurs.
  sigmaX?: number;
  sigmaY?: number;
}

export interface CompositeTextPlan {
  getterName: string;
  fontFamily?: string;
  fontSize?: number;
  fontWeight?: string; // RN expects '400' | '500' | … as a string
  lineHeight?: number;
  letterSpacing?: number;
}

export interface CompositeColorPlan {
  getterName: string;
  // v1: only SOLID supported; others stored with type for visibility.
  type: 'SOLID' | 'GRADIENT_LINEAR' | 'GRADIENT_RADIAL' | 'GRADIENT_ANGULAR' | 'GRADIENT_DIAMOND' | 'IMAGE';
  color?: string;
}

// ── Theme plan ───────────────────────────────────────────────────────────

export interface ThemePlan {
  /** Per-collection plan, in IR declaration order. */
  collections: CollectionPlan[];
  /** Axis collections (subset of `collections` with axisKey !== null), in IR order. */
  axes: Axis[];
  /** axis keyCamel → default mode key for that axis (first mode). */
  axisDefaults: Record<string, string>;
  /** True when an axis with both `light` and `dark` mode keys exists. */
  hasLightDark: boolean;
  /** Light/dark axis key when `hasLightDark` is true; null otherwise. */
  lightDarkAxisKey: string | null;
  /** Merged shape — the full set of leaves across all collections, in
   *  iteration order with later collections overriding earlier paths. */
  shape: ThemeLeaf[];
  /** Composites — resolved once at codegen time. */
  textStyles: CompositeTextPlan[];
  shadows: CompositeShadowPlan[];
  colorStyles: CompositeColorPlan[];
}

// ── Build the plan ───────────────────────────────────────────────────────

export function buildThemePlan(prepared: PreparedRN): ThemePlan {
  const axisByCollectionId = new Map<string, Axis>();
  for (const a of prepared.axes) axisByCollectionId.set(a.collectionId, a);

  const collections: CollectionPlan[] = prepared.collections.map((c) =>
    buildCollectionPlan(c, axisByCollectionId.get(c.id) ?? null),
  );

  const axisDefaults: Record<string, string> = {};
  for (const a of prepared.axes) axisDefaults[a.keyCamel] = a.modes[0].keyCamel;

  const lightDark = prepared.axes.find((a) => a.isLightDarkLike) ?? null;

  return {
    collections,
    axes: prepared.axes,
    axisDefaults,
    hasLightDark: lightDark !== null,
    lightDarkAxisKey: lightDark?.keyCamel ?? null,
    shape: buildShape(collections),
    textStyles: prepared.textStyles.map((t) => planText(t, prepared.resolvedByMode)),
    shadows: prepared.effectStyles.map((s) => planShadow(s, prepared.resolvedByMode)),
    colorStyles: prepared.paintStyles.map((p) => planColor(p, prepared.resolvedByMode)),
  };
}

function buildCollectionPlan(
  c: PreparedRNCollection,
  axis: Axis | null,
): CollectionPlan {
  const modeKeys: string[] = [];
  const modeIds: Record<string, string> = {};
  if (axis) {
    for (const m of axis.modes) {
      modeKeys.push(m.keyCamel);
      modeIds[m.keyCamel] = m.id;
    }
  } else {
    // Single-mode collection — synthesize one slot.
    const m = c.modes[0];
    if (m) {
      modeKeys.push(m.keyCamel);
      modeIds[m.keyCamel] = m.id;
    }
  }

  const variables = c.variables
    .map((v) => buildVariablePlan(v, modeKeys, modeIds))
    .filter((v): v is NonNullable<typeof v> => v !== null);

  return {
    id: c.id,
    axisKey: axis?.keyCamel ?? null,
    modeKeys,
    modeIds,
    defaultModeKey: modeKeys[0] ?? '',
    defaultModeId: modeIds[modeKeys[0]] ?? '',
    variables,
  };
}

function buildVariablePlan(
  v: PreparedRNVariable,
  modeKeys: string[],
  modeIds: Record<string, string>,
): {
  id: string;
  path: string[];
  leaf: string;
  tsType: LeafTSType;
  rawByMode: Record<string, RawSlot>;
} | null {
  // Drop variables with no useful path (defensive).
  const path = v.groupCamel;

  const rawByMode: Record<string, RawSlot> = {};
  for (const key of modeKeys) {
    const modeId = modeIds[key];
    const irValue = v.valuesByMode[modeId];
    if (!irValue) continue;
    if (irValue.kind === 'alias') {
      rawByMode[key] = { kind: 'alias', varId: irValue.targetVariableId };
    } else {
      const literal = irValue.value;
      if (typeof literal === 'number' || typeof literal === 'string' || typeof literal === 'boolean') {
        rawByMode[key] = { kind: 'literal', value: literal };
      } else {
        // RGBA — convert to hex (the resolver also does this; keeping it here
        // avoids a runtime dependency on the rgba helper).
        rawByMode[key] = { kind: 'literal', value: rgbaHex(literal) };
      }
    }
  }

  if (Object.keys(rawByMode).length === 0) return null;

  return {
    id: v.id,
    path,
    leaf: v.stableLeafKey,
    tsType: tsTypeFor(v.type),
    rawByMode,
  };
}

function tsTypeFor(t: PreparedRNVariable['type']): LeafTSType {
  switch (t) {
    case 'COLOR':
    case 'STRING':
      return 'string';
    case 'FLOAT':
      return 'number';
    case 'BOOLEAN':
      return 'boolean';
  }
}

function buildShape(collections: CollectionPlan[]): ThemeLeaf[] {
  // Last write wins per leaf path. We track ordering via a Map that we
  // rebuild as we encounter each variable.
  const byKey = new Map<string, ThemeLeaf>();
  for (const c of collections) {
    for (const v of c.variables) {
      const key = `${v.path.join('/')}::${v.leaf}`;
      byKey.set(key, { path: v.path, leaf: v.leaf, varId: v.id, tsType: v.tsType });
    }
  }
  return [...byKey.values()];
}

// ── Composite planning ────────────────────────────────────────────────────

function planText(s: PreparedRNTextStyle, resolved: ResolvedByMode): CompositeTextPlan {
  const r = s.raw;
  const modeId = pickModeId(r, resolved);
  const fontFamily = modeId
    ? resolveTextValue(modeId, r.fontFamily, resolved) ?? undefined
    : undefined;
  const fontSize = modeId
    ? resolveTextValue(modeId, r.fontSize, resolved) ?? undefined
    : undefined;
  const fontWeightNum = modeId
    ? resolveTextValue(modeId, r.fontWeight, resolved) ?? undefined
    : undefined;
  const lh = modeId ? resolveTextValueWithUnit(modeId, r.lineHeight, resolved) : null;
  const ls = modeId ? resolveTextValueWithUnit(modeId, r.letterSpacing, resolved) : null;

  const fsForPercent = fontSize ?? 16; // RN default text size
  let lineHeight: number | undefined;
  if (lh && lh.unit !== 'AUTO') {
    lineHeight = lh.unit === 'PIXELS' ? lh.value : (lh.value / 100) * fsForPercent;
  }
  let letterSpacing: number | undefined;
  if (ls && ls.unit !== 'AUTO') {
    letterSpacing = ls.unit === 'PIXELS' ? ls.value : (ls.value / 100) * fsForPercent;
  }

  return {
    getterName: s.getterName,
    fontFamily,
    fontSize,
    fontWeight: fontWeightNum != null ? String(Math.round(fontWeightNum)) : undefined,
    lineHeight,
    letterSpacing,
  };
}

function planShadow(s: PreparedRNEffectStyle, resolved: ResolvedByMode): CompositeShadowPlan {
  const r = s.raw as any;
  if (s.type === 'DROP_SHADOW' || s.type === 'INNER_SHADOW') {
    const modeId = pickModeId(r, resolved);
    const color = modeId ? resolveColorValue(modeId, r.color, resolved) : null;
    return {
      getterName: s.getterName,
      type: s.type,
      shadowColor: color ?? '#00000000',
      shadowOffset: { width: r.offsetX, height: r.offsetY },
      shadowRadius: r.blurRadius,
      shadowOpacity: alphaFromHex(color),
    };
  }
  return {
    getterName: s.getterName,
    type: s.type,
    sigmaX: r.sigmaX,
    sigmaY: r.sigmaY,
  };
}

function planColor(s: PreparedRNPaintStyle, resolved: ResolvedByMode): CompositeColorPlan {
  if (s.type === 'SOLID') {
    const r = s.raw as any;
    const modeId = pickModeId(r, resolved);
    const color = modeId ? resolveColorValue(modeId, r.color, resolved) : null;
    return { getterName: s.getterName, type: 'SOLID', color: color ?? undefined };
  }
  return { getterName: s.getterName, type: s.type };
}

/**
 * Pick any mode id that exists in the resolved table — composites are
 * resolved against a single arbitrary mode (first one we see). This is the
 * documented limitation: composites don't update with axis switches.
 */
function pickModeId(_raw: unknown, resolved: ResolvedByMode): string | null {
  const keys = Object.keys(resolved);
  return keys[0] ?? null;
}

function alphaFromHex(hex: string | null): number {
  if (!hex || hex[0] !== '#' || hex.length !== 9) return 1;
  const aa = parseInt(hex.slice(7, 9), 16);
  if (!Number.isFinite(aa)) return 1;
  return Math.round((aa / 255) * 1000) / 1000;
}

function rgbaHex(rgba: { r: number; g: number; b: number; a: number }): string {
  const c = (n: number) => Math.round(Math.min(Math.max(n, 0), 1) * 255)
    .toString(16)
    .padStart(2, '0')
    .toUpperCase();
  return `#${c(rgba.r)}${c(rgba.g)}${c(rgba.b)}${c(rgba.a)}`;
}
