// Emit engine — target-agnostic orchestrator.
//
// Phase 8: the engine accepts an array of targets, runs each target's
// prepare+emit pipeline, and merges emitted files + per-target manifest
// sections into a single v2 manifest.
//
// Invariants guaranteed by the engine (not by individual targets):
//   - Files from different targets are namespaced under `<targetId>/` to
//     prevent path collisions when multiple targets are emitted simultaneously.
//   - The output manifest preserves sections for targets NOT included in this
//     run so stable names from previous exports are not wiped.

import type { IR } from '../ir/types';
import type { Manifest } from './manifest';
import type { EmittedFile, Target } from './target';

// ── Engine output ──────────────────────────────────────────────────────────

export interface EngineOutput {
  /** Flat list of emitted files. Paths are prefixed with "<targetId>/" when
   *  multiple targets are requested in the same run. */
  files: EmittedFile[];
  /** Updated manifest to persist back to storage / disk. */
  nextManifest: Manifest;
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
  }

  const nextManifest: Manifest = {
    version: '2.0',
    fileKey: ir.fileKey,
    lastExportedAt: new Date().toISOString(),
    targets: nextTargets,
  };

  return { files: allFiles, nextManifest };
}
