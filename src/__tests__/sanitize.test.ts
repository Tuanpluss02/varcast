import { describe, it, expect } from 'vitest';
import {
  sanitize,
  sanitizeIdentifier,
  newSanitizeContext,
  toPascalCase,
  toCamelCase,
} from '../sanitize';

describe('sanitize', () => {
  it('splits Figma path into PascalCase groups + camelCase leaf', () => {
    const r = sanitize(['Background', 'Primary'], newSanitizeContext());
    expect(r.groupPath).toEqual(['Background']);
    expect(r.leafName).toBe('primary');
  });

  it('numeric-only leaf gets prepended n', () => {
    const r = sanitize(['neutral', '900'], newSanitizeContext());
    expect(r.leafName).toBe('n900');
  });

  it('reserved keyword leaf gets trailing underscore', () => {
    const r = sanitize(['Border', 'default'], newSanitizeContext());
    expect(r.leafName).toBe('default_');
  });

  it('strips brackets and dashes from collection-style names', () => {
    expect(sanitizeIdentifier('[1] Color-Basic')).toBe('ColorBasic');
    expect(sanitizeIdentifier('[2] Color-Token')).toBe('ColorToken');
    expect(sanitizeIdentifier('Font-Weight')).toBe('FontWeight');
  });

  it('Vietnamese diacritics → ASCII', () => {
    expect(sanitizeIdentifier('Mặc định', 'camel')).toBe('macDinh');
    expect(sanitizeIdentifier('Đỏ', 'pascal')).toBe('Do');
  });

  it('camelCase mode names', () => {
    expect(sanitizeIdentifier('Dark Mode', 'camel')).toBe('darkMode');
    expect(sanitizeIdentifier('Light Mode', 'camel')).toBe('lightMode');
    expect(sanitizeIdentifier('Mode 1', 'camel')).toBe('mode1');
    expect(sanitizeIdentifier('Sans Serif', 'camel')).toBe('sansSerif');
    expect(sanitizeIdentifier('Value', 'camel')).toBe('value');
  });

  it('dedup within same parent group (within one ctx)', () => {
    const ctx = newSanitizeContext();
    const a = sanitize(['Background', 'primary'], ctx);
    const b = sanitize(['Background', 'primary'], ctx);
    const c = sanitize(['Background', 'primary'], ctx);
    expect(a.leafName).toBe('primary');
    expect(b.leafName).toBe('primary_2');
    expect(c.leafName).toBe('primary_3');
  });

  it('dedup is scoped per parent — siblings under different groups OK', () => {
    const ctx = newSanitizeContext();
    const a = sanitize(['Background', 'primary'], ctx);
    const b = sanitize(['Action', 'primary'], ctx);
    expect(a.leafName).toBe('primary');
    expect(b.leafName).toBe('primary');
  });

  it('PascalCase splits camelCase input correctly', () => {
    expect(toPascalCase('lightMode')).toBe('LightMode');
    expect(toPascalCase('sansSerif')).toBe('SansSerif');
    expect(toPascalCase('font weight')).toBe('FontWeight');
  });

  it('camelCase preserves digits attached to leaf prefix', () => {
    expect(toCamelCase('mode 1')).toBe('mode1');
    expect(toCamelCase('h4')).toBe('h4');
  });

  it('symbol-only segment falls back to "unnamed"', () => {
    const r = sanitize(['$$$'], newSanitizeContext());
    expect(r.leafName).toBe('unnamed');
  });
});
