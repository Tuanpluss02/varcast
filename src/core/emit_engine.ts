/**
 * Emit Engine — Target-agnostic orchestrator.
 * 
 * Responsibilities:
 * - Runs each target's `prepare` and `emit` pipeline.
 * - Namespaces output files under `<targetId>/` if multiple targets are exported.
 * - Merges emitted files and per-target manifest sections into a single v2 manifest.
 * - Preserves manifest sections for targets not included in the current run.
 */

import type { IR } from '../ir/types';
import type { Manifest } from './manifest';
import type { EmittedFile, Target, TargetWarning } from './target';

// ── Engine output ──────────────────────────────────────────────────────────

export interface EngineOutput {
  /** Flat list of emitted files. Paths are prefixed with "<targetId>/" when
   *  multiple targets are requested in the same run. */
  files: EmittedFile[];
  /** Updated manifest to persist back to storage / disk. */
  nextManifest: Manifest;
  /** Aggregated non-fatal diagnostics from each target's prepare step. */
  warnings: TargetWarning[];
}

// ── Engine ─────────────────────────────────────────────────────────────────

/**
 * Run the emit pipeline for one or more targets.
 *
 * @param ir             Validated IR produced by the reader.
 * @param targets        Targets to emit. Order is deterministic.
 * @param manifest       Last-saved manifest (null on first export).
 * @param optionsByTarget Per-target options objects; targets receive their own
 *                        slice. Missing entries fall back to `undefined`.
 */
export function runEngine(
  ir: IR,
  targets: Target[],
  manifest: Manifest | null,
  optionsByTarget: Record<string, unknown> = {},
): EngineOutput {
  const multiTarget = targets.length > 1;
  const allFiles: EmittedFile[] = [];
  const allWarnings: TargetWarning[] = [];
  const nextTargets: Manifest['targets'] = { ...(manifest?.targets ?? {}) };

  for (const target of targets) {
    const options = optionsByTarget[target.id];
    const prepared = target.prepare(ir, manifest, options);
    const files = target.emit(prepared, options);
    const prefix = multiTarget ? `${target.id}/` : '';
    for (const f of files) {
      allFiles.push({ path: `${prefix}${f.path}`, contents: f.contents });
    }
    nextTargets[target.id] = prepared.nextManifestSection;
    if (prepared.warnings) allWarnings.push(...prepared.warnings);
  }

  const nextManifest: Manifest = {
    version: '2.0',
    fileKey: ir.fileKey,
    lastExportedAt: new Date().toISOString(),
    targets: nextTargets,
  };

  return { files: allFiles, nextManifest, warnings: allWarnings };
}
