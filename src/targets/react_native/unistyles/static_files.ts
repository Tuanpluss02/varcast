// Static, non-IR-dependent files for the Unistyles flavor package.

import type { ReactNativeOptions } from '../options';

export function packageJson(o: ReactNativeOptions): string {
  return (
    JSON.stringify(
      {
        name: o.packageName,
        private: true,
        version: '0.1.0',
        main: 'dist/index.js',
        types: 'dist/index.d.ts',
        files: ['dist'],
        scripts: {
          build: 'tsc -p tsconfig.json',
          typecheck: 'tsc -p tsconfig.json --noEmit',
        },
        peerDependencies: {
          'react-native': '>=0.72',
          'react-native-unistyles': '^2.0.0',
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
          declaration: true,
          outDir: 'dist',
          rootDir: 'src',
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

export function readmeMd(o: ReactNativeOptions): string {
  return `# ${o.packageName}

Generated React Native design tokens for [\`react-native-unistyles\`](https://www.npmjs.com/package/react-native-unistyles). Do not edit by hand.

## Install

Place this folder in your app repo (e.g. \`packages/${o.packageName}\`) and add it as a dependency.

\`\`\`bash
cd packages/${o.packageName}
pnpm install
pnpm build
\`\`\`

## Usage

\`\`\`ts
import { UnistylesRegistry } from 'react-native-unistyles';
import { light, dark } from '${o.packageName}';

UnistylesRegistry
  .addThemes({ light, dark })
  .addConfig({ adaptiveThemes: true });
\`\`\`

If your Figma file has multiple axis collections (e.g. \`Mode\`, \`Brand\`, \`Corner\`, \`Font\`), you can build any combination at app boot:

\`\`\`ts
import { UnistylesRegistry } from 'react-native-unistyles';
import { buildTheme } from '${o.packageName}';

UnistylesRegistry
  .addThemes({
    lightBlueRounded: buildTheme({ mode: 'light', brand: 'blue', corner: 'rounded' }),
    darkPurpleSharp:  buildTheme({ mode: 'dark',  brand: 'purple', corner: 'sharp' }),
  })
  .addConfig({ initialTheme: 'lightBlueRounded' });
\`\`\`

## Module augmentation

This package augments \`react-native-unistyles\` so \`theme.*\` autocompletes inside \`createStyleSheet\`. Make sure \`src/module-augmentation.d.ts\` is included by your \`tsconfig\` (\`include: ['src/**/*']\` is enough).

## Composites

\`textStyles\`, \`shadows\`, and \`colorStyles\` are exposed under the theme. Note: composites are resolved at codegen time using each token's first available mode — they do **not** update with axis switches at runtime. Compose dynamic styles from \`theme.colors\` etc. if you need runtime reactivity.
`;
}
