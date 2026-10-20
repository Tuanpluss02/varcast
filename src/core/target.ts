import type { IR, RGBA } from '../ir/types';
import type { SemanticTokenGraph } from './graph/types';
import type { Manifest, ManifestTargetSection } from './manifest';

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
}

export interface PreparedTarget {
  readonly targetId?: string;
  readonly nextManifestSection: ManifestTargetSection;
  readonly warnings?: TargetWarning[];
}

/**
 * Backward compatibility alias for PreparedTarget during architecture transition.
 */
export type PreparedIR = PreparedTarget;

export interface Target<TOptions = unknown, TPrepared extends PreparedTarget = PreparedTarget>
  extends Partial<TargetMetadata<TOptions>> {
  readonly id: string;
  readonly displayName?: string;
  readonly defaultPackageName?: string;
  /** @deprecated Retained for backward compatibility during architecture redesign. */
  readonly profile?: IdentifierProfile;
  /** @deprecated Retained for backward compatibility during architecture redesign. */
  readonly typeMapping?: TypeMapping;

  prepare(
    graph: SemanticTokenGraph | IR,
    manifest: Manifest | ManifestTargetSection | null,
    options?: TOptions,
  ): TPrepared;

  emit(prepared: TPrepared, options?: TOptions): EmittedFile[];
}

/**
 * @deprecated Use target-internal identifier conventions instead. Retained for backward compatibility.
 */
export interface IdentifierProfile {
  reservedWords: ReadonlySet<string>;
  classCase(words: string[]): string;
  memberCase(words: string[]): string;
  fileNameCase(words: string[]): string;
  fixReservedWord(name: string): string;
}

/**
 * @deprecated Use target-internal literal emitters instead. Retained for backward compatibility.
 */
export interface TypeMapping {
  color: string;
  number: string;
  string: string;
  bool: string;
  literalColor(rgba: RGBA): string;
  literalNumber(n: number): string;
  literalString(s: string): string;
  literalBool(b: boolean): string;
}
