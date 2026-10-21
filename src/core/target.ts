import type { SemanticTokenGraph } from './graph/types';
import type { ManifestTargetSection } from './manifest';

export interface EmittedFile {
  /** Path relative to the target output root. */
  path: string;
  contents: string;
}

export interface TargetWarning {
  /** Source target id (for namespacing in UI). */
  targetId: string;
  /** Stable warning code (e.g. "KEYWORD_CONFLICT", "DUPLICATE_LEAF_NAME"). */
  code: string;
  /** Human-readable message ready for display. */
  message: string;
  /** Optional structured payload for UI inspection. */
  details?: Record<string, unknown>;
}

export interface TargetMetadata<TOptions = unknown> {
  readonly id: string;
  readonly displayName: string;
  readonly defaultPackageName: string;
  readonly defaultOptions?: TOptions;
  sanitizePackageName?(raw: string): string;
  normalizeOptions?(raw?: unknown): TOptions;
  validateOptions?(raw?: unknown): string[] | null;
}

export interface PreparedTarget {
  readonly nextManifestSection: ManifestTargetSection;
  readonly warnings: TargetWarning[];
}

export interface Target<TOptions = unknown, TPrepared extends PreparedTarget = PreparedTarget>
  extends Partial<TargetMetadata<TOptions>> {
  readonly id: string;
  readonly displayName: string;
  readonly defaultPackageName: string;
  readonly defaultOptions?: TOptions;
  sanitizePackageName?(raw: string): string;
  normalizeOptions?(raw?: unknown): TOptions;
  validateOptions?(raw?: unknown): string[] | null;

  prepare(
    graph: SemanticTokenGraph,
    section: ManifestTargetSection | null,
    options?: TOptions,
  ): TPrepared;

  emit(prepared: TPrepared, options?: TOptions): EmittedFile[];
}
