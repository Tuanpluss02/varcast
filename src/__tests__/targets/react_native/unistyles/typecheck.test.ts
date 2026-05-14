// Writes the generated Unistyles package to a temp directory and runs `tsc`
// against it to catch syntax / type-shape regressions. Skipped if the host
// has no `tsc` binary available.

import { execFileSync } from 'node:child_process';
import { existsSync, mkdtempSync, rmSync, writeFileSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { runEngine } from '../../../../core/emit_engine';
import type { IR } from '../../../../ir/types';
import { reactNativeTarget } from '../../../../targets/react_native';

const TSC = join(__dirname, '..', '..', '..', '..', '..', 'node_modules', '.bin', 'tsc');

function runTsc(cwd: string): { ok: true } | { ok: false; output: string } {
  try {
    execFileSync(TSC, ['-p', 'tsconfig.json', '--noEmit'], { cwd, stdio: 'pipe' });
    return { ok: true };
  } catch (e: any) {
    const out = (e.stdout?.toString() ?? '') + (e.stderr?.toString() ?? '');
    return { ok: false, output: out };
  }
}

function writeAll(root: string, files: { path: string; contents: string }[]) {
  for (const f of files) {
    const target = join(root, f.path);
    mkdirSync(dirname(target), { recursive: true });
    writeFileSync(target, f.contents, 'utf8');
  }
}

function multiAxisIR(): IR {
  return {
    version: '1.0',
    fileKey: 'k',
    generatedAt: new Date(0).toISOString(),
    collections: [
      {
        id: 'col:mode',
        name: 'Mode',
        kind: 'token',
        modes: [
          { id: 'm:light', name: 'Light' },
          { id: 'm:dark', name: 'Dark' },
        ],
        variables: [
          {
            id: 'v:bg',
            figmaName: 'colors/background/primary',
            groupPath: ['colors', 'background', 'primary'],
            type: 'COLOR',
            scopes: ['ALL_FILLS'],
            hiddenFromPublishing: false,
            emitToPublic: true,
            valuesByMode: {
              'm:light': { kind: 'literal', value: { r: 1, g: 1, b: 1, a: 1 } },
              'm:dark': { kind: 'literal', value: { r: 0, g: 0, b: 0, a: 1 } },
            },
          },
        ],
      },
    ],
    composites: { paintStyles: [], effectStyles: [], textStyles: [] },
  };
}

describe('Unistyles flavor — generated package typechecks', () => {
  // Stub `react-native` types because the generated package's tsconfig has
  // no peer-deps installed. We provide a minimal declaration file so the
  // `import type { TextStyle } from 'react-native'` line resolves.
  const REACT_NATIVE_STUB = `declare module 'react-native' {
  export interface TextStyle {
    color?: string;
    fontFamily?: string;
    fontSize?: number;
    fontWeight?: string | number;
    fontStyle?: string;
    lineHeight?: number;
    letterSpacing?: number;
    textAlign?: string;
    shadowColor?: string;
    shadowOffset?: { width: number; height: number };
    shadowRadius?: number;
    shadowOpacity?: number;
  }
}
`;

  it('generated package compiles cleanly under tsc --noEmit', () => {
    if (!existsSync(TSC)) {
      // Local dev environments without dependencies installed — skip.
      return;
    }

    const out = runEngine(multiAxisIR(), [reactNativeTarget], null, {
      react_native: { flavor: 'unistyles', packageName: 'ds-uni' },
    });
    const root = mkdtempSync(join(tmpdir(), 'varcast-uni-'));
    try {
      writeAll(root, out.files);
      // Drop in a stub for `react-native` and reference it from tsconfig.
      mkdirSync(join(root, 'src', 'stubs'), { recursive: true });
      writeFileSync(join(root, 'src', 'stubs', 'react-native.d.ts'), REACT_NATIVE_STUB, 'utf8');
      const result = runTsc(root);
      if (!result.ok) {
        throw new Error(`tsc failed:\n${result.output}`);
      }
      expect(result.ok).toBe(true);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  }, 30_000);
});
