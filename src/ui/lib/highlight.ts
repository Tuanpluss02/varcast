/**
 * Tiny syntax highlighter for the review screen's code viewer.
 *
 * Hand-rolled state machine — keeps the bundle small (a real highlighter like
 * Prism would add ~30kb). Supports Dart, TypeScript / JS, JSON, YAML.
 * Anything else falls through to escaped plain text.
 *
 * Output is HTML wrapped in <span class="tok-…">, designed to be set via
 * innerHTML on the <pre> code viewer.
 */

const DART_KEYWORDS = new Set([
  'abstract','as','assert','async','await','base','break','case','catch','class',
  'const','continue','covariant','default','deferred','do','dynamic','else','enum',
  'export','extends','extension','external','factory','false','final','finally',
  'for','Function','get','hide','if','implements','import','in','interface','is',
  'late','library','mixin','new','null','of','on','operator','part','required',
  'rethrow','return','sealed','set','show','static','super','switch','sync','this',
  'throw','true','try','type','typedef','var','void','when','while','with','yield',
]);

const TS_KEYWORDS = new Set([
  'abstract','any','as','async','await','boolean','break','case','catch','class',
  'const','continue','debugger','declare','default','delete','do','else','enum',
  'export','extends','false','finally','for','from','function','get','if',
  'implements','import','in','instanceof','interface','is','keyof','let','module',
  'namespace','never','new','null','number','of','package','private','protected',
  'public','readonly','return','satisfies','set','static','string','super',
  'switch','this','throw','true','try','type','typeof','undefined','unknown',
  'var','void','while','with','yield',
]);

export function highlight(code: string, path: string): string {
  if (path.endsWith('.dart')) return highlightCLike(code, DART_KEYWORDS);
  if (/\.(tsx?|jsx?|mjs|cjs)$/.test(path)) return highlightCLike(code, TS_KEYWORDS);
  if (path.endsWith('.json')) return highlightJson(code);
  if (/\.ya?ml$/.test(path)) return highlightYaml(code);
  return escapeHtml(code);
}

// ── Helpers ───────────────────────────────────────────────────────────────

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function isIdentStart(ch: string): boolean {
  return /[A-Za-z_$]/.test(ch);
}
function isIdentPart(ch: string): boolean {
  return /[\w$]/.test(ch);
}

// ── C-like (Dart, TS, JS) ─────────────────────────────────────────────────

function highlightCLike(src: string, keywords: Set<string>): string {
  let out = '';
  let i = 0;
  const n = src.length;

  while (i < n) {
    const ch = src[i];
    const ch2 = src[i + 1];

    // Line comment
    if (ch === '/' && ch2 === '/') {
      const end = src.indexOf('\n', i);
      const stop = end === -1 ? n : end;
      out += `<span class="tok-comment">${escapeHtml(src.slice(i, stop))}</span>`;
      i = stop;
      continue;
    }

    // Block comment
    if (ch === '/' && ch2 === '*') {
      const end = src.indexOf('*/', i + 2);
      const stop = end === -1 ? n : end + 2;
      out += `<span class="tok-comment">${escapeHtml(src.slice(i, stop))}</span>`;
      i = stop;
      continue;
    }

    // Strings: "...", '...', `...` — single line, with backslash escapes.
    if (ch === '"' || ch === "'" || ch === '`') {
      const q = ch;
      let j = i + 1;
      while (j < n && src[j] !== q) {
        if (src[j] === '\\') j += 2;
        else if (src[j] === '\n' && q !== '`') break;
        else j++;
      }
      const stop = Math.min(j + 1, n);
      out += `<span class="tok-string">${escapeHtml(src.slice(i, stop))}</span>`;
      i = stop;
      continue;
    }

    // Numbers (decimal, hex, with exponent)
    if (/[0-9]/.test(ch) || (ch === '.' && /[0-9]/.test(ch2 || ''))) {
      const slice = src.slice(i, Math.min(i + 32, n));
      const m = /^(0[xX][\da-fA-F]+|\d+(?:\.\d+)?(?:[eE][+-]?\d+)?)/.exec(slice);
      if (m) {
        out += `<span class="tok-number">${escapeHtml(m[0])}</span>`;
        i += m[0].length;
        continue;
      }
    }

    // Identifier / keyword / type
    if (isIdentStart(ch)) {
      let j = i + 1;
      while (j < n && isIdentPart(src[j])) j++;
      const word = src.slice(i, j);
      let cls: string | null = null;
      if (keywords.has(word)) cls = 'tok-keyword';
      else if (/^[A-Z]/.test(word)) cls = 'tok-type';
      out += cls
        ? `<span class="${cls}">${escapeHtml(word)}</span>`
        : escapeHtml(word);
      i = j;
      continue;
    }

    // Punctuation / whitespace / anything else
    out += escapeHtml(ch);
    i++;
  }
  return out;
}

