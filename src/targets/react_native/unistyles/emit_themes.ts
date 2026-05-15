// Emits `src/themes.ts` — pre-built `light` and `dark` constants when a
// light/dark axis is detected. They're convenience exports on top of
// `buildTheme()`.

import type { ThemePlan } from './planner';

export function emitThemesTs(plan: ThemePlan): string {
  if (!plan.hasLightDark || !plan.lightDarkAxisKey) {
    return [
      '// GENERATED FILE — do not edit by hand.',
      '',
      "import { buildTheme } from './build-theme';",
      "import type { Theme } from './types';",
      '',
      'export const theme: Theme = buildTheme();',
      '',
    ].join('\n');
  }

  return [
    '// GENERATED FILE — do not edit by hand.',
    '',
    "import { buildTheme } from './build-theme';",
    "import type { Theme } from './types';",
    '',
    `export const light: Theme = buildTheme({ ${plan.lightDarkAxisKey}: 'light' });`,
    `export const dark: Theme = buildTheme({ ${plan.lightDarkAxisKey}: 'dark' });`,
    '',
    'export const themes = { light, dark } as const;',
    '',
  ].join('\n');
}
