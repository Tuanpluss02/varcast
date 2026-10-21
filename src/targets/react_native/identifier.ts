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
import { isJsReservedWord } from './reserved';

export {
  processSegment,
  splitWords,
  sanitizeWords,
  stripOrderingPrefix,
  toPascalCase,
  toCamelCase,
  toSnakeCase,
  toKebabCase,
};

/**
 * Sanitizes a raw name into a valid JavaScript / TypeScript identifier (camelCase by default).
 */
export function sanitizeJsIdentifier(
  raw: string,
  style: 'camel' | 'pascal' = 'camel',
): string {
  let clean = raw;
  if (/^\s*\[\s*\d+\s*\]/.test(clean) || /^\s*\d+\s*[.\-_:]/.test(clean)) {
    clean = stripOrderingPrefix(clean);
  }
  const processed = processSegment(clean);
  let id = style === 'pascal' ? toPascalCase(processed) : toCamelCase(processed);
  return id;
}

/**
 * Sanitizes a Figma collection name into a valid React Native export name (camelCase),
 * stripping ordering prefixes and avoiding JS reserved words.
 */
export function collectionExportName(raw: string): string {
  const clean = stripOrderingPrefix(raw);
  let name = toCamelCase(processSegment(clean));
  if (isJsReservedWord(name)) {
    name = `${name}Tokens`;
  }
  return name;
}

export function wordsFromRaw(raw: string): string[] {
  return sanitizeWords(stripOrderingPrefix(raw));
}

