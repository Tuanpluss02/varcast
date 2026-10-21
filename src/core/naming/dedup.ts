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
