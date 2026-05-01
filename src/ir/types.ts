// Intermediate Representation types — the contract between reader and generator.
// Reader writes IR; generator reads IR. No other code should hand-roll these shapes.

export interface IR {
  version: '1.0';
  fileKey: string;
  generatedAt: string;
  collections: IRCollection[];
  composites: IRComposites;
}

export interface IRCollection {
  id: string;
  /** Raw Figma name. Targets derive their own class/type name from this. */
  name: string;
  kind: 'primitive' | 'token';
  modes: IRMode[];
  variables: IRVariable[];
}

export interface IRMode {
  id: string;
  /** Raw Figma mode name. Targets derive their own enum case from this. */
  name: string;
}

export interface IRVariable {
  id: string;
  /** Raw Figma name (with `/` separators). */
  figmaName: string;
  /** `figmaName.split('/')`, trimmed. Targets sanitize per their own rules. */
  groupPath: string[];
  type: 'COLOR' | 'FLOAT' | 'STRING' | 'BOOLEAN';
  scopes: VariableScope[];
  hiddenFromPublishing: boolean;
  emitToPublic: boolean;
  valuesByMode: Record<string, IRValue>;
}

export type IRValue =
  | { kind: 'literal'; value: RGBA | number | string | boolean }
  | { kind: 'alias'; targetVariableId: string };

export interface RGBA {
  r: number;
  g: number;
  b: number;
  a: number;
}

export type VariableScope =
  | 'ALL_FILLS'
  | 'FILL_COLOR'
  | 'STROKE_COLOR'
  | 'EFFECT_COLOR'
  | 'CORNER_RADIUS'
  | 'WIDTH_HEIGHT'
  | 'GAP'
  | 'OPACITY'
  | 'FONT_FAMILY'
  | 'FONT_SIZE'
  | 'FONT_WEIGHT'
  | 'FONT_STYLE'
  | 'LINE_HEIGHT'
  | 'LETTER_SPACING'
  | 'PARAGRAPH_SPACING'
  | 'PARAGRAPH_INDENT'
  | 'TEXT_CONTENT'
  | 'EFFECT_FLOAT'
  | 'ALL_SCOPES';

export interface IRComposites {
  paintStyles: IRPaintStyle[];
  effectStyles: IREffectStyle[];
  textStyles: IRTextStyle[];
}

// ── Paint styles ────────────────────────────────────────────────────────────

export type IRPaintStyle =
  | IRSolid
  | IRGradientLinear
  | IRGradientRadial
  | IRGradientAngular
  | IRGradientDiamond
  | IRImage;

export interface IRPaintStyleBase {
  id: string;
  figmaName: string;
  groupPath: string[];
}

export interface IRSolid extends IRPaintStyleBase {
  type: 'SOLID';
  color: IRColorValue;
}

export interface IRGradientLinear extends IRPaintStyleBase {
  type: 'GRADIENT_LINEAR';
  angleRadians: number;
  stops: IRGradientStop[];
}

export interface IRGradientRadial extends IRPaintStyleBase {
  type: 'GRADIENT_RADIAL';
  center: { x: number; y: number };
  radius: number;
  stops: IRGradientStop[];
}

export interface IRGradientAngular extends IRPaintStyleBase {
  type: 'GRADIENT_ANGULAR';
  startAngle: number;
  endAngle: number;
  stops: IRGradientStop[];
}

export interface IRGradientDiamond extends IRPaintStyleBase {
  type: 'GRADIENT_DIAMOND';
  stops: IRGradientStop[];
  note: 'approximated_as_radial';
}

export interface IRImage extends IRPaintStyleBase {
  type: 'IMAGE';
  assetName: string;
}

export interface IRGradientStop {
  position: number;
  color: IRColorValue;
}

export type IRColorValue =
  | { kind: 'literal'; rgba: RGBA }
  | { kind: 'alias'; targetVariableId: string };

// ── Effect styles ───────────────────────────────────────────────────────────

export type IREffectStyle =
  | IRDropShadow
  | IRInnerShadow
  | IRLayerBlur
  | IRBackgroundBlur;

export interface IREffectStyleBase {
  id: string;
  figmaName: string;
  groupPath: string[];
}

export interface IRDropShadow extends IREffectStyleBase {
  type: 'DROP_SHADOW';
  color: IRColorValue;
  offsetX: number;
  offsetY: number;
  blurRadius: number;
  spreadRadius: number;
}

export interface IRInnerShadow extends IREffectStyleBase {
  type: 'INNER_SHADOW';
  color: IRColorValue;
  offsetX: number;
  offsetY: number;
  blurRadius: number;
  spreadRadius: number;
}

export interface IRLayerBlur extends IREffectStyleBase {
  type: 'LAYER_BLUR';
  sigmaX: number;
  sigmaY: number;
}

export interface IRBackgroundBlur extends IREffectStyleBase {
  type: 'BACKGROUND_BLUR';
  sigmaX: number;
  sigmaY: number;
}

// ── Text styles ─────────────────────────────────────────────────────────────

export interface IRTextStyle {
  id: string;
  figmaName: string;
  groupPath: string[];
  fontFamily: IRTextValue<string>;
  fontSize: IRTextValue<number>;
  fontWeight: IRTextValue<number>;
  lineHeight: IRTextValueWithUnit<number>;
  letterSpacing: IRTextValueWithUnit<number>;
}

export type IRTextValue<T> =
  | { kind: 'literal'; value: T }
  | { kind: 'alias'; targetVariableId: string };

export type IRTextValueWithUnit<T> =
  | { kind: 'literal'; value: T; unit: 'PIXELS' | 'PERCENT' | 'AUTO' }
  | { kind: 'alias'; targetVariableId: string };
