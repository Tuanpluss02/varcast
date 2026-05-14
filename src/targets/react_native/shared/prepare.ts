// RN-specific PreparedIR. Both flavors (NativeWind, Unistyles) share this
// preparation step so the IR is normalized exactly once per export.
//
// Faithful naming policy: identifiers are derived from Figma groupPath /
// collection name / mode name. We never inject semantic schema keys
// ("brand", "surface", "default500", …) — if the Figma file is structured
// that way, the generated theme will be too, and vice versa.
//
// Casing is provided in two flavors per identifier:
//   - camel  → for Unistyles (`theme.background.surface.primary`)
//   - kebab  → for NativeWind / CSS variables (`--ds-background-surface-primary`)
//
// Stable identifiers (manifest persistence) use the camel form; kebab is
// derived deterministically at emit time.

import type {
  IR,
  IRCollection,
  IREffectStyle,
  IRMode,
  IRPaintStyle,
  IRTextStyle,
  IRValue,
  IRVariable,
} from '../../../ir/types';
import type { Manifest, ManifestTargetSection } from '../../../core/manifest';
import {
  resolveStableCollectionName,
  resolveStableVariableName,
} from '../../../core/manifest';
import {
  processSegment,
  splitWords,
  toCamelCase,
  toKebabCase,
  toPascalCase,
} from '../../../core/sanitize_base';
import type { TargetWarning } from '../../../core/target';
import { detectAxes, type Axis } from './axes';
import {
  resolveAllVariableLiterals,
  type ResolvedByMode,
} from './composite_resolve';
import { tailwindBucketFor, type TailwindBucket } from './scope_classify';

export const REACT_NATIVE_TARGET_ID = 'react_native';

// ── Output types ───────────────────────────────────────────────────────────

export interface PreparedRNMode {
  id: string;
  figmaName: string;
  keyCamel: string; // 'darkMode'
  keyKebab: string; // 'dark-mode'
}

export interface PreparedRNVariable {
  id: string;
  figmaName: string;
  type: IRVariable['type'];
  scopes: IRVariable['scopes'];
  groupCamel: string[]; // ['background','surface']
  groupKebab: string[]; // ['background','surface']
  leafCamel: string;
  leafKebab: string;
  /** Manifest-stable canonical key (camelCase). Persisted across exports. */
  stableLeafKey: string;
  tailwindBucket: TailwindBucket | null;
  valuesByMode: Record<string, IRValue>;
}

export interface PreparedRNCollection {
  id: string;
  figmaName: string;
  kind: IRCollection['kind'];
  exportNameCamel: string; // 'colorToken'
  typeNamePascal: string; // 'ColorToken'
  fileBaseNameKebab: string; // 'color-token'
  defaultModeId: string;
  modes: PreparedRNMode[];
  variables: PreparedRNVariable[];
}

export interface PreparedRNPaintStyle {
  id: string;
  type: IRPaintStyle['type'];
  /** First Figma path segment (PascalCase). 'Paint' if none. */
  groupName: string;
  getterName: string; // camelCase, deduped within group
  raw: IRPaintStyle;
}

export interface PreparedRNEffectStyle {
  id: string;
  type: IREffectStyle['type'];
  groupName: string;
  getterName: string;
  raw: IREffectStyle;
}

export interface PreparedRNTextStyle {
  id: string;
  groupName: string;
  getterName: string;
  raw: IRTextStyle;
}

export interface PreparedRN {
  collections: PreparedRNCollection[];
  axes: Axis[];
  resolvedByMode: ResolvedByMode;
  paintStyles: PreparedRNPaintStyle[];
  effectStyles: PreparedRNEffectStyle[];
  textStyles: PreparedRNTextStyle[];
  nextManifestSection: ManifestTargetSection;
  warnings: TargetWarning[];
}

// ── Entry point ───────────────────────────────────────────────────────────

