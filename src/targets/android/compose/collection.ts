import type { IRValue, RGBA } from '../../../ir/types';
import {
  boolLiteral,
  colorLiteral,
  FILE_HEADER,
  floatLiteral,
  stringLiteral,
  subPackageLine,
} from './emit_helpers';
import type {
  AndroidVarRef,
  KotlinType,
  PreparedAndroidCollection,
  PreparedAndroidVariable,
} from '../shared/prepare';

export function collectionDir(col: PreparedAndroidCollection): 'primitives' | 'tokens' {
  for (const v of col.variables) {
    for (const val of Object.values(v.valuesByMode)) {
      if (val.kind === 'alias') return 'tokens';
    }
  }
  return col.kind === 'primitive' ? 'primitives' : 'tokens';
}

export function emitCollection(
  namespace: string,
  col: PreparedAndroidCollection,
  varIndex: Map<string, AndroidVarRef>,
): string {
  const cn = col.className;
  const vars = col.variables.map((v) => ({ v, getter: flatGetterName(v.groupPath, v.leafName) }));
  const usesColor = vars.some(({ v }) => v.kotlinType === 'Color');
  const usesAlias = collectionUsesAlias(col);

  let out = FILE_HEADER;
  out += subPackageLine(namespace, collectionDir(col));
  if (usesColor) out += `import androidx.compose.ui.graphics.Color\n`;
  out += `import ${namespace}.internal.lerpTo\n`;
  if (usesAlias) out += `import ${namespace}.internal.DesignSystemController\n`;
  out += `\n`;

  out += `enum class ${cn}Mode { ${col.modes.map((m) => m.enumEntry).join(', ')} }\n\n`;

  out += `abstract class ${cn} {\n`;
  for (const { v, getter } of vars) {
    out += `    abstract val ${getter}: ${v.kotlinType}\n`;
  }
  out += `\n`;
  out += `    companion object {\n`;
  out += `        fun lerp(a: ${cn}, b: ${cn}, t: Float): ${cn} = Lerped${cn}(a, b, t)\n`;
  out += `    }\n`;
  out += `}\n\n`;

  const injectsController = usesAlias;
  for (const mode of col.modes) {
    const concrete = concreteClassName(cn, mode.enumEntry);
    out += `class ${concrete} internal constructor(`;
    out += injectsController ? `private val c: DesignSystemController` : '';
    out += `) : ${cn}() {\n`;
    for (const { v, getter } of vars) {
      const expr = emitValueExpr(v, mode.id, varIndex);
      out += `    override val ${getter}: ${v.kotlinType}\n`;
      out += `        get() = ${expr}\n`;
    }
    out += `}\n\n`;
  }

  out += `private class Lerped${cn}(\n`;
  out += `    private val a: ${cn},\n`;
  out += `    private val b: ${cn},\n`;
  out += `    private val t: Float,\n`;
  out += `) : ${cn}() {\n`;
  for (const { v, getter } of vars) {
    out += `    override val ${getter}: ${v.kotlinType}\n`;
    out += `        get() = a.${getter}.lerpTo(b.${getter}, t)\n`;
  }
  out += `}\n`;

  return out;
}

export function flatGetterName(groupPath: string[], leafName: string): string {
  if (groupPath.length === 0) return leafName;
  const [first, ...rest] = groupPath;
  return lowerFirst(first) + rest.join('') + leafSuffix(leafName);
}

export function aliasExpr(ref: AndroidVarRef): string {
  return `c.${ref.collectionAccessor}.${flatGetterName(ref.groupPath, ref.leafName)}`;
}

export function concreteClassName(collectionClassName: string, modeEntry: string): string {
  const candidate = `${collectionClassName}${modeEntry}`;
  if (candidate === `${collectionClassName}Mode`) return `${candidate}Value`;
  return candidate;
}

export function defaultExprFor(t: KotlinType): string {
  switch (t) {
    case 'Color':
      return 'Color.Transparent';
    case 'Float':
      return '0f';
    case 'String':
      return '""';
    case 'Boolean':
      return 'false';
  }
}

export function literalFor(t: KotlinType, v: IRValue): string {
  if (v.kind !== 'literal') return defaultExprFor(t);
  switch (t) {
    case 'Color':
      return colorLiteral(v.value as RGBA);
    case 'Float':
      return floatLiteral(v.value as number);
    case 'String':
      return stringLiteral(v.value as string);
    case 'Boolean':
      return boolLiteral(v.value as boolean);
  }
}

function emitValueExpr(
  v: PreparedAndroidVariable,
  modeId: string,
  varIndex: Map<string, AndroidVarRef>,
): string {
  const val = v.valuesByMode[modeId];
  if (!val) return defaultExprFor(v.kotlinType);
  if (val.kind === 'alias') {
    const ref = varIndex.get(val.targetVariableId);
    if (!ref) return defaultExprFor(v.kotlinType);
    return aliasExpr(ref);
  }
  return literalFor(v.kotlinType, val);
}

function collectionUsesAlias(col: PreparedAndroidCollection): boolean {
  return col.variables.some((v) =>
    Object.values(v.valuesByMode).some((val) => val.kind === 'alias'),
  );
}

function leafSuffix(leafName: string): string {
  if (/^n\d+$/.test(leafName)) return leafName.slice(1);
  return leafName.charAt(0).toUpperCase() + leafName.slice(1);
}

function lowerFirst(s: string): string {
  return s ? s[0].toLowerCase() + s.slice(1) : s;
}
