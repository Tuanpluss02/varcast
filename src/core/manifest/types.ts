/**
 * Manifest version for stable identifier persistence across re-exports.
 */
export const MANIFEST_VERSION = '2.0' as const;

export interface ManifestItemDiff {
  id: string;
  name: string;
  figmaName: string;
}

export interface ManifestRenameDiff {
  id: string;
  name: string;
  oldFigmaName: string;
  newFigmaName: string;
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

export interface ManifestTargetSection {
  variables: Record<string, string>;
  collections: Record<string, string>;
  composites?: Record<string, string>;
  figmaNames?: {
    variables?: Record<string, string>;
    collections?: Record<string, string>;
    composites?: Record<string, string>;
  };
}

export interface Manifest {
  version: typeof MANIFEST_VERSION;
  fileKey: string;
  lastExportedAt: string;
  targets: Record<string, ManifestTargetSection>;
}

export interface ManifestDiff {
  targetId: string;
  variables: {
    added: ManifestItemDiff[];
    removed: ManifestItemDiff[];
    renamed: ManifestRenameDiff[];
  };
  collections: {
    added: ManifestItemDiff[];
    removed: ManifestItemDiff[];
    renamed: ManifestRenameDiff[];
  };
  composites: {
    added: ManifestItemDiff[];
    removed: ManifestItemDiff[];
    renamed: ManifestRenameDiff[];
  };
  // Optional legacy accessors for backward compatibility
  added?: ManifestItemDiff[];
  removed?: ManifestItemDiff[];
  renamed?: ManifestRenameDiff[];
}

export function emptyManifest(fileKey = ''): Manifest {
  return {
    version: MANIFEST_VERSION,
    fileKey,
    lastExportedAt: new Date(0).toISOString(),
    targets: {},
  };
}

export function emptyTargetSection(): ManifestTargetSection {
  return {
    variables: {},
    collections: {},
    composites: {},
  };
}

export function getTargetSection(
  manifest: Manifest | null,
  targetId: string,
): ManifestTargetSection | null {
  return manifest?.targets?.[targetId] ?? null;
}

function isRecord(val: unknown): val is Record<string, unknown> {
  return typeof val === 'object' && val !== null && !Array.isArray(val);
}

/**
 * Normalizes a raw object into a v2 manifest, or returns null if unrecognized.
 * Strictly requires version === '2.0'. No v1 migration logic.
 */
export function normalizeManifest(raw: unknown): Manifest | null {
  if (!isRecord(raw)) return null;
  const obj = raw;
  if (obj.version !== MANIFEST_VERSION) return null;
  if (typeof obj.fileKey !== 'string') return null;
  if (typeof obj.lastExportedAt !== 'string') return null;
  if (!isRecord(obj.targets)) return null;

  for (const section of Object.values(obj.targets)) {
    if (!isRecord(section)) return null;
    if (!isRecord(section.variables)) return null;
    if (!isRecord(section.collections)) return null;
    if (section.composites !== undefined && !isRecord(section.composites)) return null;
    if (section.figmaNames !== undefined) {
      if (!isRecord(section.figmaNames)) return null;
      if (
        section.figmaNames.variables !== undefined &&
        !isRecord(section.figmaNames.variables)
      ) {
        return null;
      }
      if (
        section.figmaNames.collections !== undefined &&
        !isRecord(section.figmaNames.collections)
      ) {
        return null;
      }
      if (
        section.figmaNames.composites !== undefined &&
        !isRecord(section.figmaNames.composites)
      ) {
        return null;
      }
    }
  }

  return {
    version: MANIFEST_VERSION,
    fileKey: obj.fileKey,
    lastExportedAt: obj.lastExportedAt,
    targets: obj.targets as Record<string, ManifestTargetSection>,
  };
}