export function prepareRN(ir: IR, manifest: Manifest | null): PreparedRN {
  const warnings: TargetWarning[] = [];

  const collections = ir.collections.map((c) =>
    prepareCollection(c, manifest, warnings),
  );

  const axes = detectAxes(ir.collections);
  const resolvedByMode = resolveAllVariableLiterals(ir);

  const paintStyles = dedupGetters(
    ir.composites.paintStyles.map(preparePaint),
    (s) => s.groupName,
  );
  const effectStyles = dedupGetters(
    ir.composites.effectStyles.map(prepareEffect),
    (s) => s.groupName,
  );
  const textStyles = dedupGetters(
    ir.composites.textStyles.map(prepareText),
    (s) => s.groupName,
  );

  const nextManifestSection = buildManifestSection(ir, collections);

  return {
    collections,
    axes,
    resolvedByMode,
    paintStyles,
    effectStyles,
    textStyles,
    nextManifestSection,
    warnings,
  };
}

// ── Collection preparation ────────────────────────────────────────────────

function prepareCollection(
  col: IRCollection,
  manifest: Manifest | null,
  warnings: TargetWarning[],
): PreparedRNCollection {
  const derivedType = pascal(col.name);
  const typeNamePascal = resolveStableCollectionName(
    REACT_NATIVE_TARGET_ID,
    col.id,
    derivedType,
    manifest,
  );
  const exportNameCamel = lowerFirst(typeNamePascal);
  const fileBaseNameKebab = kebab(col.name);

  const modes: PreparedRNMode[] = col.modes.map(prepareMode);
  const defaultModeId = modes[0]?.id ?? '';

  const variables: PreparedRNVariable[] = [];
  const seenLeafByGroup = new Map<string, Set<string>>();

  for (const v of col.variables) {
    if (!v.emitToPublic) continue;

    const segs = (v.groupPath ?? [])
      .map((s) => (s ?? '').trim())
      .filter((s) => s.length > 0);
    const groupSegs = segs.slice(0, -1);
    const leafSeg = segs[segs.length - 1] ?? 'unnamed';

    const groupCamel = groupSegs.map(camel);
    const groupKebab = groupSegs.map(kebab);
    const leafCamel = camel(leafSeg);
    const leafKebab = kebab(leafSeg);

    let stableLeafKey = resolveStableVariableName(
      REACT_NATIVE_TARGET_ID,
      v.id,
      leafCamel,
      manifest,
    );

    const groupKey = groupCamel.join('/');
    const deduped = dedupLeaf(seenLeafByGroup, groupKey, stableLeafKey);
    if (deduped !== stableLeafKey) {
      warnings.push({
        targetId: REACT_NATIVE_TARGET_ID,
        code: 'DUPLICATE_LEAF_NAME',
        message: `Variable ${v.id}: leaf "${stableLeafKey}" collided with a sibling — renamed to "${deduped}".`,
        details: { variableId: v.id, original: stableLeafKey, fixed: deduped },
      });
      stableLeafKey = deduped;
    }

    variables.push({
      id: v.id,
      figmaName: v.figmaName,
      type: v.type,
      scopes: v.scopes ?? [],
      groupCamel,
      groupKebab,
      leafCamel: stableLeafKey,
      leafKebab: camelToKebab(stableLeafKey),
      stableLeafKey,
      tailwindBucket: tailwindBucketFor({ type: v.type, scopes: v.scopes ?? [] }),
      valuesByMode: v.valuesByMode,
    });
  }

  return {
    id: col.id,
    figmaName: col.name,
    kind: col.kind,
    exportNameCamel,
    typeNamePascal,
    fileBaseNameKebab,
    defaultModeId,
    modes,
    variables,
  };
}

function prepareMode(m: IRMode): PreparedRNMode {
  const base = camel(m.name);
  const keyCamel = /mode$/i.test(base) ? base : `${base}Mode`;
  return {
    id: m.id,
    figmaName: m.name,
    keyCamel,
    keyKebab: camelToKebab(keyCamel),
  };
}

// ── Composite style preparation ────────────────────────────────────────────

