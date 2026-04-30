import type { IREffectStyle, IRColorValue, RGBA } from '../ir/types';

// Reads all local EffectStyles. Each effect within a style becomes one IR entry,
// so a "Card / Elevated" style with two drop shadows yields two IR entries that
// share style.id and style.name — Phase 3/4 dedupes leaf names if needed.
export async function readEffectStyles(): Promise<IREffectStyle[]> {
  const styles = await figma.getLocalEffectStylesAsync();
  const out: IREffectStyle[] = [];
  for (const style of styles) {
    for (const effect of style.effects) {
      const built = buildEffect(style, effect);
      if (built) out.push(built);
    }
  }
  return out;
}

function buildEffect(style: EffectStyle, effect: Effect): IREffectStyle | null {
  const base = {
    id: style.id,
    figmaName: style.name,
    dartName: style.name,
    groupPath: style.name.split('/').map((s) => s.trim()),
  };

  switch (effect.type) {
    case 'DROP_SHADOW': {
      const e = effect as DropShadowEffect;
      return {
        ...base,
        type: 'DROP_SHADOW',
        color: shadowColor(e),
        offsetX: e.offset.x,
        offsetY: e.offset.y,
        blurRadius: e.radius,
        spreadRadius: e.spread ?? 0,
      };
    }
    case 'INNER_SHADOW': {
      const e = effect as InnerShadowEffect;
      return {
        ...base,
        type: 'INNER_SHADOW',
        color: shadowColor(e),
        offsetX: e.offset.x,
        offsetY: e.offset.y,
        blurRadius: e.radius,
        spreadRadius: e.spread ?? 0,
      };
    }
    case 'LAYER_BLUR':
      return {
        ...base,
        type: 'LAYER_BLUR',
        sigmaX: effect.radius,
        sigmaY: effect.radius,
      };
    case 'BACKGROUND_BLUR':
      return {
        ...base,
        type: 'BACKGROUND_BLUR',
        sigmaX: effect.radius,
        sigmaY: effect.radius,
      };
    default:
      return null;
  }
}

function shadowColor(e: DropShadowEffect | InnerShadowEffect): IRColorValue {
  const binding = (e as { boundVariables?: Record<string, VariableAlias> })
    .boundVariables?.['color'];
  if (binding) {
    return { kind: 'alias', targetVariableId: binding.id };
  }
  return { kind: 'literal', rgba: e.color as RGBA };
}
