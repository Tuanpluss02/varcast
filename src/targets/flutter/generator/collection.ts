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
 * Processed variable with its computed getter name.
 */
interface ProcessedVariable {
  v: PreparedVariable;
  getter: string;
}

/**
 * A file to be emitted for a collection.
 */
export interface CollectionFile {
  fileName: string; // e.g., 'ColorToken.dart', 'light.dart', 'dark.dart'
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
 * Generates the Dart expression to access an aliased variable.
 *
 * - 'static' mode -> `AppTheme.colorBasic.brand950`
 * - 'context' mode -> `_c.colorBasic.brand950`. Tokens and composites in
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

/**
 * Converts a mode name to kebab-case for file naming.
 * e.g., "Light" -> "light", "DarkMode" -> "dark-mode", "XS" -> "xs"
 */
function modeToKebabCase(modeName: string): string {
  // Handle already kebab-case
  if (modeName.includes('-')) return modeName.toLowerCase();
  // Handle PascalCase or camelCase: insert hyphens before uppercase letters
  // and convert to lowercase
  return modeName
    .replace(/([a-z])([A-Z])/g, '$1-$2')
    .replace(/([A-Z]+)([A-Z][a-z])/g, '$1-$2')
    .toLowerCase();
}

/**
 * Gets the mode class name suffix from the PascalCase mode name.
 * E.g., "Light" -> "Light", "DarkMode" -> "Dark", "XS" -> "XS"
 * This avoids naming collisions like "_FooModeMode".
 */
function modeClassSuffix(modePascal: string): string {
  // If mode name ends with "Mode", strip it to avoid doubling
  if (modePascal.endsWith('Mode')) {
    return modePascal.slice(0, -4);
  }
  return modePascal;
}

/**
 * Emits the base class for a collection (the abstract class with all getters).
 * When allCollectionNames is provided, includes imports for other collections.
 */
export function emitCollectionBaseClass(
  col: PreparedCollection,
  allCollectionNames: string[] | undefined = undefined,
  archMode: ArchMode = 'static',
): string {
  const cn = col.className;
  // Base class name matches collection name for controller compatibility
  const baseClassName = `${cn}`;
  const usesColor = collectionUsesColor(col);
  const usesAlias = collectionUsesAlias(col);

  // Attach flat getter name to each variable once.
  const vars = col.variables.map((v) => ({
    v,
    getter: flatGetterName(v.groupPath, v.leafName),
  }));

  let out = FILE_HEADER;
  if (usesColor) {
    out += `import 'package:flutter/painting.dart';\n`;
  }
  // Note: Other collection imports are NOT needed in the base class.
  // Mode classes import other collections as needed for alias resolution.
  // lerp.dart is needed when there are variables (for the lerp method)
  if (col.variables.length > 0) {
    out += `import '../src/_internal/lerp.dart';\n`;
  }

  // ── Export mode files ────────────────────────────────────────────────────
  // Always export the mode files so the controller can access the mode classes
  // by importing just this file. Exports must come before any declarations.
  for (const mode of col.modes) {
    const exportFileName = `${modeToKebabCase(mode.pascal)}.dart`;
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
  // Emit the mode enum for the controller/theme to reference
  out += `enum ${cn}Mode { ${col.modes.map((m) => m.camel).join(', ')} }\n`;

  return out;
}

/**
 * Emits a mode-specific concrete class for a collection.
 * @param isAppendedToBase - If true, skips imports and FILE_HEADER (for single-mode collections)
 */
export function emitCollectionModeClass(
  col: PreparedCollection,
  modeId: string,
  modePascal: string,
  varIndex: Map<string, VarRef>,
  allCollectionNames: string[] | undefined = undefined,
  archMode: ArchMode = 'static',
  isAppendedToBase: boolean = false,
): string {
  const cn = col.className;
  // Base class name matches collection name for controller compatibility
  const baseClassName = `${cn}`;
  // Use the suffix to avoid naming collisions (e.g., "ColorTokenLightMode" not "ColorTokenLightModeMode")
  const modeSuffix = modeClassSuffix(modePascal);
  const modeClassName = `${cn}${modeSuffix}Mode`;
  const usesColor = collectionUsesColor(col);
  const usesAlias = collectionUsesAlias(col);
  const isAllConst = !usesAlias;

  // Attach flat getter name to each variable once.
  const vars = col.variables.map((v) => ({
    v,
    getter: flatGetterName(v.groupPath, v.leafName),
  }));

  let out = '';

  // Only add imports and FILE_HEADER for separate mode files (multi-mode collections)
  // When appended to base file, imports are already present
  if (!isAppendedToBase) {
    out += FILE_HEADER;
    if (usesColor) {
      out += `import 'package:flutter/painting.dart';\n`;
    }
    // Note: lerp.dart is NOT needed in mode files - it's only in the base class
    // Mode files import the base class which has the lerp method

    // Always import own collection's base file to extend its base class
    // Mode files are in lib/{cn}/{kebab-mode}.dart, base file is lib/{cn}/{cn}.dart
    // Same directory, so just import the base filename
    out += `import '${cn}.dart';\n`;

    // In context mode: need controller import for _c
    // In static mode: need theme import for AppTheme (aliases use AppTheme.{accessor})
    // We don't import other collections directly - they're accessed via AppTheme or _c
    if (usesAlias) {
      out +=
        archMode === 'context'
          ? `import '../src/_internal/controller.dart';\n`
          : `import '../src/theme.dart';\n`;
    }
    out += '\n';
  }

  // ── Mode-specific concrete class ──────────────────────────────────────────
  // In context mode, classes that resolve aliases hold the controller as a
  // ctor-injected `_c` field instead of reaching for `DesignSystemController.instance`.
  const injectsController = archMode === 'context' && usesAlias;
  const ctorPrefix = isAllConst ? 'const ' : '';

  out += `class ${modeClassName} extends ${baseClassName} {\n`;
  if (injectsController) {
    out += `  ${modeClassName}(this._c);\n`;
    out += `  final DesignSystemController _c;\n`;
  } else {
    out += `  ${ctorPrefix}${modeClassName}();\n`;
  }
  for (const { v, getter } of vars) {
    const expr = emitValueExpr(v, modeId, varIndex, archMode);
    out += `  @override ${v.dartType} get ${getter} => ${expr};\n`;
  }
  out += `}\n`;

  return out;
}

/**
 * Emits all files for a collection.
 * Returns an array of CollectionFile objects, one for the base class and one per mode.
 *
 * @param col - The prepared collection to emit
 * @param varIndex - Variable index for alias resolution
 * @param allCollectionNames - Optional list of all collection names for cross-collection imports
 * @param archMode - Architecture mode ('static' or 'context')
 */
export function emitCollection(
  col: PreparedCollection,
  varIndex: Map<string, VarRef>,
  allCollectionNames?: string[],
  archMode: ArchMode = 'static',
): CollectionFile[] {
  const files: CollectionFile[] = [];

  // Emit base class file
  const baseClassFile: CollectionFile = {
    fileName: `${col.className}.dart`,
    contents: emitCollectionBaseClass(col, allCollectionNames, archMode),
  };
  files.push(baseClassFile);

  // Always emit mode files in separate files so the controller can access
  // the private mode classes via the export from the base file.
  for (const mode of col.modes) {
    const modeFile: CollectionFile = {
      fileName: `${modeToKebabCase(mode.pascal)}.dart`,
      contents: emitCollectionModeClass(col, mode.id, mode.pascal, varIndex, allCollectionNames, archMode),
    };
    files.push(modeFile);
  }

  return files;
}

/**
 * Legacy single-file emit for backward compatibility (if needed).
 * @deprecated Use emitCollection() which returns multiple files.
 */
export function emitCollectionSingleFile(
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
  out += `import '../src/_internal/lerp.dart';\n`;
  if (usesAlias) {
    out +=
      archMode === 'context'
        ? `import '../src/_internal/controller.dart';\n`
        : `import '../src/theme.dart';\n`;
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
      const expr = emitValueExpr(v, mode.id, varIndex, archMode);
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
}

function concreteClassName(collectionClassName: string, modePascal: string): string {
  const candidate = `${collectionClassName}${modePascal}`;
  // Prevent collision with the enum `${Collection}Mode`.
  if (candidate === `${collectionClassName}Mode`) return `${candidate}Value`;
  return candidate;
}

function emitValueExpr(
  v: PreparedVariable,
  modeId: string,
  varIndex: Map<string, VarRef>,
  archMode: ArchMode,
): string {
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
