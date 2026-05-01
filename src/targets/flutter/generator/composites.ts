import type {
  IRColorValue,
  IRGradientStop,
  IRPaintStyle,
  IREffectStyle,
  IRTextStyle,
  IRTextValue,
  IRTextValueWithUnit,
} from '../../../ir/types';
import {
  FILE_HEADER,
  angleToAlignmentDart,
  colorLiteral,
  doubleLiteral,
  stringLiteral,
} from './emit_helpers';
import type {
  PreparedEffectStyle,
  PreparedPaintStyle,
  PreparedTextStyle,
  VarRef,
} from './prepare';

export function emitColorStyles(
  styles: PreparedPaintStyle[],
  varIndex: Map<string, VarRef>,
): string {
  const buckets = new Map<string, PreparedPaintStyle[]>();
  for (const s of styles) {
    if (!buckets.has(s.groupName)) buckets.set(s.groupName, []);
    buckets.get(s.groupName)!.push(s);
  }
  const ordered: [string, PreparedPaintStyle[]][] = [
    'Solid',
    'Linear',
    'Radial',
    'Angular',
    'Diamond',
    'Image',
  ]
    .filter((b) => buckets.has(b))
    .map((b) => [b, buckets.get(b)!]);

  let out = FILE_HEADER;
  out += `import 'dart:math' show pi;\n`;
  out += `import 'package:flutter/painting.dart';\n`;
  out += `import '../theme.dart';\n\n`;
  out += `// ignore_for_file: unused_import\n\n`;

  for (const [bucket, items] of ordered) {
    const cls = `DSColorStyles${bucket}`;
    out += `class ${cls} {\n`;
    out += `  const ${cls}();\n\n`;
    for (const s of items) out += emitPaintGetter(s, varIndex);
    out += `}\n\n`;
  }

  if (buckets.has('Diamond')) {
    out += `class _DiamondTransform extends GradientTransform {\n`;
    out += `  const _DiamondTransform();\n`;
    out += `  @override\n`;
    out += `  Matrix4? transform(Rect bounds, {TextDirection? textDirection}) {\n`;
    out += `    return Matrix4.identity()..scale(1.0, 0.5, 1.0);\n`;
    out += `  }\n`;
    out += `}\n\n`;
  }

  out += `class DSColorStyles {\n`;
  out += `  const DSColorStyles();\n`;
  for (const [bucket] of ordered) {
    const field = bucket[0].toLowerCase() + bucket.slice(1);
    out += `  final DSColorStyles${bucket} ${field} = const DSColorStyles${bucket}();\n`;
  }
  out += `}\n`;
  return out;
}

