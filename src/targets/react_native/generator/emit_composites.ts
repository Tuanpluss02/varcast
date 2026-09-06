import type { EmittedFile } from '../../../core/target';
import type {
  PreparedRN,
  PreparedRNEffectStyle,
  PreparedRNPaintStyle,
  PreparedRNTextStyle,
} from './prepare';
import {
  resolveColorValueToHex,
  resolveTextValue,
  resolveTextValueWithUnit,
} from './prepare';

export function emitComposites(prepared: PreparedRN): EmittedFile[] {
  const colorStyles = emitColorStyles(prepared.paintStyles, prepared);
  const shadows = emitShadows(prepared.effectStyles, prepared);
  const textStyles = emitTextStyles(prepared.textStyles, prepared);

  return [
    { path: 'src/composites/colorStyles.ts', contents: colorStyles },
    { path: 'src/composites/shadows.ts', contents: shadows },
    { path: 'src/composites/textStyles.ts', contents: textStyles },
  ];
}

function emitColorStyles(styles: PreparedRNPaintStyle[], prepared: PreparedRN): string {
  const out: { solid: Record<string, Record<string, string | null>>; unsupported: Record<string, { type: string }> } = {
    solid: {},
    unsupported: {},
  };
  for (const s of styles) {
    const r = s.raw;
    if (r.type === 'SOLID') {
      const byMode: Record<string, string | null> = {};
      for (const mode of prepared.modes) {
        const hex = resolveColorValueToHex(mode.id, r.color, prepared.resolvedVarByMode);
        byMode[mode.key] = hex;
      }
      out.solid[s.getterName] = byMode;
    } else {
      out.unsupported[s.getterName] = { type: s.type };
    }
  }

  return [
    '// GENERATED FILE — do not edit by hand.',
    '',
    'export const colorStyles = ' + JSON.stringify(out, null, 2) + ' as const;',
    '',
  ].join('\n');
}

function emitShadows(styles: PreparedRNEffectStyle[], prepared: PreparedRN): string {
  const out: { drop: Record<string, Record<string, unknown>>; unsupported: Record<string, { type: string }> } = {
    drop: {},
    unsupported: {},
  };

  for (const s of styles) {
    const r = s.raw;
    if (r.type === 'DROP_SHADOW') {
      const byMode: Record<string, unknown> = {};
      for (const mode of prepared.modes) {
        const hex = resolveColorValueToHex(mode.id, r.color, prepared.resolvedVarByMode);
        const opacity = hex ? alphaFromHex(hex) : 1;
        byMode[mode.key] = {
          shadowColor: hex ?? '#00000000',
          shadowOffset: { width: r.offsetX, height: r.offsetY },
          shadowRadius: r.blurRadius,
          shadowOpacity: opacity,
          elevation: 0,
        };
      }
      out.drop[s.getterName] = byMode;
    } else {
      out.unsupported[s.getterName] = { type: s.type };
    }
  }

  return [
    '// GENERATED FILE — do not edit by hand.',
    '',
    'export const shadows = ' + JSON.stringify(out, null, 2) + ' as const;',
    '',
  ].join('\n');
}

function emitTextStyles(styles: PreparedRNTextStyle[], prepared: PreparedRN): string {
  const out: Record<string, Record<string, Record<string, Record<string, string | number>>>> = {};

  for (const s of styles) {
    const r = s.raw;
    const byMode: Record<string, Record<string, string | number>> = {};
    for (const mode of prepared.modes) {
      const fontFamily = resolveTextValue<string>(mode.id, r.fontFamily, prepared.resolvedVarByMode);
      const fontSize = resolveTextValue<number>(mode.id, r.fontSize, prepared.resolvedVarByMode);
      const fontWeight = resolveTextValue<number>(mode.id, r.fontWeight, prepared.resolvedVarByMode);
      const lh = resolveTextValueWithUnit(mode.id, r.lineHeight, prepared.resolvedVarByMode);
      const ls = resolveTextValueWithUnit(mode.id, r.letterSpacing, prepared.resolvedVarByMode);

      const style: Record<string, string | number> = {};
      if (fontFamily != null) style.fontFamily = fontFamily;
      if (fontSize != null) style.fontSize = fontSize;
      if (fontWeight != null) style.fontWeight = String(Math.round(fontWeight));

      const fsForPercent = fontSize ?? 16;
      if (lh) {
        if (lh.unit === 'PIXELS') {
          style.lineHeight = lh.value;
        } else if (lh.unit === 'PERCENT') {
          style.lineHeight = (lh.value / 100) * fsForPercent;
        }
      }
      if (ls) {
        if (ls.unit === 'PIXELS') {
          style.letterSpacing = ls.value;
        } else if (ls.unit === 'PERCENT') {
          style.letterSpacing = (ls.value / 100) * fsForPercent;
        }
      }

      byMode[mode.key] = style;
    }

    if (!out[s.groupName]) out[s.groupName] = {};
    out[s.groupName][s.getterName] = byMode;
  }

  return [
    '// GENERATED FILE — do not edit by hand.',
    '',
    'export const textStyles = ' + JSON.stringify(out, null, 2) + ' as const;',
    '',
  ].join('\n');
}

function alphaFromHex(hex: string): number {
  if (!hex || hex[0] !== '#' || hex.length !== 9) return 1;
  const aa = parseInt(hex.slice(7, 9), 16);
  if (!Number.isFinite(aa)) return 1;
  return Math.round((aa / 255) * 1000) / 1000;
}
