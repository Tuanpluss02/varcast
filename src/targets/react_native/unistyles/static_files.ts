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

  const augmentationSnippet = buildAugmentationSnippet(o, plan);

  return `# ${o.packageName}

Generated React Native design tokens for [\`react-native-unistyles\` v3](https://www.npmjs.com/package/react-native-unistyles). Do not edit by hand.

## Compatibility

- React Native ≥ 0.72 (Babel must understand TypeScript — true by default since RN 0.71)
- \`react-native-unistyles\` ^3.0.0
- Works in bare RN, Expo SDK 50+, and any Metro-based tooling

## Install

Place this folder in your app repo (e.g. \`packages/${o.packageName}\`) and add it as a dependency.

\`\`\`bash
pnpm add ${o.packageName}@workspace:*
# or, outside a pnpm workspace:
pnpm add ./packages/${o.packageName}
\`\`\`

Your app must also install and configure Unistyles v3 and its native dependencies. Let your package manager pick versions compatible with your RN — for Expo:

\`\`\`bash
expo install react-native-unistyles react-native-edge-to-edge react-native-nitro-modules
\`\`\`

For bare RN, follow [the Unistyles 3 install guide](https://www.unistyl.es/v3/start/getting-started) to pick versions that match your RN release.

> ⚠️ **Do not run \`pnpm install\` inside this folder.** This package ships TypeScript source under \`src/\` — there is no build step. Your app's Metro/Babel handles transpilation. Installing here pulls a duplicate \`react-native\` into nested \`node_modules\` and crashes the consumer app's Metro bundler.

## Setup — TypeScript augmentation (required)

Unistyles types \`theme.*\` from your app's \`UnistylesThemes\` interface. This package intentionally does not augment it, so you can register exactly the themes you use without TS errors. Add this once in your app (e.g. \`src/unistyles.d.ts\`):

\`\`\`ts
${augmentationSnippet}
\`\`\`

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

## Composites

\`textStyles\`, \`shadows\`, and \`colorStyles\` are exposed under the theme as typed objects (each key matches a Figma style getter). Composites are resolved at codegen time using each token's first available mode — they do **not** update with axis switches at runtime. Compose dynamic styles from token collections if you need runtime reactivity.

## Troubleshooting

**TypeScript reports \`Cannot find module 'react-native'\`** — your install method symlinked this package outside the consumer's \`node_modules\`, so TS can't see the consumer's peer deps. Fix it by either:

- Using a pnpm workspace (\`pnpm add ${o.packageName}@workspace:*\`), or
- Copying instead of symlinking: \`npm install --install-links ./packages/${o.packageName}\`

**Metro fails with \`Unable to determine event arguments for "..."\`** — there's a duplicate \`react-native\` inside this package's \`node_modules\`. Delete \`packages/${o.packageName}/node_modules\` and re-install from your app root.
`;
}

function buildAugmentationSnippet(o: ReactNativeOptions, plan: ThemePlan): string {
  const shipped = plan.hasLightDark ? ['light', 'dark'] : ['theme'];
  const lines = [
    `import type { Theme } from '${o.packageName}';`,
    '',
    "declare module 'react-native-unistyles' {",
    '  interface UnistylesThemes {',
    ...shipped.map((name) => `    ${name}: Theme;`),
    '    // Add any custom theme names you register with buildTheme(), e.g.:',
    '    // designSystem: Theme;',
    '  }',
    '}',
  ];
  return lines.join('\n');
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
