import { describe, it, expect } from 'vitest';
import {
  dedupGetters,
  dedupSiblingKeys,
  reserveSiblingKey,
} from '../../../core/naming/dedup';

describe('dedupGetters', () => {
  it('deduplicates getterName collision with numeric suffixes', () => {
    const items = [
      { id: '1', getterName: 'primaryColor' },
      { id: '2', getterName: 'primaryColor' },
      { id: '3', getterName: 'primaryColor' },
    ];
    const result = dedupGetters(items);
    expect(result.map((x) => x.getterName)).toEqual([
      'primaryColor',
      'primaryColor2',
      'primaryColor3',
    ]);
  });

  it('respects bucketKey when grouping deduplication', () => {
    const items = [
      { id: '1', type: 'paint', getterName: 'shadow' },
      { id: '2', type: 'effect', getterName: 'shadow' },
      { id: '3', type: 'effect', getterName: 'shadow' },
    ];
    const result = dedupGetters(items, (item) => item.type);
    expect(result.map((x) => `${x.type}:${x.getterName}`)).toEqual([
      'paint:shadow',
      'effect:shadow',
      'effect:shadow2',
    ]);
  });

  it('handles existing suffixed names without generating duplicate keys', () => {
    const items = [
      { id: '1', getterName: 'color' },
      { id: '2', getterName: 'color2' },
      { id: '3', getterName: 'color' },
    ];
    const result = dedupGetters(items);
    expect(result.map((x) => x.getterName)).toEqual([
      'color',
      'color2',
      'color3',
    ]);
  });

  it('prioritizes stable pinned items over newly derived ones regardless of array order', () => {
    // Item 1 is newly added with derived name 'primary'
    // Item 2 is an existing stable pinned item with stable name 'primary'
    const items = [
      { id: 'new', getterName: 'primary', isStable: false },
      { id: 'stable', getterName: 'primary', isStable: true },
    ];
    const result = dedupGetters(items);
    // Stable item MUST retain 'primary', new item MUST be suffixed 'primary2'
    expect(result.find((x) => x.id === 'stable')?.getterName).toBe('primary');
    expect(result.find((x) => x.id === 'new')?.getterName).toBe('primary2');
  });

  it('preserves items that have unique getterNames', () => {
    const items = [
      { id: '1', getterName: 'colorA' },
      { id: '2', getterName: 'colorB' },
      { id: '3', getterName: 'colorC' },
    ];
    const result = dedupGetters(items);
    expect(result.map((x) => x.getterName)).toEqual([
      'colorA',
      'colorB',
      'colorC',
    ]);
  });
});

describe('dedupSiblingKeys', () => {
  it('increments sibling keys under the same parent', () => {
    const used = new Map<string, Set<string>>();
    expect(dedupSiblingKeys(used, 'colors', 'bg')).toBe('bg');
    expect(dedupSiblingKeys(used, 'colors', 'bg')).toBe('bg2');
    expect(dedupSiblingKeys(used, 'typography', 'bg')).toBe('bg');
  });

  it('skips suffixes that are already taken in the parent set', () => {
    const used = new Map<string, Set<string>>();
    used.set('colors', new Set(['bg', 'bg2']));
    expect(dedupSiblingKeys(used, 'colors', 'bg')).toBe('bg3');
  });

  it('guarantees pre-reserved stable sibling key is never displaced by newly derived keys', () => {
    const used = new Map<string, Set<string>>();
    // Pass 1: Stable key 'primary' is pre-reserved
    const reservedStable = reserveSiblingKey(used, 'buttons', 'primary');
    expect(reservedStable).toBe('primary');

    // Pass 2: A newly derived key 'primary' arrives first
    const newAllocated = dedupSiblingKeys(used, 'buttons', 'primary');
    expect(newAllocated).toBe('primary2');

    // The stable key was preserved as 'primary'
    expect(reservedStable).toBe('primary');
  });
});
