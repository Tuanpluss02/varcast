// Emits `src/build-theme.ts` — the runtime `buildTheme(opts)` factory.
//
// Strategy: walk every collection's `shape`, look up the active mode for
// each variable's owning collection (axis-driven), resolve aliases against
// the same combo, then deep-merge into a single theme tree. Composites are
// static and stitched on top.

import type { ThemePlan } from './planner';

export function emitBuildThemeTs(plan: ThemePlan): string {
  const optsType = renderOptsType(plan);
  const defaults = renderDefaults(plan);
  const axisSetters = renderAxisSetters(plan);

  return [
    '// GENERATED FILE — do not edit by hand.',
    '',
    "import type { Theme, ThemeOptions } from './types';",
    "import { UnistylesRuntime } from 'react-native-unistyles';",
    "import { _collections, _vars } from './data';",
    "import type { Alias, RawLeaf } from './data/types';",
    "import { _textStyles } from './composites/text-styles';",
    "import { _shadows } from './composites/shadows';",
    "import { _colorStyles } from './composites/color-styles';",
    '',
    `${optsType}`,
    '',
    'export const _defaults = ' + defaults + ' as const;',
    'let _currentModes: ThemeOptions = { ..._defaults } as ThemeOptions;',
    '',
    'export function buildTheme(opts: Partial<ThemeOptions> = {}): Theme {',
    '  const axisModeKey: Record<string, string> = { ..._defaults, ...opts };',
    '',
    '  const resolveLeaf = (varId: string, seen: Set<string>): string | number | boolean | null => {',
    '    if (seen.has(varId)) return null;',
    '    seen.add(varId);',
    '    const meta = _vars[varId];',
    '    if (!meta) return null;',
    '    const c = _collections[meta.c];',
    '    const wantedMode = c.axis ? axisModeKey[c.axis] : c.defaultMode;',
    '    const modeKey = wantedMode in meta.v ? wantedMode : c.defaultMode;',
    '    const slot = meta.v[modeKey];',
    '    if (slot === undefined) return null;',
    '    if (typeof slot === "object" && slot !== null && "$alias" in slot) {',
    '      return resolveLeaf((slot as Alias).$alias, seen);',
    '    }',
    '    return slot as Exclude<RawLeaf, Alias>;',
    '  };',
    '',
    '  const tree: Record<string, unknown> = {};',
    '  for (const colId of Object.keys(_collections)) {',
    '    const c = _collections[colId];',
    '    for (const v of c.shape) {',
    '      const value = resolveLeaf(v.varId, new Set());',
    '      let cur: any = tree;',
    '      for (const seg of v.path) {',
    '        if (cur[seg] === undefined || cur[seg] === null || typeof cur[seg] !== "object") {',
    '          cur[seg] = {};',
    '        }',
    '        cur = cur[seg];',
    '      }',
    '      cur[v.leaf] = value;',
    '    }',
    '  }',
    '',
    '  (tree as any).textStyles = _textStyles;',
    '  (tree as any).shadows = _shadows;',
    '  (tree as any).colorStyles = _colorStyles;',
    '  return tree as unknown as Theme;',
    '}',
    '',
    'export function getDesignSystemModes(): ThemeOptions {',
    '  return { ..._currentModes };',
    '}',
    '',
    'export function setDesignSystemModes(opts: Partial<ThemeOptions>): Theme {',
    '  _currentModes = { ..._currentModes, ...opts } as ThemeOptions;',
    '  const nextTheme = buildTheme(_currentModes);',
    '  // Only push into Unistyles if a theme is actually active. Hardcoding a',
    '  // fallback (e.g. "light") would crash when the consumer only registered',
    '  // a custom theme name.',
    '  const themeName = UnistylesRuntime.themeName;',
    '  if (themeName) UnistylesRuntime.updateTheme(themeName, () => nextTheme);',
    '  return nextTheme;',
    '}',
    '',
    ...axisSetters,
  ].join('\n');
}

function renderOptsType(plan: ThemePlan): string {
  // We export ThemeOptions from `types.ts`. The runtime file just uses the
  // type — no need to re-declare it here.
  if (plan.axes.length === 0) return '// No axis collections detected — buildTheme accepts an empty options object.';
  return '';
}

function renderDefaults(plan: ThemePlan): string {
  const entries: string[] = [];
  for (const a of plan.axes) entries.push(`  ${JSON.stringify(a.keyCamel)}: ${JSON.stringify(plan.axisDefaults[a.keyCamel])}`);
  return `{\n${entries.join(',\n')}\n}`;
}

function renderAxisSetters(plan: ThemePlan): string[] {
  if (plan.axes.length === 0) return [];
  const lines: string[] = [];
  for (const axis of plan.axes) {
    const fnName = `set${pascal(axis.keyCamel)}Mode`;
    const key = JSON.stringify(axis.keyCamel);
    lines.push(`export function ${fnName}(mode: ThemeOptions[${key}]): Theme {`);
    lines.push(`  return setDesignSystemModes({ ${key}: mode } as Partial<ThemeOptions>);`);
    lines.push('}');
    lines.push('');
  }
  return lines;
}

function pascal(s: string): string {
  return s ? s[0].toUpperCase() + s.slice(1) : 'Mode';
}
