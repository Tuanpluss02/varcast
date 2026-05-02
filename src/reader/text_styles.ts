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

  const lineHeight = readLineHeight(style, bv);
  const letterSpacing = readLetterSpacing(style, bv);

  const fontName = (style.fontName ?? {}) as Partial<FontName>;
  const family = typeof fontName.family === 'string' ? fontName.family : '';
  const styleStr = typeof fontName.style === 'string' ? fontName.style : '';
  // Prefer Figma's explicit numeric weight when present, otherwise infer from
  // the style name. Both `style.fontWeight` (some plugin API versions) and
  // `style.fontName.style` are best-effort sources.
  const explicitWeight = (style as { fontWeight?: unknown }).fontWeight;
  const fallbackWeight =
    typeof explicitWeight === 'number' && Number.isFinite(explicitWeight)
      ? explicitWeight
      : styleStr
        ? styleNameToWeight(styleStr)
        : 400;
  const fontSize = typeof style.fontSize === 'number' ? style.fontSize : 0;

  return {
    id: style.id,
    figmaName: style.name,
    groupPath: String(style.name)
      .split('/')
      .map((s: string) => s.trim())
      .filter((s: string) => s.length > 0),
    fontFamily: textVal<string>(bv, 'fontFamily', family),
    fontSize: textVal<number>(bv, 'fontSize', fontSize),
    fontWeight: textVal<number>(bv, 'fontWeight', fallbackWeight),
    lineHeight,
    letterSpacing,
  };
}

function readLineHeight(
  style: TextStyle,
  bv: BoundVarMap,
): IRTextValueWithUnit<number> {
  if (bv['lineHeight']) {
    return { kind: 'alias', targetVariableId: bv['lineHeight'].id };
  }
  const lh = style.lineHeight as Partial<LineHeight> | undefined;
  if (!lh || lh.unit === 'AUTO') {
    return { kind: 'literal', value: 0, unit: 'AUTO' };
  }
  const value = typeof lh.value === 'number' && Number.isFinite(lh.value) ? lh.value : 0;
  const unit = lh.unit === 'PIXELS' || lh.unit === 'PERCENT' ? lh.unit : 'AUTO';
  if (unit === 'AUTO') return { kind: 'literal', value: 0, unit: 'AUTO' };
  return { kind: 'literal', value, unit };
}

function readLetterSpacing(
  style: TextStyle,
  bv: BoundVarMap,
): IRTextValueWithUnit<number> {
  if (bv['letterSpacing']) {
    return { kind: 'alias', targetVariableId: bv['letterSpacing'].id };
  }
  const ls = style.letterSpacing as Partial<LetterSpacing> | undefined;
  if (!ls) return { kind: 'literal', value: 0, unit: 'PIXELS' };
  const value = typeof ls.value === 'number' && Number.isFinite(ls.value) ? ls.value : 0;
  // letterSpacing in Figma is PIXELS or PERCENT — never AUTO. Default to PIXELS
  // if the runtime hands us something unexpected.
  const unit = ls.unit === 'PERCENT' ? 'PERCENT' : 'PIXELS';
  return { kind: 'literal', value, unit };
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