// ── JSON ──────────────────────────────────────────────────────────────────

function highlightJson(src: string): string {
  let out = '';
  let i = 0;
  const n = src.length;

  while (i < n) {
    const ch = src[i];

    if (ch === '"') {
      let j = i + 1;
      while (j < n && src[j] !== '"') {
        if (src[j] === '\\') j += 2;
        else j++;
      }
      const stop = Math.min(j + 1, n);
      // Look ahead past whitespace — if next non-space is `:`, it's a key.
      let k = stop;
      while (k < n && /\s/.test(src[k])) k++;
      const cls = src[k] === ':' ? 'tok-key' : 'tok-string';
      out += `<span class="${cls}">${escapeHtml(src.slice(i, stop))}</span>`;
      i = stop;
      continue;
    }

    if (/[-\d]/.test(ch)) {
      const slice = src.slice(i, Math.min(i + 32, n));
      const m = /^-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?/.exec(slice);
      if (m && m[0].length > (ch === '-' ? 1 : 0)) {
        out += `<span class="tok-number">${escapeHtml(m[0])}</span>`;
        i += m[0].length;
        continue;
      }
    }

    const slice6 = src.slice(i, Math.min(i + 6, n));
    const litMatch = /^(true|false|null)\b/.exec(slice6);
    if (litMatch) {
      out += `<span class="tok-keyword">${litMatch[0]}</span>`;
      i += litMatch[0].length;
      continue;
    }

    out += escapeHtml(ch);
    i++;
  }
  return out;
}

// ── YAML (line-by-line, good enough for pubspec) ──────────────────────────

function highlightYaml(src: string): string {
  return src.split('\n').map(highlightYamlLine).join('\n');
}

function highlightYamlLine(line: string): string {
  const trimmed = line.trimStart();
  if (trimmed.length === 0) return escapeHtml(line);
  if (trimmed.startsWith('#')) {
    return `<span class="tok-comment">${escapeHtml(line)}</span>`;
  }
  // Strip an inline trailing comment if present (heuristic: " # …" outside of strings)
  let body = line;
  let trailing = '';
  const hashIdx = findInlineCommentStart(line);
  if (hashIdx !== -1) {
    body = line.slice(0, hashIdx);
    trailing = `<span class="tok-comment">${escapeHtml(line.slice(hashIdx))}</span>`;
  }
  // Match: leading indent, key, colon, gap, value
  const m = /^(\s*-?\s*)([^:#\s][^:]*?)(:)(\s*)(.*)$/.exec(body);
  if (m) {
    const [, prefix, key, colon, gap, val] = m;
    return (
      escapeHtml(prefix) +
      `<span class="tok-key">${escapeHtml(key)}</span>` +
      escapeHtml(colon) +
      escapeHtml(gap) +
      highlightYamlValue(val) +
      trailing
    );
  }
  return escapeHtml(body) + trailing;
}

function findInlineCommentStart(line: string): number {
  // Find a `#` that is preceded by whitespace and not inside quotes.
  let inSingle = false;
  let inDouble = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '\\') { i++; continue; }
    if (c === '"' && !inSingle) inDouble = !inDouble;
    else if (c === "'" && !inDouble) inSingle = !inSingle;
    else if (c === '#' && !inSingle && !inDouble && (i === 0 || /\s/.test(line[i - 1]))) {
      return i;
    }
  }
  return -1;
}

function highlightYamlValue(v: string): string {
  if (!v) return '';
  if (v.startsWith('"') || v.startsWith("'")) {
    return `<span class="tok-string">${escapeHtml(v)}</span>`;
  }
  if (/^(true|false|null|~|yes|no|on|off)$/i.test(v)) {
    return `<span class="tok-keyword">${escapeHtml(v)}</span>`;
  }
  if (/^-?\d+(?:\.\d+)?$/.test(v)) {
    return `<span class="tok-number">${escapeHtml(v)}</span>`;
  }
  return escapeHtml(v);
}
