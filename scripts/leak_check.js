#!/usr/bin/env node
/**
 * CI guard: prevent target-specific leakage into target-neutral layers.
 *
 * Scans:
 * - plugin/src/core
 * - plugin/src/reader
 * - plugin/src/ir
 *
 * Fails if it finds any forbidden symbols.
 */
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const SCAN_DIRS = ['src/core', 'src/reader', 'src/ir'].map((p) => path.join(ROOT, p));

/** Keep this list intentionally broad and cheap. */
const FORBIDDEN = [
  // Flutter/Dart
  /\bDart\b/,
  /\bFlutter\b/,
  /\bpubspec\b/,
  /\bColor\s*\(/, // common Dart literal pattern; helps catch accidental snippets
  // React Native / JSX
  /\breact-native\b/i,
  /\bJSX\b/,
  /<\s*[A-Z][A-Za-z0-9]*\s*[^>]*>/, // rough JSX tag detector
  // Future targets
  /\bSwift\b/,
  /\bKotlin\b/,
  /\bCompose\b/,
];

const ALLOW_FILE_EXT = new Set(['.ts', '.tsx', '.js', '.jsx', '.md']);

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

/** @returns {string[]} */
function scanFile(file) {
  const ext = path.extname(file);
  if (!ALLOW_FILE_EXT.has(ext)) return [];
  const text = fs.readFileSync(file, 'utf8');
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
