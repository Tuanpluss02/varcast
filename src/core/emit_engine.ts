/**
 * Emit Engine — Target-agnostic orchestrator.
 * 
 * Responsibilities:
 * - Runs each target's `prepare` and `emit` pipeline.
 * - Namespaces output files under `<targetId>/` if multiple targets are exported.
 * - Merges emitted files and per-target manifest sections into a single v2 manifest.
 * - Preserves manifest sections for targets not included in the current run.
 * - Computes target-scoped diffs for each exported target.
 */

import type { IR } from '../ir/types';
import { isSemanticGraph, type SemanticTokenGraph } from './graph/types';
import { buildSemanticGraph } from './graph/build_graph';
import type { Manifest, ManifestDiff } from './manifest';
import { diffTargetSection } from './manifest';
import type { EmittedFile, Target, TargetWarning } from './target';
import { getTarget } from './registry/target_registry';

export interface EngineOutput {
  /** Flat list of emitted files. Paths are prefixed with "<targetId>/" when
   *  multiple targets are requested in the same run. */
  files: EmittedFile[];
  /** Updated manifest to persist back to storage / disk. */
  nextManifest: Manifest;
  /** Aggregated non-fatal diagnostics from each target's prepare step. */
  warnings: TargetWarning[];
  /** Target-scoped diffs calculated per target against the input manifest. */
  diffsByTarget: Record<string, ManifestDiff>;
}

/**
 * Run the emit pipeline for one or more targets.
 *
 * @param ir              Validated IR produced by the reader or pre-built SemanticTokenGraph.
 * @param targets         Targets or target IDs to emit. Order is deterministic.
 * @param manifest        Last-saved manifest (null on first export).
 * @param optionsByTarget Per-target options objects; targets receive their own
 *                         slice. Missing entries fall back to `undefined`.
 */
export function runEngine(
  input: IR | SemanticTokenGraph,
  targets: (Target<any, any> | string)[],
  manifest: Manifest | null,
  optionsByTarget: Record<string, unknown> = {},
): EngineOutput {
  const resolvedTargets: Target<any, any>[] = targets.map((t) =>
    typeof t === 'string' ? getTarget(t) : t,
  );
  const graph: SemanticTokenGraph = isSemanticGraph(input)
    ? input
    : buildSemanticGraph(input);

  const multiTarget = resolvedTargets.length > 1;
  const allFiles: EmittedFile[] = [];
  const allWarnings: TargetWarning[] = [];
  const nextTargets: Manifest['targets'] = { ...(manifest?.targets ?? {}) };
  const diffsByTarget: Record<string, ManifestDiff> = {};

  if (graph.warnings && graph.warnings.length > 0) {
    allWarnings.push(...graph.warnings);
  }

  for (const target of resolvedTargets) {
    const options = optionsByTarget[target.id];
    if (target.validateOptions) {
      const optionErrors = target.validateOptions(options);
      if (optionErrors && optionErrors.length > 0) {
        for (const message of optionErrors) {
          allWarnings.push({
            targetId: target.id,
            code: 'INVALID_OPTIONS',
            message,
          });
        }
      }
    }
    const normalizedOptions = target.normalizeOptions
      ? target.normalizeOptions(options)
      : options;
    const section = manifest?.targets?.[target.id] ?? null;
    const prepared = target.prepare(graph, section, normalizedOptions);
    const files = target.emit(prepared, normalizedOptions);
    const prefix = multiTarget ? `${target.id}/` : '';
    for (const f of files) {
      allFiles.push({ path: `${prefix}${f.path}`, contents: f.contents });
    }
    nextTargets[target.id] = prepared.nextManifestSection;
    if (prepared.warnings) {
      allWarnings.push(...prepared.warnings);
    }
    diffsByTarget[target.id] = diffTargetSection(
      manifest?.targets?.[target.id] ?? null,
      nextTargets[target.id],
      target.id,
    );
  }

  const nextManifest: Manifest = {
    version: '2.0',
    fileKey: graph.fileKey,
    lastExportedAt: new Date().toISOString(),
    targets: nextTargets,
  };

  return {
    files: allFiles,
    nextManifest,
    warnings: allWarnings,
    diffsByTarget,
  };
}
