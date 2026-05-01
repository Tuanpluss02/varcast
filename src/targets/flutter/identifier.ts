import { DART_KEYWORDS } from '../../conventions/dart_keywords';
import {
  processSegment,
  splitWords,
  toCamelCase,
  toPascalCase,
  toSnakeCase,
} from '../../core/sanitize_base';
import type { IdentifierProfile } from '../../core/target';

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