function emitPaintGetter(
  s: PreparedPaintStyle,
  varIndex: Map<string, VarRef>,
): string {
  const r = s.raw;
  switch (r.type) {
    case 'SOLID':
      return `  Color get ${s.getterName} => ${colorRef(r.color, varIndex)};\n\n`;
    case 'GRADIENT_LINEAR': {
      const { begin, end } = angleToAlignmentDart(r.angleRadians);
      return (
        `  LinearGradient get ${s.getterName} => LinearGradient(\n` +
        `    begin: ${begin},\n` +
        `    end: ${end},\n` +
        `    stops: ${stopsLiteral(r.stops)},\n` +
        `    colors: [${r.stops.map((st) => colorRef(st.color, varIndex)).join(', ')}],\n` +
        `  );\n\n`
      );
    }
    case 'GRADIENT_RADIAL':
      return (
        `  RadialGradient get ${s.getterName} => RadialGradient(\n` +
        `    center: Alignment(${doubleLiteral((r.center.x - 0.5) * 2)}, ${doubleLiteral((r.center.y - 0.5) * 2)}),\n` +
        `    radius: ${doubleLiteral(r.radius * 2)},\n` +
        `    stops: ${stopsLiteral(r.stops)},\n` +
        `    colors: [${r.stops.map((st) => colorRef(st.color, varIndex)).join(', ')}],\n` +
        `  );\n\n`
      );
    case 'GRADIENT_ANGULAR':
      return (
        `  SweepGradient get ${s.getterName} => SweepGradient(\n` +
        `    center: Alignment.center,\n` +
        `    startAngle: ${doubleLiteral((r as any).startAngle)},\n` +
        `    endAngle: ${doubleLiteral((r as any).endAngle)},\n` +
        `    stops: ${stopsLiteral(r.stops)},\n` +
        `    colors: [${r.stops.map((st) => colorRef(st.color, varIndex)).join(', ')}],\n` +
        `  );\n\n`
      );
    case 'GRADIENT_DIAMOND':
      return (
        `  // Approximated from Figma GRADIENT_DIAMOND.\n` +
        `  RadialGradient get ${s.getterName} => RadialGradient(\n` +
        `    center: Alignment.center,\n` +
        `    radius: 1.0,\n` +
        `    transform: const _DiamondTransform(),\n` +
        `    stops: ${stopsLiteral(r.stops)},\n` +
        `    colors: [${r.stops.map((st) => colorRef(st.color, varIndex)).join(', ')}],\n` +
        `  );\n\n`
      );
    case 'IMAGE':
      return `  String get ${s.getterName} => ${stringLiteral(`packages/design_system/assets/${(r as any).assetName}`)};\n\n`;
  }
}

function colorRef(c: IRColorValue, varIndex: Map<string, VarRef>): string {
  if (c.kind === 'alias') {
    const ref = varIndex.get(c.targetVariableId);
    if (!ref) return 'const Color(0x00000000)';
    const segs = [
      'AppTheme',
      ref.collectionAccessor,
      ...ref.groupPath.map(lowerFirst),
      ref.leafName,
    ];
    return segs.join('.');
  }
  return colorLiteral(c.rgba);
}

function stopsLiteral(stops: IRGradientStop[]): string {
  return `const [${stops.map((s) => doubleLiteral(s.position)).join(', ')}]`;
}

export function emitShadows(
  styles: PreparedEffectStyle[],
  varIndex: Map<string, VarRef>,
): string {
  const drops = styles.filter((s) => s.type === 'DROP_SHADOW');
  const inners = styles.filter((s) => s.type === 'INNER_SHADOW');
  const blurs = styles.filter(
    (s) => s.type === 'LAYER_BLUR' || s.type === 'BACKGROUND_BLUR',
  );

  let out = FILE_HEADER;
  out += `import 'dart:ui' show ImageFilter;\n`;
  out += `import 'package:flutter/painting.dart';\n`;
  out += `import '../theme.dart';\n\n`;
  out += `// ignore_for_file: unused_import\n\n`;

  out += `class DSShadow extends BoxShadow {\n`;
  out += `  const DSShadow({\n`;
  out += `    super.color,\n`;
  out += `    super.offset,\n`;
  out += `    super.blurRadius,\n`;
  out += `    super.spreadRadius,\n`;
  out += `    super.blurStyle,\n`;
  out += `  });\n`;
  out += `}\n\n`;

  if (drops.length > 0) {
    out += `class DSDropShadows {\n  const DSDropShadows();\n\n`;
    for (const s of drops) out += emitShadowGetter(s, varIndex, 'normal');
    out += `}\n\n`;
  }
  if (inners.length > 0) {
    out += `class DSInnerShadows {\n  const DSInnerShadows();\n\n`;
    for (const s of inners) out += emitShadowGetter(s, varIndex, 'inner');
    out += `}\n\n`;
  }
  if (blurs.length > 0) {
    out += `class DSBlurs {\n  const DSBlurs();\n\n`;
    for (const s of blurs) {
      const r = s.raw as { sigmaX: number; sigmaY: number };
      out += `  ImageFilter get ${s.getterName} => ImageFilter.blur(sigmaX: ${doubleLiteral(r.sigmaX)}, sigmaY: ${doubleLiteral(r.sigmaY)});\n\n`;
    }
    out += `}\n\n`;
  }

  out += `class DSShadows {\n  const DSShadows();\n`;
  if (drops.length > 0) out += `  final DSDropShadows drop = const DSDropShadows();\n`;
  if (inners.length > 0) out += `  final DSInnerShadows inner = const DSInnerShadows();\n`;
  if (blurs.length > 0) out += `  final DSBlurs blur = const DSBlurs();\n`;
  out += `}\n`;
  return out;
}

