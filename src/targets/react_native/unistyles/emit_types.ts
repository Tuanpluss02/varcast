// Emits `src/types.ts` — `Theme` and `ThemeOptions` interfaces derived from
// the prepared shape. These are explicit (not `typeof`-derived) so leaf
// types stay narrow (`number`/`string`) instead of being widened to `any`.

import type { LeafTSType, ThemePlan } from './planner';

export function emitTypesTs(plan: ThemePlan): string {
  return [
    '// GENERATED FILE — do not edit by hand.',
    '',
    "import type { TextStyle } from 'react-native';",
    '',
    renderThemeOptions(plan),
    '',
    renderTheme(plan),
    '',
  ].join('\n');
}

function renderThemeOptions(plan: ThemePlan): string {
  if (plan.axes.length === 0) {
    return ['export interface ThemeOptions {', '  // no axis collections detected', '}'].join('\n');
  }
  const lines: string[] = ['export interface ThemeOptions {'];
  for (const a of plan.axes) {
    const union = a.modes.map((m) => JSON.stringify(m.keyCamel)).join(' | ');
    lines.push(`  ${a.keyCamel}: ${union};`);
  }
  lines.push('}');
  return lines.join('\n');
}

function renderTheme(plan: ThemePlan): string {
  // Build a nested type tree from `plan.shape`.
  type Node = { children: Map<string, Node>; leafType?: LeafTSType };
  const root: Node = { children: new Map() };
  for (const leaf of plan.shape) {
    let cur = root;
    for (const seg of leaf.path) {
      let next = cur.children.get(seg);
      if (!next) {
        next = { children: new Map() };
        cur.children.set(seg, next);
      }
      cur = next;
    }
    let leafNode = cur.children.get(leaf.leaf);
    if (!leafNode) {
      leafNode = { children: new Map() };
      cur.children.set(leaf.leaf, leafNode);
    }
    leafNode.leafType = leaf.tsType;
  }

  const lines: string[] = ['export interface Theme {'];
  for (const [key, node] of root.children) {
    lines.push(...renderNode(key, node, '  '));
  }
  lines.push(...renderCompositeBlock('textStyles', plan.textStyles.map((s) => s.getterName), 'TextStyle'));
  lines.push(...renderCompositeBlock('shadows', plan.shadows.map((s) => s.getterName), 'TextStyle'));
  lines.push(...renderCompositeBlock('colorStyles', plan.colorStyles.map((s) => s.getterName), 'string | null'));
  lines.push('}');
  return lines.join('\n');
}

function renderCompositeBlock(name: string, keys: string[], valueType: string): string[] {
  // Composites are flattened by getterName across groups, mirroring the
  // runtime emit. Same getterName from different groups overwrites at
  // runtime (last write wins) — match that here by deduping the type keys.
  const unique = Array.from(new Set(keys));
  if (unique.length === 0) {
    return [`  ${name}: {};`];
  }
  const lines = [`  ${name}: {`];
  for (const k of unique) lines.push(`    ${JSON.stringify(k)}: ${valueType};`);
  lines.push('  };');
  return lines;
}

function renderNode(name: string, node: { children: Map<string, any>; leafType?: LeafTSType }, indent: string): string[] {
  const safeKey = JSON.stringify(name);
  if (node.leafType && node.children.size === 0) {
    return [`${indent}${safeKey}: ${renderLeafType(node.leafType)};`];
  }
  const lines: string[] = [`${indent}${safeKey}: {`];
  for (const [k, child] of node.children) {
    lines.push(...renderNode(k, child, indent + '  '));
  }
  lines.push(`${indent}};`);
  return lines;
}

function renderLeafType(t: LeafTSType): string {
  // FONT_WEIGHT-scoped variables hold values like 400 or "bold". Typing them
  // as RN's TextStyle['fontWeight'] union (matches '100'…'900' | 'normal' |
  // 'bold' | …) means consumers don't need to cast.
  if (t === 'fontWeight') return "TextStyle['fontWeight']";
  return t;
}
