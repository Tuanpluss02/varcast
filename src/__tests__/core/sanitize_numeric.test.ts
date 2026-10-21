import { describe, it, expect } from 'vitest';
import { stripOrderingPrefix, processSegment, sanitizeWords } from '../../core/sanitize_base';
import { sanitizeIdentifier } from '../../targets/flutter/identifier';
import { sanitizeJsIdentifier } from '../../targets/react_native/identifier';

describe('Domain-Driven Sanitization', () => {
  it('strips ordering prefix only for collection names', () => {
    expect(stripOrderingPrefix('[1] Color-Basic')).toBe('Color-Basic');
    expect(stripOrderingPrefix('01. Typography')).toBe('Typography');
    expect(stripOrderingPrefix('02 - Spacing')).toBe('Spacing');
    expect(stripOrderingPrefix('Normal Collection')).toBe('Normal Collection');
  });

  it('preserves numeric tokens without dropping digits', () => {
    expect(sanitizeWords('100 Primary')).toEqual(['100', 'primary']);
    expect(sanitizeWords('400 Regular')).toEqual(['400', 'regular']);
    expect(sanitizeWords('12 Spacing')).toEqual(['12', 'spacing']);
    expect(sanitizeWords('Regular 400')).toEqual(['regular', '400']);
  });

  it('formats camelCase safely with leading digits prefixed with n', () => {
    expect(sanitizeIdentifier('100 Primary', 'camel')).toBe('n100Primary');
    expect(sanitizeIdentifier('400 Regular', 'camel')).toBe('n400Regular');
    expect(sanitizeIdentifier('Regular 400', 'camel')).toBe('regular400');
    expect(sanitizeJsIdentifier('100 Primary')).toBe('n100Primary');
  });
});
