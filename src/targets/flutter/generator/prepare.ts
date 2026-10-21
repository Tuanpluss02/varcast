import type {
  IR,
  IRPaintStyle,
  IREffectStyle,
  IRTextStyle,
  IRValue,
} from '../../../ir/types';
import {
  newSanitizeContext,
  sanitize,
  sanitizeIdentifier,
} from '../identifier';
import { DISALLOWED_COLLECTION_CLASS_NAMES } from '../reserved_names';
import { DART_KEYWORDS } from '../dart_keywords';
import type { Manifest, ManifestTargetSection } from '../../../core/manifest';
import {
  getTargetSection,
  resolveStableCollectionName,
  resolveStableCompositeName,
  resolveStableVariableName,
} from '../../../core/manifest';
import { dedupGetters, dedupSiblingKeys, reserveSiblingKey } from '../../../core/naming/dedup';
import type { PreparedTarget } from '../../../core/target';
import type {
  GraphCollection,
  ResolvedLiteral,
  SemanticTokenGraph,
} from '../../../core/graph/types';
import { buildSemanticGraph } from '../../../core/graph/build_graph';
import type { ExportOptions } from './options';
import { DEFAULT_EXPORT_OPTIONS } from './options';

/**
 * PreparedIR — The IR with finalized Dart identifiers and a flattened variable index
 * for cross-collection alias lookup. Generators consume this rather than raw IR.
 */

export type DartType = 'Color' | 'double' | 'String' | 'bool';

export interface PreparedMode {
  id: string;
  pascal: string; // e.g. "DarkMode"
  camel: string; // e.g. "darkMode"
}

export interface PreparedVariable {
  id: string;
  figmaName: string;
  groupPath: string[]; // PascalCase segments, leading group classes
  leafName: string; // emitted camelCase getter
  stableLeafName: string; // persisted in manifest (no prefix/suffix)
  dartType: DartType;
  valuesByMode: Record<string, IRValue>;
  resolvedValuesByMode?: Record<string, ResolvedLiteral>;
  emitToPublic: boolean;
}

export interface PreparedCollection {
  id: string;
  className: string; // PascalCase, e.g. "ColorBasic"
  accessor: string; // camelCase, e.g. "colorBasic"
  kind: 'primitive' | 'token';
  defaultModeIndex: number;
  modes: PreparedMode[];
  variables: PreparedVariable[];
  fileBaseName: string; // snake_case, e.g. "color_basic"
}

export interface VarRef {
  collectionId: string;
  collectionAccessor: string; // camelCase, e.g. "colorBasic"
  collectionClassName: string; // PascalCase, e.g. "ColorBasic"
  groupPath: string[]; // PascalCase
  leafName: string; // camelCase
  dartType: DartType;
  resolvedLiteral?: ResolvedLiteral;
}

export interface PreparedPaintStyle {
  id: string;
  type: IRPaintStyle['type'];
  groupName: string; // first segment of figmaName, sanitized PascalCase
  getterName: string; // remaining segments joined into camelCase
  isStable?: boolean;
  raw: IRPaintStyle;
}

export interface PreparedEffectStyle {
  id: string;
  type: IREffectStyle['type'];
  groupName: string;
  getterName: string;
  isStable?: boolean;
  raw: IREffectStyle;
}

export interface PreparedTextStyle {
  id: string;
  groupName: string;
  getterName: string;
  isStable?: boolean;
  raw: IRTextStyle;
}

export type PreparedWarning =
  | {
      type: 'KEYWORD_CONFLICT';
      variableId: string;
      original: string;
      fixed: string;
    }
  | {
      type: 'DUPLICATE_DART_NAME';
      variableId: string;
      original: string;
      fixed: string;
    };

export interface PreparedIR {
  targetId?: string;
  collections: PreparedCollection[];
  paintStyles: PreparedPaintStyle[];
  effectStyles: PreparedEffectStyle[];
  textStyles: PreparedTextStyle[];
  varIndex: Map<string, VarRef>;
  nextManifest: Manifest;
  nextManifestSection: ManifestTargetSection;
  warnings: PreparedWarning[];
  /** Original IR for alias resolution fallback */
  ir?: IR;
}

