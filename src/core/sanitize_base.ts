/**
 * Transliteration mapping for Vietnamese alphabet and common Latin diacritics.
 */
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

/**
 * Transliterates accented characters into standard ASCII representations.
 */
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
  return out.normalize('NFD').replace(/[̀-ͯ]/g, '');
}

/**
 * Strips numeric ordering prefix (e.g. "[1] Color-Basic", "01. Typography", "02 - Spacing")
 * from Figma collection names.
 */
export function stripOrderingPrefix(name: string): string {
  return name.replace(/^\s*\[?\s*\d+\s*\]?[.\-_:\s]*/, '').trim() || name;
}

/**
 * Normalizes a raw segment into space-separated alphanumeric words.
 * Preserves all numeric tokens without dropping digits.
 */
export function processSegment(seg: string): string {
  let out = transliterate(seg);
  out = out.replace(/[\s\-_.]+/g, ' ');
  out = out.replace(/[^a-zA-Z0-9 ]/g, '');
  out = out.trim();
  if (out.length === 0) return 'unnamed';
  const words = out.split(/\s+/);
  const hasAlpha = words.some((w) => /[a-zA-Z]/.test(w));
  if (!hasAlpha && /^\d/.test(out)) {
    out = 'n' + out;
  }
  return out;
}

/**
 * Splits a normalized string into constituent words across word and case boundaries.
 */
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

/**
 * Normalizes and splits a raw segment into sanitized constituent words.
 */
export function sanitizeWords(seg: string): string[] {
  let out = transliterate(seg);
  out = out.replace(/[\s\-_.]+/g, ' ');
  out = out.replace(/[^a-zA-Z0-9 ]/g, '');
  out = out.trim();
  if (out.length === 0) return ['unnamed'];
  return splitWords(out).map((w) => w.toLowerCase());
}

export function toPascalCase(input: string | string[]): string {
  const words = Array.isArray(input) ? input : splitWords(input);
  if (words.length === 0) return 'Unnamed';
  let first = capitalize(words[0]);
  if (/^\d/.test(first)) {
    first = 'N' + first;
  }
  return first + words.slice(1).map(capitalize).join('');
}

export function toCamelCase(input: string | string[]): string {
  const words = Array.isArray(input) ? input : splitWords(input);
  if (words.length === 0) return 'unnamed';
  let first = words[0].toLowerCase();
  if (/^\d/.test(first)) {
    first = 'n' + first;
  }
  return first + words.slice(1).map(capitalize).join('');
}

export function toSnakeCase(input: string | string[]): string {
  const words = Array.isArray(input) ? input : splitWords(input);
  if (words.length === 0) return 'unnamed';
  let first = words[0].toLowerCase();
  if (/^\d/.test(first)) {
    first = 'n_' + first;
  }
  return [first, ...words.slice(1).map((w) => w.toLowerCase())].join('_');
}

export function toKebabCase(input: string | string[]): string {
  const words = Array.isArray(input) ? input : splitWords(input);
  if (words.length === 0) return 'unnamed';
  let first = words[0].toLowerCase();
  if (/^\d/.test(first)) {
    first = 'n-' + first;
  }
  return [first, ...words.slice(1).map((w) => w.toLowerCase())].join('-');
}

function capitalize(w: string): string {
  if (!w) return '';
  return w[0].toUpperCase() + w.slice(1).toLowerCase();
}
