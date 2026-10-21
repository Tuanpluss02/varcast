/**
 * Centralized naming deduplication utilities.
 */

/**
 * Deduplicates `getterName` collisions by appending `2`, `3`, etc.
 * If `bucketKey` is provided, items are partitioned by bucket before deduplicating.
 * Modifies `getterName` on items and returns the deduplicated items.
 */
export function dedupGetters<T extends { getterName: string }>(
  items: T[],
  bucketKey?: (item: T) => string,
): T[] {
  const used = new Map<string, Set<string>>();

  return items.map((it) => {
    const bucket = bucketKey ? bucketKey(it) : '';
    let set = used.get(bucket);
    if (!set) {
      set = new Set<string>();
      used.set(bucket, set);
    }

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
