// Static (non-IR-dependent) files for the NativeWind flavor package.

import type { ReactNativeOptions } from '../options';

export function packageJson(o: ReactNativeOptions): string {
  return (
    JSON.stringify(
      {
        name: o.packageName,
        private: true,
        version: '0.1.0',
        // Tailwind preset is the package's default export when consumed via
        // `require('<pkg>')` from `tailwind.config.js`.
        main: 'tailwind.preset.cjs',
        types: 'themes/index.d.ts',
        files: ['tailwind.preset.cjs', 'themes', 'src'],
        peerDependencies: {
          tailwindcss: '>=3.0',
          nativewind: '>=4.0',
        },
      },
      null,
      2,
    ) + '\n'
  );
}

export function readmeMd(o: ReactNativeOptions): string {
  return `# ${o.packageName}

Generated NativeWind preset + theme files. Do not edit by hand.

## Install

Place this folder in your app repo (e.g. \`packages/${o.packageName}\`) and add it as a dependency.

## Tailwind preset

Wire the preset into your \`tailwind.config.js\`:

\`\`\`js
module.exports = {
  presets: [require('${o.packageName}')],
  content: ['./src/**/*.{ts,tsx}'],
};
\`\`\`

Every token resolves to a CSS variable (\`var(--ds-…)\`) so theme switching does **not** require rebuilding Tailwind.

## Themes — web (\`@import\` CSS)

Each theme file scopes its variables under \`:root[data-theme="<slug>"]\`. Switch by setting the attribute on the document root.

\`\`\`css
/* global.css */
@tailwind base;
@tailwind components;
@tailwind utilities;

@import '${o.packageName}/themes/base.css';
@import '${o.packageName}/themes/light.css';
@import '${o.packageName}/themes/dark.css';
\`\`\`

## Themes — native (NativeWind \`vars()\`)

For React Native, switch themes at the View level via NativeWind's \`vars()\` helper:

\`\`\`tsx
import { vars } from 'nativewind';
import { themes } from '${o.packageName}';

<View style={vars(themes.dark)}>
  {/* children render in the dark theme */}
</View>
\`\`\`

## Composites

- \`.type-<name>\` utility per Figma text style — backed by literal values from each style's first available mode.
- Shadows are baked from the default mode into the preset's \`boxShadow\`. NativeWind cannot reference CSS variables for native \`box-shadow\`, so axis-driven shadow switching is **not** supported.
- The light/dark axis is detected automatically when a collection has both modes named \`light\` and \`dark\`.
`;
}
