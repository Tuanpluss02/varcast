import type {
  IR,
  IREffectStyle,
  IRPaintStyle,
  IRTextStyle,
  IRValue,
  IRVariable,
} from '../../../ir/types';
import type { ManifestTargetSection } from '../../../core/manifest/types';
import {
  resolveStableCollectionName,
  resolveStableCompositeName,
  resolveStableVariableName,
} from '../../../core/manifest/stable_names';
import { assembleTargetSection } from '../../../core/manifest/section_assembler';
import {
  allocateStableCollectionIdentifiers,
  dedupGetters,
} from '../../../core/naming/dedup';
import type { PreparedTarget, TargetWarning } from '../../../core/target';
import {
  isSemanticGraph,
  type GraphCollection,
  type ResolvedEffectStyle,
  type ResolvedLiteral,
  type ResolvedPaintStyle,
  type ResolvedTextStyle,
  type ResolvedVariable,
  type SemanticTokenGraph,
} from '../../../core/graph/types';
import { buildSemanticGraph } from '../../../core/graph/build_graph';
import {
  processSegment,
  stripOrderingPrefix,
  toCamelCase,
  toPascalCase,
} from '../../../core/sanitize_base';
import {
  collectionClassName,
  escapeKotlinIdentifier,
  isKotlinReserved,
  sanitizeKotlinIdentifier,
} from '../identifier';
import { type ComposeOptions, DEFAULT_COMPOSE_OPTIONS } from '../options';

export type KotlinPrimitiveType =
  | 'Color'
  | 'Dp'
  | 'TextUnit'
  | 'Float'
  | 'String'
  | 'Boolean';

/**
 * Infers the idiomatic Jetpack Compose / Kotlin type for a variable
 * based on its IR type and usage scopes.
 */
export function inferKotlinType(
  v: ResolvedVariable | IRVariable,
): KotlinPrimitiveType {
  switch (v.type) {
    case 'COLOR':
      return 'Color';
    case 'FLOAT': {
      const scopes = v.scopes ?? [];
      const hasScope = (targets: string[]) =>
        scopes.some((s) => targets.includes(s));

      if (hasScope(['FONT_SIZE', 'LINE_HEIGHT', 'LETTER_SPACING'])) {
        return 'TextUnit';
      }
      if (
        hasScope([
          'GAP',
          'CORNER_RADIUS',
          'STROKE_FLOAT',
          'WIDTH_HEIGHT',
          'EFFECT_FLOAT',
        ])
      ) {
        return 'Dp';
      }
      if (hasScope(['OPACITY'])) {
        return 'Float';
      }
      return 'Dp';
    }
    case 'STRING':
      return 'String';
    case 'BOOLEAN':
      return 'Boolean';
    default:
      return 'Dp';
  }
}

export interface PreparedComposeVariable {
  id: string;
  figmaName: string;
  groupPath: string[];
  leafName: string;
  stableLeafKey: string;
  propertyName: string;
  kotlinType: KotlinPrimitiveType;
  valuesByMode: Record<string, IRValue>;
  resolvedValuesByMode?: Record<string, ResolvedLiteral>;
  emitToPublic: boolean;
}

export interface PreparedComposeMode {
  id: string;
  name: string;
  key: string;
  pascalName: string;
}

export interface PreparedComposeCollection {
  id: string;
  name: string;
  figmaName: string;
  className: string;
  accessor: string;
  kind: 'primitive' | 'token';
  defaultModeIndex: number;
  modes: PreparedComposeMode[];
  variables: PreparedComposeVariable[];
  fileBaseName: string;
}

export interface PreparedComposePaintStyle {
  id: string;
  type: IRPaintStyle['type'];
  getterName: string;
  isStable?: boolean;
  raw: IRPaintStyle;
  resolved: ResolvedPaintStyle;
  valuesByMode?: ResolvedPaintStyle['valuesByMode'];
}

export interface PreparedComposeEffectStyle {
  id: string;
  type: IREffectStyle['type'];
  getterName: string;
  isStable?: boolean;
  raw: IREffectStyle;
  resolved: ResolvedEffectStyle;
  valuesByMode?: ResolvedEffectStyle['valuesByMode'];
}

export interface PreparedComposeTextStyle {
  id: string;
  getterName: string;
  isStable?: boolean;
  raw: IRTextStyle;
  resolved: ResolvedTextStyle;
  valuesByMode?: ResolvedTextStyle['valuesByMode'];
}

