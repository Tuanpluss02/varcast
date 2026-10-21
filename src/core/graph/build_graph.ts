import type { IR, IRCollection, IRValue, IRVariable } from '../../ir/types';
import type { TargetWarning } from '../target';
import { toCamelCase } from '../sanitize_base';
import { resolveVariableLiteral } from './alias_resolver';
import { resolveComposites } from './composite_resolver';
import { buildGroupTree } from './group_tree';
import type {
  GraphCollection,
  ResolvedLiteral,
  ResolvedVariable,
  SemanticTokenGraph,
} from './types';

/**
 * Builds a SemanticTokenGraph from intermediate representation (IR).
 * - Indexes all variables across collections for fast lookup.
 * - Extracts global allModes with camelCase keys.
 * - Resolves all variable aliases to concrete literals per mode.
 * - Marks variables with unresolvable or circular aliases with emitToPublic = false.
 * - Constructs hierarchical TokenTreeNodes for each collection.
 */
export function buildSemanticGraph(ir: IR): SemanticTokenGraph {
  const variableIndex = new Map<string, ResolvedVariable>();
  const warnings: TargetWarning[] = [];
  const seenWarningKeys = new Set<string>();
  const onWarning = (code: string, message: string) => {
    const key = `${code}:${message}`;
    if (!seenWarningKeys.has(key)) {
      seenWarningKeys.add(key);
      warnings.push({
        targetId: 'core',
        code,
        message,
      });
    }
  };

  // Extract allModes across collections
  const allModes: Array<{ id: string; name: string; key: string }> = [];
  const seenModeIds = new Set<string>();

  for (const col of ir.collections) {
    for (const mode of col.modes) {
      if (!seenModeIds.has(mode.id)) {
        seenModeIds.add(mode.id);
        allModes.push({
          id: mode.id,
          name: mode.name,
          key: toCamelCase(mode.name),
        });
      }
    }
  }

  // Index all raw variables for cross-collection alias resolution
  const irVarIndex = new Map<string, IRVariable>();
  for (const col of ir.collections) {
    for (const v of col.variables) {
      irVarIndex.set(v.id, v);
    }
  }

  // Build GraphCollections
  const collections: GraphCollection[] = ir.collections.map((col: IRCollection) => {
    const resolvedVariables: ResolvedVariable[] = [];

    for (const v of col.variables) {
      let groupPath: string[];
      let leafName: string;

      if (v.groupPath && v.groupPath.length > 1) {
        groupPath = v.groupPath.slice(0, -1);
        leafName = v.groupPath[v.groupPath.length - 1];
      } else if (v.groupPath && v.groupPath.length === 1) {
        groupPath = [];
        leafName = v.groupPath[0];
      } else {
        groupPath = [];
        leafName = v.figmaName || 'unnamed';
      }

      const rawValuesByMode: Record<string, IRValue> = { ...v.valuesByMode };
      const resolvedValuesByMode: Record<string, ResolvedLiteral> = {};
      let emitToPublic = v.emitToPublic ?? !v.hiddenFromPublishing;

      const modeIds = new Set([
        ...col.modes.map((m) => m.id),
        ...Object.keys(v.valuesByMode),
      ]);

      for (const modeId of modeIds) {
        const rawVal = v.valuesByMode[modeId];
        if (rawVal) {
          const resolved = resolveVariableLiteral(rawVal, modeId, irVarIndex, onWarning);
          if (resolved !== undefined) {
            resolvedValuesByMode[modeId] = resolved;
          } else {
            if (rawVal.kind === 'alias') {
              emitToPublic = false;
            }
          }
        }
      }

      const resolvedVar: ResolvedVariable = {
        id: v.id,
        figmaName: v.figmaName,
        type: v.type,
        groupPath,
        leafName,
        scopes: [...(v.scopes ?? [])],
        emitToPublic,
        resolvedValuesByMode,
        rawValuesByMode,
      };

      resolvedVariables.push(resolvedVar);
      variableIndex.set(v.id, resolvedVar);
    }

    const rootNode = buildGroupTree(resolvedVariables);

    return {
      id: col.id,
      name: col.name,
      kind: col.kind,
      modes: col.modes.map((m) => ({
        id: m.id,
        name: m.name,
        key: toCamelCase(m.name),
      })),
      variables: resolvedVariables,
      rootNode,
    };
  });

  const resolvedComposites = resolveComposites(ir.composites, allModes, variableIndex);

  return {
    fileKey: ir.fileKey,
    generatedAt: ir.generatedAt,
    collections,
    composites: resolvedComposites,
    resolvedComposites,
    variableIndex,
    allModes,
    warnings,
  };
}
