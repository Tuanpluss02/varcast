import type {
  IRColorValue,
  IREffectStyle,
  IRGradientStop,
  IRTextValue,
  IRTextValueWithUnit,
} from '../../../ir/types';
import {
  colorLiteral,
  FILE_HEADER,
  floatLiteral,
  subPackageLine,
} from './emit_helpers';
import { aliasExpr, defaultExprFor, literalFor } from './collection';
import type {
  AndroidVarRef,
  PreparedAndroidEffectStyle,
  PreparedAndroidPaintStyle,
  PreparedAndroidTextStyle,
} from '../shared/prepare';

export function emitColorStyles(
  namespace: string,
  styles: PreparedAndroidPaintStyle[],
  varIndex: Map<string, AndroidVarRef>,
): string {
  let out = FILE_HEADER;
  out += subPackageLine(namespace, 'composites');
  out += `import androidx.compose.ui.graphics.Brush\n`;
  out += `import androidx.compose.ui.graphics.Color\n`;
  out += `import ${namespace}.internal.DesignSystemController\n\n`;

  out += `class DSColorStyles internal constructor(\n`;
  out += `    private val c: DesignSystemController = DesignSystemController.instance,\n`;
  out += `) {\n`;
  for (const style of styles) {
    const type = style.raw.type === 'SOLID' ? 'Color' : 'Brush';
    out += `    val ${style.getterName}: ${type}\n`;
    out += `        get() = ${paintExpr(style, varIndex)}\n\n`;
  }
  out += `}\n`;
  return out;
}

export function emitShadows(
  namespace: string,
  styles: PreparedAndroidEffectStyle[],
  varIndex: Map<string, AndroidVarRef>,
): string {
  const shadowStyles = styles.filter(
    (s) => s.raw.type === 'DROP_SHADOW' || s.raw.type === 'INNER_SHADOW',
  );
  let out = FILE_HEADER;
  out += subPackageLine(namespace, 'composites');
  out += `import androidx.compose.ui.graphics.Color\n`;
  out += `import ${namespace}.internal.DesignSystemController\n\n`;
  out += `data class DSShadow(\n`;
  out += `    val color: Color,\n`;
  out += `    val offsetX: Float,\n`;
  out += `    val offsetY: Float,\n`;
  out += `    val blurRadius: Float,\n`;
  out += `    val spreadRadius: Float,\n`;
  out += `)\n\n`;
  out += `class DSShadows internal constructor(\n`;
  out += `    private val c: DesignSystemController = DesignSystemController.instance,\n`;
  out += `) {\n`;
  for (const style of shadowStyles) {
    const raw = style.raw as Extract<IREffectStyle, { type: 'DROP_SHADOW' | 'INNER_SHADOW' }>;
    out += `    val ${style.getterName}: DSShadow\n`;
    out += `        get() = DSShadow(\n`;
    out += `            color = ${colorValueExpr(raw.color, varIndex)},\n`;
    out += `            offsetX = ${floatLiteral(raw.offsetX)},\n`;
    out += `            offsetY = ${floatLiteral(raw.offsetY)},\n`;
    out += `            blurRadius = ${floatLiteral(raw.blurRadius)},\n`;
    out += `            spreadRadius = ${floatLiteral(raw.spreadRadius)},\n`;
    out += `        )\n\n`;
  }
  out += `}\n`;
  return out;
}

export function emitTextStyles(
  namespace: string,
  styles: PreparedAndroidTextStyle[],
  varIndex: Map<string, AndroidVarRef>,
): string {
  let out = FILE_HEADER;
  out += subPackageLine(namespace, 'composites');
  out += `import androidx.compose.ui.text.TextStyle\n`;
  out += `import androidx.compose.ui.text.font.FontFamily\n`;
  out += `import androidx.compose.ui.text.font.FontWeight\n`;
  out += `import androidx.compose.ui.unit.TextUnit\n`;
  out += `import androidx.compose.ui.unit.sp\n`;
  out += `import ${namespace}.internal.DesignSystemController\n\n`;
  out += `typealias DSTextStyle = TextStyle\n\n`;
  out += `class DSStyles internal constructor(\n`;
  out += `    private val c: DesignSystemController = DesignSystemController.instance,\n`;
  out += `) {\n`;
  for (const style of styles) {
    const raw = style.raw;
    out += `    val ${style.getterName}: TextStyle\n`;
    out += `        get() = TextStyle(\n`;
    out += `            fontFamily = ${fontFamilyExpr(raw.fontFamily, varIndex)},\n`;
    out += `            fontSize = ${numberTextUnitExpr(raw.fontSize, varIndex)},\n`;
    out += `            fontWeight = ${fontWeightExpr(raw.fontWeight, varIndex)},\n`;
    out += `            lineHeight = ${textUnitWithUnitExpr(raw.lineHeight, raw.fontSize, varIndex)},\n`;
    out += `            letterSpacing = ${textUnitWithUnitExpr(raw.letterSpacing, null, varIndex)},\n`;
    out += `        )\n\n`;
  }
  out += `}\n`;
  return out;
}

