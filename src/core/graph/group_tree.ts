import { dedupSiblingKeys } from '../naming/dedup';
import type { ResolvedVariable, TokenTreeNode } from './types';

/**
 * Computes a flattened camelCase accessor name from groupPath segments and a leafName.
 * If groupPath is empty, returns leafName.
 * Otherwise returns: first group segment lowercase + remaining group segments capitalized + leafName capitalized.
 *
 * Example: `flatGetterName(['color', 'bg'], 'brand')` -> `'colorBgBrand'`
 */
export function flatGetterName(groupPath: string[], leafName: string): string {
  if (groupPath.length === 0) {
    return leafName;
  }
  const [first, ...rest] = groupPath;
  const firstFormatted = first.charAt(0).toLowerCase() + first.slice(1);
  const restFormatted = rest
    .map((seg) => (seg ? seg.charAt(0).toUpperCase() + seg.slice(1) : ''))
    .join('');
  const leafFormatted = leafName
    ? leafName.charAt(0).toUpperCase() + leafName.slice(1)
    : '';
  return firstFormatted + restFormatted + leafFormatted;
}

/**
 * Deduplicates a leaf name among siblings by appending an incrementing numeric suffix (starting at 2).
 * Delegates to the centralized dedupSiblingKeys logic.
 */
export function deduplicateSiblingName(
  baseName: string,
  existingNames: Set<string> | Map<string, unknown>,
): string {
  const set = existingNames instanceof Set
    ? new Set(existingNames)
    : new Set(existingNames.keys());
  const usedMap = new Map<string, Set<string>>([['', set]]);
  return dedupSiblingKeys(usedMap, '', baseName);
}

/**
 * Builds a TokenTreeNode hierarchy from a flat list of ResolvedVariables.
 */
export function buildGroupTree(
  variables: ResolvedVariable[],
  rootName = 'root',
): TokenTreeNode {
  const root: TokenTreeNode = {
    name: rootName,
    children: new Map(),
    variables: new Map(),
  };

  for (const v of variables) {
    let current = root;
    for (const segment of v.groupPath) {
      let child = current.children.get(segment);
      if (!child) {
        child = {
          name: segment,
          children: new Map(),
          variables: new Map(),
        };
        current.children.set(segment, child);
      }
      current = child;
    }

    const key = deduplicateSiblingName(v.leafName, current.variables);
    current.variables.set(key, v);
  }

  return root;
}
