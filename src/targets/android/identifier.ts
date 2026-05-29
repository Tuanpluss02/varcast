import {
  processSegment,
  splitWords,
  toCamelCase,
  toPascalCase,
  toSnakeCase,
} from '../../core/sanitize_base';
import type { IdentifierProfile } from '../../core/target';

export const KOTLIN_RESERVED = new Set<string>([
  'as',
  'as?',
  'break',
  'class',
  'continue',
  'do',
  'else',
  'false',
  'for',
  'fun',
  'if',
  'in',
  '!in',
  'interface',
  'is',
  '!is',
  'null',
  'object',
  'package',
  'return',
  'super',
  'this',
  'throw',
  'true',
  'try',
  'typealias',
  'typeof',
  'val',
  'var',
  'when',
  'while',
  'by',
  'catch',
  'constructor',
  'delegate',
  'dynamic',
  'field',
  'file',
  'finally',
  'get',
  'import',
  'init',
  'param',
  'property',
  'receiver',
  'set',
  'setparam',
  'where',
  'actual',
  'abstract',
  'annotation',
  'companion',
  'const',
  'crossinline',
  'data',
  'enum',
  'expect',
  'external',
  'final',
  'infix',
  'inline',
  'inner',
  'internal',
  'lateinit',
  'noinline',
  'open',
  'operator',
  'out',
  'override',
  'private',
  'protected',
  'public',
  'reified',
  'sealed',
  'suspend',
  'tailrec',
  'vararg',
]);

export const androidIdentifierProfile: IdentifierProfile = {
  reservedWords: KOTLIN_RESERVED,
  classCase(words: string[]): string {
    const id = toPascalCase(words.join(' '));
    return KOTLIN_RESERVED.has(id.toLowerCase()) ? `${id}_` : id;
  },
  memberCase(words: string[]): string {
    const id = toCamelCase(words.join(' '));
    return KOTLIN_RESERVED.has(id) ? `${id}_` : id;
  },
  fileNameCase(words: string[]): string {
    return toSnakeCase(words.join(' '));
  },
  fixReservedWord(name: string): string {
    return KOTLIN_RESERVED.has(name) || KOTLIN_RESERVED.has(name.toLowerCase())
      ? `${name}_`
      : name;
  },
};

export function wordsFromRaw(raw: string): string[] {
  return splitWords(processSegment(raw));
}

export function androidClassName(raw: string): string {
  return androidIdentifierProfile.classCase(wordsFromRaw(raw));
}

export function androidMemberName(raw: string): string {
  return androidIdentifierProfile.memberCase(wordsFromRaw(raw));
}

export function androidFileName(className: string): string {
  return `${className}.kt`;
}
