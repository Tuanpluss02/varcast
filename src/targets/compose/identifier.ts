import {
  processSegment,
  sanitizeWords,
  splitWords,
  stripOrderingPrefix,
  toCamelCase,
  toKebabCase,
  toPascalCase,
  toSnakeCase,
} from '../../core/sanitize_base';
import { isKotlinReserved, KOTLIN_RESERVED_WORDS } from './reserved';
import { sanitizePackageName } from './options';

export {
  processSegment,
  splitWords,
  sanitizeWords,
  stripOrderingPrefix,
  toPascalCase,
  toCamelCase,
  toSnakeCase,
  toKebabCase,
  isKotlinReserved,
  KOTLIN_RESERVED_WORDS,
  sanitizePackageName,
};

/**
 * Escapes a Kotlin identifier with backticks if it collides with a Kotlin reserved keyword.
 */
export function escapeKotlinIdentifier(raw: string): string {
  if (isKotlinReserved(raw)) {
    return `\`${raw}\``;
  }
  return raw;
}

/**
 * Sanitizes a raw identifier into an idiomatic Kotlin identifier (camelCase or PascalCase),
 * escaping reserved keywords with backticks.
 */
export function sanitizeKotlinIdentifier(
  raw: string,
  style: 'camel' | 'pascal' = 'camel',
): string {
  const clean = stripOrderingPrefix(raw);
  const processed = processSegment(clean);
  const id = style === 'pascal' ? toPascalCase(processed) : toCamelCase(processed);
  return escapeKotlinIdentifier(id);
}

/**
 * Sanitizes a Figma collection name into a valid Kotlin PascalCase class name,
 * stripping numeric ordering prefixes (e.g. "[1] Color-Basic" -> "ColorBasic").
 */
export function collectionClassName(raw: string): string {
  const stripped = stripOrderingPrefix(raw);
  const processed = processSegment(stripped);
  const id = toPascalCase(processed);
  return escapeKotlinIdentifier(id);
}

/**
 * Sanitizes a Figma collection name into a valid Kotlin file base name (snake_case),
 * stripping numeric ordering prefixes.
 */
export function collectionFileName(raw: string): string {
  const stripped = stripOrderingPrefix(raw);
  return toSnakeCase(processSegment(stripped));
}

export function kotlinWordsFromRaw(raw: string): string[] {
  return sanitizeWords(raw);
}
