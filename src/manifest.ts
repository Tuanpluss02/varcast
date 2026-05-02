// Legacy compat layer for the Flutter target.
//
// All new code should import from `core/manifest.ts`. This module re-exports
// the v2 schema and exposes Flutter-flavoured `resolveStableName` /
// `resolveStableCollectionName` / `diffManifest` helpers that hardcode
// `targetId: 'flutter'` so existing callers keep working without churn.

import {
  diffManifestForTarget,
  resolveStableVariableName,
  resolveStableCollectionName as coreResolveStableCollectionName,
} from './core/manifest';
import type { Manifest, ManifestDiff, ManifestTargetSection } from './core/manifest';

export type {
  Manifest,
  ManifestDiff,
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
  // Normalize against the full Flutter section so renames detect collisions
  // (a legacy `bgSecondary_2` should not be renamed to `bgSecondary2` if some
  // other variable in the same manifest is already called `bgSecondary2`).
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
  return diffManifestForTarget(old, next, FLUTTER_TARGET_ID);
}

// Migration: older Flutter generators used `_2`, `_3` suffixes for dedup.
// Dart public members should be lowerCamelCase without underscores. Convert
// `foo_2` → `foo2`. Keyword fix-ups like `default_` are preserved.
//
// Collision-safe: if the renamed form matches the stable name of a *different*
// variable in the same manifest section, keep the original name and let the
// downstream dedup pass disambiguate. This prevents a silent rename that would
// merge two variables onto the same Dart identifier.
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
