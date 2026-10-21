import type {
  IR,
  IRCollection,
  IREffectStyle,
  IRPaintStyle,
  IRTextStyle,
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
import { dedupGetters, dedupSiblingKeys, reserveSiblingKey } from '../../../core/naming/dedup';
import type { PreparedTarget, TargetWarning } from '../../../core/target';
import type {
  GraphCollection,
  ResolvedEffectStyle,
  ResolvedLiteral,
  ResolvedPaintStyle,
  ResolvedTextStyle,
  SemanticTokenGraph,
} from '../../../core/graph/types';
import { buildSemanticGraph } from '../../../core/graph/build_graph';
import {
  processSegment,
  splitWords,
  stripOrderingPrefix,
  toCamelCase,
  toKebabCase,
  toPascalCase,
} from '../../../core/sanitize_base';
import { isJsReservedWord } from '../reserved';
import type { PartialReactNativeOptions } from '../options';

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
  nextManifestSection: ManifestTargetSection;
  warnings: TargetWarning[];
}

export interface PreparedRNPaintStyle {
  id: string;
  type: IRPaintStyle['type'];
  groupName: string;
  getterName: string;
  isStable?: boolean;
  raw: IRPaintStyle;
  resolved: ResolvedPaintStyle;
  valuesByMode: ResolvedPaintStyle['valuesByMode'];
}

export interface PreparedRNEffectStyle {
  id: string;
  type: IREffectStyle['type'];
  groupName: string;
  getterName: string;
  isStable?: boolean;
  raw: IREffectStyle;
  resolved: ResolvedEffectStyle;
  valuesByMode: ResolvedEffectStyle['valuesByMode'];
}

export interface PreparedRNTextStyle {
  id: string;
  groupName: string;
  getterName: string;
  isStable?: boolean;
  raw: IRTextStyle;
  resolved: ResolvedTextStyle;
  valuesByMode: ResolvedTextStyle['valuesByMode'];
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
  _options: PartialReactNativeOptions = {},
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

  const warnings: TargetWarning[] = [];

  const manifestSection: ManifestTargetSection | null =
    manifest && 'collections' in manifest
      ? (manifest as ManifestTargetSection)
      : getTargetSection(manifest as Manifest | null, 'react_native');

  const collections: PreparedRNCollection[] = graph.collections.map((c) =>
    prepareCollection(c, manifestSection, warnings),
  );

  const paintStyles = dedupGetters(
    graph.composites.paintStyles.map((s) => preparePaint(s, manifestSection)),
    (s) => s.groupName,
  );
  const effectStyles = dedupGetters(
    graph.composites.effectStyles.map((s) => prepareEffect(s, manifestSection)),
    (s) => s.groupName,
  );
  const textStyles = dedupGetters(
    graph.composites.textStyles.map((s) => prepareText(s, manifestSection)),
    (s) => s.groupName,
  );


  // Collect unsupported effects
  for (const s of graph.composites.effectStyles) {
    if (s.type !== 'DROP_SHADOW') {
      warnings.push({
        targetId: 'react_native',
        code: 'UNSUPPORTED_EFFECT',
        message: `Effect style "${s.figmaName}" of type "${s.type}" is not supported in React Native.`,
        details: { styleId: s.id, type: s.type },
      });
    }
  }

  const nextManifestSection = buildNextManifestSection(graph, collections, {
    paintStyles,
    effectStyles,
    textStyles,
  });

  return {
    targetId: 'react_native',
    modes,
    collections,
    paintStyles,
    effectStyles,
    textStyles,
    nextManifestSection,
    warnings,
  };
}

