// Target-neutral identifier helpers.
//
// Everything here is shared by every target (Flutter, React Native, Swift,
// Compose, …). Target-specific concerns live in the target's own
// `identifier.ts` (reserved-word set, casing convention, reserved-word fix).
//
// Pipeline:
//   raw Figma segment ──▶ transliterate ──▶ word-split ──▶ case helper

// ── Vietnamese transliteration ─────────────────────────────────────────────
//
// Covers the Vietnamese alphabet plus common Latin diacritics so designers
// from any locale produce safe identifiers. We keep this in core because it
// has nothing to do with the output language.

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

export function transliterate(s: string): string {
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
  // Strip any leftover combining marks (NFD-decomposed input).
  return out.normalize('NFD').replace(/[̀-ͯ]/g, '');
}

// ── Segment normalisation ──────────────────────────────────────────────────
//
// Turns a raw Figma segment ("[1] Color-Basic", "Mặc định", "900") into a
// space-separated word string suitable for case helpers. Numeric-only or
// digit-leading segments get an `n` prefix so they yield valid identifiers
// in every language we target.

export function processSegment(seg: string): string {
  let out = transliterate(seg);
  // Replace separators with spaces so case helpers split on word boundaries.
  out = out.replace(/[\s\-_.]+/g, ' ');
  // Strip anything that's not alphanumeric or space.
  out = out.replace(/[^a-zA-Z0-9 ]/g, '');
  out = out.trim();
  if (out.length === 0) return 'unnamed';
  // Drop leading numeric-only words for multi-word segments (designer ordering
  // prefixes like "[1] Color-Basic" → "Color Basic"); a single numeric word
  // still gets the 'n' prefix below.
  const words = out.split(/\s+/);
  if (words.length > 1) {
    while (words.length > 1 && /^\d+$/.test(words[0])) words.shift();
    out = words.join(' ');
  }
  // Numeric-only or starts with digit → prepend 'n'.
  if (/^\d/.test(out)) out = 'n' + out;
  return out;
}

// ── Word splitting ─────────────────────────────────────────────────────────
//
// Splits a normalised string into words. Handles space-separated, camelCase
// boundaries, and digit boundaries so "lightMode2x" → ["light","Mode","2","x"].

export function splitWords(s: string): string[] {
  const out: string[] = [];
  for (const chunk of s.split(/\s+/).filter(Boolean)) {
    const expanded = chunk
      .replace(/([a-z])([A-Z])/g, '$1 $2')
      .replace(/([A-Za-z])([0-9])/g, '$1 $2')
      .replace(/([0-9])([A-Za-z])/g, '$1 $2');
    out.push(...expanded.split(/\s+/).filter(Boolean));
  }
  return out;
}

// ── Case helpers ───────────────────────────────────────────────────────────

export function toPascalCase(s: string): string {
  return splitWords(s).map(capitalize).join('');
}

export function toCamelCase(s: string): string {
  const words = splitWords(s);
  if (words.length === 0) return 'unnamed';
  return words[0].toLowerCase() + words.slice(1).map(capitalize).join('');
}

export function toSnakeCase(s: string): string {
  return splitWords(s).map((w) => w.toLowerCase()).join('_');
}

export function toKebabCase(s: string): string {
  return splitWords(s).map((w) => w.toLowerCase()).join('-');
}

function capitalize(w: string): string {
  if (!w) return '';
  return w[0].toUpperCase() + w.slice(1).toLowerCase();
}
