import type { ReactNativeOptions } from './options';

export function packageJson(o: ReactNativeOptions): string {
  return JSON.stringify(
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
        react: '>=18',
        'react-native': '>=0.72',
      },
    },
    null,
    2,
  ) + '\n';
}

export function tsconfigJson(): string {
  return JSON.stringify(
    {
      compilerOptions: {
        target: 'ES2020',
        module: 'ESNext',
        jsx: 'react-jsx',
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
  ) + '\n';
}

export function readmeMd(o: ReactNativeOptions): string {
  return `# ${o.packageName}

Generated React Native design system package. Do not edit by hand.

## What gets generated

- \`src/tokens/**\`: per-collection token objects, grouped by mode (e.g. \`lightMode\`, \`darkMode\`).
- \`src/runtime/**\`: a tiny runtime that selects the active mode per collection.
- \`src/composites/**\` (optional): computed helpers for Figma styles (colors, shadows, text styles).

The package builds TypeScript \`src/\` into \`dist/\` and exposes \`dist/index.js\` + \`dist/index.d.ts\`.

## Install (recommended: monorepo / path dependency)

1) Put the generated folder somewhere in your app repo (e.g. \`packages/${o.packageName}\`).

2) Add it as a dependency.

- **pnpm / yarn workspaces**: add it as a workspace package.
- **npm**: use a local file dependency:

\`\`\`json
{
  "dependencies": {
    "${o.packageName}": "file:../packages/${o.packageName}"
  }
}
\`\`\`

3) Build the package once (and whenever you re-export):

\`\`\`bash
cd packages/${o.packageName}
pnpm install
pnpm build
\`\`\`

## Basic usage

\`\`\`tsx
import { ThemeProvider, useTheme } from '${o.packageName}';

export function App() {
  return (
    <ThemeProvider>
      <Screen />
    </ThemeProvider>
  );
}

function Screen() {
  const theme = useTheme();

  // Each collection becomes a getter on \`theme\`.
  // Example: \`theme.colorToken\`, \`theme.numberBasic\`, ...
  // (Exact names depend on your Figma collection names.)
  return null;
}
\`\`\`

## Switching modes (dark/light, etc.)

Each token collection has its own mode key. To switch a collection at runtime:

\`\`\`ts
import { setTokenMode } from '${o.packageName}';

// collection = the collection getter name on \`theme\`
// mode = a generated mode key like \`lightMode\` / \`darkMode\`
setTokenMode(theme, 'colorToken', 'darkMode');
\`\`\`

Notes:
- Default mode is the **first** mode in each collection (deterministic).
- Mode keys are derived from the Figma mode name and normalized to a camelCase-ish \`*Mode\` key (e.g. "Dark" → \`darkMode\`).

## Composites (if enabled)

If you enable composites, the package also exports:
- \`colorStyles\`: Figma paint styles resolved per mode (solid colors supported in v1).
- \`shadows\`: drop shadow mapping to React Native shadow props per mode.
- \`textStyles\`: basic text style mapping per mode.

## What you can change

These are controlled by export options in Varcast:
- \`packageName\`: the npm package name (import path).
- \`include.primitives\`: include primitive collections.
- \`include.tokens\`: include token collections.
- \`include.composites.{colorStyles,shadows,textStyles}\`: include each composite file.
`;
}

export function runtimeIndexTs(): string {
  return [
    "export { ThemeProvider, useTheme } from './runtime/ThemeProvider';",
    "export type { Theme, ThemeModeState } from './runtime/createTheme';",
    "export { setTokenMode } from './runtime/modes';",
    "export * from './composites/colorStyles';",
    "export * from './composites/shadows';",
    "export * from './composites/textStyles';",
    '',
  ].join('\n');
}

export function modesTs(): string {
  return [
    '// GENERATED FILE — do not edit by hand.',
    '',
    "import type { Theme } from './createTheme';",
    '',
    'export function setTokenMode(theme: Theme, collection: string, mode: string) {',
    '  theme.setMode(collection, mode);',
    '}',
    '',
  ].join('\n') + '\n';
}

export function reactShimDts(): string {
  return [
    '// GENERATED FILE — do not edit by hand.',
    '// Minimal shims so `tsc --noEmit` can run without installing react typings.',
    '',
    "declare module 'react' {",
    '  export type Dispatch<T> = (value: T) => void;',
    '  export type SetStateAction<S> = S | ((prevState: S) => S);',
    '  export type ReactNode = any;',
    '  export type Context<T> = { Provider: any; __type?: T };',
    '  export function createContext<T>(value: T): Context<T>;',
    '  export function useContext<T>(ctx: Context<T>): T;',
    '  export function useMemo<T>(fn: () => T, deps: any[]): T;',
    '  export function useState<S>(initialState: S | (() => S)): [S, Dispatch<SetStateAction<S>>];',
    '  export default {} as any;',
    '}',
    '',
    "declare module 'react/jsx-runtime' {",
    '  export const jsx: any;',
    '  export const jsxs: any;',
    '  export const Fragment: any;',
    '}',
    '',
  ].join('\n');
}

export function themeProviderTsx(): string {
  return (
    [
      "import React, { createContext, useContext, useMemo, useState } from 'react';",
      "import type { ReactNode } from 'react';",
      "import { createTheme } from './createTheme';",
      "import type { Theme, ThemeModeState } from './createTheme';",
      '',
      'const ThemeContext = createContext<Theme | null>(null);',
      '',
      'export function ThemeProvider(props: { children: ReactNode; initial?: Partial<ThemeModeState> }) {',
      '  const [modes, setModes] = useState<ThemeModeState>(() => ({ ...(props.initial as ThemeModeState | undefined) } as ThemeModeState));',
      '',
      '  const theme = useMemo(() => createTheme(modes, setModes), [modes]);',
      '',
      '  return <ThemeContext.Provider value={theme}>{props.children}</ThemeContext.Provider>;',
      '}',
      '',
      'export function useTheme(): Theme {',
      '  const v = useContext(ThemeContext);',
      "  if (!v) throw new Error('useTheme must be used within ThemeProvider');",
      '  return v;',
      '}',
      '',
    ].join('\n') + '\n'
  );
}


