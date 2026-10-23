import { describe, it, expect } from 'vitest';
import {
  isKotlinReserved,
  escapeKotlinIdentifier,
  sanitizePackageName,
  sanitizeKotlinIdentifier,
  collectionClassName,
  collectionFileName,
} from '../../../targets/compose/identifier';
import {
  DEFAULT_COMPOSE_OPTIONS,
  normalizeComposeOptions,
} from '../../../targets/compose/options';

describe('Compose Identifier Sanitization', () => {
  it('detects Kotlin reserved keywords', () => {
    expect(isKotlinReserved('val')).toBe(true);
    expect(isKotlinReserved('fun')).toBe(true);
    expect(isKotlinReserved('when')).toBe(true);
    expect(isKotlinReserved('package')).toBe(true);
    expect(isKotlinReserved('primary')).toBe(false);
  });

  it('escapes reserved keywords with backticks or suffixes', () => {
    expect(escapeKotlinIdentifier('val')).toBe('`val`');
    expect(escapeKotlinIdentifier('when')).toBe('`when`');
    expect(escapeKotlinIdentifier('primary')).toBe('primary');
  });

  it('sanitizes package names into valid dot-separated Kotlin packages', () => {
    expect(sanitizePackageName('My-Company.Design_System')).toBe('my_company.design_system');
    expect(sanitizePackageName('...invalid..pkg...')).toBe('invalid.pkg');
    expect(sanitizePackageName('')).toBe('com.example.designsystem');
    expect(sanitizePackageName('   ')).toBe('com.example.designsystem');
  });

  it('sanitizes general identifiers and escapes keyword collisions', () => {
    expect(sanitizeKotlinIdentifier('primary-color', 'camel')).toBe('primaryColor');
    expect(sanitizeKotlinIdentifier('val', 'camel')).toBe('`val`');
    expect(sanitizeKotlinIdentifier('[1] Color-Basic', 'pascal')).toBe('ColorBasic');
  });

  it('generates idiomatic collection class and file names', () => {
    expect(collectionClassName('[1] Color-Tokens')).toBe('ColorTokens');
    expect(collectionFileName('[1] Color-Tokens')).toBe('color_tokens');
  });

  it('normalizes compose options correctly with defaults and overrides', () => {
    const defaults = normalizeComposeOptions();
    expect(defaults).toEqual(DEFAULT_COMPOSE_OPTIONS);
    expect(defaults.packageName).toBe('com.example.designsystem');
    expect(defaults.include.primitives).toBe(true);
    expect(defaults.include.composites.colorStyles).toBe(true);

    const customized = normalizeComposeOptions({
      packageName: 'org.acme.design-tokens',
      include: {
        primitives: false,
        composites: {
          shadows: false,
        },
      },
    });
    expect(customized.packageName).toBe('org.acme.design_tokens');
    expect(customized.include.primitives).toBe(false);
    expect(customized.include.tokens).toBe(true);
    expect(customized.include.composites.shadows).toBe(false);
    expect(customized.include.composites.colorStyles).toBe(true);
  });
});
