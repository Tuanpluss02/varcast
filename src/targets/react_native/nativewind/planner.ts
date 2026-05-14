// NativeWind theme planner. Translates the shared PreparedRN into:
//   - A list of CSS variables (one per kept token), with per-(axis, mode)
//     assignments (literal value or `var(--…)` reference).
//   - A list of theme files to emit — one per axis × mode, plus a `base`
//     file for single-mode collections.
//   - A Tailwind preset shape: nested entries under `colors`, `spacing`,
//     `borderRadius`, … keyed by the variable's groupKebab path.
//   - Composite plans for `boxShadow` (literal default-mode bake) and
//     `.type-<getter>` text utilities (CSS-var-backed where possible).
//
// CSS variable naming: `--ds-<groupKebab.join('-')>-<leafKebab>`. We do NOT
// prefix with the Tailwind bucket — the bucket is only used for routing
// inside the preset (and Tailwind utilities provide the `bg-`/`text-`/…
// prefix themselves).

import type {
  CompositeShadowPlan,
  CompositeTextPlan,
} from '../unistyles/planner';
export type { CompositeShadowPlan, CompositeTextPlan } from '../unistyles/planner';
import {
  resolveColorValue,
  resolveTextValue,
  resolveTextValueWithUnit,
  type ResolvedByMode,
} from '../shared/composite_resolve';
import type { TailwindBucket } from '../shared/scope_classify';
import type {
  PreparedRN,
  PreparedRNCollection,
  PreparedRNEffectStyle,
  PreparedRNTextStyle,
  PreparedRNVariable,
} from '../shared/prepare';

// ── Per-token representation ──────────────────────────────────────────────

export interface TokenAssignment {
  /** Either a literal CSS value (`#FF0000FF`, `16px`, `Inter`) or a `var(...)` reference. */
  value: string;
}

export interface TokenPlan {
  varId: string;
  /** CSS variable name, e.g. `--ds-text-brand-default500`. */
  cssVarName: string;
  /** Group path segments (kebab), used to nest under the Tailwind preset bucket. */
  groupKebab: string[];
  leafKebab: string;
  bucket: TailwindBucket | null;
  /** TS/CSS hint for value formatting (e.g., px suffix for spacing). */
  type: PreparedRNVariable['type'];
  /** Owning collection id. */
  collectionId: string;
  /** Axis key for the owning collection (null when single-mode). */
  axisKey: string | null;
  /** Per-mode assignment for THIS collection. Key = axis mode key (or '__base__'
   *  for single-mode collections). */
  perMode: Record<string, TokenAssignment>;
}

export interface ThemeFilePlan {
  /** Slug used for the file name — `light`, `dark`, `brand-blue`, `base`, … */
  slug: string;
  /** Axis key, or null when this is the synthetic `base` file. */
  axisKey: string | null;
  /** Mode key (within the axis), or null when this is the `base` file. */
  modeKey: string | null;
  /** CSS variable assignments to emit in this file. */
  assignments: Array<{ name: string; value: string }>;
}

// ── Top-level plan ────────────────────────────────────────────────────────

export interface NativeWindPlan {
  tokens: TokenPlan[];
  themeFiles: ThemeFilePlan[];
  /** Composites — text styles map to `.type-*` utilities, shadows bake into `boxShadow`. */
  textStyles: CompositeTextPlan[];
  shadows: CompositeShadowPlan[];
  /** Detected light/dark axis key (for documentation/preset metadata). */
  lightDarkAxisKey: string | null;
}

// ── Build the plan ───────────────────────────────────────────────────────

const BASE_KEY = '__base__';
const BASE_SLUG = 'base';

