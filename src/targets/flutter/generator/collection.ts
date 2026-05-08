import type { IRValue } from '../../../ir/types';
import {
  FILE_HEADER,
  colorLiteral,
  doubleLiteral,
  stringLiteral,
  boolLiteral,
} from './emit_helpers';
import type { ArchMode } from './options';
import type {
  PreparedCollection,
  PreparedVariable,
  VarRef,
  DartType,
} from './prepare';

/**
 * Processes a variable leaf name for flat getter concatenation.
 * Strips the 'n' prefix from digit-only names (e.g., 'n950' -> '950')
 * added by the sanitizer, or capitalizes the first letter for camelCase.
 */
function leafSuffix(leafName: string): string {
  if (/^n\d+$/.test(leafName)) return leafName.slice(1);
  return leafName.charAt(0).toUpperCase() + leafName.slice(1);
}

/**
 * Computes a flat camelCase getter name by concatenating group segments and the leaf name.
 * Example: `['Brand', 'Primary'], 'n950'` -> `'brandPrimary950'`
 */
function flatGetterName(groupPath: string[], leafName: string): string {
  if (groupPath.length === 0) return leafName;
  const [first, ...rest] = groupPath;
  const firstLower = first.charAt(0).toLowerCase() + first.slice(1);
  return firstLower + rest.join('') + leafSuffix(leafName);
}

/**
 * Generates the Dart expression to access an aliased variable.
 *
 * - 'static' mode → `AppTheme.colorBasic.brand950`
 * - 'context' mode → `_c.colorBasic.brand950`. Tokens and composites in
 *   context mode hold the controller as a constructor-injected `_c` field
 *   instead of reaching for `DesignSystemController.instance` — that keeps
 *   the singleton out of every reactive read path.
 */
export function flatAliasExpr(
  collectionAccessor: string,
  groupPath: string[],
  leafName: string,
  archMode: ArchMode = 'static',
): string {
  const getter = flatGetterName(groupPath, leafName);
  const root = archMode === 'context' ? '_c' : 'AppTheme';
  return `${root}.${collectionAccessor}.${getter}`;
}

export function emitCollection(
  col: PreparedCollection,
  varIndex: Map<string, VarRef>,
  archMode: ArchMode = 'static',
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
    out +=
      archMode === 'context'
        ? `import '../_internal/controller.dart';\n`
        : `import '../theme.dart';\n`;
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
  // In context mode, classes that resolve aliases hold the controller as a
  // ctor-injected `_c` field instead of reaching for `DesignSystemController.instance`.
  // That makes alias getters depend only on what the wrapper hands down, not on
  // a global service locator.
  const injectsController = archMode === 'context' && usesAlias;
  for (const mode of col.modes) {
    const concreteName = concreteClassName(cn, mode.pascal);
    const ctorPrefix = isAllConst ? 'const ' : '';
    out += `class ${concreteName} extends ${cn} {\n`;
    if (injectsController) {
      out += `  ${concreteName}(this._c);\n`;
      out += `  final DesignSystemController _c;\n`;
    } else {
      out += `  ${ctorPrefix}${concreteName}();\n`;
    }
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

  function concreteClassName(collectionClassName: string, modePascal: string): string {
    const candidate = `${collectionClassName}${modePascal}`;
    // Prevent collision with the enum `${Collection}Mode`.
    // Example: `FontFamily` + mode `Mode` => `FontFamilyMode` (enum) vs class.
    if (candidate === `${collectionClassName}Mode`) return `${candidate}Value`;
    return candidate;
  }

  function emitValueExpr(v: PreparedVariable, modeId: string): string {
    const val = v.valuesByMode[modeId];
    if (!val) return defaultExprFor(v.dartType);
    if (val.kind === 'alias') {
      const ref = varIndex.get(val.targetVariableId);
      if (!ref) return defaultExprFor(v.dartType);
      return flatAliasExpr(
        ref.collectionAccessor,
        ref.groupPath,
        ref.leafName,
        archMode,
      );
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
