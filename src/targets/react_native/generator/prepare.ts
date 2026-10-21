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
} from '../../../ir/types';
import type { Manifest, ManifestTargetSection } from '../../../core/manifest';
import {
  getTargetSection,
  resolveStableCollectionName,
  resolveStableCompositeName,
  resolveStableVariableName,
} from '../../../core/manifest';
import { dedupGetters } from '../../../core/naming/dedup';
import type { PreparedTarget, TargetWarning } from '../../../core/target';
import type {
  GraphCollection,
  ResolvedLiteral,
  SemanticTokenGraph,
} from '../../../core/graph/types';
import { buildSemanticGraph } from '../../../core/graph/build_graph';
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
  resolvedValuesByMode?: Record<string, ResolvedLiteral>;
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

export interface PreparedRN extends PreparedTarget {
  targetId?: string;
  /** All known modes across collections (used for composites). */
  modes: PreparedRNMode[];
  collections: PreparedRNCollection[];
  paintStyles: PreparedRNPaintStyle[];
  effectStyles: PreparedRNEffectStyle[];
  textStyles: PreparedRNTextStyle[];
  /** Per-mode variable literal index (post alias-resolve). */
  resolvedVarByMode: Record<string /*modeId*/, Record<string /*varId*/, Primitive>>;
  nextManifestSection: ManifestTargetSection;
  nextManifest?: Manifest;
  warnings?: TargetWarning[];
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

export function prepareRN(
  input: SemanticTokenGraph | IR,
  manifest: Manifest | ManifestTargetSection | null = null,
): PreparedRN {
  const isRawIR = 'version' in input && !('variableIndex' in input);
  const graph: SemanticTokenGraph = isRawIR
    ? buildSemanticGraph(input as IR)
    : (input as SemanticTokenGraph);

  const modes: PreparedRNMode[] = graph.allModes.map((m) => ({
    id: m.id,
    name: m.name,
    key: modeKey(m.name),
  }));

  const collections: PreparedRNCollection[] = graph.collections.map((c) =>
    prepareCollection(c, manifest),
  );

  const manifestSection: ManifestTargetSection | null =
    manifest && 'collections' in manifest
      ? (manifest as ManifestTargetSection)
      : getTargetSection(manifest as Manifest | null, 'react_native');
  const parentManifest: Manifest | null =
    manifest && 'targets' in manifest ? (manifest as Manifest) : null;

  const resolvedVarByMode = extractResolvedVarByMode(graph);

  const paintStyles = dedupGetters(
    graph.composites.paintStyles.map((s) =>
      preparePaint(s, manifestSection, parentManifest),
    ),
    (s) => s.groupName,
  );
  const effectStyles = dedupGetters(
    graph.composites.effectStyles.map((s) =>
      prepareEffect(s, manifestSection, parentManifest),
    ),
    (s) => s.groupName,
  );
  const textStyles = dedupGetters(
    graph.composites.textStyles.map((s) =>
      prepareText(s, manifestSection, parentManifest),
    ),
    (s) => s.groupName,
  );

  const nextManifestSection = buildNextManifestSection(graph, collections, {
    paintStyles,
    effectStyles,
    textStyles,
  });

  const oldTargets: Manifest['targets'] =
    manifest && 'targets' in manifest ? { ...(manifest as Manifest).targets } : {};
  oldTargets['react_native'] = nextManifestSection;

  const nextManifest: Manifest = {
    version: '2.0',
    fileKey: graph.fileKey,
    lastExportedAt: new Date().toISOString(),
    targets: oldTargets,
  };

  return {
    targetId: 'react_native',
    modes,
    collections,
    paintStyles,
    effectStyles,
    textStyles,
    resolvedVarByMode,
    nextManifestSection,
    nextManifest,
    warnings: [],
  };
}

function prepareCollection(
  col: GraphCollection,
  manifest: Manifest | ManifestTargetSection | null,
): PreparedRNCollection {
  const derivedType = pascal(col.name);
  const typeName = resolveStableCollectionName(
    manifest && 'collections' in manifest ? (manifest as ManifestTargetSection) : 'react_native',
    col.id,
    derivedType,
    manifest && 'targets' in manifest ? (manifest as Manifest) : null,
  );
  const exportName = lowerFirst(typeName);
  const fileBaseName = kebab(col.name);

  const modes: PreparedRNMode[] = col.modes.map((m) => ({
    id: m.id,
    name: m.name,
    key: modeKey(m.name),
  }));

  const variables: PreparedRNVariable[] = [];
  for (const v of col.variables) {
    if (!v.emitToPublic) continue;
    const groupSegs = v.groupPath.map((s) => s.trim()).filter(Boolean);
    const leafSeg = (v.leafName ?? 'unnamed').trim();
    const segs = [...groupSegs, leafSeg];
    const groupPathKeys = groupSegs.map(camel);
    const derivedLeaf = camel(leafSeg);
    const stableLeafKey = resolveStableVariableName(
      manifest && 'variables' in manifest ? (manifest as ManifestTargetSection) : 'react_native',
      v.id,
      derivedLeaf,
      manifest && 'targets' in manifest ? (manifest as Manifest) : null,
    );
    variables.push({
      id: v.id,
      figmaName: v.figmaName,
      groupPath: segs,
      groupPathKeys,
      leafKey: derivedLeaf,
      stableLeafKey,
      type: v.type,
      valuesByMode: v.rawValuesByMode ?? (v as any).valuesByMode ?? {},
      resolvedValuesByMode: v.resolvedValuesByMode,
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

function modeKey(modeName: string): string {
  const base = camel(modeName);
  return /mode$/i.test(base) ? base : `${base}Mode`;
}

function buildNextManifestSection(
  graph: SemanticTokenGraph,
  cols: PreparedRNCollection[],
  composites: {
    paintStyles: PreparedRNPaintStyle[];
    effectStyles: PreparedRNEffectStyle[];
    textStyles: PreparedRNTextStyle[];
  },
): ManifestTargetSection {
  const variables: Record<string, string> = {};
  const collections: Record<string, string> = {};
  const compositeMap: Record<string, string> = {};
  const figmaVar: Record<string, string> = {};
  const figmaCol: Record<string, string> = {};
  const figmaComposite: Record<string, string> = {};

  for (const c of cols) {
    collections[c.id] = c.typeName;
    for (const v of c.variables) {
      variables[v.id] = v.stableLeafKey;
    }
  }

  const allComposites = [
    ...composites.paintStyles,
    ...composites.effectStyles,
    ...composites.textStyles,
  ];
  for (const s of allComposites) {
    compositeMap[s.id] = s.getterName;
    figmaComposite[s.id] = s.raw.figmaName;
  }

  for (const c of graph.collections) {
    figmaCol[c.id] = c.name;
    for (const v of c.variables) {
      figmaVar[v.id] = v.figmaName;
    }
  }

  return {
    variables,
    collections,
    composites: compositeMap,
    figmaNames: {
      variables: figmaVar,
      collections: figmaCol,
      composites: figmaComposite,
    },
  };
}

function lowerFirst(s: string): string {
  return s ? s[0].toLowerCase() + s.slice(1) : s;
}

function preparePaint(
  s: IRPaintStyle,
  manifestSection?: ManifestTargetSection | null,
  manifest?: Manifest | null,
): PreparedRNPaintStyle {
  const derivedGetterName = camel(s.figmaName);
  const getterName = resolveStableCompositeName(
    manifestSection,
    s.id,
    derivedGetterName,
    manifest,
  );
  return {
    id: s.id,
    type: s.type,
    groupName: paintBucket(s.type),
    getterName,
    raw: s,
  };
}

function prepareEffect(
  s: IREffectStyle,
  manifestSection?: ManifestTargetSection | null,
  manifest?: Manifest | null,
): PreparedRNEffectStyle {
  const derivedGetterName = camel(s.figmaName);
  const getterName = resolveStableCompositeName(
    manifestSection,
    s.id,
    derivedGetterName,
    manifest,
  );
  return {
    id: s.id,
    type: s.type,
    groupName: effectBucket(s.type),
    getterName,
    raw: s,
  };
}

function prepareText(
  s: IRTextStyle,
  manifestSection?: ManifestTargetSection | null,
  manifest?: Manifest | null,
): PreparedRNTextStyle {
  const segs = s.figmaName.split('/').map((x) => x.trim()).filter(Boolean);
  let groupName = 'Main';
  let getterParts: string[] = segs;
  if (segs.length >= 2) {
    groupName = pascal(segs[0]);
    getterParts = segs.slice(1);
  }
  const derivedGetterName = camel(getterParts.join(' '));
  const getterName = resolveStableCompositeName(
    manifestSection,
    s.id,
    derivedGetterName,
    manifest,
  );
  return {
    id: s.id,
    groupName,
    getterName,
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

type Primitive = string | number | boolean;

function extractResolvedVarByMode(
  graph: SemanticTokenGraph,
): Record<string, Record<string, Primitive>> {
  const out: Record<string, Record<string, Primitive>> = {};

  for (const mode of graph.allModes) {
    out[mode.id] = {};
  }

  for (const [, v] of graph.variableIndex) {
    for (const [modeId, resolvedLit] of Object.entries(v.resolvedValuesByMode)) {
      if (!out[modeId]) {
        out[modeId] = {};
      }
      if (typeof resolvedLit === 'object' && resolvedLit !== null && 'hex' in resolvedLit) {
        out[modeId][v.id] = resolvedLit.hex;
      } else if (
        typeof resolvedLit === 'number' ||
        typeof resolvedLit === 'string' ||
        typeof resolvedLit === 'boolean'
      ) {
        out[modeId][v.id] = resolvedLit;
      }
    }
  }

  return out;
}

export function resolveColorValueToHex(
  modeId: string,
  c: IRColorValue,
  resolvedVarByMode: Record<string, Record<string, Primitive>>,
): string | null {
  if (c.kind === 'literal') return rgbaToRRGGBBAA(c.rgba);
  const v = resolvedVarByMode[modeId]?.[c.targetVariableId];
  return typeof v === 'string' ? v : null;
}

export function resolveTextValue<T extends Primitive>(
  modeId: string,
  v: IRTextValue<T>,
  resolvedVarByMode: Record<string, Record<string, Primitive>>,
): T | null {
  if (v.kind === 'literal') return v.value;
  const id = v.targetVariableId;
  const got = resolvedVarByMode[modeId]?.[id];
  return (got as T) ?? null;
}

export function resolveTextValueWithUnit(
  modeId: string,
  v: IRTextValueWithUnit<number>,
  resolvedVarByMode: Record<string, Record<string, Primitive>>,
): { value: number; unit: 'PIXELS' | 'PERCENT' | 'AUTO' } | null {
  if (v.kind === 'literal') return { value: v.value, unit: v.unit };
  const id = v.targetVariableId;
  const got = resolvedVarByMode[modeId]?.[id];
  return typeof got === 'number' ? { value: got, unit: 'PIXELS' } : null;
}
