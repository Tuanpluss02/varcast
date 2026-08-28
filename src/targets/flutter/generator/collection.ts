import type { IR, IRValue } from '../../../ir/types';
import { toSnakeCase } from '../../../core/sanitize_base';
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

/**
 * A file to be emitted for a collection.
 */
export interface CollectionFile {
  fileName: string; // e.g., 'color_token.dart', 'light_mode.dart', 'dark_mode.dart'
  contents: string;
}

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
export function flatGetterName(groupPath: string[], leafName: string): string {
  if (groupPath.length === 0) return leafName;
  const [first, ...rest] = groupPath;
  const firstLower = first.charAt(0).toLowerCase() + first.slice(1);
  return firstLower + rest.join('') + leafSuffix(leafName);
}

/**
 * Generates the Dart expression to access an aliased variable via AppTheme singleton facade.
 * e.g. `AppTheme.colorBasic.brand950`
 */
export function flatAliasExpr(
  collectionAccessor: string,
  groupPath: string[],
  leafName: string,
): string {
  const getter = flatGetterName(groupPath, leafName);
  return `AppTheme.${collectionAccessor}.${getter}`;
}

/**
 * Converts a mode name to snake_case for file naming according to Dart conventions.
 * e.g., "Light Mode" -> "light_mode", "DarkMode" -> "dark_mode", "XS" -> "xs"
 */
export function modeToSnakeCase(modeName: string): string {
  return toSnakeCase(modeName);
}

/**
 * Gets the mode class name suffix from the PascalCase mode name.
 * E.g., "Light" -> "Light", "DarkMode" -> "Dark", "XS" -> "XS"
 * This avoids naming collisions like "_FooModeMode".
 */
export function modeClassSuffix(modePascal: string): string {
  if (modePascal.endsWith('Mode')) {
    return modePascal.slice(0, -4);
  }
  return modePascal;
}

/**
 * Recursively resolves a variable ID and mode to its ultimate literal value in the IR.
 * Protects against cycles and handles multi-hop aliases.
 */
export function resolveToLiteralValue(
  variableId: string,
  modeIdOrIndex: string | number,
  ir?: IR,
  visited = new Set<string>(),
): IRValue | null {
  if (!ir || visited.has(variableId)) return null;
  visited.add(variableId);

  for (const col of ir.collections) {
    const v = col.variables.find((x) => x.id === variableId);
    if (!v) continue;

    let val: IRValue | undefined;
    if (typeof modeIdOrIndex === 'string') {
      val = v.valuesByMode[modeIdOrIndex];
    }
    if (!val) {
      const modeKeys = Object.keys(v.valuesByMode);
      if (typeof modeIdOrIndex === 'number' && modeIdOrIndex < modeKeys.length) {
        val = v.valuesByMode[modeKeys[modeIdOrIndex]];
      } else if (modeKeys.length > 0) {
        val = v.valuesByMode[modeKeys[0]];
      }
    }
    if (!val) return null;

    if (val.kind === 'literal') {
      return val;
    }
    if (val.kind === 'alias') {
      return resolveToLiteralValue(val.targetVariableId, modeIdOrIndex, ir, visited);
    }
  }
  return null;
}

/**
 * Emits the base class for a collection (the abstract class with all getters).
 */
export function emitCollectionBaseClass(
  col: PreparedCollection,
  allCollectionNames: string[] | undefined = undefined,
): string {
  const cn = col.className;
  const baseClassName = `${cn}`;
  const usesColor = collectionUsesColor(col);

  // Attach flat getter name to each variable once.
  const vars = col.variables.map((v) => ({
    v,
    getter: flatGetterName(v.groupPath, v.leafName),
  }));

  let out = FILE_HEADER;
  if (usesColor) {
    out += `import 'package:flutter/painting.dart';\n`;
  }
  // lerp.dart is located in lib/src/_internal/lerp.dart; collection files are in lib/src/collections/<col>/
  if (col.variables.length > 0) {
    out += `import '../../_internal/lerp.dart';\n`;
  }

  // ── Export mode files ────────────────────────────────────────────────────
  for (const mode of col.modes) {
    const exportFileName = `${modeToSnakeCase(mode.pascal)}.dart`;
    out += `export '${exportFileName}';\n`;
  }

  out += '\n';

  // ── Abstract base class ────────────────────────────────────────────────────
  out += `abstract class ${baseClassName} {\n`;
  out += `  const ${baseClassName}();\n`;
  for (const { v, getter } of vars) {
    out += `  ${v.dartType} get ${getter};\n`;
  }
  out += `\n  static ${baseClassName} lerp(${baseClassName} a, ${baseClassName} b, double t) =>\n`;
  out += `      _${cn}Lerp(\n`;
  for (const { getter } of vars) {
    out += `        ${getter}: a.${getter}.lerpTo(b.${getter}, t),\n`;
  }
  out += `      );\n}\n\n`;

  // ── Lerped class ───────────────────────────────────────────────────────────
  out += `class _${cn}Lerp extends ${baseClassName} {\n`;
  if (vars.length > 0) {
    out += `  const _${cn}Lerp({\n`;
    for (const { getter } of vars) out += `    required this.${getter},\n`;
    out += `  });\n`;
    for (const { v, getter } of vars) {
      out += `  @override final ${v.dartType} ${getter};\n`;
    }
  } else {
    out += `  const _${cn}Lerp();\n`;
  }
  out += `}\n\n`;

  // ── Mode enum ─────────────────────────────────────────────────────────────
  out += `enum ${cn}Mode { ${col.modes.map((m) => m.camel).join(', ')} }\n`;

  return out;
}