function emitShadowGetter(
  s: PreparedEffectStyle,
  varIndex: Map<string, VarRef>,
  blurStyle: 'normal' | 'inner',
): string {
  const r = s.raw as any;
  const colorIsLiteral = r.color.kind === 'literal';
  const colorExpr = colorRef(r.color, varIndex);
  const constKw = colorIsLiteral ? 'const ' : '';
  return (
    `  List<DSShadow> get ${s.getterName} => ${constKw}[\n` +
    `    DSShadow(\n` +
    `      color: ${colorExpr},\n` +
    `      offset: ${colorIsLiteral ? 'Offset' : 'const Offset'}(${doubleLiteral(r.offsetX)}, ${doubleLiteral(r.offsetY)}),\n` +
    `      blurRadius: ${doubleLiteral(r.blurRadius)},\n` +
    `      spreadRadius: ${doubleLiteral(r.spreadRadius)},\n` +
    `      blurStyle: BlurStyle.${blurStyle},\n` +
    `    ),\n` +
    `  ];\n\n`
  );
}

export function emitTextStyles(
  styles: PreparedTextStyle[],
  varIndex: Map<string, VarRef>,
): string {
  const buckets = new Map<string, PreparedTextStyle[]>();
  for (const s of styles) {
    if (!buckets.has(s.groupName)) buckets.set(s.groupName, []);
    buckets.get(s.groupName)!.push(s);
  }
  const ordered = [...buckets.entries()].sort(([a], [b]) => a.localeCompare(b));

  let out = FILE_HEADER;
  out += `import 'package:flutter/painting.dart';\n`;
  out += `import '../theme.dart';\n\n`;
  out += `// ignore_for_file: unused_import\n\n`;

  out += `class DSTextStyle extends TextStyle {\n`;
  out += `  const DSTextStyle._({\n`;
  out += `    super.color,\n`;
  out += `    super.fontFamily,\n`;
  out += `    super.fontSize,\n`;
  out += `    super.fontWeight,\n`;
  out += `    super.height,\n`;
  out += `    super.letterSpacing,\n`;
  out += `    super.decoration,\n`;
  out += `  });\n\n`;
  out += `  DSTextStyle tint(Color? c) => _from(copyWith(color: c));\n\n`;
  out += `  DSTextStyle styled({\n`;
  out += `    Color? color,\n`;
  out += `    double? fontSize,\n`;
  out += `    FontWeight? fontWeight,\n`;
  out += `    double? height,\n`;
  out += `    double? letterSpacing,\n`;
  out += `    TextDecoration? decoration,\n`;
  out += `  }) => _from(copyWith(\n`;
  out += `    color: color, fontSize: fontSize, fontWeight: fontWeight,\n`;
  out += `    height: height, letterSpacing: letterSpacing, decoration: decoration,\n`;
  out += `  ));\n\n`;
  out += `  static DSTextStyle _from(TextStyle s) => DSTextStyle._(\n`;
  out += `    color: s.color, fontFamily: s.fontFamily, fontSize: s.fontSize,\n`;
  out += `    fontWeight: s.fontWeight, height: s.height,\n`;
  out += `    letterSpacing: s.letterSpacing, decoration: s.decoration,\n`;
  out += `  );\n\n`;
  out += `  static FontWeight _bucket(double v) => switch (v) {\n`;
  out += `    <= 100 => FontWeight.w100, <= 200 => FontWeight.w200,\n`;
  out += `    <= 300 => FontWeight.w300, <= 400 => FontWeight.w400,\n`;
  out += `    <= 500 => FontWeight.w500, <= 600 => FontWeight.w600,\n`;
  out += `    <= 700 => FontWeight.w700, <= 800 => FontWeight.w800,\n`;
  out += `    _      => FontWeight.w900,\n`;
  out += `  };\n`;
  out += `}\n\n`;

  for (const [bucket, items] of ordered) {
    const cls = `DSStyles${bucket}`;
    out += `class ${cls} {\n`;
    out += `  const ${cls}();\n\n`;
    for (const s of items) out += emitTextGetter(s, varIndex);
    out += `}\n\n`;
  }

  out += `class DSStyles {\n`;
  out += `  const DSStyles();\n`;
  for (const [bucket] of ordered) {
    const field = bucket[0].toLowerCase() + bucket.slice(1);
    out += `  final DSStyles${bucket} ${field} = const DSStyles${bucket}();\n`;
  }
  out += `}\n`;
  return out;
}