export type PreparedFlutterIR = PreparedIR;

export function prepareIR(
  input: SemanticTokenGraph | IR,
  manifest: Manifest | ManifestTargetSection | null = null,
  options: ExportOptions = DEFAULT_EXPORT_OPTIONS,
): PreparedIR {
  const isRawIR = 'version' in input && !('variableIndex' in input);
  const graph: SemanticTokenGraph = isRawIR
    ? buildSemanticGraph(input as IR)
    : (input as SemanticTokenGraph);
  const ir: IR | undefined = isRawIR ? (input as IR) : undefined;

  const manifestSection: ManifestTargetSection | null =
    manifest && 'collections' in manifest
      ? (manifest as ManifestTargetSection)
      : getTargetSection(manifest as Manifest | null, FLUTTER_TARGET_ID);

  const warnings: PreparedWarning[] = [];
  const collections = graph.collections.map((c) =>
    prepareCollection(c, manifestSection, options, warnings),
  );

  const varIndex = new Map<string, VarRef>();
  for (const col of collections) {
    for (const v of col.variables) {
      const firstModeId = col.modes[0]?.id;
      const firstResolved = firstModeId ? v.resolvedValuesByMode?.[firstModeId] : undefined;
      varIndex.set(v.id, {
        collectionId: col.id,
        collectionAccessor: col.accessor,
        collectionClassName: col.className,
        groupPath: v.groupPath,
        leafName: v.leafName,
        dartType: v.dartType,
        resolvedLiteral: firstResolved,
      });
    }
  }

  const paintStyles = dedupGetters(
    graph.composites.paintStyles.map((s) => preparePaint(s, manifestSection)),
    () => `paint`,
  );
  const effectStyles = dedupGetters(
    graph.composites.effectStyles.map((s) => prepareEffect(s, manifestSection)),
    () => `effect`,
  );
  const textStyles = dedupGetters(
    graph.composites.textStyles.map((s) => prepareText(s, manifestSection)),
    () => `text`,
  );

  const figmaVar: Record<string, string> = {};
  const figmaCol: Record<string, string> = {};
  for (const c of graph.collections) {
    figmaCol[c.id] = c.name;
    for (const v of c.variables) {
      figmaVar[v.id] = v.figmaName;
    }
  }

  const { nextManifest, nextManifestSection } = buildNextManifest(
    graph.fileKey,
    collections,
    { paintStyles, effectStyles, textStyles },
    manifest,
    figmaVar,
    figmaCol,
  );

  return {
    targetId: 'flutter',
    collections,
    paintStyles,
    effectStyles,
    textStyles,
    varIndex,
    nextManifest,
    nextManifestSection,
    warnings,
    ir,
  };
}

export const prepareFlutterIR = prepareIR;


function normalizeLegacyLeafName(
  name: string,
  section: ManifestTargetSection | undefined,
  variableId: string,
): string {
  const m = /^(.+)_([0-9]+)$/.exec(name);
  if (!m) return name;
  const base = m[1];
  const n = m[2];
  if (base.endsWith('_')) return name;
  const renamed = `${base}${n}`;
  if (section?.variables) {
    for (const [otherId, otherName] of Object.entries(section.variables)) {
      if (otherId === variableId) continue;
      if (otherName === renamed) return name;
    }
  }
  return renamed;
}

export function resolveStableName(
  variableId: string,
  derivedLeafName: string,
  manifest: Manifest | ManifestTargetSection | null,
): string {
  const section =
    manifest && 'variables' in manifest
      ? (manifest as ManifestTargetSection)
      : (manifest as Manifest | null)?.targets?.flutter;
  const raw = resolveStableVariableName(
    section,
    variableId,
    derivedLeafName,
  );
  return normalizeLegacyLeafName(raw, section, variableId);
}

