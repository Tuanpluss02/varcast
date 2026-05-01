import type {
  IR,
  IRCollection,
  IRColorValue,
  IREffectStyle,
  IRPaintStyle,
  IRTextStyle,
  IRTextValue,
  IRTextValueWithUnit,
  IRValue,
  IRVariable,
  RGBA,
} from '../../../ir/types';
import type { Manifest, ManifestTargetSection } from '../../../core/manifest';
import {
  resolveStableCollectionName,
  resolveStableVariableName,
} from '../../../core/manifest';
import { processSegment, splitWords, toCamelCase, toKebabCase, toPascalCase } from '../../../core/sanitize_base';
import { rgbaToRRGGBBAA } from '../type_mapping';

export type RNPrimitiveType = 'string' | 'number' | 'boolean';

export interface PreparedRNMode {
  id: string;
  name: string;
  key: string; // camelCase-ish mode key (e.g. darkMode)
}

export interface PreparedRNVariable {
  id: string;
  figmaName: string;
  groupPath: string[]; // raw segments
  groupPathKeys: string[]; // camelCase segments
  leafKey: string; // camelCase leaf key
  stableLeafKey: string;
  type: IRVariable['type'];
  valuesByMode: Record<string, IRValue>;
}

export interface PreparedRNCollection {
  id: string;
  figmaName: string;
  kind: IRCollection['kind'];
  exportName: string; // camelCase, e.g. colorToken
  typeName: string; // PascalCase, e.g. ColorToken
  fileBaseName: string; // kebab-case, e.g. color-token
  modes: PreparedRNMode[];
  variables: PreparedRNVariable[];
}

export interface PreparedRN {
  collections: PreparedRNCollection[];
  paintStyles: PreparedRNPaintStyle[];
  effectStyles: PreparedRNEffectStyle[];
  textStyles: PreparedRNTextStyle[];
  /** Per-mode variable literal index (post alias-resolve). */
  resolvedVarByMode: Record<string /*modeId*/, Record<string /*varId*/, string | number | boolean>>;
  nextManifestSection: ManifestTargetSection;
}

