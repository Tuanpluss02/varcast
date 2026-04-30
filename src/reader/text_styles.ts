import type {
  IRTextStyle,
  IRTextValue,
  IRTextValueWithUnit,
} from '../ir/types';

type BoundVarMap = Record<string, VariableAlias>;

// Reads all local TextStyles. Variable-bound fields stay as `{ kind: 'alias' }`;
// otherwise the literal value plus its unit (lineHeight / letterSpacing) is
// preserved so the generator can emit the correct Flutter conversion.
export async function readTextStyles(): Promise<IRTextStyle[]> {
  const styles = await figma.getLocalTextStylesAsync();
  return styles.map(buildTextStyle);
}

function buildTextStyle(style: TextStyle): IRTextStyle {
  const bv = ((style as { boundVariables?: BoundVarMap }).boundVariables ?? {}) as BoundVarMap;

  const lh = style.lineHeight as LineHeight;
  const lineHeight: IRTextValueWithUnit<number> = bv['lineHeight']
    ? { kind: 'alias', targetVariableId: bv['lineHeight'].id }
    : lh.unit === 'AUTO'
      ? { kind: 'literal', value: 0, unit: 'AUTO' }
      : { kind: 'literal', value: lh.value, unit: lh.unit };

  const ls = style.letterSpacing as LetterSpacing;
  const letterSpacing: IRTextValueWithUnit<number> = bv['letterSpacing']
    ? { kind: 'alias', targetVariableId: bv['letterSpacing'].id }
    : { kind: 'literal', value: ls.value, unit: ls.unit };

  return {
    id: style.id,
    figmaName: style.name,
    dartName: style.name,
    groupPath: style.name.split('/').map((s) => s.trim()),
    fontFamily: textVal<string>(bv, 'fontFamily', style.fontName.family),
    fontSize: textVal<number>(bv, 'fontSize', style.fontSize),
    fontWeight: textVal<number>(bv, 'fontWeight', style.fontName.style ? styleNameToWeight(style.fontName.style) : 400),
    lineHeight,
    letterSpacing,
  };
}

function textVal<T>(bv: BoundVarMap, key: string, fallback: T): IRTextValue<T> {
  return bv[key]
    ? { kind: 'alias', targetVariableId: bv[key].id }
    : { kind: 'literal', value: fallback };
}

// Best-effort numeric weight from font style names. Designers commonly use
// "Regular", "Medium", "Bold" etc.; map them to canonical CSS weights.
const STYLE_WEIGHT_MAP: Record<string, number> = {
  thin: 100,
  hairline: 100,
  extralight: 200,
  ultralight: 200,
  light: 300,
  regular: 400,
  normal: 400,
  book: 400,
  medium: 500,
  semibold: 600,
  demibold: 600,
  bold: 700,
  extrabold: 800,
  ultrabold: 800,
  black: 900,
  heavy: 900,
};

function styleNameToWeight(name: string): number {
  const key = name.replace(/\s+/g, '').toLowerCase();
  for (const [token, weight] of Object.entries(STYLE_WEIGHT_MAP)) {
    if (key.includes(token)) return weight;
  }
  return 400;
}
