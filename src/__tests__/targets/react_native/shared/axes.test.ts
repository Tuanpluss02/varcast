import { describe, expect, it } from 'vitest';
import type { IRCollection } from '../../../../ir/types';
import { detectAxes, findLightDarkAxis } from '../../../../targets/react_native/shared/axes';

function col(
  id: string,
  name: string,
  modeNames: string[],
  kind: IRCollection['kind'] = 'token',
): IRCollection {
  return {
    id,
    name,
    kind,
    modes: modeNames.map((n, i) => ({ id: `${id}:m${i}`, name: n })),
    variables: [],
  };
}

describe('detectAxes', () => {
  it('skips collections with a single mode', () => {
    const axes = detectAxes([
      col('c:font', 'Font', ['Inter']),
      col('c:mode', 'Mode', ['Light', 'Dark']),
    ]);
    expect(axes.map((a) => a.keyCamel)).toEqual(['mode']);
  });

  it('preserves Figma collection order', () => {
    const axes = detectAxes([
      col('c:mode', 'Mode', ['Light', 'Dark']),
      col('c:brand', 'Brand', ['Blue', 'Purple']),
      col('c:corner', 'Corner', ['Rounded', 'Sharp']),
    ]);
    expect(axes.map((a) => a.keyCamel)).toEqual(['mode', 'brand', 'corner']);
  });

  it('camelCases axis and mode keys', () => {
    const axes = detectAxes([col('c:b', 'Brand Color', ['Cool Blue', 'Warm Red'])]);
    expect(axes[0].keyCamel).toBe('brandColor');
    expect(axes[0].modes.map((m) => m.keyCamel)).toEqual(['coolBlue', 'warmRed']);
  });

  it('marks the light/dark axis', () => {
    const axes = detectAxes([
      col('c:brand', 'Brand', ['Blue', 'Purple']),
      col('c:mode', 'Mode', ['Light', 'Dark']),
    ]);
    expect(axes.find((a) => a.keyCamel === 'mode')?.isLightDarkLike).toBe(true);
    expect(axes.find((a) => a.keyCamel === 'brand')?.isLightDarkLike).toBe(false);
  });

  it('does not mark light-only or dark-only axes', () => {
    const axes = detectAxes([col('c:m', 'Mode', ['Light', 'Sepia'])]);
    expect(axes[0].isLightDarkLike).toBe(false);
  });

  it('de-dupes colliding mode keys within an axis', () => {
    // Both names normalize to 'lightMode' once cased — the dedup suffixes the
    // second occurrence rather than letting it shadow the first.
    const axes = detectAxes([col('c:m', 'Mode', ['Light Mode', 'LIGHT-MODE'])]);
    expect(axes[0].modes.map((m) => m.keyCamel)).toEqual(['lightMode', 'lightMode2']);
  });
});

describe('findLightDarkAxis', () => {
  it('returns the light/dark axis when present', () => {
    const axes = detectAxes([
      col('c:brand', 'Brand', ['Blue', 'Purple']),
      col('c:mode', 'Mode', ['Light', 'Dark']),
    ]);
    expect(findLightDarkAxis(axes)?.keyCamel).toBe('mode');
  });

  it('returns null when none', () => {
    const axes = detectAxes([col('c:brand', 'Brand', ['Blue', 'Purple'])]);
    expect(findLightDarkAxis(axes)).toBeNull();
  });
});