export function buildNativeWindPlan(prepared: PreparedRN): NativeWindPlan {
  const axisByCollection = new Map<string, { keyCamel: string; modes: Array<{ keyCamel: string; id: string }> }>();
  for (const a of prepared.axes) {
    axisByCollection.set(a.collectionId, {
      keyCamel: a.keyCamel,
      modes: a.modes.map((m) => ({ keyCamel: m.keyCamel, id: m.id })),
    });
  }

  // 1) Per-collection token plans (CSS var + per-mode assignment)
  const tokens: TokenPlan[] = [];
  // Maps cssVarName → first owning token. Later collections that hit the
  // same path are flagged but we still emit their assignments — the user's
  // import order picks the winner.
  const seenByCssVar = new Map<string, TokenPlan>();

  for (const c of prepared.collections) {
    const axis = axisByCollection.get(c.id) ?? null;
    for (const v of c.variables) {
      const cssVarName = buildCssVarName(v);
      const existing = seenByCssVar.get(cssVarName);
      const t: TokenPlan = existing ?? {
        varId: v.id,
        cssVarName,
        groupKebab: v.groupKebab,
        leafKebab: v.leafKebab,
        bucket: v.tailwindBucket,
        type: v.type,
        collectionId: c.id,
        axisKey: axis?.keyCamel ?? null,
        perMode: {},
      };
      const modes = axis?.modes ?? [{ keyCamel: BASE_KEY, id: c.defaultModeId }];
      for (const m of modes) {
        const irValue = v.valuesByMode[m.id];
        if (!irValue) continue;
        if (irValue.kind === 'literal') {
          const literal = irValue.value;
          t.perMode[m.keyCamel] = {
            value: formatLiteralForCss(literal, v.type),
          };
        } else {
          const ref = lookupCssVarById(irValue.targetVariableId, prepared.collections);
          t.perMode[m.keyCamel] = { value: ref ? `var(${ref})` : 'initial' };
        }
      }
      if (!existing) {
        seenByCssVar.set(cssVarName, t);
        tokens.push(t);
      }
    }
  }

  // 2) Theme files: one per axis × mode, plus base for single-mode collections.
  const themeFiles = buildThemeFiles(prepared, tokens);

  // 3) Composites — bake from prepared.resolvedByMode (first available mode).
  const textStyles = prepared.textStyles.map((t) => planText(t, prepared.resolvedByMode));
  const shadows = prepared.effectStyles.map((s) => planShadow(s, prepared.resolvedByMode));

  return {
    tokens,
    themeFiles,
    textStyles,
    shadows,
    lightDarkAxisKey: prepared.axes.find((a) => a.isLightDarkLike)?.keyCamel ?? null,
  };
}

function buildCssVarName(v: PreparedRNVariable): string {
  const parts = [...v.groupKebab, v.leafKebab].filter(Boolean);
  return `--ds-${parts.join('-')}`;
}

function lookupCssVarById(
  id: string,
  collections: PreparedRNCollection[],
): string | null {
  for (const c of collections) {
    for (const v of c.variables) {
      if (v.id === id) return buildCssVarName(v);
    }
  }
  return null;
}

function formatLiteralForCss(
  v: string | number | boolean | { r: number; g: number; b: number; a: number },
  type: PreparedRNVariable['type'],
): string {
  if (type === 'COLOR' && typeof v === 'object') return rgbaHex(v as any);
  if (typeof v === 'string') return v;
  if (typeof v === 'boolean') return String(v);
  if (typeof v === 'number') {
    // Numeric tokens with a unit-bearing scope render as px so Tailwind utils
    // (p-4 → 16px etc.) compose cleanly. Unitless tokens (opacity, weight)
    // stay as plain numbers.
    return Number.isFinite(v) ? `${v}` : '0';
  }
  // Stray RGBA-like value when type isn't COLOR: render hex defensively.
  if (typeof v === 'object' && v !== null && 'r' in v) return rgbaHex(v as any);
  return String(v);
}

function rgbaHex(rgba: { r: number; g: number; b: number; a: number }): string {
  const c = (n: number) =>
    Math.round(Math.min(Math.max(n, 0), 1) * 255).toString(16).padStart(2, '0').toUpperCase();
  return `#${c(rgba.r)}${c(rgba.g)}${c(rgba.b)}${c(rgba.a)}`;
}

