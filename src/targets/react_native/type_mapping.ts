import type { RGBA } from '../../ir/types';

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
