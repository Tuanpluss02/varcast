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
    renderModuleAugmentation(plan),
    '',
  ].join('\n');
}

function renderModuleAugmentation(plan: ThemePlan): string {
  const themeNames = plan.hasLightDark ? ['light', 'dark'] : ['theme'];
  const themeLines = themeNames.map((name) => `    ${name}: Theme;`);
  return [
    "declare module 'react-native-unistyles' {",
    '  export interface UnistylesThemes {',
    ...themeLines,
    '  }',
    '}',
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
  lines.push('  textStyles: Record<string, TextStyle>;');
  lines.push('  shadows: Record<string, TextStyle>;');
  lines.push('  colorStyles: Record<string, string | null>;');
  lines.push('}');
  return lines.join('\n');
}

function renderNode(name: string, node: { children: Map<string, any>; leafType?: LeafTSType }, indent: string): string[] {
  const safeKey = JSON.stringify(name);
  if (node.leafType && node.children.size === 0) {
    return [`${indent}${safeKey}: ${node.leafType};`];
  }
  const lines: string[] = [`${indent}${safeKey}: {`];
  for (const [k, child] of node.children) {
    lines.push(...renderNode(k, child, indent + '  '));
  }
  lines.push(`${indent}};`);
  return lines;
}
