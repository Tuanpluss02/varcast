// Emits `src/index.ts` — package public surface.

import type { ThemePlan } from './planner';

export function emitPackageIndexTs(plan: ThemePlan): string {
  const lines = ['// GENERATED FILE — do not edit by hand.', ''];

  lines.push("export { buildTheme } from './build-theme';");
  lines.push("export type { Theme, ThemeOptions } from './types';");

  if (plan.hasLightDark) {
    lines.push("export { light, dark, themes } from './themes';");
  } else {
    lines.push("export { theme } from './themes';");
  }
  lines.push('');
  return lines.join('\n');
}