/**
 * Emits a mode-specific concrete class for a collection.
 */
export function emitCollectionModeClass(
  col: PreparedCollection,
  modeId: string,
  modePascal: string,
  varIndex: Map<string, VarRef>,
  exportedColIds?: Set<string>,
  ir?: IR,
  isAppendedToBase: boolean = false,
): string {
  const cn = col.className;
  const baseClassName = `${cn}`;
  const modeSuffix = modeClassSuffix(modePascal);
  const modeClassName = `${cn}${modeSuffix}Mode`;
  const usesColor = collectionUsesColor(col);
  const usesAlias = collectionUsesExportedAlias(col, varIndex, exportedColIds);

  // Attach flat getter name to each variable once.
  const vars = col.variables.map((v) => ({
    v,
    getter: flatGetterName(v.groupPath, v.leafName),
  }));

  let out = '';

  if (!isAppendedToBase) {
    out += FILE_HEADER;
    if (usesColor) {
      out += `import 'package:flutter/painting.dart';\n`;
    }

    // Always import own collection's base file to extend its base class
    out += `import '${col.fileBaseName}.dart';\n`;

    // Static mode: need theme import for AppTheme when aliases to exported collections are used
    if (usesAlias) {
      out += `import '../../theme.dart';\n`;
    }
    out += '\n';
  }

  // ── Mode-specific concrete class ──────────────────────────────────────────
  out += `class ${modeClassName} extends ${baseClassName} {\n`;
  out += `  const ${modeClassName}();\n`;
  for (const { v, getter } of vars) {
    const expr = emitValueExpr(v, modeId, varIndex, exportedColIds, ir);
    out += `  @override ${v.dartType} get ${getter} => ${expr};\n`;
  }
  out += `}\n`;

  return out;
}

/**
 * Emits all files for a collection.
 * Returns an array of CollectionFile objects, one for the base class and one per mode.
 */
export function emitCollection(
  col: PreparedCollection,
  varIndex: Map<string, VarRef>,
  exportedColIds?: Set<string>,
  ir?: IR,
): CollectionFile[] {
  const files: CollectionFile[] = [];

  // Emit base class file
  const baseClassFile: CollectionFile = {
    fileName: `${col.fileBaseName}.dart`,
    contents: emitCollectionBaseClass(col),
  };
  files.push(baseClassFile);

  // Emit mode files in separate files
  for (const mode of col.modes) {
    const modeFile: CollectionFile = {
      fileName: `${modeToSnakeCase(mode.pascal)}.dart`,
      contents: emitCollectionModeClass(col, mode.id, mode.pascal, varIndex, exportedColIds, ir),
    };
    files.push(modeFile);
  }

  return files;
}

export function emitValueExpr(
  v: PreparedVariable,
  modeId: string,
  varIndex: Map<string, VarRef>,
  exportedColIds?: Set<string>,
  ir?: IR,
): string {
  const val = v.valuesByMode[modeId];
  if (!val) return defaultExprFor(v.dartType);
  if (val.kind === 'alias') {
    const ref = varIndex.get(val.targetVariableId);
    // If target collection is exported, use alias via AppTheme
    if (ref && (!exportedColIds || exportedColIds.has(ref.collectionId))) {
      return flatAliasExpr(
        ref.collectionAccessor,
        ref.groupPath,
        ref.leafName,
      );
    }
    // Target collection is NOT exported -> inline literal value
    const resolved = resolveToLiteralValue(val.targetVariableId, modeId, ir);
    if (resolved && resolved.kind === 'literal') {
      return literalFor(v.dartType, resolved);
    }
    return defaultExprFor(v.dartType);
  }
  return literalFor(v.dartType, val);
}

export function literalFor(t: DartType, v: IRValue): string {
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

export function defaultExprFor(t: DartType): string {
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

function collectionUsesExportedAlias(
  col: PreparedCollection,
  varIndex: Map<string, VarRef>,
  exportedColIds?: Set<string>,
): boolean {
  return col.variables.some((v) =>
    Object.values(v.valuesByMode).some((val) => {
      if (val.kind !== 'alias') return false;
      if (!exportedColIds) return true;
      const ref = varIndex.get(val.targetVariableId);
      return ref ? exportedColIds.has(ref.collectionId) : false;
    }),
  );
}
