/**
 * Kotlin hard and soft keywords according to the Kotlin language reference.
 * Identifiers matching these keywords must be escaped using backticks (e.g. `val`)
 * or appropriately sanitized to avoid syntax errors in generated Kotlin code.
 */
export const KOTLIN_RESERVED_WORDS = new Set<string>([
  // Hard keywords
  'as',
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
  'interface',
  'is',
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

  // Soft keywords
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
  'value',
  'where',

  // Modifier keywords
  'abstract',
  'actual',
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

/**
 * Returns true if the identifier is a reserved keyword in Kotlin.
 */
export function isKotlinReserved(word: string): boolean {
  return KOTLIN_RESERVED_WORDS.has(word);
}
