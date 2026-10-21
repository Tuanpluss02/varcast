import type { ManifestTargetSection } from './types';

/**
 * Resolves a stable variable name against a target section.
 */
export function resolveStableVariableName(
  section: ManifestTargetSection | null | undefined,
  variableId: string,
  derivedName: string,
): string {
  return section?.variables?.[variableId] ?? derivedName;
}

/**
 * Resolves a stable collection name against a target section.
 */
export function resolveStableCollectionName(
  section: ManifestTargetSection | null | undefined,
  collectionId: string,
  derivedName: string,
): string {
  return section?.collections?.[collectionId] ?? derivedName;
}

/**
 * Resolves a stable composite name against a target section.
 */
export function resolveStableCompositeName(
  section: ManifestTargetSection | null | undefined,
  compositeId: string,
  derivedName: string,
): string {
  return section?.composites?.[compositeId] ?? derivedName;
}
