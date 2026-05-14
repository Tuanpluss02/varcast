// Emits per-theme `.vars.js` modules and a `themes/index.js` aggregator so
// consumers can switch themes natively via NativeWind's `vars()` helper.

import type { NativeWindPlan, ThemeFilePlan } from './planner';

export function emitThemeVarsJs(plan: ThemeFilePlan): string {
  const lines: string[] = ['// GENERATED FILE — do not edit by hand.', '', 'module.exports = {'];
  for (const a of plan.assignments) {
    lines.push(`  ${JSON.stringify(a.name)}: ${JSON.stringify(a.value)},`);
  }
  lines.push('};', '');
  return lines.join('\n');
}

export function emitThemesIndexJs(plan: NativeWindPlan): string {
  // Skip the synthetic `base` file from the `themes` aggregator — it always
  // applies, so users wouldn't pass it to `vars()`.
  const aliased = plan.themeFiles.filter((f) => f.axisKey !== null);

  const lines: string[] = ['// GENERATED FILE — do not edit by hand.', ''];
  for (const f of aliased) {
    lines.push(`const ${slugIdent(f.slug)} = require('./${f.slug}.vars.js');`);
  }
  lines.push('');
  lines.push('module.exports = {');
  lines.push('  themes: {');
  for (const f of aliased) {
    lines.push(`    ${JSON.stringify(f.slug)}: ${slugIdent(f.slug)},`);
  }
  lines.push('  },');
  lines.push('};');
  lines.push('');
  return lines.join('\n');
}

export function emitThemesIndexDts(plan: NativeWindPlan): string {
  const aliased = plan.themeFiles.filter((f) => f.axisKey !== null);
  const lines: string[] = ['// GENERATED FILE — do not edit by hand.', ''];
  lines.push('export type ThemeVarMap = Record<string, string>;');
  lines.push('export declare const themes: {');
  for (const f of aliased) {
    lines.push(`  ${JSON.stringify(f.slug)}: ThemeVarMap;`);
  }
  lines.push('};');
  lines.push('');
  return lines.join('\n');
}

function slugIdent(slug: string): string {
  return `_t_${slug.replace(/[^a-zA-Z0-9_]/g, '_')}`;
}
