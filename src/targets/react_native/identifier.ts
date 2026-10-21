import {
  processSegment,
  sanitizeWords,
  splitWords,
  toCamelCase,
  toKebabCase,
  toPascalCase,
} from '../../core/sanitize_base';

export function wordsFromRaw(raw: string): string[] {
  return sanitizeWords(raw);
}
