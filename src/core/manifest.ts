// Target-neutral manifest schema (v2).
//
// Manifest persists "stable identifiers" across re-exports so that designer
// renames in Figma do not break consumer code. v2 keys identifiers per-target
// because Flutter and React Native (and Swift, Compose, …) each have their
// own naming conventions and reserved-word lists — a Dart-stable name is not
// necessarily a JS-stable name.
//
// Schema versions:
//   v1: { variables, collections, figmaNames? }                  (Flutter-only)
//   v2: { targets: { <id>: { variables, collections, figmaNames? } } }
//
// `loadManifest` migrates v1 → v2 transparently (assumes the v1 manifest
// belongs to the `flutter` target, which is the only target that ever wrote
// v1 manifests).

export const MANIFEST_VERSION = '2.0' as const;

// ── v2 (current) ──────────────────────────────────────────────────────────

export interface ManifestTargetSection {
  /** VariableID → stable leaf name (camelCase / per-target convention). */
  variables: Record<string, string>;
  /** VariableCollectionID → stable class/type name (PascalCase / per-target). */
  collections: Record<string, string>;
  /** Last-seen Figma names — used to produce a useful diff for humans. */
  figmaNames?: {
    variables: Record<string, string>;
    collections: Record<string, string>;
  };
}

export interface Manifest {
  version: typeof MANIFEST_VERSION;
  fileKey: string;
  lastExportedAt: string;
  targets: Record<string, ManifestTargetSection>;
}

export type ManifestDiffEntry =
  | { kind: 'added'; id: string; name: string; figmaName: string }
  | { kind: 'removed'; id: string; name: string; figmaName: string }
  | {
      kind: 'renamed';
      id: string;
      name: string;
      oldFigmaName: string;
      newFigmaName: string;
    };

export interface ManifestDiff {
  added: Array<{ id: string; name: string; figmaName: string }>;
  removed: Array<{ id: string; name: string; figmaName: string }>;
  renamed: Array<{
    id: string;
    name: string;
    oldFigmaName: string;
    newFigmaName: string;
  }>;
}

// ── v1 (legacy, for migration only) ───────────────────────────────────────

interface ManifestV1 {
  version: '1.0';
  fileKey: string;
  lastExportedAt: string;
  variables: Record<string, string>;
  collections: Record<string, string>;
  figmaNames?: {
    variables: Record<string, string>;
    collections: Record<string, string>;
  };
}

// ── helpers ────────────────────────────────────────────────────────────────

export function emptyManifest(fileKey = ''): Manifest {
  return {
    version: MANIFEST_VERSION,
    fileKey,
    lastExportedAt: new Date(0).toISOString(),
    targets: {},
  };
}

export function emptyTargetSection(): ManifestTargetSection {
  return { variables: {}, collections: {} };
}

export function getTargetSection(
  manifest: Manifest | null,
  targetId: string,
): ManifestTargetSection | null {
  return manifest?.targets?.[targetId] ?? null;
}

// Normalise a raw object into a v2 manifest. Returns null if shape is not
// recognisable (unknown version, missing required fields).
export function normalizeManifest(raw: unknown): Manifest | null {
  if (!raw || typeof raw !== 'object') return null;
  const obj = raw as { version?: string };
  if (obj.version === '2.0') return validateV2(raw);
  if (obj.version === '1.0') return migrateV1(raw as ManifestV1);
  return null;
}

function validateV2(raw: unknown): Manifest | null {
  const m = raw as Manifest;
  if (
    typeof m.fileKey !== 'string' ||
    typeof m.lastExportedAt !== 'string' ||
    !m.targets ||
    typeof m.targets !== 'object'
  ) {
    return null;
  }
  return {
    version: MANIFEST_VERSION,
    fileKey: m.fileKey,
    lastExportedAt: m.lastExportedAt,
    targets: m.targets,
  };
}

function migrateV1(v1: ManifestV1): Manifest {
  // Anything that wrote v1 was the Flutter generator (only target before the
  // multi-target refactor), so attribute the section to `flutter`.
  return {
    version: MANIFEST_VERSION,
    fileKey: v1.fileKey,
    lastExportedAt: v1.lastExportedAt,
    targets: {
      flutter: {
        variables: { ...(v1.variables ?? {}) },
        collections: { ...(v1.collections ?? {}) },
        ...(v1.figmaNames ? { figmaNames: v1.figmaNames } : {}),
      },
    },
  };
}

// ── stable-name resolution ────────────────────────────────────────────────
//
// Each target consults the manifest with its own targetId. If the variable
// was previously exported under that target, return the stored name;
// otherwise fall back to the freshly-derived name.

export function resolveStableVariableName(
  targetId: string,
  variableId: string,
  derivedName: string,
  manifest: Manifest | null,
): string {
  return manifest?.targets?.[targetId]?.variables?.[variableId] ?? derivedName;
}

export function resolveStableCollectionName(
  targetId: string,
  collectionId: string,
  derivedName: string,
  manifest: Manifest | null,
): string {
  return (
    manifest?.targets?.[targetId]?.collections?.[collectionId] ?? derivedName
  );
}

// ── diff ──────────────────────────────────────────────────────────────────
//
// Diffs two target sections (added/removed/renamed). The wider per-target
// schema means callers must specify which target's diff they want.

export function diffTargetSection(
  oldSection: ManifestTargetSection | null,
  nextSection: ManifestTargetSection,
): ManifestDiff {
  const added: ManifestDiff['added'] = [];
  const removed: ManifestDiff['removed'] = [];
  const renamed: ManifestDiff['renamed'] = [];

  const oldVars = oldSection?.variables ?? {};
  const nextVars = nextSection.variables;
  const oldFigma = oldSection?.figmaNames?.variables ?? {};
  const nextFigma = nextSection.figmaNames?.variables ?? {};

  for (const [id, name] of Object.entries(nextVars)) {
    if (!(id in oldVars)) {
      added.push({ id, name, figmaName: nextFigma[id] ?? '' });
      continue;
    }
    const oldName = oldFigma[id];
    const newName = nextFigma[id];
    if (oldName && newName && oldName !== newName) {
      renamed.push({ id, name, oldFigmaName: oldName, newFigmaName: newName });
    }
  }
  for (const [id, name] of Object.entries(oldVars)) {
    if (!(id in nextVars)) {
      removed.push({ id, name, figmaName: oldFigma[id] ?? '' });
    }
  }

  added.sort((a, b) => a.name.localeCompare(b.name));
  removed.sort((a, b) => a.name.localeCompare(b.name));
  renamed.sort((a, b) => a.name.localeCompare(b.name));

  return { added, removed, renamed };
}

// Convenience wrapper for the common case of "diff a single target".
export function diffManifestForTarget(
  oldManifest: Manifest | null,
  nextManifest: Manifest,
  targetId: string,
): ManifestDiff {
  return diffTargetSection(
    getTargetSection(oldManifest, targetId),
    getTargetSection(nextManifest, targetId) ?? emptyTargetSection(),
  );
}