function preparePaint(s: IRPaintStyle): PreparedRNPaintStyle {
  const { groupName, getterName } = splitFigmaName(s.figmaName);
  return { id: s.id, type: s.type, groupName, getterName, raw: s };
}

function prepareEffect(s: IREffectStyle): PreparedRNEffectStyle {
  const { groupName, getterName } = splitFigmaName(s.figmaName);
  return { id: s.id, type: s.type, groupName, getterName, raw: s };
}

function prepareText(s: IRTextStyle): PreparedRNTextStyle {
  const { groupName, getterName } = splitFigmaName(s.figmaName);
  return { id: s.id, groupName, getterName, raw: s };
}

function splitFigmaName(figmaName: string): { groupName: string; getterName: string } {
  const segs = figmaName.split('/').map((s) => s.trim()).filter(Boolean);
  if (segs.length === 0) return { groupName: 'Main', getterName: 'unnamed' };
  if (segs.length === 1) return { groupName: 'Main', getterName: camel(segs[0]) };
  return { groupName: pascal(segs[0]), getterName: camel(segs.slice(1).join(' ')) };
}

function dedupGetters<T extends { getterName: string }>(
  items: T[],
  bucketKey: (item: T) => string,
): T[] {
  const used = new Map<string, number>();
  for (const it of items) {
    const base = it.getterName;
    const key = `${bucketKey(it)}::${base}`;
    const n = used.get(key);
    if (n === undefined) {
      used.set(key, 1);
      continue;
    }
    const next = n + 1;
    used.set(key, next);
    it.getterName = `${base}${next}`;
  }
  return items;
}

// ── Manifest section ──────────────────────────────────────────────────────

function buildManifestSection(
  ir: IR,
  cols: PreparedRNCollection[],
): ManifestTargetSection {
  const variables: Record<string, string> = {};
  const collections: Record<string, string> = {};
  const figmaVar: Record<string, string> = {};
  const figmaCol: Record<string, string> = {};

  for (const c of cols) collections[c.id] = c.typeNamePascal;
  for (const c of ir.collections) {
    figmaCol[c.id] = c.name;
    for (const v of c.variables) figmaVar[v.id] = v.figmaName;
  }
  for (const c of cols) {
    for (const v of c.variables) variables[v.id] = v.stableLeafKey;
  }

  return {
    variables,
    collections,
    figmaNames: { variables: figmaVar, collections: figmaCol },
  };
}

// ── Casing helpers ────────────────────────────────────────────────────────

function words(raw: string): string[] {
  return splitWords(processSegment(raw));
}

function camel(raw: string): string {
  // Numeric-only segments stay as bare digits — JS/TS targets allow numeric
  // object keys (`theme.space[4]`) and idiomatic Tailwind utilities use
  // them as-is (`p-4`, not `p-n-4`).
  const trimmed = (raw ?? '').trim();
  if (/^\d+$/.test(trimmed)) return trimmed;
  return toCamelCase(words(raw).join(' '));
}

function pascal(raw: string): string {
  return toPascalCase(words(raw).join(' '));
}

function kebab(raw: string): string {
  const trimmed = (raw ?? '').trim();
  if (/^\d+$/.test(trimmed)) return trimmed;
  return toKebabCase(words(raw).join(' '));
}

function lowerFirst(s: string): string {
  return s ? s[0].toLowerCase() + s.slice(1) : s;
}

function camelToKebab(s: string): string {
  if (/^\d+$/.test(s)) return s;
  return toKebabCase(splitWords(s).join(' '));
}

function dedupLeaf(
  usedByParent: Map<string, Set<string>>,
  parentKey: string,
  leaf: string,
): string {
  let used = usedByParent.get(parentKey);
  if (!used) {
    used = new Set();
    usedByParent.set(parentKey, used);
  }
  if (!used.has(leaf)) {
    used.add(leaf);
    return leaf;
  }
  let i = 2;
  while (used.has(`${leaf}${i}`)) i++;
  const next = `${leaf}${i}`;
  used.add(next);
  return next;
}
