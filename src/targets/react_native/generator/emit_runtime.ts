import type { EmittedFile } from '../../../core/target';
import type { PreparedRN } from './prepare';

export function emitRuntime(prepared: PreparedRN): EmittedFile[] {
  const imports: string[] = [];
  const attachLines: string[] = [];
  const modeDefaults: string[] = [];

  for (const col of prepared.collections) {
    const isPrimitive = col.kind === 'primitive';
    const rel = isPrimitive
      ? `../tokens/primitives/${col.fileBaseName}`
      : `../tokens/tokens/${col.fileBaseName}`;
    imports.push(`import { ${col.exportName} } from '${rel}';`);
    // default mode = first mode key (deterministic)
    const defaultModeKey = col.modes[0]?.key ?? 'default';
    modeDefaults.push(`  ${JSON.stringify(col.exportName)}: ${JSON.stringify(defaultModeKey)},`);
    attachLines.push(
      `  Object.defineProperty(theme, ${JSON.stringify(col.exportName)}, {`,
      `    enumerable: true,`,
      `    get: () => ${col.exportName}[theme.modes[${JSON.stringify(col.exportName)}] as keyof typeof ${col.exportName}] ?? ${col.exportName}[${JSON.stringify(defaultModeKey)} as any],`,
      `  });`,
    );
  }

  const createTheme = [
    "import type { Dispatch, SetStateAction } from 'react';",
    ...imports,
    '',
    'export type ThemeModeState = Record<string, string>;',
    '',
    'export type Theme = {',
    '  modes: ThemeModeState;',
    '  setMode: (collection: string, mode: string) => void;',
    '  [k: string]: any;',
    '};',
    '',
    'export function createTheme(',
    '  modes: ThemeModeState = {},',
    '  setModes?: Dispatch<SetStateAction<ThemeModeState>>,',
    '): Theme {',
    '  const setMode = (collection: string, mode: string) => {',
    '    if (!setModes) return;',
    '    setModes((prev: ThemeModeState) => ({ ...prev, [collection]: mode }));',
    '  };',
    '',
    '  const theme: Theme = {',
    '    modes: {',
    ...modeDefaults,
    '      ...modes,',
    '    },',
    '    setMode,',
    '  } as any;',
    '',
    ...attachLines,
    '',
    '  return theme;',
    '}',
    '',
  ].join('\n');

  return [{ path: 'src/runtime/createTheme.ts', contents: createTheme }];
}