function prepareCollection(
  col: GraphCollection,
  manifestSection: ManifestTargetSection | null,
  options: ExportOptions,
  warnings: PreparedWarning[],
): PreparedCollection {
  let className = sanitizeIdentifier(col.name, 'pascal');
  if (DISALLOWED_COLLECTION_CLASS_NAMES.has(className)) {
    className = `${className}Tokens`;
  }
  className = resolveStableCollectionName(manifestSection, col.id, className);
  const accessor = lowerFirst(className);
  const modes: PreparedMode[] = col.modes.map((m) => {
    let rawName = m.name;
    if (rawName === 'Mode') rawName = 'default';
    return {
      id: m.id,
      pascal: sanitizeIdentifier(rawName, 'pascal'),
      camel: sanitizeIdentifier(rawName, 'camel'),
    };
  });

  const ctx = newSanitizeContext();
  const finalNamesByParent = new Map<string, Set<string>>();
  const stableReservedByVarId = new Map<string, string>();

  // Pass 1: Pre-reserve all stable pinned variable names under their group paths
  for (const v of col.variables) {
    if (!v.emitToPublic) continue;
    if (manifestSection?.variables?.[v.id]) {
      const fullPath = 'leafName' in v && v.leafName
        ? [...v.groupPath, v.leafName]
        : v.groupPath;
      const { groupPath, leafName } = sanitize(fullPath, ctx);
      let stableLeaf = resolveStableName(v.id, leafName, manifestSection);
      if (DART_KEYWORDS.has(stableLeaf)) {
        stableLeaf = `${stableLeaf}_`;
      }
      const allocated = reserveSiblingKey(finalNamesByParent, groupPath.join('/'), stableLeaf);
      stableReservedByVarId.set(v.id, allocated);
    }
  }

  // Pass 2: Allocate and deduplicate leaves
  const variables: PreparedVariable[] = [];
  for (const v of col.variables) {
    if (!v.emitToPublic) continue;
    const fullPath = 'leafName' in v && v.leafName
      ? [...v.groupPath, v.leafName]
      : v.groupPath;
    const { groupPath, leafName, notes } = sanitize(fullPath, ctx);
    if (notes.keywordFixedFrom) {
      warnings.push({
        type: 'KEYWORD_CONFLICT',
        variableId: v.id,
        original: notes.keywordFixedFrom,
        fixed: leafName,
      });
    }
    if (notes.dedupedAs !== undefined) {
      const base = leafName.slice(0, -String(notes.dedupedAs).length);
      warnings.push({
        type: 'DUPLICATE_DART_NAME',
        variableId: v.id,
        original: base,
        fixed: leafName,
      });
    }

    let stableLeaf = resolveStableName(v.id, leafName, manifestSection);
    /**
     * Re-apply keyword fix for legacy manifests that may carry a Dart keyword leaf name.
     * Prevents emitting reserved words like `default` which break compilation.
     */
    if (DART_KEYWORDS.has(stableLeaf)) {
      const fixed = `${stableLeaf}_`;
      if (notes.keywordFixedFrom === undefined) {
        warnings.push({
          type: 'KEYWORD_CONFLICT',
          variableId: v.id,
          original: stableLeaf,
          fixed,
        });
      }
      stableLeaf = fixed;
    }

    if (stableReservedByVarId.has(v.id)) {
      stableLeaf = stableReservedByVarId.get(v.id)!;
    } else {
      stableLeaf = dedupSiblingKeys(finalNamesByParent, groupPath.join('/'), stableLeaf);
    }
    variables.push({
      id: v.id,
      figmaName: v.figmaName,
      groupPath,
      leafName: stableLeaf,
      stableLeafName: stableLeaf,
      dartType: dartTypeOf(v.type),
      valuesByMode: v.rawValuesByMode,
      resolvedValuesByMode: v.resolvedValuesByMode,
      emitToPublic: v.emitToPublic,
    });
  }

  return {
    id: col.id,
    className,
    accessor,
    kind: col.kind,
    defaultModeIndex: 0,
    modes,
    variables,
    fileBaseName: pascalToSnake(className),
  };
}

