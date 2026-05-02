import type { IR, RGBA } from '../ir/types';
import type { Manifest, ManifestTargetSection } from './manifest';

export interface EmittedFile {
  /** Path relative to the target output root. */
  path: string;
  contents: string;
}

export interface IdentifierProfile {
  reservedWords: ReadonlySet<string>;
  classCase(words: string[]): string;
  memberCase(words: string[]): string;
  fileNameCase(words: string[]): string;
  fixReservedWord(name: string): string;
}

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

export interface PreparedIR {
  /** Per-target manifest section for this run. */
  nextManifestSection: ManifestTargetSection;
  /** Optional non-fatal diagnostics (keyword fixes, dedup, etc.). */
  warnings?: TargetWarning[];
}

export interface Target {
  readonly id: string;
  readonly profile: IdentifierProfile;
  readonly typeMapping: TypeMapping;

  prepare(ir: IR, manifest: Manifest | null, options: unknown): PreparedIR;
  emit(prepared: PreparedIR, options: unknown): EmittedFile[];
}

