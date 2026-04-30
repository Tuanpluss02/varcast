import { DART_KEYWORDS } from './conventions/dart_keywords';

// Sanitize a Figma name into a Dart-safe path.
//
// Figma names can contain anything (Vietnamese diacritics, brackets, dashes,
// digits, reserved words). We split on `/`, normalise each segment, then
// PascalCase all but the last (groups → class names) and camelCase the leaf
// (variable → getter name). Dedup happens within a SanitizeContext that the
// caller resets per Dart file (typically per collection).

export interface SanitizeContext {
  // Set of leaf identifiers already produced under the same parent group.
  // Caller is expected to scope this map by parent path so that
  // `Background/primary` and `Action/primary` both end up as `primary`.
  // Map key: parent path joined with '/'; value: set of leaves used so far.
  existingByParent: Map<string, Set<string>>;
}

export interface SanitizeResult {
  groupPath: string[]; // PascalCase segments
  leafName: string; // camelCase
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

  if (segments.length === 0) {
    // Empty name shouldn't happen post-validation, but be defensive.
    segments.push('unnamed');
  }

  const groupPath = segments.slice(0, -1).map(toPascalCase);
  const rawLeaf = segments[segments.length - 1];
  let leafName = toCamelCase(rawLeaf);

  // Re-apply keyword check after camelCasing (toCamelCase may unmask a keyword
  // that was hidden by the raw form, e.g. "DEFAULT" → "default").
  if (DART_KEYWORDS.has(leafName)) leafName = leafName + '_';

  const parentKey = groupPath.join('/');
  let used = ctx.existingByParent.get(parentKey);
  if (!used) {
    used = new Set();
    ctx.existingByParent.set(parentKey, used);
  }
  if (used.has(leafName)) {
    let i = 2;
    while (used.has(`${leafName}${i}`)) i++;
    leafName = `${leafName}${i}`;
  }
  used.add(leafName);

  return { groupPath, leafName };
}

// Process a single segment: transliterate, strip, prefix-digit guard, keyword.
// Output is "raw" — case is decided by toPascalCase / toCamelCase.
function processSegment(seg: string): string {
  let out = transliterate(seg);
  // Replace separators with spaces so case helpers split on word boundaries.
  out = out.replace(/[\s\-_.]+/g, ' ');
  // Strip anything that's not alphanumeric or space.
  out = out.replace(/[^a-zA-Z0-9 ]/g, '');
  out = out.trim();
  if (out.length === 0) return 'unnamed';
  // Drop leading numeric-only words for multi-word segments (designer
  // ordering prefixes like "[1] Color-Basic" → "Color Basic"); a single
  // numeric word still gets the 'n' prefix below.
  const words = out.split(/\s+/);
  if (words.length > 1) {
    while (words.length > 1 && /^\d+$/.test(words[0])) words.shift();
    out = words.join(' ');
  }
  // Numeric-only or starts with digit → prepend 'n'.
  if (/^\d/.test(out)) out = 'n' + out;
  return out;
}

// Sanitize a Figma collection / mode name into a Dart class identifier (Pascal).
export function sanitizeIdentifier(
  raw: string,
  style: 'pascal' | 'camel' = 'pascal',
): string {
  const processed = processSegment(raw);
  let id = style === 'pascal' ? toPascalCase(processed) : toCamelCase(processed);
  if (style === 'camel' && DART_KEYWORDS.has(id)) id = id + '_';
  return id;
}

export function toPascalCase(s: string): string {
  return splitWords(s)
    .map(capitalize)
    .join('');
}

export function toCamelCase(s: string): string {
  const words = splitWords(s);
  if (words.length === 0) return 'unnamed';
  return words[0].toLowerCase() + words.slice(1).map(capitalize).join('');
}

function splitWords(s: string): string[] {
  // Split on space, then further split camelCase boundaries (e.g. "lightMode").
  const out: string[] = [];
  for (const chunk of s.split(/\s+/).filter(Boolean)) {
    // Insert space before each upper after lower or before number boundaries.
    const expanded = chunk
      .replace(/([a-z])([A-Z])/g, '$1 $2')
      .replace(/([A-Za-z])([0-9])/g, '$1 $2')
      .replace(/([0-9])([A-Za-z])/g, '$1 $2');
    out.push(...expanded.split(/\s+/).filter(Boolean));
  }
  return out;
}

function capitalize(w: string): string {
  if (!w) return '';
  return w[0].toUpperCase() + w.slice(1).toLowerCase();
}

// ── Vietnamese transliteration ────────────────────────────────────────────
//
// Covers diacritics in the Vietnamese alphabet plus common Latin diacritics
// designers from other locales might use. Generated programmatically from a
// base map plus combining-mark stripping for any remaining accented Latin.

const VIET_MAP: Record<string, string> = {
  à: 'a', á: 'a', â: 'a', ã: 'a', ä: 'a', å: 'a',
  è: 'e', é: 'e', ê: 'e', ë: 'e',
  ì: 'i', í: 'i', î: 'i', ï: 'i',
  ò: 'o', ó: 'o', ô: 'o', õ: 'o', ö: 'o',
  ù: 'u', ú: 'u', û: 'u', ü: 'u',
  ý: 'y', ÿ: 'y',
  ă: 'a', ắ: 'a', ặ: 'a', ẳ: 'a', ẵ: 'a', ằ: 'a',
  ấ: 'a', ậ: 'a', ẩ: 'a', ẫ: 'a', ầ: 'a',
  ạ: 'a', ả: 'a',
  đ: 'd',
  ế: 'e', ệ: 'e', ể: 'e', ễ: 'e', ề: 'e', ẹ: 'e', ẻ: 'e', ẽ: 'e',
  ố: 'o', ộ: 'o', ổ: 'o', ỗ: 'o', ồ: 'o', ọ: 'o', ỏ: 'o',
  ơ: 'o', ớ: 'o', ợ: 'o', ở: 'o', ỡ: 'o', ờ: 'o',
  ư: 'u', ứ: 'u', ự: 'u', ử: 'u', ữ: 'u', ừ: 'u',
  ụ: 'u', ủ: 'u', ũ: 'u',
  ỳ: 'y', ỵ: 'y', ỷ: 'y', ỹ: 'y',
  ñ: 'n',
  ç: 'c',
  ß: 'ss',
};

function transliterate(s: string): string {
  let out = '';
  for (const ch of s) {
    const lower = ch.toLowerCase();
    const replacement = VIET_MAP[lower];
    if (replacement !== undefined) {
      out += ch === lower ? replacement : replacement.toUpperCase();
    } else {
      out += ch;
    }
  }
  // Strip any leftover combining marks (e.g. NFD-decomposed input).
  return out.normalize('NFD').replace(/[̀-ͯ]/g, '');
}
