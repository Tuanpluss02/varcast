// Emits `tailwind.preset.cjs` — a Tailwind preset that points every token
// at its CSS variable counterpart. NativeWind picks up the preset via
// `presets: [require('@<org>/<package>')]` in the consumer's
// `tailwind.config.js`.

import type { TailwindBucket } from '../shared/scope_classify';
import type { CompositeShadowPlan, CompositeTextPlan, NativeWindPlan, TokenPlan } from './planner';

interface BucketTree {
  [k: string]: BucketTree | string;
}

export function emitTailwindPresetCjs(plan: NativeWindPlan): string {
  const buckets: Partial<Record<TailwindBucket, BucketTree>> = {};

  for (const t of plan.tokens) {
    if (!t.bucket) continue;
    const target = (buckets[t.bucket] ??= {});
    placeNested(target, t.presetPathKebab, `var(${t.cssVarName})`);
  }

  // Shadows go into `boxShadow` as literal default-mode values (NativeWind
  // can't read CSS vars for `box-shadow` on native).
  if (plan.shadows.length > 0) {
    const tree = (buckets.colors === undefined ? {} : (buckets as any)) as any; // no-op
    void tree;
  }
  const boxShadow: Record<string, string> = {};
  for (const s of plan.shadows) {
    if (s.type === 'DROP_SHADOW' || s.type === 'INNER_SHADOW') {
      boxShadow[s.getterName] = formatBoxShadow(s);
    }
  }

  const lines: string[] = [];
  lines.push('// GENERATED FILE — do not edit by hand.');
  lines.push('// Tailwind preset for NativeWind. See README.md for usage.');
  lines.push('');
  // NOTE: we deliberately do NOT emit a `@type {import(...)}` JSDoc tag here.
  // Figma's plugin sandbox rejects any source code containing the substring
  // `import(` (dynamic-import expression detection), and esbuild constant-
  // folds split string literals back into one. Consumers still get type
  // inference via `tailwindcss`'s own `presets` typing.
  lines.push('module.exports = {');
  lines.push('  content: [],');
  lines.push('  theme: {');
  lines.push('    extend: {');
  for (const [bucket, tree] of Object.entries(buckets)) {
    if (!tree) continue;
    lines.push(`      ${JSON.stringify(bucket)}: ${renderTree(tree, '      ')},`);
  }
  if (Object.keys(boxShadow).length > 0) {
    lines.push(`      boxShadow: ${renderFlat(boxShadow, '      ')},`);
  }
  lines.push('    },');
  lines.push('  },');

  // .type-* utility plugin
  if (plan.textStyles.length > 0) {
    lines.push('  plugins: [');
    lines.push('    function ({ addUtilities }) {');
    lines.push('      addUtilities({');
    for (const t of plan.textStyles) {
      lines.push(`        '.type-${t.getterName}': ${renderTextDecl(t)},`);
    }
    lines.push('      });');
    lines.push('    },');
    lines.push('  ],');
  } else {
    lines.push('  plugins: [],');
  }
  lines.push('};');
  lines.push('');
  return lines.join('\n');
}

function placeNested(tree: BucketTree, path: string[], leafValue: string) {
  if (path.length === 0) return;
  let cur: BucketTree = tree;
  for (let i = 0; i < path.length - 1; i++) {
    const seg = path[i];
    const next = cur[seg];
    if (next === undefined || typeof next === 'string') {
      const fresh: BucketTree = {};
      cur[seg] = fresh;
      cur = fresh;
    } else {
      cur = next;
    }
  }
  cur[path[path.length - 1]] = leafValue;
}

function renderTree(tree: BucketTree, indent: string): string {
  const lines: string[] = ['{'];
  for (const [k, v] of Object.entries(tree)) {
    if (typeof v === 'string') {
      lines.push(`${indent}  ${JSON.stringify(k)}: ${JSON.stringify(v)},`);
    } else {
      lines.push(`${indent}  ${JSON.stringify(k)}: ${renderTree(v, indent + '  ')},`);
    }
  }
  lines.push(`${indent}}`);
  return lines.join('\n');
}

function renderFlat(obj: Record<string, string>, indent: string): string {
  const lines: string[] = ['{'];
  for (const [k, v] of Object.entries(obj)) {
    lines.push(`${indent}  ${JSON.stringify(k)}: ${JSON.stringify(v)},`);
  }
  lines.push(`${indent}}`);
  return lines.join('\n');
}

function formatBoxShadow(s: CompositeShadowPlan): string {
  const off = s.shadowOffset ?? { width: 0, height: 0 };
  const radius = s.shadowRadius ?? 0;
  const color = s.shadowColor ?? '#00000000';
  const inset = s.type === 'INNER_SHADOW' ? 'inset ' : '';
  return `${inset}${off.width}px ${off.height}px ${radius}px ${color}`;
}

function renderTextDecl(t: CompositeTextPlan): string {
  const fields: string[] = [];
  if (t.fontFamily !== undefined) fields.push(`fontFamily: ${JSON.stringify(t.fontFamily)}`);
  if (t.fontSize !== undefined) fields.push(`fontSize: ${JSON.stringify(`${t.fontSize}px`)}`);
  if (t.fontWeight !== undefined) fields.push(`fontWeight: ${JSON.stringify(t.fontWeight)}`);
  if (t.lineHeight !== undefined) fields.push(`lineHeight: ${JSON.stringify(`${t.lineHeight}px`)}`);
  if (t.letterSpacing !== undefined) fields.push(`letterSpacing: ${JSON.stringify(`${t.letterSpacing}px`)}`);
  return `{ ${fields.join(', ')} }`;
}

// (No exported variable from this module — emitTailwindPresetCjs is the entry.)
