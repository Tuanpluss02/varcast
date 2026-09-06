import { describe, it, expect } from 'vitest';
import {
  toHex,
  toRgbaString,
  extractVariablePreview,
  extractPaintPreview,
  extractEffectPreview,
  extractTextPreview,
} from '../../ui/preview_adapter';
import type { IRCollection, IRVariable, IRPaintStyle, IREffectStyle, IRTextStyle } from '../../ir/types';

describe('preview_adapter', () => {
  it('converts rgba to hex string correctly', () => {
    expect(toHex({ r: 1, g: 1, b: 1, a: 1 })).toBe('#FFFFFF');
    expect(toHex({ r: 0, g: 0, b: 0, a: 0.5 })).toBe('#00000080');
  });

  it('converts rgba to css string correctly', () => {
    expect(toRgbaString({ r: 1, g: 0, b: 0, a: 1 })).toBe('rgba(255, 0, 0, 1.00)');
  });

  it('extracts variable preview for color literal', () => {
    const v: IRVariable = {
      id: 'v:1',
      figmaName: 'primary/color',
      groupPath: ['primary', 'color'],
      type: 'COLOR',
      scopes: [],
      hiddenFromPublishing: false,
      emitToPublic: true,
      valuesByMode: {
        'm:1': { kind: 'literal', value: { r: 0, g: 0, b: 0, a: 1 } },
      },
    };
    const preview = extractVariablePreview(v, []);
    expect(preview.valuePreview).toBe('#000000');
    expect(preview.isAlias).toBe(false);
  });

  it('extracts paint preview for solid style', () => {
    const p: IRPaintStyle = {
      id: 'p:1',
      figmaName: 'Brand/Primary',
      groupPath: ['Brand', 'Primary'],
      type: 'SOLID',
      color: { kind: 'literal', rgba: { r: 1, g: 0, b: 0, a: 1 } },
    };
    const preview = extractPaintPreview(p, []);
    expect(preview.colorHex).toBe('#FF0000');
  });

  it('extracts effect preview for drop shadow', () => {
    const e: IREffectStyle = {
      id: 'e:1',
      figmaName: 'Shadow/SM',
      groupPath: ['Shadow', 'SM'],
      type: 'DROP_SHADOW',
      color: { kind: 'literal', rgba: { r: 0, g: 0, b: 0, a: 0.25 } },
      offsetX: 0,
      offsetY: 2,
      blurRadius: 4,
      spreadRadius: 0,
    };
    const preview = extractEffectPreview(e, []);
    expect(preview.boxShadowCss).toContain('0px 2px 4px 0px');
  });

  it('extracts text preview for text style', () => {
    const t: IRTextStyle = {
      id: 't:1',
      figmaName: 'Header/H1',
      groupPath: ['Header', 'H1'],
      fontFamily: { kind: 'literal', value: 'Inter' },
      fontSize: { kind: 'literal', value: 32 },
      fontWeight: { kind: 'literal', value: 700 },
      letterSpacing: { kind: 'literal', value: 0, unit: 'PIXELS' },
      lineHeight: { kind: 'literal', value: 40, unit: 'PIXELS' },
    };
    const preview = extractTextPreview(t, []);
    expect(preview.fontFamily).toBe('Inter');
    expect(preview.fontSize).toBe(32);
    expect(preview.fontWeight).toBe(700);
  });
});
