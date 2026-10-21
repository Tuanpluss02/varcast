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
 * Normalizes a raw segment into space-separated alphanumeric words.
 */
export function processSegment(seg: string): string {
  let out = transliterate(seg);
  out = out.replace(/[\s\-_.]+/g, ' ');
  out = out.replace(/[^a-zA-Z0-9 ]/g, '');
  out = out.trim();
  if (out.length === 0) return 'unnamed';
  const words = out.split(/\s+/);
  const hasAlpha = words.some((w) => /[a-zA-Z]/.test(w));
  if (hasAlpha) {
    while (words.length > 0 && /^\d+$/.test(words[0])) words.shift();
    out = words.join(' ');
  }
  if (/^\d/.test(out)) out = 'n' + out;
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
  return splitWords(processSegment(seg));
}

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
