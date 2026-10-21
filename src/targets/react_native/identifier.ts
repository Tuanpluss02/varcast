import {
  processSegment,
  splitWords,
  toCamelCase,
  toKebabCase,
  toPascalCase,
} from '../../core/sanitize_base';

export function wordsFromRaw(raw: string): string[] {
  const processed = processSegment(raw);
  return splitWords(processed);
}
