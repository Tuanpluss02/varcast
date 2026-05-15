// Static, non-IR-dependent files for the Unistyles flavor package.

import type { ReactNativeOptions } from '../options';
import type { ThemePlan } from './planner';

export function packageJson(o: ReactNativeOptions): string {
  return (
    JSON.stringify(
      {
        name: o.packageName,
        private: true,
        version: '0.1.0',
        main: 'src/index.ts',
        types: 'src/index.ts',
        files: ['src'],
        peerDependencies: {
          'react-native': '>=0.72',
          'react-native-unistyles': '^3.0.0',
        },
      },
      null,
      2,
    ) + '\n'
  );
}

export function tsconfigJson(): string {
  return (
    JSON.stringify(
      {
        compilerOptions: {
          target: 'ES2020',
          module: 'ESNext',
          moduleResolution: 'Bundler',
          noEmit: true,
          strict: true,
          esModuleInterop: true,
          skipLibCheck: true,
          forceConsistentCasingInFileNames: true,
        },
        include: ['src'],
      },
      null,
      2,
    ) + '\n'
  );
}

export function npmrc(): string {
  // Defensive: if someone runs `pnpm install` inside this package, do NOT
  // auto-install peers (notably `react-native`). A nested install creates
  // duplicate native code that crashes the consumer app's Metro bundler.
  return 'auto-install-peers=false\n';
}

export function readmeMd(o: ReactNativeOptions, plan: ThemePlan): string {
  const configureExample = plan.hasLightDark
    ? `import { light, dark } from '${o.packageName}';

StyleSheet.configure({
  themes: { light, dark },
  settings: { adaptiveThemes: true },
});`
    : `import { theme } from '${o.packageName}';

StyleSheet.configure({
  themes: { theme },
  settings: { initialTheme: 'theme' },
});`;
  const customThemeExample = buildCustomThemeExample(plan);
  const modeSwitchingSection = buildModeSwitchingSection(o, plan);
  const collectionRoots = plan.collections.map((c) => c.rootKey);
  const collectionList =
    collectionRoots.length > 0 ? collectionRoots.map((k) => `\`${k}\``).join(', ') : '`theme`';

  return `# ${o.packageName}

Generated React Native design tokens for [\`react-native-unistyles\` v3](https://www.npmjs.com/package/react-native-unistyles). Do not edit by hand.

## Install

Place this folder in your app repo (e.g. \`packages/${o.packageName}\`) and add it as a dependency.

\`\`\`bash
pnpm add ${o.packageName}@workspace:*
# or, outside a pnpm workspace:
pnpm add ./packages/${o.packageName}
\`\`\`

Your app must also install and configure Unistyles v3 and its native dependencies according to the Unistyles documentation. At minimum, a React Native app needs:

\`\`\`bash
pnpm add react-native-unistyles react-native-edge-to-edge react-native-nitro-modules@0.31.4
\`\`\`

This package ships TypeScript source under \`src/\`. There is no build step — your app's Metro/Babel handles transpilation. **Do not run \`pnpm install\` inside this folder**: it pulls a duplicate copy of \`react-native\` into nested \`node_modules\` and crashes your app's Metro bundler.

## Usage

\`\`\`ts
import { StyleSheet } from 'react-native-unistyles';
${configureExample}
\`\`\`

Call \`StyleSheet.configure\` before importing components that create Unistyles stylesheets.

If your Figma file has multiple axis collections, you can build any combination at app boot. This package's axis keys are typed in \`ThemeOptions\`.

\`\`\`ts
import { StyleSheet } from 'react-native-unistyles';
import { buildTheme } from '${o.packageName}';

StyleSheet.configure({
  themes: {
${customThemeExample}
  },
  settings: { initialTheme: 'primary' },
});
\`\`\`

${modeSwitchingSection}

## Theme shape

Token collections are exposed under collection roots to preserve every Figma variable, even when two collections use the same group path. This package exposes: ${collectionList}.

## Module augmentation

This package augments \`react-native-unistyles\` so \`theme.*\` autocompletes inside \`StyleSheet.create\`. No setup needed — importing anything from this package brings the augmentation along, and TypeScript picks it up for the rest of your program.

The shipped augmentation covers ${plan.hasLightDark ? '`light` and `dark`' : '`theme`'}. If you register custom theme names with \`buildTheme()\` (e.g. \`primary\`, \`alternate\`, \`designSystem\`), add your own augmentation alongside them:

\`\`\`ts
import type { Theme } from '${o.packageName}';

declare module 'react-native-unistyles' {
  interface UnistylesThemes {
    designSystem: Theme;
  }
}
\`\`\`

## Composites

\`textStyles\`, \`shadows\`, and \`colorStyles\` are exposed under the theme. Note: composites are resolved at codegen time using each token's first available mode — they do **not** update with axis switches at runtime. Compose dynamic styles from token collections if you need runtime reactivity.
`;
}

