import type {
  IR,
  IRPaintStyle,
  IREffectStyle,
  IRTextStyle,
  IRValue,
} from '../../../ir/types';
import {
  processSegment,
  sanitizeIdentifier,
  stripOrderingPrefix,
  toCamelCase,
  toPascalCase,
} from '../identifier';
import { DISALLOWED_COLLECTION_CLASS_NAMES } from '../reserved_names';
import { DART_KEYWORDS } from '../dart_keywords';
import type { Manifest, ManifestTargetSection } from '../../../core/manifest';
import {
  assembleTargetSection,
  getTargetSection,
  resolveStableCollectionName,
  resolveStableCompositeName,
  resolveStableVariableName,
} from '../../../core/manifest';
import {
  allocateStableCollectionIdentifiers,
  dedupGetters,
} from '../../../core/naming/dedup';
import type { PreparedTarget } from '../../../core/target';
import type {
  GraphCollection,
  ResolvedComposites,
  ResolvedEffectStyle,
  ResolvedLiteral,
  ResolvedPaintStyle,
  ResolvedTextStyle,
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
  name: string;
  figmaName: string;
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
  resolved?: ResolvedPaintStyle;
  valuesByMode?: ResolvedPaintStyle['valuesByMode'];
}

export interface PreparedEffectStyle {
  id: string;
  type: IREffectStyle['type'];
  groupName: string;
  getterName: string;
  isStable?: boolean;
  raw: IREffectStyle;
  resolved?: ResolvedEffectStyle;
  valuesByMode?: ResolvedEffectStyle['valuesByMode'];
}

export interface PreparedTextStyle {
  id: string;
  groupName: string;
  getterName: string;
  isStable?: boolean;
  raw: IRTextStyle;
  resolved?: ResolvedTextStyle;
  valuesByMode?: ResolvedTextStyle['valuesByMode'];
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

  const nextManifestSection = buildNextManifestSection(collections, {
    paintStyles,
    effectStyles,
    textStyles,
  });

