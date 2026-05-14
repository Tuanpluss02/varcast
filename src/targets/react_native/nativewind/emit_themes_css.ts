// Emits one `.css` per theme file plan. Each file scopes its variable
// assignments under either `:root` (for the synthetic `base` file) or
// `:root[data-theme="<slug>"]` (per axis-mode), so consumers can switch
// themes by setting the attribute on the document root.

import type { ThemeFilePlan } from './planner';

export function emitThemeCss(plan: ThemeFilePlan): string {
  const selector = plan.axisKey === null ? ':root' : `:root[data-theme="${plan.slug}"]`;
  const lines: string[] = ['/* GENERATED FILE — do not edit by hand. */', '', `${selector} {`];
  for (const a of plan.assignments) {
    lines.push(`  ${a.name}: ${a.value};`);
  }
  lines.push('}', '');
  return lines.join('\n');
}
