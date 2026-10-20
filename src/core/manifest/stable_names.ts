import type { Manifest, ManifestTargetSection } from './types';

function extractTargetSection(
  targetIdOrSection: string | ManifestTargetSection | null | undefined,
  manifest?: Manifest | null,
): ManifestTargetSection | null {
  if (!targetIdOrSection) return null;
  if (typeof targetIdOrSection === 'string') {
    return manifest?.targets?.[targetIdOrSection] ?? null;
  }
  return targetIdOrSection;
}

/**
 * Resolves a stable variable name against a target section or manifest targetId.
 */
export function resolveStableVariableName(
  targetIdOrSection: string | ManifestTargetSection | null | undefined,
  variableId: string,
  derivedName: string,
  manifest?: Manifest | null,
): string {
  const section = extractTargetSection(targetIdOrSection, manifest);
  return section?.variables?.[variableId] ?? derivedName;
}

/**
 * Resolves a stable collection name against a target section or manifest targetId.
 */
export function resolveStableCollectionName(
  targetIdOrSection: string | ManifestTargetSection | null | undefined,
  collectionId: string,
  derivedName: string,
  manifest?: Manifest | null,
): string {
  const section = extractTargetSection(targetIdOrSection, manifest);
  return section?.collections?.[collectionId] ?? derivedName;
}

/**
 * Resolves a stable composite name against a target section or manifest targetId.
 */
export function resolveStableCompositeName(
  targetIdOrSection: string | ManifestTargetSection | null | undefined,
  compositeId: string,
  derivedName: string,
  manifest?: Manifest | null,
): string {
  const section = extractTargetSection(targetIdOrSection, manifest);
  return section?.composites?.[compositeId] ?? derivedName;
}
