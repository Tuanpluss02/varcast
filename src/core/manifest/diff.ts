import type {
  Manifest,
  ManifestDiff,
  ManifestItemDiff,
  ManifestRenameDiff,
  ManifestTargetSection,
} from './types';
import { emptyTargetSection, getTargetSection } from './types';

function diffBucket(
  oldEntries: Record<string, string> = {},
  nextEntries: Record<string, string> = {},
  oldFigma: Record<string, string> = {},
  nextFigma: Record<string, string> = {},
): {
  added: ManifestItemDiff[];
  removed: ManifestItemDiff[];
  renamed: ManifestRenameDiff[];
} {
  const added: ManifestItemDiff[] = [];
  const removed: ManifestItemDiff[] = [];
  const renamed: ManifestRenameDiff[] = [];

  for (const [id, name] of Object.entries(nextEntries)) {
    if (!(id in oldEntries)) {
      added.push({ id, name, figmaName: nextFigma[id] ?? '' });
      continue;
    }
    const oldName = oldFigma[id];
    const newName = nextFigma[id];
    if (oldName && newName && oldName !== newName) {
      renamed.push({ id, name, oldFigmaName: oldName, newFigmaName: newName });
    }
  }

  for (const [id, name] of Object.entries(oldEntries)) {
    if (!(id in nextEntries)) {
      removed.push({ id, name, figmaName: oldFigma[id] ?? '' });
    }
  }

  added.sort((a, b) => a.name.localeCompare(b.name));
  removed.sort((a, b) => a.name.localeCompare(b.name));
  renamed.sort((a, b) => a.name.localeCompare(b.name));

  return { added, removed, renamed };
}

/**
 * Computes difference between two target sections across variables, collections, and composites.
 */
export function diffTargetSection(
  oldSection: ManifestTargetSection | null,
  nextSection: ManifestTargetSection,
  targetId: string = '',
): ManifestDiff {
  const variables = diffBucket(
    oldSection?.variables ?? {},
    nextSection.variables ?? {},
    oldSection?.figmaNames?.variables ?? {},
    nextSection.figmaNames?.variables ?? {},
  );

  const collections = diffBucket(
    oldSection?.collections ?? {},
    nextSection.collections ?? {},
    oldSection?.figmaNames?.collections ?? {},
    nextSection.figmaNames?.collections ?? {},
  );

  const composites = diffBucket(
    oldSection?.composites ?? {},
    nextSection.composites ?? {},
    oldSection?.figmaNames?.composites ?? {},
    nextSection.figmaNames?.composites ?? {},
  );

  return {
    targetId,
    variables,
    collections,
    composites,
    // Backwards compatibility legacy accessors
    added: variables.added,
    removed: variables.removed,
    renamed: variables.renamed,
  };
}

/**
 * Computes difference between two manifests for a specific target.
 */
export function diffManifestForTarget(
  oldManifest: Manifest | null,
  nextManifest: Manifest,
  targetId: string,
): ManifestDiff {
  return diffTargetSection(
    getTargetSection(oldManifest, targetId),
    getTargetSection(nextManifest, targetId) ?? emptyTargetSection(),
    targetId,
  );
}
