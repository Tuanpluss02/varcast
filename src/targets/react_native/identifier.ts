import {
  processSegment,
  splitWords,
  toCamelCase,
  toKebabCase,
  toPascalCase,
} from '../../core/sanitize_base';
import type { IdentifierProfile } from '../../core/target';

// Minimal JS/TS reserved words set (expand later if needed).
// Includes JS keywords + a few built-ins that cause ergonomic issues.
const JS_RESERVED = new Set<string>([
  'break','case','catch','class','const','continue','debugger','default','delete',
  'do','else','export','extends','finally','for','function','if','import','in',
  'instanceof','new','return','super','switch','this','throw','try','typeof',
  'var','void','while','with','yield','enum','await','implements','interface',
  'let','package','private','protected','public','static','null','true','false',
]);

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

