import type { ManifestTargetSection } from '../manifest/types';
import { resolveStableVariableName } from '../manifest/stable_names';

/**
 * Centralized naming deduplication utilities.
 */

/**
 * Deduplicates `getterName` collisions by appending `2`, `3`, etc.
 * If `bucketKey` is provided, items are partitioned by bucket before deduplicating.
 * Stable pinned items (`isStable: true`) are prioritized in Pass 1 and will never be renamed.
 * Modifies `getterName` on items and returns the deduplicated items.
 */
export function dedupGetters<T extends { getterName: string; isStable?: boolean }>(
  items: T[],
  bucketKey?: (item: T) => string,
): T[] {
  const used = new Map<string, Set<string>>();

  const getBucketSet = (it: T): Set<string> => {
    const bucket = bucketKey ? bucketKey(it) : '';
    let set = used.get(bucket);
    if (!set) {
      set = new Set<string>();
      used.set(bucket, set);
    }
    return set;
  };

  // Pass 1: Reserve all stable pinned names first to guarantee stability
  for (const it of items) {
    if (it.isStable) {
      const set = getBucketSet(it);
      set.add(it.getterName);
    }
  }

  // Pass 2: Allocate names for non-stable items, suffixing if colliding
  return items.map((it) => {
    if (it.isStable) {
      return it;
    }

    const set = getBucketSet(it);
    const base = it.getterName;
    let finalName = base;
    if (set.has(finalName)) {
      let suffix = 2;
      while (set.has(`${base}${suffix}`)) {
        suffix++;
      }
      finalName = `${base}${suffix}`;
    }

    set.add(finalName);
    it.getterName = finalName;
    return it;
  });
}

/**
 * Pre-reserves a stable sibling key under a parent namespace so that
 * later newly derived sibling keys will not collide with or displace it.
 * If the key was already taken by a prior stable item, resolves collision by suffixing.
 */
export function reserveSiblingKey(
  usedMap: Map<string, Set<string>>,
  parentKey: string,
  key: string,
): string {
  return dedupSiblingKeys(usedMap, parentKey, key);
}

/**
 * Deduplicates sibling keys under a parent namespace.
 * If `key` is unused in the parent's set, records and returns `key`.
 * Otherwise tries `${key}2`, `${key}3`, etc., records the first available candidate, and returns it.
 */
export function dedupSiblingKeys(
  usedMap: Map<string, Set<string>>,
  parentKey: string,
  key: string,
): string {
  let set = usedMap.get(parentKey);
  if (!set) {
    set = new Set<string>();
    usedMap.set(parentKey, set);
  }

  let finalKey = key;
  if (set.has(finalKey)) {
    let suffix = 2;
    while (set.has(`${key}${suffix}`)) {
      suffix++;
    }
    finalKey = `${key}${suffix}`;
  }

  set.add(finalKey);
  return finalKey;
}

export interface AllocatedIdentifier {
  stableLeafKey: string;
  isStable: boolean;
  wasDeduplicated?: boolean;
}

/**
 * 2-pass stable identifier allocator with deduplication across variables in a collection.
 * Pass 1: Pre-reserves pinned stable names from manifest under group namespaces.
 * Pass 2: Allocates remaining variables, deduplicating collisions against reserved stable names.
 */
export function allocateStableCollectionIdentifiers<
  TVar extends {
    id: string;
    figmaName: string;
    groupPath?: string[];
    leafName?: string;
    emitToPublic?: boolean;
  },
>(
  variables: TVar[],
  manifestSection: ManifestTargetSection | null,
  sanitizeLeaf: (leaf: string, v: TVar) => string,
  options?: {
    getGroupKey?: (v: TVar) => string;
    formatStableName?: (variableId: string, derivedLeaf: string) => string;
  },
): Map<string, AllocatedIdentifier> {
  const usedByGroup = new Map<string, Set<string>>();
  const stableReservedByVarId = new Map<string, AllocatedIdentifier>();
  const resultMap = new Map<string, AllocatedIdentifier>();

  const computeGroupKey = (v: TVar): string => {
    if (options?.getGroupKey) {
      return options.getGroupKey(v);
    }
    return v.groupPath ? v.groupPath.join('/') : '';
  };

  // Pass 1: Pre-reserve all stable pinned variable names under their group paths
  for (const v of variables) {
    if (v.emitToPublic === false) {
      continue;
    }
    if (manifestSection?.variables?.[v.id]) {
      const derivedLeaf = sanitizeLeaf(v.leafName ?? 'unnamed', v);
      let stableLeaf = resolveStableVariableName(
        manifestSection,
        v.id,
        derivedLeaf,
      );
      if (options?.formatStableName) {
        stableLeaf = options.formatStableName(v.id, stableLeaf);
      }
      const groupKey = computeGroupKey(v);
      const allocated = reserveSiblingKey(usedByGroup, groupKey, stableLeaf);
      stableReservedByVarId.set(v.id, {
        stableLeafKey: allocated,
        isStable: true,
      });
    }
  }

  // Pass 2: Allocate and deduplicate leaves
  for (const v of variables) {
    if (v.emitToPublic === false) {
      continue;
    }
    const reserved = stableReservedByVarId.get(v.id);
    if (reserved) {
      resultMap.set(v.id, reserved);
      continue;
    }

    const groupKey = computeGroupKey(v);
    const derivedLeaf = sanitizeLeaf(v.leafName ?? 'unnamed', v);
    let candidateLeaf = resolveStableVariableName(
      manifestSection,
      v.id,
      derivedLeaf,
    );
    if (options?.formatStableName) {
      candidateLeaf = options.formatStableName(v.id, candidateLeaf);
    }
    const finalLeaf = dedupSiblingKeys(usedByGroup, groupKey, candidateLeaf);
    resultMap.set(v.id, {
      stableLeafKey: finalLeaf,
      isStable: false,
      wasDeduplicated: finalLeaf !== candidateLeaf,
    });
  }

  return resultMap;
}