function prepareCollection(
  col: GraphCollection,
  manifestSection: ManifestTargetSection | null,
  warnings: TargetWarning[],
): PreparedRNCollection {
  const cleanName = stripOrderingPrefix(col.name);
  const derivedType = pascal(cleanName);
  const typeName = resolveStableCollectionName(
    manifestSection,
    col.id,
    derivedType,
  );
  let exportName = lowerFirst(typeName);
  if (isJsReservedWord(exportName)) {
    const escaped = `${exportName}Tokens`;
    warnings.push({
      targetId: 'react_native',
      code: 'RESERVED_WORD_ESCAPED',
      message: `Collection export name "${col.name}" is a JavaScript reserved word; escaped to "${escaped}".`,
    });
    exportName = escaped;
  }
  const fileBaseName = kebab(cleanName);

  const modes: PreparedRNMode[] = col.modes.map((m) => ({
    id: m.id,
    name: m.name,
    key: modeKey(m.name),
  }));

  // Collect all intermediate group paths in this collection to prevent prefix collisions
  const intermediateGroups = new Set<string>();
  for (const v of col.variables) {
    if (!v.emitToPublic) continue;
    const groupSegs = v.groupPath.map((s) => s.trim()).filter(Boolean);
    const groupKeys = groupSegs.map(camel);
    let prefix = '';
    for (const seg of groupKeys) {
      prefix = prefix ? `${prefix}/${seg}` : seg;
      intermediateGroups.add(prefix);
    }
  }

  const usedByGroup = new Map<string, Set<string>>();
  const stableReservedByVarId = new Map<string, string>();

  // Pass 1: Pre-reserve all stable pinned variable names under their group paths
  for (const v of col.variables) {
    if (!v.emitToPublic) continue;
    if (manifestSection?.variables?.[v.id]) {
      const groupSegs = v.groupPath.map((s) => s.trim()).filter(Boolean);
      const groupPathKeys = groupSegs.map(camel);
      const derivedLeaf = camel((v.leafName ?? 'unnamed').trim());
      const stableLeaf = resolveStableVariableName(manifestSection, v.id, derivedLeaf);
      const groupKey = groupPathKeys.join('/');
      const allocated = reserveSiblingKey(usedByGroup, groupKey, stableLeaf);
      stableReservedByVarId.set(v.id, allocated);
    }
  }

  // Pass 2: Allocate and deduplicate leaves
  const variables: PreparedRNVariable[] = [];
  for (const v of col.variables) {
    if (!v.emitToPublic) continue;
    const groupSegs = v.groupPath.map((s) => s.trim()).filter(Boolean);
    const leafSeg = (v.leafName ?? 'unnamed').trim();
    const segs = [...groupSegs, leafSeg];
    const groupPathKeys = groupSegs.map(camel);
    const groupKey = groupPathKeys.join('/');

    let finalLeaf: string;
    let stableLeaf: string;

    if (stableReservedByVarId.has(v.id)) {
      stableLeaf = stableReservedByVarId.get(v.id)!;
      finalLeaf = stableLeaf;
    } else {
      const derivedLeaf = camel(leafSeg);
      stableLeaf = resolveStableVariableName(
        manifestSection,
        v.id,
        derivedLeaf,
      );

      // Check if leaf conflicts with an intermediate group prefix
      let candidateLeaf = stableLeaf;
      const fullLeafPath = groupKey ? `${groupKey}/${candidateLeaf}` : candidateLeaf;
      if (intermediateGroups.has(fullLeafPath)) {
        candidateLeaf = `${candidateLeaf}Value`;
        warnings.push({
          targetId: 'react_native',
          code: 'LEAF_GROUP_CONFLICT',
          message: `Variable "${v.figmaName}" leaf "${stableLeaf}" conflicts with an intermediate group path under collection "${col.name}"; renamed to "${candidateLeaf}".`,
          details: { variableId: v.id, original: stableLeaf, fixed: candidateLeaf },
        });
      }

      finalLeaf = dedupSiblingKeys(usedByGroup, groupKey, candidateLeaf);
      if (finalLeaf !== stableLeaf && candidateLeaf === stableLeaf) {
        warnings.push({
          targetId: 'react_native',
          code: 'DUPLICATE_LEAF_NAME',
          message: `Variable "${v.figmaName}" collided with sibling leaf name; deduplicated to "${finalLeaf}".`,
          details: { variableId: v.id, original: stableLeaf, fixed: finalLeaf },
        });
      }
    }
    variables.push({
      id: v.id,
      figmaName: v.figmaName,
      groupPath: segs,
      groupPathKeys,
      leafKey: finalLeaf,
      stableLeafKey: finalLeaf,
      type: v.type,
      valuesByMode: v.rawValuesByMode,
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
  s: ResolvedPaintStyle,
  manifestSection?: ManifestTargetSection | null,
): PreparedRNPaintStyle {
  const derivedGetterName = camel(s.figmaName);
  const getterName = resolveStableCompositeName(
    manifestSection,
    s.id,
    derivedGetterName,
  );
  const isStable = Boolean(manifestSection?.composites?.[s.id]);
  return {
    id: s.id,
    type: s.type,
    groupName: paintBucket(s.type),
    getterName,
    isStable,
    raw: s.raw,
    resolved: s,
    valuesByMode: s.valuesByMode,
  };
}

function prepareEffect(
  s: ResolvedEffectStyle,
  manifestSection?: ManifestTargetSection | null,
): PreparedRNEffectStyle {
  const derivedGetterName = camel(s.figmaName);
  const getterName = resolveStableCompositeName(
    manifestSection,
    s.id,
    derivedGetterName,
  );
  const isStable = Boolean(manifestSection?.composites?.[s.id]);
  return {
    id: s.id,
    type: s.type,
    groupName: effectBucket(s.type),
    getterName,
    isStable,
    raw: s.raw,
    resolved: s,
    valuesByMode: s.valuesByMode,
  };
}

function prepareText(
  s: ResolvedTextStyle,
  manifestSection?: ManifestTargetSection | null,
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
  );
  const isStable = Boolean(manifestSection?.composites?.[s.id]);
  return {
    id: s.id,
    groupName,
    getterName,
    isStable,
    raw: s.raw,
    resolved: s,
    valuesByMode: s.valuesByMode,
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
