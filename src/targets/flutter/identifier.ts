import { DART_KEYWORDS } from './dart_keywords';
import {
  processSegment,
  sanitizeWords,
  splitWords,
  stripOrderingPrefix,
  toCamelCase,
  toPascalCase,
  toSnakeCase,
} from '../../core/sanitize_base';

export {
  processSegment,
  splitWords,
  sanitizeWords,
  stripOrderingPrefix,
  toPascalCase,
  toCamelCase,
  toSnakeCase,
  DART_KEYWORDS,
};

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
  let clean = raw;
  if (/^\s*\[\s*\d+\s*\]/.test(clean) || /^\s*\d+\s*[.\-_:]/.test(clean)) {
    clean = stripOrderingPrefix(clean);
  }
  const processed = processSegment(clean);
  let id = style === 'pascal' ? toPascalCase(processed) : toCamelCase(processed);
  if (style === 'camel' && DART_KEYWORDS.has(id)) id = id + '_';
  return id;
}

/**
 * Sanitizes a Figma collection name into a valid Dart PascalCase class name,
 * stripping any numeric ordering prefixes (e.g. "[1] Color-Basic" -> "ColorBasic").
 */
export function collectionClassName(raw: string): string {
  const stripped = stripOrderingPrefix(raw);
  return sanitizeIdentifier(stripped, 'pascal');
}

/**
 * Sanitizes a Figma collection name into a valid Dart file base name (snake_case),
 * stripping any numeric ordering prefixes.
 */
export function collectionFileName(raw: string): string {
  const stripped = stripOrderingPrefix(raw);
  return toSnakeCase(processSegment(stripped));
}

export function flutterWordsFromRaw(raw: string): string[] {
  return sanitizeWords(stripOrderingPrefix(raw));
}