export interface PreparedCompose extends PreparedTarget {
  targetId: 'compose';
  collections: PreparedComposeCollection[];
  modes: PreparedComposeMode[];
  paintStyles: PreparedComposePaintStyle[];
  effectStyles: PreparedComposeEffectStyle[];
  textStyles: PreparedComposeTextStyle[];
  nextManifestSection: ManifestTargetSection;
  warnings: TargetWarning[];
}

interface VarCandidateInfo {
  groupSegments: string[];
  leafSegment: string;
  cleanLeaf: string;
  candidateName: string;
}

function computeVarCandidateInfo(v: ResolvedVariable): VarCandidateInfo {
  const rawSegments = v.figmaName.includes('/')
    ? v.figmaName.split('/')
    : v.groupPath.length > 0
      ? [...v.groupPath, v.leafName]
      : [v.leafName || v.figmaName];

  const segments = rawSegments.map((s) => s.trim()).filter(Boolean);
  if (segments.length === 0) {
    segments.push('unnamed');
  }

  const groupSegments = segments.slice(0, -1);
  const leafSegment = segments[segments.length - 1];

  const cleanSegments = segments.map(stripOrderingPrefix).map(processSegment);
  const candidateName = toCamelCase(cleanSegments.join(' ')) || 'unnamed';
  const cleanLeaf =
    toCamelCase(processSegment(stripOrderingPrefix(leafSegment))) || 'unnamed';

  return {
    groupSegments,
    leafSegment,
    cleanLeaf,
    candidateName,
  };
}

function prepareMode(m: { id: string; name: string }): PreparedComposeMode {
  const clean = stripOrderingPrefix(m.name);
  const processed = processSegment(clean);
  const camel = toCamelCase(processed) || 'default';
  const pascal = toPascalCase(processed) || 'Default';
  return {
    id: m.id,
    name: m.name,
    key: escapeKotlinIdentifier(camel),
    pascalName: escapeKotlinIdentifier(pascal),
  };
}

