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

Generated React Native design system. Do not edit by hand.

## Usage

\`\`\`tsx
import { ThemeProvider, useTheme } from '${o.packageName}';

function App() {
  return (
    <ThemeProvider>
      <Screen />
    </ThemeProvider>
  );
}

function Screen() {
  const theme = useTheme();
  return null;
}
\`\`\`
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

export function createThemeTs(): string {
  return (
    [
      "import type { Dispatch, SetStateAction } from 'react';",
      '',
      '// Collection modes are added by generated token modules.',
      'export type ThemeModeState = Record<string, string>;',
      '',
      'export type Theme = {',
      '  modes: ThemeModeState;',
      '  setMode: (collection: string, mode: string) => void;',
      '  // collections are added by generated modules',
      '  [k: string]: any;',
      '};',
      '',
      'export function createTheme(',
      '  modes: ThemeModeState = {},',
      '  setModes?: Dispatch<SetStateAction<ThemeModeState>>,',
      '): Theme {',
      '  const setMode = (collection: string, mode: string) => {',
      '    if (!setModes) return;',
      '    setModes((prev) => ({ ...prev, [collection]: mode }));',
      '  };',
      '',
      '  return {',
      '    modes,',
      '    setMode,',
      '  } as Theme;',
      '}',
      '',
    ].join('\\n') + '\\n'
  );
}

