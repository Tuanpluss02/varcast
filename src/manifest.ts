export interface Manifest {
  version: '1.0';
  fileKey: string;
  lastExportedAt: string;
  variables: Record<string, string>; // VariableID → dart leafName (stable)
  collections: Record<string, string>; // CollectionId → dart className (stable)
  /**
   * Optional: used to produce a useful diff for humans.
   * (Kept optional so older manifests remain readable.)
   */
  figmaNames?: {
    variables: Record<string, string>; // VariableID → last seen figmaName
    collections: Record<string, string>; // CollectionId → last seen figmaName
  };
}

export type ManifestDiff = {
  added: Array<{ id: string; dartName: string; figmaName: string }>;
  removed: Array<{ id: string; dartName: string; figmaName: string }>;
  renamed: Array<{
    id: string;
    dartName: string;
    oldFigmaName: string;
    newFigmaName: string;
  }>;
};

export function resolveStableName(
  variableId: string,
  derivedLeafName: string,
  manifest: Manifest | null,
): string {
  const raw = manifest?.variables?.[variableId];
  if (!raw) return derivedLeafName;
  return normalizeLegacyLeafName(raw);
}

export function resolveStableCollectionName(
  collectionId: string,
  derivedClassName: string,
  manifest: Manifest | null,
): string {
  return manifest?.collections?.[collectionId] ?? derivedClassName;
}

function normalizeLegacyLeafName(name: string): string {
  // Migration: older generators used `_2`, `_3` suffixes for dedup. Dart public
  // members should be lowerCamelCase without underscores. Convert `foo_2`→`foo2`.
  //
  // Do NOT touch keyword fix-ups like `default_`.
  const m = /^(.+)_([0-9]+)$/.exec(name);
  if (!m) return name;
  const base = m[1];
  const n = m[2];
  // If base already ends with '_' it's likely a keyword fix; keep as-is.
  if (base.endsWith('_')) return name;
  return `${base}${n}`;
}

export function diffManifest(old: Manifest | null, next: Manifest): ManifestDiff {
  const added: ManifestDiff['added'] = [];
  const removed: ManifestDiff['removed'] = [];
  const renamed: ManifestDiff['renamed'] = [];

  const oldVars = old?.variables ?? {};
  const nextVars = next.variables ?? {};

  const oldFigmaVars = old?.figmaNames?.variables ?? {};
  const nextFigmaVars = next.figmaNames?.variables ?? {};

  for (const [id, dartName] of Object.entries(nextVars)) {
    if (!(id in oldVars)) {
      added.push({
        id,
        dartName,
        figmaName: nextFigmaVars[id] ?? '',
      });
    } else {
      const oldName = oldFigmaVars[id];
      const newName = nextFigmaVars[id];
      if (oldName && newName && oldName !== newName) {
        renamed.push({ id, dartName, oldFigmaName: oldName, newFigmaName: newName });
      }
    }
  }

  for (const [id, dartName] of Object.entries(oldVars)) {
    if (!(id in nextVars)) {
      removed.push({
        id,
        dartName,
        figmaName: oldFigmaVars[id] ?? '',
      });
    }
  }

  added.sort((a, b) => a.dartName.localeCompare(b.dartName));
  removed.sort((a, b) => a.dartName.localeCompare(b.dartName));
  renamed.sort((a, b) => a.dartName.localeCompare(b.dartName));

  return { added, removed, renamed };
}