function prepareCollection(
  col: GraphCollection,
  manifestSection: ManifestTargetSection | null,
  warnings: TargetWarning[],
): PreparedComposeCollection {
  const derivedClassName = collectionClassName(col.name);
  const className = resolveStableCollectionName(
    manifestSection,
    col.id,
    derivedClassName,
  );
  const accessor = sanitizeKotlinIdentifier(className, 'camel');
  const fileBaseName = className;

  const modes = col.modes.map(prepareMode);

  const varInfoMap = new Map<string, VarCandidateInfo>();
  for (const v of col.variables) {
    if (!v.emitToPublic) continue;
    varInfoMap.set(v.id, computeVarCandidateInfo(v));
  }

  const allocatedMap = allocateStableCollectionIdentifiers(
    col.variables,
    manifestSection,
    (_leaf, v) => varInfoMap.get(v.id)?.candidateName ?? 'unnamed',
    {
      getGroupKey: () => '',
      formatStableName: (varId, name) => {
        return resolveStableVariableName(manifestSection, varId, name);
      },
    },
  );

  const variables: PreparedComposeVariable[] = [];
  for (const v of col.variables) {
    if (!v.emitToPublic) continue;
    const info = varInfoMap.get(v.id)!;
    const allocated = allocatedMap.get(v.id)!;

    if (allocated.wasDeduplicated) {
      warnings.push({
        targetId: 'compose',
        code: 'DUPLICATE_LEAF_NAME',
        message: `Variable "${v.figmaName}" collided with sibling name; deduplicated to "${allocated.stableLeafKey}".`,
        details: {
          variableId: v.id,
          original: info.candidateName,
          fixed: allocated.stableLeafKey,
        },
      });
    }

    const rawProp = allocated.stableLeafKey;
    const propertyName = escapeKotlinIdentifier(rawProp);

    if (isKotlinReserved(rawProp)) {
      warnings.push({
        targetId: 'compose',
        code: 'KEYWORD_CONFLICT',
        message: `Variable "${v.figmaName}" conflicts with Kotlin keyword "${rawProp}"; escaped to "${propertyName}".`,
        details: { variableId: v.id, original: rawProp, fixed: propertyName },
      });
    }

    variables.push({
      id: v.id,
      figmaName: v.figmaName,
      groupPath: info.groupSegments,
      leafName: info.cleanLeaf,
      stableLeafKey: allocated.stableLeafKey,
      propertyName,
      kotlinType: inferKotlinType(v),
      valuesByMode: { ...v.rawValuesByMode },
      resolvedValuesByMode: v.resolvedValuesByMode,
      emitToPublic: true,
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
    fileBaseName,
  };
}

function preparePaint(
  s: ResolvedPaintStyle,
  manifestSection?: ManifestTargetSection | null,
): PreparedComposePaintStyle {
  const clean = stripOrderingPrefix(s.figmaName);
  const processed = processSegment(clean);
  const derived = toCamelCase(processed) || 'paint';
  const stableName = resolveStableCompositeName(manifestSection, s.id, derived);
  const isStable = Boolean(manifestSection?.composites?.[s.id]);
  return {
    id: s.id,
    type: s.type,
    getterName: escapeKotlinIdentifier(stableName),
    isStable,
    raw: s.raw,
    resolved: s,
    valuesByMode: s.valuesByMode,
  };
}

function prepareEffect(
  s: ResolvedEffectStyle,
  manifestSection?: ManifestTargetSection | null,
): PreparedComposeEffectStyle {
  const clean = stripOrderingPrefix(s.figmaName);
  const processed = processSegment(clean);
  const derived = toCamelCase(processed) || 'effect';
  const stableName = resolveStableCompositeName(manifestSection, s.id, derived);
  const isStable = Boolean(manifestSection?.composites?.[s.id]);
  return {
    id: s.id,
    type: s.type,
    getterName: escapeKotlinIdentifier(stableName),
    isStable,
    raw: s.raw,
    resolved: s,
    valuesByMode: s.valuesByMode,
  };
}

function prepareText(
  s: ResolvedTextStyle,
  manifestSection?: ManifestTargetSection | null,
): PreparedComposeTextStyle {
  const clean = stripOrderingPrefix(s.figmaName);
  const processed = processSegment(clean);
  const derived = toCamelCase(processed) || 'text';
  const stableName = resolveStableCompositeName(manifestSection, s.id, derived);
  const isStable = Boolean(manifestSection?.composites?.[s.id]);
  return {
    id: s.id,
    getterName: escapeKotlinIdentifier(stableName),
    isStable,
    raw: s.raw,
    resolved: s,
    valuesByMode: s.valuesByMode,
  };
}

function buildNextManifestSection(
  cols: PreparedComposeCollection[],
  composites: {
    paintStyles: PreparedComposePaintStyle[];
    effectStyles: PreparedComposeEffectStyle[];
    textStyles: PreparedComposeTextStyle[];
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
        stableLeafKey: v.stableLeafKey,
      })),
    })),
    composites: allComposites.map((s) => ({
      id: s.id,
      figmaName: s.raw.figmaName,
      getterName: s.getterName,
    })),
  });
}

/**
 * Prepares the Jetpack Compose intermediate representation from the SemanticTokenGraph.
 * Adheres strictly to the 5 Golden Rules:
 * 1. Uses allocateStableCollectionIdentifiers for 2-pass stable reservation.
 * 2. Uses assembleTargetSection to build nextManifestSection.
 * 3. Consumes lossless RGBAValue from resolved literals and composites.
 * 4. Does not rescan for broken aliases; consumes v.resolvedValuesByMode.
 * 5. Uses strict TypeScript types with zero `as any` assertions.
 */
export function prepareCompose(
  input: SemanticTokenGraph | IR,
  section: ManifestTargetSection | null = null,
  _options: ComposeOptions = DEFAULT_COMPOSE_OPTIONS,
): PreparedCompose {
  const graph: SemanticTokenGraph = isSemanticGraph(input)
    ? input
    : buildSemanticGraph(input);

  const warnings: TargetWarning[] = [];
  const manifestSection = section;

  const collections = graph.collections.map((col) =>
    prepareCollection(col, manifestSection, warnings),
  );

  const modes = graph.allModes.map(prepareMode);

  const paintStyles = dedupGetters(
    graph.composites.paintStyles.map((s) => preparePaint(s, manifestSection)),
  );
  const effectStyles = dedupGetters(
    graph.composites.effectStyles.map((s) => prepareEffect(s, manifestSection)),
  );
  const textStyles = dedupGetters(
    graph.composites.textStyles.map((s) => prepareText(s, manifestSection)),
  );

  const nextManifestSection = buildNextManifestSection(collections, {
    paintStyles,
    effectStyles,
    textStyles,
  });

  return {
    targetId: 'compose',
    collections,
    modes,
    paintStyles,
    effectStyles,
    textStyles,
    nextManifestSection,
    warnings,
  };
}
