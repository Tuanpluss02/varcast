import type { RGBA } from '../../ir/types';
import type { TypeMapping } from '../../core/target';

function clamp01(n: number): number {
  return n < 0 ? 0 : n > 1 ? 1 : n;
}

function hex2(v: number): string {
  return Math.round(clamp01(v) * 255)
    .toString(16)
    .padStart(2, '0')
    .toUpperCase();
}

export function rgbaToRRGGBBAA(rgba: RGBA): string {
  return `#${hex2(rgba.r)}${hex2(rgba.g)}${hex2(rgba.b)}${hex2(rgba.a)}`;
}

export const reactNativeTypeMapping: TypeMapping = {
  color: 'string',
  number: 'number',
  string: 'string',
  bool: 'boolean',
  literalColor(rgba: RGBA): string {
    return JSON.stringify(rgbaToRRGGBBAA(rgba));
  },
  literalNumber(n: number): string {
    return Number.isFinite(n) ? String(n) : '0';
  },
  literalString(s: string): string {
    return JSON.stringify(s);
  },
  literalBool(b: boolean): string {
    return b ? 'true' : 'false';
  },
};

