// GENERATED FILE — do not edit by hand.

type Alias = { $alias: string };
const isAlias = (x: unknown): x is Alias => Boolean(x && typeof x === 'object' && '$alias' in (x as any));

function resolveAliases<T extends Record<string, any>>(raw: T, index: Record<string, any>): any {
  const seen = new Set<string>();
  const walk = (node: any): any => {
    if (isAlias(node)) {
      const id = node.$alias;
      if (seen.has(id)) return undefined;
      seen.add(id);
      const target = index[id];
      return walk(target);
    }
    if (!node || typeof node !== 'object') return node;
    if (Array.isArray(node)) return node.map(walk);
    const out: any = {};
    for (const [k, v] of Object.entries(node)) out[k] = walk(v);
    return out;
  };
  return walk(raw);
}

// Raw per-mode data. Aliases are encoded as { $alias: '<variableId>' }.
const _raw = {
  "darkMode": {
    "background": {
      "primary": "#FF0000FF"
    }
  },
  "lightMode": {
    "background": {
      "primary": "#00FF00FF"
    }
  }
} as const;
const _index = {
  "darkMode": {
    "var:1": "#FF0000FF"
  },
  "lightMode": {
    "var:1": "#00FF00FF"
  }
} as const;

export type ColorTokenMode = keyof typeof _raw;
export type ColorToken = (typeof colorToken)[ColorTokenMode];

// Runtime-resolved per-mode values (aliases resolved within each mode).
export const colorToken = ((): any => {
  const out: any = {};
  for (const mode of Object.keys(_raw) as Array<keyof typeof _raw>) {
    out[mode] = resolveAliases(_raw[mode], _index[mode] as any);
  }
  return out;
})() as any;