function buildNextManifest(
  fileKey: string,
  cols: PreparedCollection[],
  composites: {
    paintStyles: PreparedPaintStyle[];
    effectStyles: PreparedEffectStyle[];
    textStyles: PreparedTextStyle[];
  },
  oldManifest: Manifest | ManifestTargetSection | null,
  figmaVar: Record<string, string>,
  figmaCol: Record<string, string>,
): { nextManifest: Manifest; nextManifestSection: ManifestTargetSection } {
  const variables: Record<string, string> = {};
  const collections: Record<string, string> = {};
  const compositeMap: Record<string, string> = {};
  const figmaComposite: Record<string, string> = {};

  for (const c of cols) {
    collections[c.id] = c.className;
    for (const v of c.variables) {
      variables[v.id] = v.stableLeafName;
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

  const nextManifestSection: ManifestTargetSection = {
    variables,
    collections,
    composites: compositeMap,
    figmaNames: {
      variables: figmaVar,
      collections: figmaCol,
      composites: figmaComposite,
    },
  };

  const oldTargets: Manifest['targets'] =
    oldManifest && 'targets' in oldManifest ? { ...oldManifest.targets } : {};
  oldTargets[FLUTTER_TARGET_ID] = nextManifestSection;

  const nextManifest: Manifest = {
    version: '2.0',
    fileKey,
    lastExportedAt: new Date().toISOString(),
    targets: oldTargets,
  };

  return { nextManifest, nextManifestSection };
}

const FLUTTER_TARGET_ID = 'flutter';

function preparePaint(
  s: IRPaintStyle,
  manifestSection?: ManifestTargetSection | null,
): PreparedPaintStyle {
  const segments = s.figmaName.split('/').map((x) => x.trim()).filter(Boolean);
  const getter = segments.length === 0 ? 'unnamed' : segments.join(' ');
  const derivedGetterName = sanitizeIdentifier(getter, 'camel');
  const getterName = resolveStableCompositeName(manifestSection, s.id, derivedGetterName);
  const isStable = Boolean(manifestSection?.composites?.[s.id]);
  return { id: s.id, type: s.type, groupName: 'Paint', getterName, isStable, raw: s };
}

function prepareEffect(
  s: IREffectStyle,
  manifestSection?: ManifestTargetSection | null,
): PreparedEffectStyle {
  const segments = s.figmaName.split('/').map((x) => x.trim()).filter(Boolean);
  const getter = segments.length === 0 ? 'unnamed' : segments.join(' ');
  const derivedGetterName = sanitizeIdentifier(getter, 'camel');
  const getterName = resolveStableCompositeName(manifestSection, s.id, derivedGetterName);
  const isStable = Boolean(manifestSection?.composites?.[s.id]);
  return { id: s.id, type: s.type, groupName: 'Effect', getterName, isStable, raw: s };
}

function prepareText(
  s: IRTextStyle,
  manifestSection?: ManifestTargetSection | null,
): PreparedTextStyle {
  const segments = s.figmaName.split('/').map((x) => x.trim()).filter(Boolean);
  const getter = segments.length === 0 ? 'unnamed' : segments.join(' ');
  const derivedGetterName = sanitizeIdentifier(getter, 'camel');
  const getterName = resolveStableCompositeName(manifestSection, s.id, derivedGetterName);
  const isStable = Boolean(manifestSection?.composites?.[s.id]);
  return { id: s.id, groupName: 'Text', getterName, isStable, raw: s };
}

function dartTypeOf(t: 'COLOR' | 'FLOAT' | 'STRING' | 'BOOLEAN'): DartType {
  switch (t) {
    case 'COLOR':
      return 'Color';
    case 'FLOAT':
      return 'double';
    case 'STRING':
      return 'String';
    case 'BOOLEAN':
      return 'bool';
  }
}

function lowerFirst(s: string): string {
  if (!s) return s;
  return s[0].toLowerCase() + s.slice(1);
}

function pascalToSnake(s: string): string {
  return s
    .replace(/([a-z0-9])([A-Z])/g, '$1_$2')
    .replace(/([A-Z]+)([A-Z][a-z])/g, '$1_$2')
    .toLowerCase();
}
