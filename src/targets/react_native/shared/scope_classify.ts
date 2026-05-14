// Maps an IR variable to a Tailwind theme bucket using the variable's type
// and Figma scopes.
//
// Both RN flavors (NativeWind preset, Unistyles) consult this when they need
// to know "where does this token belong" — NativeWind uses it to pick the
// `theme.extend.*` key, Unistyles uses it as a hint for surface grouping
// when a collection has no explicit groupPath.
//
// Faithful policy: only classify when scopes give an unambiguous signal.
// `ALL_SCOPES` (Figma's default for new variables) is treated as "no
// information" — the caller falls back to a flavor-specific default.

import type { IRVariable, VariableScope } from '../../../ir/types';

export type TailwindBucket =
  | 'colors'
  | 'spacing'
  | 'borderRadius'
  | 'fontSize'
  | 'lineHeight'
  | 'fontFamily'
  | 'fontWeight'
  | 'letterSpacing'
  | 'opacity';

const COLOR_SCOPES: ReadonlySet<VariableScope> = new Set([
  'ALL_FILLS',
  'FILL_COLOR',
  'STROKE_COLOR',
  'EFFECT_COLOR',
]);

interface ClassifyInput {
  type: IRVariable['type'];
  scopes: VariableScope[];
}

export function tailwindBucketFor(v: ClassifyInput): TailwindBucket | null {
  const scopeSet = new Set(v.scopes ?? []);
  // ALL_SCOPES carries no specificity — discard it for FLOAT inference.
  // Empty scopes list also means "no information".
  const hasExplicit = scopeSet.size > 0 && !scopeSet.has('ALL_SCOPES');

  // COLOR is unambiguous from type alone.
  if (v.type === 'COLOR') return 'colors';

  // STRING + FONT_FAMILY scope → fontFamily. Otherwise STRING is unmappable.
  if (v.type === 'STRING') {
    return hasExplicit && scopeSet.has('FONT_FAMILY') ? 'fontFamily' : null;
  }

  // BOOLEAN never maps to a Tailwind bucket.
  if (v.type === 'BOOLEAN') return null;

  // FLOAT — order from most specific to least.
  if (!hasExplicit) return null;

  if (scopeSet.has('CORNER_RADIUS')) return 'borderRadius';
  if (scopeSet.has('FONT_SIZE')) return 'fontSize';
  if (scopeSet.has('LINE_HEIGHT')) return 'lineHeight';
  if (scopeSet.has('LETTER_SPACING')) return 'letterSpacing';
  if (scopeSet.has('FONT_WEIGHT')) return 'fontWeight';
  if (scopeSet.has('OPACITY')) return 'opacity';
  if (scopeSet.has('GAP') || scopeSet.has('WIDTH_HEIGHT')) return 'spacing';
  return null;
}

// Re-exported for tests / callers that want the constant.
export { COLOR_SCOPES };