function buildThemeFiles(prepared: PreparedRN, tokens: TokenPlan[]): ThemeFilePlan[] {
  // Group tokens by their owning axis-mode key.
  // Single-mode collections feed the synthetic 'base' file.
  const buckets = new Map<string, ThemeFilePlan>();

  for (const t of tokens) {
    if (t.axisKey === null) {
      const key = `_:${BASE_KEY}`;
      const existing = buckets.get(key) ?? {
        slug: BASE_SLUG,
        axisKey: null,
        modeKey: null,
        assignments: [],
      };
      const v = t.perMode[BASE_KEY];
      if (v) existing.assignments.push({ name: t.cssVarName, value: v.value });
      buckets.set(key, existing);
      continue;
    }
    const axis = prepared.axes.find((a) => a.keyCamel === t.axisKey);
    if (!axis) continue;
    for (const m of axis.modes) {
      const key = `${axis.keyCamel}:${m.keyCamel}`;
      const slug = slugFor(axis, m.keyCamel);
      const existing = buckets.get(key) ?? {
        slug,
        axisKey: axis.keyCamel,
        modeKey: m.keyCamel,
        assignments: [],
      };
      const v = t.perMode[m.keyCamel];
      if (v) existing.assignments.push({ name: t.cssVarName, value: v.value });
      buckets.set(key, existing);
    }
  }

  // Emit base first, then per-axis files in IR axis order.
  const out: ThemeFilePlan[] = [];
  const base = buckets.get(`_:${BASE_KEY}`);
  if (base && base.assignments.length > 0) out.push(base);
  for (const a of prepared.axes) {
    for (const m of a.modes) {
      const f = buckets.get(`${a.keyCamel}:${m.keyCamel}`);
      if (f && f.assignments.length > 0) out.push(f);
    }
  }
  return out;
}

function slugFor(
  axis: { keyCamel: string; isLightDarkLike: boolean },
  modeKey: string,
): string {
  // Light/dark axis files get the bare mode name (`light.css`, `dark.css`)
  // — matches the spec's @import examples.
  if (axis.isLightDarkLike) return modeKey;
  return `${axis.keyCamel}-${modeKey}`;
}

// ── Composites ────────────────────────────────────────────────────────────

function planText(s: PreparedRNTextStyle, resolved: ResolvedByMode): CompositeTextPlan {
  const r = s.raw as any;
  const modeId = pickModeId(resolved);
  const fontFamily = modeId ? resolveTextValue<string>(modeId, r.fontFamily, resolved) ?? undefined : undefined;
  const fontSize = modeId ? resolveTextValue<number>(modeId, r.fontSize, resolved) ?? undefined : undefined;
  const fontWeightNum = modeId ? resolveTextValue<number>(modeId, r.fontWeight, resolved) ?? undefined : undefined;
  const lh = modeId ? resolveTextValueWithUnit(modeId, r.lineHeight, resolved) : null;
  const ls = modeId ? resolveTextValueWithUnit(modeId, r.letterSpacing, resolved) : null;
  const fsForPercent = fontSize ?? 16;

  let lineHeight: number | undefined;
  if (lh && lh.unit !== 'AUTO') lineHeight = lh.unit === 'PIXELS' ? lh.value : (lh.value / 100) * fsForPercent;

  let letterSpacing: number | undefined;
  if (ls && ls.unit !== 'AUTO') letterSpacing = ls.unit === 'PIXELS' ? ls.value : (ls.value / 100) * fsForPercent;

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
    const modeId = pickModeId(resolved);
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
  return { getterName: s.getterName, type: s.type, sigmaX: r.sigmaX, sigmaY: r.sigmaY };
}

function alphaFromHex(hex: string | null): number {
  if (!hex || hex[0] !== '#' || hex.length !== 9) return 1;
  const aa = parseInt(hex.slice(7, 9), 16);
  if (!Number.isFinite(aa)) return 1;
  return Math.round((aa / 255) * 1000) / 1000;
}

function pickModeId(resolved: ResolvedByMode): string | null {
  return Object.keys(resolved)[0] ?? null;
}
