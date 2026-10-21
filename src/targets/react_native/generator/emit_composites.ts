import type { EmittedFile } from '../../../core/target';
import type {
  PreparedRN,
  PreparedRNEffectStyle,
  PreparedRNPaintStyle,
  PreparedRNTextStyle,
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
    if (s.type === 'SOLID') {
      const byMode: Record<string, string | null> = {};
      for (const mode of prepared.modes) {
        const modeVal = s.valuesByMode[mode.id] ?? s.valuesByMode[mode.key];
        byMode[mode.key] = modeVal?.hex ?? null;
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
    if (s.raw.type === 'DROP_SHADOW') {
      const r = s.raw;
      const byMode: Record<string, unknown> = {};
      for (const mode of prepared.modes) {
        const modeVal = s.valuesByMode[mode.id] ?? s.valuesByMode[mode.key];
        const hex = modeVal?.shadowColor ?? null;
        const opacity = modeVal ? modeVal.opacity : (hex ? alphaFromHex(hex) : 1);
        byMode[mode.key] = {
          shadowColor: hex ?? '#00000000',
          shadowOffset: {
            width: modeVal?.offsetX ?? r.offsetX,
            height: modeVal?.offsetY ?? r.offsetY,
          },
          shadowRadius: modeVal?.blurRadius ?? r.blurRadius,
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
    const byMode: Record<string, Record<string, string | number>> = {};
    for (const mode of prepared.modes) {
      const modeVal = s.valuesByMode[mode.id] ?? s.valuesByMode[mode.key];
      const style: Record<string, string | number> = {};

      if (modeVal) {
        if (modeVal.fontFamily != null) {
          style.fontFamily = modeVal.fontFamily;
        }
        if (modeVal.fontSize != null) {
          style.fontSize = modeVal.fontSize;
        }
        if (modeVal.fontWeight != null) {
          const numWeight = parseFloat(modeVal.fontWeight);
          style.fontWeight = Number.isFinite(numWeight)
            ? String(Math.round(numWeight))
            : modeVal.fontWeight;
        }

        const fsForPercent = modeVal.fontSize ?? 16;
        const lh = modeVal.lineHeight;
        if (lh) {
          if (lh.unit === 'PIXELS') {
            style.lineHeight = lh.value;
          } else if (lh.unit === 'PERCENT') {
            style.lineHeight = (lh.value / 100) * fsForPercent;
          }
        }

        const ls = modeVal.letterSpacing;
        if (ls) {
          if (ls.unit === 'PIXELS') {
            style.letterSpacing = ls.value;
          } else if (ls.unit === 'PERCENT') {
            style.letterSpacing = (ls.value / 100) * fsForPercent;
          }
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
