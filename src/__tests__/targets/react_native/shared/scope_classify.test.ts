import { describe, expect, it } from 'vitest';
import { tailwindBucketFor } from '../../../../targets/react_native/shared/scope_classify';

describe('tailwindBucketFor', () => {
  it('classifies COLOR by type alone, ignoring scopes', () => {
    expect(tailwindBucketFor({ type: 'COLOR', scopes: [] })).toBe('colors');
    expect(tailwindBucketFor({ type: 'COLOR', scopes: ['ALL_SCOPES'] })).toBe('colors');
    expect(tailwindBucketFor({ type: 'COLOR', scopes: ['FILL_COLOR'] })).toBe('colors');
  });

  it('classifies STRING + FONT_FAMILY → fontFamily; other STRING → null', () => {
    expect(tailwindBucketFor({ type: 'STRING', scopes: ['FONT_FAMILY'] })).toBe('fontFamily');
    expect(tailwindBucketFor({ type: 'STRING', scopes: [] })).toBeNull();
    expect(tailwindBucketFor({ type: 'STRING', scopes: ['ALL_SCOPES'] })).toBeNull();
  });

  it('returns null for FLOAT with empty or ALL_SCOPES (no information)', () => {
    expect(tailwindBucketFor({ type: 'FLOAT', scopes: [] })).toBeNull();
    expect(tailwindBucketFor({ type: 'FLOAT', scopes: ['ALL_SCOPES'] })).toBeNull();
  });

  it('maps each FLOAT scope to its bucket', () => {
    expect(tailwindBucketFor({ type: 'FLOAT', scopes: ['CORNER_RADIUS'] })).toBe('borderRadius');
    expect(tailwindBucketFor({ type: 'FLOAT', scopes: ['FONT_SIZE'] })).toBe('fontSize');
    expect(tailwindBucketFor({ type: 'FLOAT', scopes: ['LINE_HEIGHT'] })).toBe('lineHeight');
    expect(tailwindBucketFor({ type: 'FLOAT', scopes: ['LETTER_SPACING'] })).toBe('letterSpacing');
    expect(tailwindBucketFor({ type: 'FLOAT', scopes: ['FONT_WEIGHT'] })).toBe('fontWeight');
    expect(tailwindBucketFor({ type: 'FLOAT', scopes: ['OPACITY'] })).toBe('opacity');
    expect(tailwindBucketFor({ type: 'FLOAT', scopes: ['GAP'] })).toBe('spacing');
    expect(tailwindBucketFor({ type: 'FLOAT', scopes: ['WIDTH_HEIGHT'] })).toBe('spacing');
  });

  it('prefers the most specific scope when multiple are present', () => {
    expect(
      tailwindBucketFor({ type: 'FLOAT', scopes: ['CORNER_RADIUS', 'GAP'] }),
    ).toBe('borderRadius');
    expect(
      tailwindBucketFor({ type: 'FLOAT', scopes: ['FONT_SIZE', 'WIDTH_HEIGHT'] }),
    ).toBe('fontSize');
  });

  it('returns null for unmappable FLOAT scopes', () => {
    expect(tailwindBucketFor({ type: 'FLOAT', scopes: ['EFFECT_FLOAT'] })).toBeNull();
    expect(tailwindBucketFor({ type: 'FLOAT', scopes: ['PARAGRAPH_SPACING'] })).toBeNull();
  });

  it('returns null for BOOLEAN regardless of scopes', () => {
    expect(tailwindBucketFor({ type: 'BOOLEAN', scopes: ['OPACITY'] })).toBeNull();
    expect(tailwindBucketFor({ type: 'BOOLEAN', scopes: [] })).toBeNull();
  });
});