function emitTextGetter(s: PreparedTextStyle, varIndex: Map<string, VarRef>): string {
  const r = s.raw as IRTextStyle;
  const fontSize = textValue(r.fontSize, varIndex, 'double');
  const fontFamily = textValue(r.fontFamily, varIndex, 'String');
  const fontWeight = textValue(r.fontWeight, varIndex, 'double');
  const lh = lineHeightExpr(r.lineHeight, varIndex);
  const ls = letterSpacingExpr(r.letterSpacing, varIndex);
  return (
    `  DSTextStyle get ${s.getterName} {\n` +
    `    final fs = ${fontSize};\n` +
    `    return DSTextStyle._(\n` +
    `      fontFamily: ${fontFamily},\n` +
    `      fontSize: fs,\n` +
    `      fontWeight: DSTextStyle._bucket(${fontWeight}),\n` +
    `      height: ${lh},\n` +
    `      letterSpacing: ${ls},\n` +
    `    );\n` +
    `  }\n\n`
  );
}

function textValue<T>(
  v: IRTextValue<T>,
  varIndex: Map<string, VarRef>,
  type: 'double' | 'String',
): string {
  if ((v as any).kind === 'alias') return aliasExpr((v as any).targetVariableId, varIndex, type);
  if (type === 'String') return stringLiteral((v as any).value as string);
  return doubleLiteral((v as any).value as number);
}

function lineHeightExpr(v: IRTextValueWithUnit<number>, varIndex: Map<string, VarRef>): string {
  if ((v as any).kind === 'alias')
    return `(${aliasExpr((v as any).targetVariableId, varIndex, 'double')} / fs)`;
  if ((v as any).unit === 'AUTO') return 'null';
  if ((v as any).unit === 'PIXELS') return `(${doubleLiteral((v as any).value)} / fs)`;
  return `${doubleLiteral(((v as any).value as number) / 100)}`;
}

function letterSpacingExpr(v: IRTextValueWithUnit<number>, varIndex: Map<string, VarRef>): string {
  if ((v as any).kind === 'alias') return aliasExpr((v as any).targetVariableId, varIndex, 'double');
  if ((v as any).unit === 'PIXELS') return doubleLiteral((v as any).value as number);
  return `(${doubleLiteral(((v as any).value as number) / 100)} * fs)`;
}

function aliasExpr(id: string, varIndex: Map<string, VarRef>, type: 'double' | 'String'): string {
  const ref = varIndex.get(id);
  if (!ref) return type === 'String' ? "''" : '0.0';
  return [
    'AppTheme',
    ref.collectionAccessor,
    ...ref.groupPath.map((s) => s[0].toLowerCase() + s.slice(1)),
    ref.leafName,
  ].join('.');
}

function lowerFirst(s: string): string {
  return s ? s[0].toLowerCase() + s.slice(1) : s;
}

