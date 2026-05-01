// Flutter-flavoured sanitizer (legacy module).
//
// Composes neutral helpers from `core/sanitize_base.ts` with Dart-specific
// reserved-word handling. New code should not import from this module —
// during Phase 8 it moves to `targets/flutter/identifier.ts`.

import { DART_KEYWORDS } from './conventions/dart_keywords';
import {
  processSegment,
  splitWords,
  toCamelCase as coreToCamelCase,
  toPascalCase as corePascalCase,
} from './core/sanitize_base';

export { processSegment, splitWords };

export interface SanitizeContext {
  // Map key: parent path joined with '/'; value: leaves used so far.
  // Dedup is scoped per parent so `Background/primary` and `Action/primary`
  // both keep the leaf name `primary`.
  existingByParent: Map<string, Set<string>>;
}

export interface SanitizeResult {
  groupPath: string[]; // PascalCase segments
  leafName: string; // camelCase
  /**
   * Diagnostic notes the caller may surface as warnings. Sanitize itself
   * never logs — the caller decides what's UI-worthy.
   */
  notes: {
    /** Set when leaf collided with a Dart keyword and got a `_` suffix. */
    keywordFixedFrom?: string;
    /** Set when leaf collided with another leaf in the same parent and a
     *  numeric suffix was appended. The number is the appended digit. */
    dedupedAs?: number;
  };
}

export function newSanitizeContext(): SanitizeContext {
  return { existingByParent: new Map() };
}

export function sanitize(
  figmaPath: string[],
  ctx: SanitizeContext,
): SanitizeResult {
  const segments = figmaPath
    .map((s) => s.trim())
    .filter((s) => s.length > 0)
    .map(processSegment);

  if (segments.length === 0) segments.push('unnamed');

  const groupPath = segments.slice(0, -1).map(corePascalCase);
  const rawLeaf = segments[segments.length - 1];
  let leafName = coreToCamelCase(rawLeaf);

  const notes: SanitizeResult['notes'] = {};

  // Re-apply keyword check after camelCasing (toCamelCase may unmask a
  // keyword that was hidden by the raw form, e.g. "DEFAULT" → "default").
  if (DART_KEYWORDS.has(leafName)) {
    notes.keywordFixedFrom = leafName;
    leafName = leafName + '_';
  }

  const parentKey = groupPath.join('/');
  let used = ctx.existingByParent.get(parentKey);
  if (!used) {
    used = new Set();
    ctx.existingByParent.set(parentKey, used);
  }
  if (used.has(leafName)) {
    let i = 2;
    while (used.has(`${leafName}${i}`)) i++;
    notes.dedupedAs = i;
    leafName = `${leafName}${i}`;
  }
  used.add(leafName);

  return { groupPath, leafName, notes };
}

// Sanitize a Figma collection / mode name into a Dart identifier.
export function sanitizeIdentifier(
  raw: string,
  style: 'pascal' | 'camel' = 'pascal',
): string {
  const processed = processSegment(raw);
  let id = style === 'pascal' ? corePascalCase(processed) : coreToCamelCase(processed);
  if (style === 'camel' && DART_KEYWORDS.has(id)) id = id + '_';
  return id;
}

// Re-export under historical names so existing imports keep working.
export const toPascalCase = corePascalCase;
export const toCamelCase = coreToCamelCase;