export interface PreparedRNPaintStyle {
  id: string;
  type: IRPaintStyle['type'];
  groupName: string;
  getterName: string;
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

function words(raw: string): string[] {
  return splitWords(processSegment(raw));
}

function camel(raw: string): string {
  return toCamelCase(words(raw).join(' '));
}

function pascal(raw: string): string {
  return toPascalCase(words(raw).join(' '));
}

function kebab(raw: string): string {
  return toKebabCase(words(raw).join(' '));
}

export function prepareRN(ir: IR, manifest: Manifest | null): PreparedRN {
  const collections: PreparedRNCollection[] = ir.collections.map((c) =>
    prepareCollection(c, manifest),
  );

  const resolvedVarByMode = resolveAllVariableLiterals(ir);

  const paintStyles = dedupCompositeGetters(
    ir.composites.paintStyles.map((s) => preparePaint(s)),
    (s) => s.groupName,
  );
  const effectStyles = dedupCompositeGetters(
    ir.composites.effectStyles.map((s) => prepareEffect(s)),
    (s) => s.groupName,
  );
  const textStyles = dedupCompositeGetters(
    ir.composites.textStyles.map((s) => prepareText(s)),
    (s) => s.groupName,
  );

  const nextManifestSection = buildNextManifestSection(ir, collections);
  return { collections, paintStyles, effectStyles, textStyles, resolvedVarByMode, nextManifestSection };
}

function prepareCollection(col: IRCollection, manifest: Manifest | null): PreparedRNCollection {
  const derivedType = pascal(col.name);
  const typeName = resolveStableCollectionName('react_native', col.id, derivedType, manifest);
  const exportName = lowerFirst(typeName);
  const fileBaseName = kebab(col.name);

  const modes: PreparedRNMode[] = col.modes.map((m) => ({
    id: m.id,
    name: m.name,
    key: camel(m.name),
  }));

  const variables: PreparedRNVariable[] = [];
  for (const v of col.variables) {
    if (!v.emitToPublic) continue;
    const segs = v.groupPath.map((s) => s.trim()).filter(Boolean);
    const groupSegs = segs.slice(0, -1);
    const leafSeg = segs[segs.length - 1] ?? 'unnamed';
    const groupPathKeys = groupSegs.map(camel);
    const derivedLeaf = camel(leafSeg);
    const stableLeafKey = resolveStableVariableName('react_native', v.id, derivedLeaf, manifest);
    variables.push({
      id: v.id,
      figmaName: v.figmaName,
      groupPath: segs,
      groupPathKeys,
      leafKey: derivedLeaf,
      stableLeafKey,
      type: v.type,
      valuesByMode: v.valuesByMode,
    });
  }

  return {
    id: col.id,
    figmaName: col.name,
    kind: col.kind,
    exportName,
    typeName,
    fileBaseName,
    modes,
    variables,
  };
}

function buildNextManifestSection(ir: IR, cols: PreparedRNCollection[]): ManifestTargetSection {
  const variables: Record<string, string> = {};
  const collections: Record<string, string> = {};
  const figmaVar: Record<string, string> = {};
  const figmaCol: Record<string, string> = {};

  for (const c of cols) collections[c.id] = c.typeName;
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

function lowerFirst(s: string): string {
  return s ? s[0].toLowerCase() + s.slice(1) : s;
}

function preparePaint(s: IRPaintStyle): PreparedRNPaintStyle {
  return {
    id: s.id,
    type: s.type,
    groupName: paintBucket(s.type),
    getterName: camel(s.figmaName),
    raw: s,
  };
}

function prepareEffect(s: IREffectStyle): PreparedRNEffectStyle {
  return {
    id: s.id,
    type: s.type,
    groupName: effectBucket(s.type),
    getterName: camel(s.figmaName),
    raw: s,
  };
}

function prepareText(s: IRTextStyle): PreparedRNTextStyle {
  const segs = s.figmaName.split('/').map((x) => x.trim()).filter(Boolean);
  let groupName = 'Main';
  let getterParts: string[] = segs;
  if (segs.length >= 2) {
    groupName = pascal(segs[0]);
    getterParts = segs.slice(1);
  }
  return {
    id: s.id,
    groupName,
    getterName: camel(getterParts.join(' ')),
    raw: s,
  };
}

function paintBucket(t: IRPaintStyle['type']): string {
  switch (t) {
    case 'SOLID':
      return 'Solid';
    case 'GRADIENT_LINEAR':
      return 'Linear';
    case 'GRADIENT_RADIAL':
      return 'Radial';
    case 'GRADIENT_ANGULAR':
      return 'Angular';
    case 'GRADIENT_DIAMOND':
      return 'Diamond';
    case 'IMAGE':
      return 'Image';
  }
}

function effectBucket(t: IREffectStyle['type']): string {
  switch (t) {
    case 'DROP_SHADOW':
      return 'Drop';
    case 'INNER_SHADOW':
      return 'Inner';
    case 'LAYER_BLUR':
      return 'LayerBlur';
    case 'BACKGROUND_BLUR':
      return 'BackgroundBlur';
  }
}

function dedupCompositeGetters<T extends { getterName: string }>(
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
    it.getterName = `${base}_${next}`;
  }
  return items;
}

// ── Variable literal resolver (for composites) ─────────────────────────────

type Primitive = string | number | boolean;

function resolveAllVariableLiterals(ir: IR): Record<string, Record<string, Primitive>> {
  const allVars = new Map<string, IRVariable>();
  for (const c of ir.collections) for (const v of c.variables) allVars.set(v.id, v);

  // Collect all modeIds from IR (across collections).
  const modeIds = new Set<string>();
  for (const c of ir.collections) for (const m of c.modes) modeIds.add(m.id);

  const out: Record<string, Record<string, Primitive>> = {};
  for (const modeId of modeIds) {
    out[modeId] = {};
    for (const [id] of allVars) {
      const v = allVars.get(id)!;
      const val = v.valuesByMode[modeId];
      if (!val) continue;
      const resolved = resolveValue(modeId, val, allVars, new Set());
      if (resolved !== undefined) out[modeId][id] = resolved;
    }
  }
  return out;
}

function resolveValue(
  modeId: string,
  v: IRValue,
  allVars: Map<string, IRVariable>,
  seen: Set<string>,
): Primitive | undefined {
  if (v.kind === 'literal') {
    const x = v.value as any;
    if (typeof x === 'number' || typeof x === 'string' || typeof x === 'boolean') return x;
    return rgbaToRRGGBBAA(x as RGBA);
  }
  const targetId = v.targetVariableId;
  if (seen.has(targetId)) return undefined;
  seen.add(targetId);
  const target = allVars.get(targetId);
  if (!target) return undefined;
  const next = target.valuesByMode[modeId];
  if (!next) return undefined;
  return resolveValue(modeId, next, allVars, seen);
}

export function resolveColorValueToHex(
  modeId: string,
  c: IRColorValue,
  resolvedVarByMode: Record<string, Record<string, Primitive>>,
): string | null {
  if (c.kind === 'literal') return rgbaToRRGGBBAA(c.rgba as RGBA);
  const v = resolvedVarByMode[modeId]?.[c.targetVariableId];
  return typeof v === 'string' ? v : null;
}

export function resolveTextValue<T extends Primitive>(
  modeId: string,
  v: IRTextValue<T>,
  resolvedVarByMode: Record<string, Record<string, Primitive>>,
): T | null {
  if ((v as any).kind === 'literal') return (v as any).value as T;
  const id = (v as any).targetVariableId as string;
  const got = resolvedVarByMode[modeId]?.[id];
  return (got as T) ?? null;
}

export function resolveTextValueWithUnit(
  modeId: string,
  v: IRTextValueWithUnit<number>,
  resolvedVarByMode: Record<string, Record<string, Primitive>>,
): { value: number; unit: 'PIXELS' | 'PERCENT' | 'AUTO' } | null {
  if ((v as any).kind === 'literal') return { value: (v as any).value, unit: (v as any).unit };
  const id = (v as any).targetVariableId as string;
  const got = resolvedVarByMode[modeId]?.[id];
  return typeof got === 'number' ? { value: got, unit: 'PIXELS' } : null;
}