function buildModeSwitchingSection(o: ReactNativeOptions, plan: ThemePlan): string {
  if (plan.axes.length === 0) {
    return `## Changing modes at runtime

This export has no multi-mode collections, so there are no generated mode setters.`;
  }

  const setterNames = plan.axes.map((axis) => `set${pascal(axis.keyCamel)}Mode`);
  const imports = ['setDesignSystemModes', 'getDesignSystemModes', ...setterNames].join(', ');
  const examples = plan.axes
    .map((axis) => {
      const fnName = `set${pascal(axis.keyCamel)}Mode`;
      const mode = axis.modes[1]?.keyCamel ?? axis.modes[0]?.keyCamel ?? 'default';
      return `${fnName}(${JSON.stringify(mode)})`;
    })
    .join('\n');
  const partial = renderThemeOptions(
    plan.axes.slice(0, 2).map((axis) => [
      axis.keyCamel,
      axis.modes[1]?.keyCamel ?? axis.modes[0]?.keyCamel ?? 'default',
    ]),
  );

  return `## Changing modes at runtime

The generated setters mirror Flutter's mode setters. They update the currently selected Unistyles theme with \`UnistylesRuntime.updateTheme\`.

For app-controlled mode switching, register one mutable theme and select it manually:

\`\`\`ts
import { StyleSheet } from 'react-native-unistyles';
import { buildTheme } from '${o.packageName}';

StyleSheet.configure({
  themes: { designSystem: buildTheme() },
  settings: { initialTheme: 'designSystem' },
});
\`\`\`

Use \`adaptiveThemes: true\` when the OS should control reserved \`light\`/\`dark\` themes. Use the generated setters when your app controls the design-system modes.

\`\`\`ts
import { ${imports} } from '${o.packageName}';

${examples}
setDesignSystemModes(${partial});
const modes = getDesignSystemModes();
\`\`\``;
}

function buildCustomThemeExample(plan: ThemePlan): string {
  if (plan.axes.length === 0) {
    return `    primary: buildTheme(),
    alternate: buildTheme(),`;
  }

  const primary = renderThemeOptions(
    plan.axes.map((axis) => [axis.keyCamel, axis.modes[0]?.keyCamel ?? 'default']),
  );
  const alternate = renderThemeOptions(
    plan.axes.map((axis) => [
      axis.keyCamel,
      axis.modes[1]?.keyCamel ?? axis.modes[0]?.keyCamel ?? 'default',
    ]),
  );

  return `    primary: buildTheme(${primary}),
    alternate: buildTheme(${alternate}),`;
}

function renderThemeOptions(entries: Array<[string, string]>): string {
  const body = entries
    .map(([key, value]) => `${key}: ${JSON.stringify(value)}`)
    .join(', ');
  return `{ ${body} }`;
}

function pascal(s: string): string {
  return s ? s[0].toUpperCase() + s.slice(1) : 'Mode';
}
