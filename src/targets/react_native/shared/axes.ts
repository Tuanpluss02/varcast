// Axis detection for the Unistyles flavor's `buildTheme(opts)` factory.
//
// Faithful policy (decision #3): every collection that has more than one mode
// becomes one axis. The collection's camelCase export name is the axis key;
// each mode becomes one allowed value.
//
// Example — Figma file with collections "Mode" (light/dark), "Brand"
// (blue/purple), "Corner" (rounded/sharp), "Font" (inter) →
//   axes = [
//     { keyCamel: 'mode',   modes: [{ keyCamel: 'light', ... }, { keyCamel: 'dark', ... }] },
//     { keyCamel: 'brand',  modes: [{ keyCamel: 'blue',  ... }, { keyCamel: 'purple', ... }] },
//     { keyCamel: 'corner', modes: [{ keyCamel: 'rounded', ...}, { keyCamel: 'sharp', ... }] },
//     // 'font' has only one mode → not an axis
//   ]
//
// `isLightDarkLike` flags the canonical light/dark axis so the generator can
// ship `light` and `dark` named exports in addition to `buildTheme()`.

import { processSegment, splitWords, toCamelCase } from '../../../core/sanitize_base';
import type { IRCollection, IRMode } from '../../../ir/types';

export interface AxisMode {
  id: string;
  figmaName: string;
  keyCamel: string;
}

export interface Axis {
  collectionId: string;
  collectionFigmaName: string;
  keyCamel: string;
  modes: AxisMode[];
  isLightDarkLike: boolean;
}

export function detectAxes(collections: IRCollection[]): Axis[] {
  return collections
    .filter((c) => c.modes.length > 1)
    .map((c) => buildAxis(c));
}

/**
 * Find the canonical light/dark axis. Returns null when none is detected.
 * The first axis whose mode set normalizes to a superset of {light, dark}
 * wins; ties are broken by collection order.
 */
export function findLightDarkAxis(axes: Axis[]): Axis | null {
  return axes.find((a) => a.isLightDarkLike) ?? null;
}

function buildAxis(c: IRCollection): Axis {
  const axisModes: AxisMode[] = c.modes.map((m) => ({
    id: m.id,
    figmaName: m.name,
    keyCamel: modeKey(m),
  }));

  // De-dupe axis mode keys within the same collection (e.g. "light/extra"
  // and "light extra" both → "lightExtra"). Suffix collisions with N.
  const seen = new Set<string>();
  for (const m of axisModes) {
    let candidate = m.keyCamel;
    let n = 2;
    while (seen.has(candidate)) candidate = `${m.keyCamel}${n++}`;
    seen.add(candidate);
    m.keyCamel = candidate;
  }

  return {
    collectionId: c.id,
    collectionFigmaName: c.name,
    keyCamel: collectionKey(c.name),
    modes: axisModes,
    isLightDarkLike: detectLightDarkLike(axisModes),
  };
}

function modeKey(m: IRMode): string {
  return camel(m.name);
}

function collectionKey(name: string): string {
  return camel(name);
}

function camel(raw: string): string {
  const words = splitWords(processSegment(raw));
  return toCamelCase(words.join(' '));
}

function detectLightDarkLike(modes: AxisMode[]): boolean {
  const keys = new Set(modes.map((m) => m.keyCamel.toLowerCase()));
  return keys.has('light') && keys.has('dark');
}