  return {
    targetId: 'flutter',
    collections,
    paintStyles,
    effectStyles,
    textStyles,
    varIndex,
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

function computeFlutterVariablePath(v: { groupPath: string[]; leafName?: string }) {
  const fullPath = v.leafName ? [...v.groupPath, v.leafName] : v.groupPath;
  const segments = fullPath
    .map((s) => s.trim())
    .filter((s) => s.length > 0)
    .map(processSegment);
  if (segments.length === 0) segments.push('unnamed');
  const groupPath = segments.slice(0, -1).map(toPascalCase);
  const rawLeaf = segments[segments.length - 1];
  const camelLeaf = toCamelCase(rawLeaf);
  return { groupPath, camelLeaf };
}

function prepareCollection(
  col: GraphCollection,
  manifestSection: ManifestTargetSection | null,
  options: ExportOptions,
  warnings: PreparedWarning[],
): PreparedCollection {
  let className = sanitizeIdentifier(stripOrderingPrefix(col.name), 'pascal');
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

  const pathByVarId = new Map<
    string,
    { groupPath: string[]; camelLeaf: string }
  >();
  for (const v of col.variables) {
    if (!v.emitToPublic) continue;
    pathByVarId.set(v.id, computeFlutterVariablePath(v));
  }

  const allocatedMap = allocateStableCollectionIdentifiers(
    col.variables,
    manifestSection,
    (_leaf, v) => {
      const info = pathByVarId.get(v.id);
      if (!info) return 'unnamed';
      const { camelLeaf } = info;
      return DART_KEYWORDS.has(camelLeaf) ? `${camelLeaf}_` : camelLeaf;
    },
    {
      getGroupKey: (v) => pathByVarId.get(v.id)?.groupPath.join('/') ?? '',
      formatStableName: (varId, name) => {
        let normalized = resolveStableName(varId, name, manifestSection);
        if (DART_KEYWORDS.has(normalized)) {
          normalized = `${normalized}_`;
        }
        return normalized;
      },
    },
  );

  const variables: PreparedVariable[] = [];
  for (const v of col.variables) {
    if (!v.emitToPublic) continue;
    const { groupPath, camelLeaf } = pathByVarId.get(v.id)!;
    const isKeyword = DART_KEYWORDS.has(camelLeaf);
    if (isKeyword) {
      warnings.push({
        type: 'KEYWORD_CONFLICT',
        variableId: v.id,
        original: camelLeaf,
        fixed: `${camelLeaf}_`,
      });
    } else if (
      manifestSection?.variables?.[v.id] &&
      DART_KEYWORDS.has(manifestSection.variables[v.id])
    ) {
      const legacy = manifestSection.variables[v.id];
      warnings.push({
        type: 'KEYWORD_CONFLICT',
        variableId: v.id,
        original: legacy,
        fixed: `${legacy}_`,
      });
    }

    const allocated = allocatedMap.get(v.id)!;
    if (allocated.wasDeduplicated) {
      const derivedCandidate = isKeyword ? `${camelLeaf}_` : camelLeaf;
      warnings.push({
        type: 'DUPLICATE_DART_NAME',
        variableId: v.id,
        original: derivedCandidate,
        fixed: allocated.stableLeafKey,
      });
    }

    variables.push({
      id: v.id,
      figmaName: v.figmaName,
      groupPath,
      leafName: allocated.stableLeafKey,
      stableLeafName: allocated.stableLeafKey,
      dartType: dartTypeOf(v.type),
      valuesByMode: v.rawValuesByMode,
      resolvedValuesByMode: v.resolvedValuesByMode,
      emitToPublic: v.emitToPublic,
    });
  }

  return {
    id: col.id,
    name: col.name,
    figmaName: col.name,
    className,
    accessor,
    kind: col.kind,
    defaultModeIndex: 0,
    modes,
    variables,
    fileBaseName: pascalToSnake(className),
  };
}

function buildNextManifestSection(
  cols: PreparedCollection[],
  composites: {
    paintStyles: PreparedPaintStyle[];
    effectStyles: PreparedEffectStyle[];
    textStyles: PreparedTextStyle[];
  },
): ManifestTargetSection {
  const allComposites = [
    ...composites.paintStyles,
    ...composites.effectStyles,
    ...composites.textStyles,
  ];
  return assembleTargetSection({
    collections: cols.map((c) => ({
      id: c.id,
      name: c.figmaName,
      exportName: c.className,
      variables: c.variables.map((v) => ({
        id: v.id,
        figmaName: v.figmaName,
        stableLeafKey: v.stableLeafName,
      })),
    })),
    composites: allComposites.map((s) => ({
      id: s.id,
      figmaName: s.raw.figmaName,
      getterName: s.getterName,
    })),
  });
}

const FLUTTER_TARGET_ID = 'flutter';

function isResolvedPaintStyle(
  s: IRPaintStyle | ResolvedPaintStyle,
): s is ResolvedPaintStyle {
  return 'valuesByMode' in s && 'raw' in s;
}

function isResolvedEffectStyle(
  s: IREffectStyle | ResolvedEffectStyle,
): s is ResolvedEffectStyle {
  return 'valuesByMode' in s && 'raw' in s;
}

function isResolvedTextStyle(
  s: IRTextStyle | ResolvedTextStyle,
): s is ResolvedTextStyle {
  return 'valuesByMode' in s && 'raw' in s;
}

function preparePaint(
  s: IRPaintStyle | ResolvedPaintStyle,
  manifestSection?: ManifestTargetSection | null,
): PreparedPaintStyle {
  const segments = s.figmaName.split('/').map((x) => x.trim()).filter(Boolean);
  const getter = segments.length === 0 ? 'unnamed' : segments.join(' ');
  const derivedGetterName = sanitizeIdentifier(getter, 'camel');
  const getterName = resolveStableCompositeName(manifestSection, s.id, derivedGetterName);
  const isStable = Boolean(manifestSection?.composites?.[s.id]);
  const resolved = isResolvedPaintStyle(s) ? s : undefined;
  const raw = isResolvedPaintStyle(s) ? s.raw : s;
  return {
    id: s.id,
    type: s.type,
    groupName: 'Paint',
    getterName,
    isStable,
    raw,
    resolved,
    valuesByMode: resolved?.valuesByMode,
  };
}

function prepareEffect(
  s: IREffectStyle | ResolvedEffectStyle,
  manifestSection?: ManifestTargetSection | null,
): PreparedEffectStyle {
  const segments = s.figmaName.split('/').map((x) => x.trim()).filter(Boolean);
  const getter = segments.length === 0 ? 'unnamed' : segments.join(' ');
  const derivedGetterName = sanitizeIdentifier(getter, 'camel');
  const getterName = resolveStableCompositeName(manifestSection, s.id, derivedGetterName);
  const isStable = Boolean(manifestSection?.composites?.[s.id]);
  const resolved = isResolvedEffectStyle(s) ? s : undefined;
  const raw = isResolvedEffectStyle(s) ? s.raw : s;
  return {
    id: s.id,
    type: s.type,
    groupName: 'Effect',
    getterName,
    isStable,
    raw,
    resolved,
    valuesByMode: resolved?.valuesByMode,
  };
}

function prepareText(
  s: IRTextStyle | ResolvedTextStyle,
  manifestSection?: ManifestTargetSection | null,
): PreparedTextStyle {
  const segments = s.figmaName.split('/').map((x) => x.trim()).filter(Boolean);
  const getter = segments.length === 0 ? 'unnamed' : segments.join(' ');
  const derivedGetterName = sanitizeIdentifier(getter, 'camel');
  const getterName = resolveStableCompositeName(manifestSection, s.id, derivedGetterName);
  const isStable = Boolean(manifestSection?.composites?.[s.id]);
  const resolved = isResolvedTextStyle(s) ? s : undefined;
  const raw = isResolvedTextStyle(s) ? s.raw : s;
  return {
    id: s.id,
    groupName: 'Text',
    getterName,
    isStable,
    raw,
    resolved,
    valuesByMode: resolved?.valuesByMode,
  };
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
