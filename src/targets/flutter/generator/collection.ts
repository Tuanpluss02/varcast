import type { IRValue } from '../../../ir/types';
import {
  FILE_HEADER,
  colorLiteral,
  doubleLiteral,
  stringLiteral,
  boolLiteral,
} from './emit_helpers';
import type {
  PreparedCollection,
  PreparedVariable,
  VarRef,
  DartType,
} from './prepare';

// Returns the leaf suffix to append when building the flat getter name.
//  - If leafName is `n` followed by only digits (e.g. n50, n100, n950):
//    the `n` was added by the sanitizer because Dart identifiers can't start
//    with a digit. Strip it and use just the number → `50`, `100`, `950`.
//  - Otherwise: capitalize the first letter so the result is proper camelCase
//    → `headingSecondary` becomes `HeadingSecondary`.
function leafSuffix(leafName: string): string {
  if (/^n\d+$/.test(leafName)) return leafName.slice(1); // e.g. n950 → 950
  return leafName.charAt(0).toUpperCase() + leafName.slice(1); // e.g. headingSecondary → HeadingSecondary
}

// Compute the flat getter name for a variable by concatenating all group-path
// segments (first segment is lowerFirst, subsequent segments stay PascalCase)
// then appending the processed leafName.
// e.g. groupPath=['Brand'],   leafName='n950'           → 'brand950'
//      groupPath=['Text'],    leafName='headingSecondary'→ 'textHeadingSecondary'
//      groupPath=['Success'],  leafName='n100'           → 'success100'
//      groupPath=['Base'],    leafName='white'           → 'baseWhite'
function flatGetterName(groupPath: string[], leafName: string): string {
  if (groupPath.length === 0) return leafName;
  const [first, ...rest] = groupPath;
  const firstLower = first.charAt(0).toLowerCase() + first.slice(1);
  return firstLower + rest.join('') + leafSuffix(leafName);
}

// Builds the alias expression used inside generated code when one variable
// references another, e.g. `AppTheme.colorBasic.brandn950`.
export function flatAliasExpr(
  collectionAccessor: string,
  groupPath: string[], // PascalCase segments from VarRef
  leafName: string,
): string {
  const getter = flatGetterName(groupPath, leafName);
  return `AppTheme.${collectionAccessor}.${getter}`;
}

export function emitCollection(
  col: PreparedCollection,
  varIndex: Map<string, VarRef>,
): string {
  const cn = col.className;
  const usesColor = collectionUsesColor(col);
  const usesAlias = collectionUsesAlias(col);
  const isAllConst = !usesAlias;

  // Attach flat getter name to each variable once.
  const vars = col.variables.map((v) => ({
    v,
    getter: flatGetterName(v.groupPath, v.leafName),
  }));

  let out = FILE_HEADER;
  if (usesColor) {
    out += `import 'package:flutter/painting.dart';\n`;
  }
  out += `import '../_internal/lerp.dart';\n`;
  if (usesAlias) {
    out += `import '../theme.dart';\n`;
  }
  out += '\n';

  out += `enum ${cn}Mode { ${col.modes.map((m) => m.camel).join(', ')} }\n\n`;

  // ── Abstract class ─────────────────────────────────────────────────────────
  out += `abstract class ${cn} {\n`;
  out += `  const ${cn}();\n`;
  for (const { v, getter } of vars) {
    out += `  ${v.dartType} get ${getter};\n`;
  }
  out += `\n  static ${cn} lerp(${cn} a, ${cn} b, double t) =>\n`;
  out += `      _Lerped${cn}(\n`;
  for (const { getter } of vars) {
    out += `        ${getter}: a.${getter}.lerpTo(b.${getter}, t),\n`;
  }
  out += `      );\n}\n\n`;

  // ── Mode-specific concrete classes ─────────────────────────────────────────
  for (const mode of col.modes) {
    const concreteName = `${cn}${mode.pascal}`;
    const ctorPrefix = isAllConst ? 'const ' : '';
    out += `class ${concreteName} extends ${cn} {\n`;
    out += `  ${ctorPrefix}${concreteName}();\n`;
    for (const { v, getter } of vars) {
      const expr = emitValueExpr(v, mode.id);
      out += `  @override ${v.dartType} get ${getter} => ${expr};\n`;
    }
    out += `}\n\n`;
  }

  // ── Lerped class ───────────────────────────────────────────────────────────
  out += `class _Lerped${cn} extends ${cn} {\n`;
  if (vars.length > 0) {
    out += `  const _Lerped${cn}({\n`;
    for (const { getter } of vars) out += `    required this.${getter},\n`;
    out += `  });\n`;
    for (const { v, getter } of vars) {
      out += `  @override final ${v.dartType} ${getter};\n`;
    }
  } else {
    out += `  const _Lerped${cn}();\n`;
  }
  out += `}\n`;

  return out;

  function emitValueExpr(v: PreparedVariable, modeId: string): string {
    const val = v.valuesByMode[modeId];
    if (!val) return defaultExprFor(v.dartType);
    if (val.kind === 'alias') {
      const ref = varIndex.get(val.targetVariableId);
      if (!ref) return defaultExprFor(v.dartType);
      return flatAliasExpr(ref.collectionAccessor, ref.groupPath, ref.leafName);
    }
    return literalFor(v.dartType, val);
  }
}

function literalFor(t: DartType, v: IRValue): string {
  if (v.kind !== 'literal') return defaultExprFor(t);
  switch (t) {
    case 'Color':
      return colorLiteral(v.value as { r: number; g: number; b: number; a: number });
    case 'double':
      return doubleLiteral(v.value as number);
    case 'String':
      return stringLiteral(v.value as string);
    case 'bool':
      return boolLiteral(v.value as boolean);
  }
}

function defaultExprFor(t: DartType): string {
  switch (t) {
    case 'Color':
      return 'const Color(0x00000000)';
    case 'double':
      return '0.0';
    case 'String':
      return "''";
    case 'bool':
      return 'false';
  }
}

function collectionUsesColor(col: PreparedCollection): boolean {
  return col.variables.some((v) => v.dartType === 'Color');
}

function collectionUsesAlias(col: PreparedCollection): boolean {
  return col.variables.some((v) =>
    Object.values(v.valuesByMode).some((val) => val.kind === 'alias'),
  );
}
