/**
 * Compatibility wrapper for Flutter target manifest resolution.
 */

import {
  diffManifestForTarget,
  resolveStableVariableName,
  resolveStableCollectionName as coreResolveStableCollectionName,
} from './core/manifest';
import type {
  Manifest,
  ManifestDiff as CoreManifestDiff,
  ManifestItemDiff,
  ManifestRenameDiff,
  ManifestTargetSection,
} from './core/manifest';

export type ManifestDiff = CoreManifestDiff & {
  added: ManifestItemDiff[];
  removed: ManifestItemDiff[];
  renamed: ManifestRenameDiff[];
};

export type {
  Manifest,
  ManifestTargetSection,
} from './core/manifest';
export {
  MANIFEST_VERSION,
  emptyManifest,
  emptyTargetSection,
  getTargetSection,
  normalizeManifest,
  diffTargetSection,
  diffManifestForTarget,
  resolveStableVariableName,
  resolveStableCollectionName as resolveStableCollectionNameForTarget,
} from './core/manifest';

const FLUTTER_TARGET_ID = 'flutter';

export function resolveStableName(
  variableId: string,
  derivedLeafName: string,
  manifest: Manifest | null,
): string {
  const raw = resolveStableVariableName(
    FLUTTER_TARGET_ID,
    variableId,
    derivedLeafName,
    manifest,
  );
  const section = manifest?.targets?.[FLUTTER_TARGET_ID];
  return normalizeLegacyLeafName(raw, section, variableId);
}

export function resolveStableCollectionName(
  collectionId: string,
  derivedClassName: string,
  manifest: Manifest | null,
): string {
  return coreResolveStableCollectionName(
    FLUTTER_TARGET_ID,
    collectionId,
    derivedClassName,
    manifest,
  );
}

export function diffManifest(
  old: Manifest | null,
  next: Manifest,
): ManifestDiff {
  return diffManifestForTarget(old, next, FLUTTER_TARGET_ID) as ManifestDiff;
}

/**
 * Normalizes legacy indexed variable leaf names (e.g. foo_2 to foo2).
 */
function normalizeLegacyLeafName(
  name: string,
  section: ManifestTargetSection | undefined,
  variableId: string,
): string {
  const m = /^(.+)_([0-9]+)$/.exec(name);
  if (!m) return name;
  const base = m[1];
  const n = m[2];
  if (base.endsWith('_')) return name;
  const renamed = `${base}${n}`;
  if (section?.variables) {
    for (const [otherId, otherName] of Object.entries(section.variables)) {
      if (otherId === variableId) continue;
      if (otherName === renamed) return name;
    }
  }
  return renamed;
}
