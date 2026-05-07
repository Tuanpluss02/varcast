#!/usr/bin/env node
/**
 * CI guard: prevent target-specific leakage into target-neutral layers.
 *
 * Scans:
 * - plugin/src/core
 * - plugin/src/reader
 * - plugin/src/ir
 *
 * Strips comments before scanning so cross-target docstrings don't trip the
 * regex; tightens the JSX detector so generic angle brackets like `Map<X>`
 * or `Foo<T>` aren't false positives.
 */
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const SCAN_DIRS = ['src/core', 'src/reader', 'src/ir'].map((p) => path.join(ROOT, p));

const FORBIDDEN = [
  // Flutter/Dart code patterns (not just words — we want to catch actual code)
  /\bnew\s+(Color|TextStyle|BoxShadow|Gradient|LinearGradient|RadialGradient|SweepGradient)\(/,
  /\bColor\s*\(\s*0x[0-9A-Fa-f]+\s*\)/,
  /\bpubspec\.yaml/,
  /\bimport\s+'package:flutter/,
  // React Native / JSX
  /\breact-native\b/i,
  /\bimport\s+React\b/,
  // Real JSX tag: <TagName ... > followed by content or close tag, NOT a generic
  // Generics look like `<T>`, `<TypeName>` followed by `(`, `=`, `,`, `>`, etc.
  // A JSX tag will typically have attributes (=) or close with `</…>` somewhere.
  /<\/[A-Z][A-Za-z0-9]*>/,
  /<[A-Z][A-Za-z0-9]*\s+[a-z][A-Za-z0-9]*=/,
];

const ALLOW_FILE_EXT = new Set(['.ts', '.tsx', '.js', '.jsx']);

function walk(dir) {
  const out = [];
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, ent.name);
    if (ent.isDirectory()) out.push(...walk(full));
    else out.push(full);
  }
  return out;
}

function rel(p) {
  return path.relative(ROOT, p);
}

function stripComments(src) {
  // Remove block comments /* ... */ and line comments // ...
  // (good enough for source files; not robust against weird strings, but
  // these are TS/JS files in our own codebase.)
  return src
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|[^:])\/\/.*$/gm, '$1');
}

function scanFile(file) {
  const ext = path.extname(file);
  if (!ALLOW_FILE_EXT.has(ext)) return [];
  const text = stripComments(fs.readFileSync(file, 'utf8'));
  const hits = [];
  for (const rx of FORBIDDEN) {
    if (rx.test(text)) hits.push(String(rx));
  }
  return hits;
}

const failures = [];
for (const d of SCAN_DIRS) {
  if (!fs.existsSync(d)) continue;
  for (const f of walk(d)) {
    const hits = scanFile(f);
    if (hits.length) failures.push({ file: rel(f), hits });
  }
}

if (failures.length) {
  console.error('[leak-check] Forbidden symbols detected in target-neutral layers:');
  for (const x of failures) console.error(`- ${x.file}: ${x.hits.join(', ')}`);
  process.exit(1);
}

console.log('[leak-check] OK');
