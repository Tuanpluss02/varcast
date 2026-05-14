// Emits `src/module-augmentation.d.ts` — augments `react-native-unistyles`
// so consumers get autocomplete for `theme.*` inside `createStyleSheet`.

import type { ThemePlan } from './planner';

export function emitModuleAugmentationDts(plan: ThemePlan): string {
  if (!plan.hasLightDark) {
    return [
      '// GENERATED FILE — do not edit by hand.',
      '',
      "import type { Theme } from './types';",
      '',
      "declare module 'react-native-unistyles' {",
      '  export interface UnistylesThemes {',
      '    theme: Theme;',
      '  }',
      '}',
      '',
      'export {};',
      '',
    ].join('\n');
  }

  return [
    '// GENERATED FILE — do not edit by hand.',
    '',
    "import type { Theme } from './types';",
    '',
    "declare module 'react-native-unistyles' {",
    '  export interface UnistylesThemes {',
    '    light: Theme;',
    '    dark: Theme;',
    '  }',
    '}',
    '',
    'export {};',
    '',
  ].join('\n');
}
