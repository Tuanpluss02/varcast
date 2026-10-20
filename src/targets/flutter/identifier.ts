import { DART_KEYWORDS } from '../../conventions/dart_keywords';
import {
  processSegment,
  splitWords,
  toCamelCase,
  toPascalCase,
  toSnakeCase,
} from '../../core/sanitize_base';
import type { IdentifierProfile } from '../../core/target';

export { processSegment, splitWords, toPascalCase, toCamelCase, DART_KEYWORDS };

export interface SanitizeContext {
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

  const groupPath = segments.slice(0, -1).map(toPascalCase);
  const rawLeaf = segments[segments.length - 1];
  let leafName = toCamelCase(rawLeaf);

  const notes: SanitizeResult['notes'] = {};

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

/**
 * Sanitizes a Figma collection or mode name into a valid Dart identifier.
 */
export function sanitizeIdentifier(
  raw: string,
  style: 'pascal' | 'camel' = 'pascal',
): string {
  const processed = processSegment(raw);
  let id = style === 'pascal' ? toPascalCase(processed) : toCamelCase(processed);
  if (style === 'camel' && DART_KEYWORDS.has(id)) id = id + '_';
  return id;
}

export const flutterIdentifierProfile: IdentifierProfile = {
  reservedWords: DART_KEYWORDS,
  classCase(words: string[]): string {
    return toPascalCase(words.join(' '));
  },
  memberCase(words: string[]): string {
    const id = toCamelCase(words.join(' '));
    return DART_KEYWORDS.has(id) ? id + '_' : id;
  },
  fileNameCase(words: string[]): string {
    return toSnakeCase(words.join(' '));
  },
  fixReservedWord(name: string): string {
    return DART_KEYWORDS.has(name) ? name + '_' : name;
  },
};

export function flutterWordsFromRaw(raw: string): string[] {
  const processed = processSegment(raw);
  return splitWords(processed);
}
