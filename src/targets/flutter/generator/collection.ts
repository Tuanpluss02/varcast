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

interface GroupNode {
  path: string[];
  children: Map<string, GroupNode>;
  leaves: PreparedVariable[];
}

export function emitCollection(
  col: PreparedCollection,
  varIndex: Map<string, VarRef>,
): string {
  const root = buildTree(col.variables);
  const usesColor = collectionUsesColor(col);
  const usesAlias = collectionUsesAlias(col);

  const cn = col.className;
  const groupClass = (path: string[]) => cn + path.join('');

  const constMap = computeConstMap(root, usesAlias);

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

  emitNode(root, true);

  return out;

  function emitNode(node: GroupNode, isRoot: boolean) {
    for (const child of node.children.values()) emitNode(child, false);
    if (isRoot) {
      emitRootClasses(node);
    } else {
      emitGroupClasses(node);
    }
  }

  function emitGroupClasses(node: GroupNode) {
    const className = groupClass(node.path);
    const childGroupEntries = [...node.children.entries()];
    const fieldName = (childPath: string[]) =>
      camelOfPascal(childPath[childPath.length - 1]);

    out += `abstract class ${className} {\n`;
    out += `  const ${className}();\n`;
    for (const [, child] of childGroupEntries) {
      const childCls = groupClass(child.path);
      out += `  ${childCls} get ${fieldName(child.path)};\n`;
    }
    for (const leaf of node.leaves) {
      out += `  ${leaf.dartType} get ${leaf.leafName};\n`;
    }
    out += `\n  static ${className} lerp(${className} a, ${className} b, double t) =>\n`;
    out += `      _Lerped${className}(\n`;
    for (const [, child] of childGroupEntries) {
      const childCls = groupClass(child.path);
      const fn = fieldName(child.path);
      out += `        ${fn}: ${childCls}.lerp(a.${fn}, b.${fn}, t),\n`;
    }
    for (const leaf of node.leaves) {
      out += `        ${leaf.leafName}: a.${leaf.leafName}.lerpTo(b.${leaf.leafName}, t),\n`;
    }
    out += `      );\n`;
    out += `}\n\n`;

    for (const mode of col.modes) {
      const concreteName = `${className}${mode.pascal}`;
      const isConst = constMap.get(node) === true;
      const ctorPrefix = isConst && childGroupEntries.length === 0 ? 'const ' : '';
      out += `class ${concreteName} extends ${className} {\n`;
      if (childGroupEntries.length > 0) {
        out += `  ${ctorPrefix}${concreteName}()\n      : `;
        const inits = childGroupEntries.map(([, child]) => {
          const childCls = groupClass(child.path);
          const childConst = constMap.get(child) === true ? 'const ' : '';
          return `${fieldName(child.path)} = ${childConst}${childCls}${mode.pascal}()`;
        });
        out += inits.join(',\n        ') + ';\n';
      } else {
        out += `  ${ctorPrefix}${concreteName}();\n`;
      }
      for (const [, child] of childGroupEntries) {
        const childCls = groupClass(child.path);
        out += `  @override final ${childCls} ${fieldName(child.path)};\n`;
      }
      for (const leaf of node.leaves) {
        const expr = emitValueExpr(leaf, mode.id);
        out += `  @override ${leaf.dartType} get ${leaf.leafName} => ${expr};\n`;
      }
      out += `}\n\n`;
    }

    const lerpedName = `_Lerped${className}`;
    const childFields = childGroupEntries.map(([, child]) => ({
      type: groupClass(child.path),
      name: fieldName(child.path),
    }));
    const leafFields = node.leaves.map((l) => ({ type: l.dartType, name: l.leafName }));
    const allFields = [...childFields, ...leafFields];
    out += `class ${lerpedName} extends ${className} {\n`;
    if (allFields.length > 0) {
      out += `  const ${lerpedName}({\n`;
      for (const f of allFields) out += `    required this.${f.name},\n`;
      out += `  });\n`;
      for (const f of allFields) out += `  @override final ${f.type} ${f.name};\n`;
    } else {
      out += `  const ${lerpedName}();\n`;
    }
    out += `}\n\n`;
  }

  function emitRootClasses(node: GroupNode) {
    const className = cn;
    const childGroupEntries = [...node.children.entries()];
    const fieldName = (childPath: string[]) =>
      camelOfPascal(childPath[childPath.length - 1]);

    const ctor = childGroupEntries.length > 0 ? '' : 'const ';
    out += `abstract class ${className} {\n`;
    out += `  ${ctor}${className}();\n`;
    for (const [, child] of childGroupEntries) {
      const childCls = groupClass(child.path);
      out += `  ${childCls} get ${fieldName(child.path)};\n`;
    }
    for (const leaf of node.leaves) {
      out += `  ${leaf.dartType} get ${leaf.leafName};\n`;
    }
    out += `\n  static ${className} lerp(${className} a, ${className} b, double t) =>\n`;
    out += `      _Lerped${className}(\n`;
    for (const [, child] of childGroupEntries) {
      const childCls = groupClass(child.path);
      const fn = fieldName(child.path);
      out += `        ${fn}: ${childCls}.lerp(a.${fn}, b.${fn}, t),\n`;
    }
    for (const leaf of node.leaves) {
      out += `        ${leaf.leafName}: a.${leaf.leafName}.lerpTo(b.${leaf.leafName}, t),\n`;
    }
    out += `      );\n}\n\n`;

    for (const mode of col.modes) {
      const concreteName = `${className}${mode.pascal}`;
      out += `class ${concreteName} extends ${className} {\n`;
      if (childGroupEntries.length > 0) {
        out += `  ${concreteName}()\n      : `;
        const inits = childGroupEntries.map(([, child]) => {
          const childCls = groupClass(child.path);
          const childConst = constMap.get(child) === true ? 'const ' : '';
          return `${fieldName(child.path)} = ${childConst}${childCls}${mode.pascal}()`;
        });
        out += inits.join(',\n        ') + ';\n';
      } else {
        out += `  const ${concreteName}();\n`;
      }
      for (const [, child] of childGroupEntries) {
        const childCls = groupClass(child.path);
        out += `  @override final ${childCls} ${fieldName(child.path)};\n`;
      }
      for (const leaf of node.leaves) {
        const expr = emitValueExpr(leaf, mode.id);
        out += `  @override ${leaf.dartType} get ${leaf.leafName} => ${expr};\n`;
      }
      out += `}\n\n`;
    }

    const lerpedName = `_Lerped${className}`;
    const childFields = childGroupEntries.map(([, child]) => ({
      type: groupClass(child.path),
      name: fieldName(child.path),
    }));
    const leafFields = node.leaves.map((l) => ({ type: l.dartType, name: l.leafName }));
    const allFields = [...childFields, ...leafFields];
    out += `class ${lerpedName} extends ${className} {\n`;
    if (allFields.length > 0) {
      out += `  ${lerpedName}({\n`;
      for (const f of allFields) out += `    required this.${f.name},\n`;
      out += `  });\n`;
      for (const f of allFields) out += `  @override final ${f.type} ${f.name};\n`;
    } else {
      out += `  ${lerpedName}();\n`;
    }
    out += `}\n`;
  }

  function emitValueExpr(v: PreparedVariable, modeId: string): string {
    const val = v.valuesByMode[modeId];
    if (!val) return defaultExprFor(v.dartType);
    if (val.kind === 'alias') {
      const ref = varIndex.get(val.targetVariableId);
      if (!ref) return defaultExprFor(v.dartType);
      const path = [
        `AppTheme`,
        ref.collectionAccessor,
        ...ref.groupPath.map(camelOfPascal),
        ref.leafName,
      ];
      return path.join('.');
    }
    return literalFor(v.dartType, val);
  }
}

function buildTree(variables: PreparedVariable[]): GroupNode {
  const root: GroupNode = { path: [], children: new Map(), leaves: [] };
  for (const v of variables) {
    let node = root;
    for (const seg of v.groupPath) node = ensureChild(node, seg);
    node.leaves.push(v);
  }
  return root;
}

function ensureChild(parent: GroupNode, name: string): GroupNode {
  const existing = parent.children.get(name);
  if (existing) return existing;
  const child: GroupNode = {
    path: [...parent.path, name],
    children: new Map(),
    leaves: [],
  };
  parent.children.set(name, child);
  return child;
}

function computeConstMap(root: GroupNode, usesAlias: boolean): Map<GroupNode, boolean> {
  const map = new Map<GroupNode, boolean>();
  function walk(node: GroupNode) {
    const isConst = !usesAlias && node.children.size === 0;
    map.set(node, isConst);
    for (const child of node.children.values()) walk(child);
  }
  walk(root);
  if (root.children.size > 0) map.set(root, false);
  return map;
}

function camelOfPascal(s: string): string {
  if (!s) return s;
  return s[0].toLowerCase() + s.slice(1);
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

