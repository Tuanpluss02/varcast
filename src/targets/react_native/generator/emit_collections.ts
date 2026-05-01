import type { IRValue } from '../../../ir/types';
import type { EmittedFile } from '../../../core/target';
import { rgbaToRRGGBBAA } from '../type_mapping';
import type { PreparedRN, PreparedRNCollection, PreparedRNVariable } from './prepare';

type AliasMarker = { $alias: string };

function isAliasMarker(x: unknown): x is AliasMarker {
  return Boolean(x && typeof x === 'object' && '$alias' in (x as any));
}

function valueLiteral(v: IRValue): unknown {
  if (v.kind === 'alias') return { $alias: v.targetVariableId } satisfies AliasMarker;
  const val = v.value as any;
  if (typeof val === 'number' || typeof val === 'string' || typeof val === 'boolean') return val;
  // RGBA
  return rgbaToRRGGBBAA(val);
}

function setDeep(obj: any, path: string[], leaf: string, value: unknown) {
  let cur = obj;
  for (const p of path) {
    if (!cur[p]) cur[p] = {};
    cur = cur[p];
  }
  cur[leaf] = value;
}

export function emitCollections(prepared: PreparedRN): EmittedFile[] {
  const files: EmittedFile[] = [];
  for (const col of prepared.collections) {
    files.push(...emitOneCollection(col));
  }
  return files;
}

function emitOneCollection(col: PreparedRNCollection): EmittedFile[] {
  const isPrimitive = col.kind === 'primitive';
  const dir = isPrimitive ? 'src/tokens/primitives' : 'src/tokens/tokens';
  const path = `${dir}/${col.fileBaseName}.ts`;

  const rawByMode: Record<string, any> = {};
  const indexByMode: Record<string, Record<string, unknown>> = {};
  for (const m of col.modes) {
    rawByMode[m.key] = {};
    indexByMode[m.key] = {};
  }
  for (const v of col.variables) {
    for (const m of col.modes) {
      const vv = v.valuesByMode[m.id];
      if (!vv) continue;
      const lit = valueLiteral(vv);
      setDeep(rawByMode[m.key], v.groupPathKeys, v.stableLeafKey, lit);
      indexByMode[m.key][v.id] = lit;
    }
  }

  const content = emitCollectionModule(col, rawByMode, indexByMode);
  return [{ path, contents: content }];
}

function emitCollectionModule(
  col: PreparedRNCollection,
  rawByMode: Record<string, any>,
  indexByMode: Record<string, Record<string, unknown>>,
): string {
  const exportName = col.exportName;
  const typeName = col.typeName;

  return [
    `// GENERATED FILE — do not edit by hand.`,
    ``,
    `type Alias = { $alias: string };`,
    `const isAlias = (x: unknown): x is Alias => Boolean(x && typeof x === 'object' && '$alias' in (x as any));`,
    ``,
    `function resolveAliases<T extends Record<string, any>>(raw: T, index: Record<string, any>): any {`,
    `  const seen = new Set<string>();`,
    `  const walk = (node: any): any => {`,
    `    if (isAlias(node)) {`,
    `      const id = node.$alias;`,
    `      if (seen.has(id)) return undefined;`,
    `      seen.add(id);`,
    `      const target = index[id];`,
    `      return walk(target);`,
    `    }`,
    `    if (!node || typeof node !== 'object') return node;`,
    `    if (Array.isArray(node)) return node.map(walk);`,
    `    const out: any = {};`,
    `    for (const [k, v] of Object.entries(node)) out[k] = walk(v);`,
    `    return out;`,
    `  };`,
    `  return walk(raw);`,
    `}`,
    ``,
    `// Raw per-mode data. Aliases are encoded as { $alias: '<variableId>' }.`,
    `const _raw = ${JSON.stringify(rawByMode, null, 2)} as const;`,
    `const _index = ${JSON.stringify(indexByMode, null, 2)} as const;`,
    ``,
    `export type ${typeName}Mode = keyof typeof _raw;`,
    `export type ${typeName} = (typeof ${exportName})[${typeName}Mode];`,
    ``,
    `// Runtime-resolved per-mode values (aliases resolved within each mode).`,
    `export const ${exportName} = ((): any => {`,
    `  const out: any = {};`,
    `  for (const mode of Object.keys(_raw) as Array<keyof typeof _raw>) {`,
    `    out[mode] = resolveAliases(_raw[mode], _index[mode] as any);`,
    `  }`,
    `  return out;`,
    `})() as any;`,
    ``,
  ].join('\n') + '\n';
}

