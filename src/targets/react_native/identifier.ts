import {
  processSegment,
  splitWords,
  toCamelCase,
  toKebabCase,
  toPascalCase,
} from '../../core/sanitize_base';
import type { IdentifierProfile } from '../../core/target';

import { JS_RESERVED_WORDS } from './reserved';

const JS_RESERVED = JS_RESERVED_WORDS;

export const reactNativeIdentifierProfile: IdentifierProfile = {
  reservedWords: JS_RESERVED,
  classCase(words: string[]): string {
    return toPascalCase(words.join(' '));
  },
  memberCase(words: string[]): string {
    const id = toCamelCase(words.join(' '));
    return JS_RESERVED.has(id) ? id + '_' : id;
  },
  fileNameCase(words: string[]): string {
    return toKebabCase(words.join(' '));
  },
  fixReservedWord(name: string): string {
    return JS_RESERVED.has(name) ? name + '_' : name;
  },
};

export function wordsFromRaw(raw: string): string[] {
  const processed = processSegment(raw);
  return splitWords(processed);
}