function paintExpr(
  style: PreparedAndroidPaintStyle,
  varIndex: Map<string, AndroidVarRef>,
): string {
  const raw = style.raw;
  if (raw.type === 'SOLID') return colorValueExpr(raw.color, varIndex);
  if (raw.type === 'GRADIENT_LINEAR') {
    return `Brush.linearGradient(colorStops = ${colorStops(raw.stops, varIndex)})`;
  }
  if (raw.type === 'GRADIENT_RADIAL') {
    return `Brush.radialGradient(colorStops = ${colorStops(raw.stops, varIndex)})`;
  }
  if (raw.type === 'GRADIENT_ANGULAR') {
    return `Brush.sweepGradient(colorStops = ${colorStops(raw.stops, varIndex)})`;
  }
  if (raw.type === 'GRADIENT_DIAMOND') {
    return `Brush.radialGradient(colorStops = ${colorStops(raw.stops, varIndex)})`;
  }
  return 'Brush.linearGradient(listOf(Color.Transparent, Color.Transparent))';
}

function colorStops(
  stops: IRGradientStop[],
  varIndex: Map<string, AndroidVarRef>,
): string {
  const entries = stops.map(
    (s) => `${floatLiteral(s.position)} to ${colorValueExpr(s.color, varIndex)}`,
  );
  return `arrayOf(${entries.join(', ')})`;
}

function colorValueExpr(
  value: IRColorValue,
  varIndex: Map<string, AndroidVarRef>,
): string {
  if (value.kind === 'literal') return colorLiteral(value.rgba);
  const ref = varIndex.get(value.targetVariableId);
  if (!ref || ref.kotlinType !== 'Color') return 'Color.Transparent';
  return aliasExpr(ref);
}

function fontFamilyExpr(
  _value: IRTextValue<string>,
  _varIndex: Map<string, AndroidVarRef>,
): string {
  return 'FontFamily.Default';
}

function fontWeightExpr(
  value: IRTextValue<number>,
  varIndex: Map<string, AndroidVarRef>,
): string {
  if (value.kind === 'literal') return `FontWeight(${Math.round(value.value)})`;
  const ref = varIndex.get(value.targetVariableId);
  if (!ref || ref.kotlinType !== 'Float') return 'FontWeight.Normal';
  return `FontWeight(${aliasExpr(ref)}.toInt())`;
}

function numberTextUnitExpr(
  value: IRTextValue<number>,
  varIndex: Map<string, AndroidVarRef>,
): string {
  if (value.kind === 'literal') return `${floatLiteral(value.value)}.sp`;
  const ref = varIndex.get(value.targetVariableId);
  if (!ref || ref.kotlinType !== 'Float') return 'TextUnit.Unspecified';
  return `${aliasExpr(ref)}.sp`;
}

function textUnitWithUnitExpr(
  value: IRTextValueWithUnit<number>,
  fontSize: IRTextValue<number> | null,
  varIndex: Map<string, AndroidVarRef>,
): string {
  if (value.kind === 'alias') {
    const ref = varIndex.get(value.targetVariableId);
    if (!ref || ref.kotlinType !== 'Float') return 'TextUnit.Unspecified';
    return `${aliasExpr(ref)}.sp`;
  }
  if (value.unit === 'AUTO') return 'TextUnit.Unspecified';
  if (value.unit === 'PIXELS') return `${floatLiteral(value.value)}.sp`;
  const baseFontSize = fontSize?.kind === 'literal' ? fontSize.value : null;
  if (baseFontSize === null) return 'TextUnit.Unspecified';
  return `${floatLiteral((baseFontSize * value.value) / 100)}.sp`;
}

// Keep these imports live as this module intentionally shares collection helpers.
void defaultExprFor;
void literalFor;
