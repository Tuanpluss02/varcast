// Emits `src/index.ts` — package public surface.

import type { ThemePlan } from './planner';

export function emitPackageIndexTs(plan: ThemePlan): string {
  const lines = ['// GENERATED FILE — do not edit by hand.', ''];

  const runtimeExports = [
    'buildTheme',
    'getDesignSystemModes',
    'setDesignSystemModes',
    ...plan.axes.map((axis) => `set${pascal(axis.keyCamel)}Mode`),
  ];
  lines.push(`export { ${runtimeExports.join(', ')} } from './build-theme';`);
  lines.push("export type { Theme, ThemeOptions } from './types';");

  if (plan.hasLightDark) {
    lines.push("export { light, dark, themes } from './themes';");
  } else {
    lines.push("export { theme } from './themes';");
  }
  lines.push('');
  return lines.join('\n');
}

function pascal(s: string): string {
  return s ? s[0].toUpperCase() + s.slice(1) : 'Mode';
}
