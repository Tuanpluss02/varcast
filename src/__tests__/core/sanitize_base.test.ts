import { describe, it, expect } from 'vitest';
import {
  sanitizeWords,
  processSegment,
  splitWords,
  stripOrderingPrefix,
  toCamelCase,
  toPascalCase,
  toSnakeCase,
  toKebabCase,
} from '../../core/sanitize_base';
import { deduplicateSiblingName } from '../../core/graph/group_tree';

describe('Sanitize Base Numeric Segments', () => {
  it('handles isolated numeric segments consistently', () => {
    // Both single number and leading numbers should produce safe identifier words
    const w1 = sanitizeWords('100');
    const w2 = sanitizeWords('100 200');
    expect(w1.length).toBeGreaterThan(0);
    expect(w2.length).toBeGreaterThan(0);
  });

  it('preserves all numbers in multi-numeric segments without unexpected dropping', () => {
    const processed = processSegment('100 200');
    expect(processed).toBe('n100 200');
    expect(toCamelCase(processed)).toBe('n100200');
    expect(toPascalCase(processed)).toBe('N100200');
    expect(toSnakeCase(processed)).toBe('n_100_200');
    expect(toKebabCase(processed)).toBe('n-100-200');
    expect(sanitizeWords('100 200')).toEqual(['100', '200']);
  });

  it('preserves triple numeric segments without dropping words', () => {
    const processed = processSegment('100 200 300');
    expect(processed).toBe('n100 200 300');
    expect(sanitizeWords('100 200 300')).toEqual(['100', '200', '300']);
  });

  it('preserves single numeric segment with n-prefix', () => {
    const processed = processSegment('100');
    expect(processed).toBe('n100');
    expect(toCamelCase(processed)).toBe('n100');
    expect(toPascalCase(processed)).toBe('N100');
    expect(sanitizeWords('100')).toEqual(['100']);
  });

  it('strips leading numeric ordering prefix with stripOrderingPrefix', () => {
    const stripped = stripOrderingPrefix('[1] Color-Basic');
    const processed = processSegment(stripped);
    expect(processed).toBe('Color Basic');
    expect(toPascalCase(processed)).toBe('ColorBasic');
    expect(toCamelCase(processed)).toBe('colorBasic');
    expect(sanitizeWords(stripped)).toEqual(['color', 'basic']);
  });

  it('handles empty, symbol-only, and diacritic segments', () => {
    expect(processSegment('')).toBe('unnamed');
    expect(processSegment('$$$')).toBe('unnamed');
    expect(processSegment('Đỏ')).toBe('Do');
    expect(sanitizeWords('Mặc định')).toEqual(['mac', 'dinh']);
  });
});

describe('GroupTree Dedup Unification', () => {
  it('deduplicates sibling name against Set and Map using suffix 2, 3...', () => {
    const existingSet = new Set(['primary']);
    expect(deduplicateSiblingName('primary', existingSet)).toBe('primary2');
    expect(deduplicateSiblingName('secondary', existingSet)).toBe('secondary');

    const existingMap = new Map([['primary', true], ['primary2', true]]);
    expect(deduplicateSiblingName('primary', existingMap)).toBe('primary3');
  });

  it('does not mutate the passed existing names collection', () => {
    const set = new Set(['title']);
    const result = deduplicateSiblingName('title', set);
    expect(result).toBe('title2');
    expect(set.has('title2')).toBe(false);
  });
});
