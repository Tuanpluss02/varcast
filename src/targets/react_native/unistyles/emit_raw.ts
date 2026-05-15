// Emits structured data modules for the Unistyles flavor.
//
// The generated package intentionally mirrors the Flutter output shape:
// collection data lives under `src/collections/*`, shared raw-data contracts
// under `src/data/*`, and composites under `src/composites/*`.

import type {
  CollectionPlan,
  CompositeColorPlan,
  CompositeShadowPlan,
  CompositeTextPlan,
  ThemePlan,
} from './planner';

export function emitDataTypesTs(): string {
  return [
    '// GENERATED FILE — do not edit by hand.',
    '',
    'export type Alias = { $alias: string };',
    'export type RawLeaf = string | number | boolean | Alias;',
    'export type RawVariable = { c: string; v: Record<string, RawLeaf> };',
    'export type RawCollection = {',
    '  axis: string | null;',
    '  modes: string[];',
    '  defaultMode: string;',
    '  shape: { path: string[]; leaf: string; varId: string }[];',
    '};',
    '',
  ].join('\n');
}

export function emitCollectionDataTs(c: CollectionPlan): string {
  const lines: string[] = [];
  lines.push('// GENERATED FILE — do not edit by hand.');
  lines.push('');
  lines.push("import type { RawCollection, RawVariable } from '../data/types';");
  lines.push('');

  lines.push('export const vars: Record<string, RawVariable> = {');
  for (const v of c.variables) {
    const valueObj: string[] = [];
    for (const [modeKey, slot] of Object.entries(v.rawByMode)) {
      const rendered =
        slot.kind === 'literal'
          ? renderLiteral(slot.value)
          : `{ $alias: ${JSON.stringify(slot.varId)} }`;
      valueObj.push(`    ${JSON.stringify(modeKey)}: ${rendered},`);
    }
    lines.push(`  ${JSON.stringify(v.id)}: { c: ${JSON.stringify(c.id)}, v: {`);
    lines.push(...valueObj);
    lines.push('  } },');
  }
  lines.push('};');
  lines.push('');

  lines.push('export const collection: RawCollection = {');
  lines.push(`  axis: ${c.axisKey === null ? 'null' : JSON.stringify(c.axisKey)},`);
  lines.push(`  modes: ${JSON.stringify(c.modeKeys)},`);
  lines.push(`  defaultMode: ${JSON.stringify(c.defaultModeKey)},`);
  lines.push('  shape: [');
  for (const v of c.variables) {
    lines.push(
      `    { path: ${JSON.stringify(v.path)}, leaf: ${JSON.stringify(v.leaf)}, varId: ${JSON.stringify(v.id)} },`,
    );
  }
  lines.push('  ],');
  lines.push('};');
  lines.push('');

  return lines.join('\n');
}

export function emitDataIndexTs(plan: ThemePlan): string {
  const imports: string[] = [];
  const varsEntries: string[] = [];
  const collectionEntries: string[] = [];

  for (const c of plan.collections) {
    const ident = identifierForCollection(c);
    imports.push(
      `import { vars as ${ident}Vars, collection as ${ident}Collection } from '../collections/${collectionFileBaseName(c)}';`,
    );
    varsEntries.push(`  ...${ident}Vars,`);
    collectionEntries.push(`  ${JSON.stringify(c.id)}: ${ident}Collection,`);
  }

  return [
    '// GENERATED FILE — do not edit by hand.',
    '',
    "import type { RawCollection, RawVariable } from './types';",
    ...imports,
    '',
    'export const _vars: Record<string, RawVariable> = {',
    ...varsEntries,
    '};',
    '',
    'export const _collections: Record<string, RawCollection> = {',
    ...collectionEntries,
    '};',
    '',
  ].join('\n');
}

export function emitTextStylesTs(plan: ThemePlan): string {
  const lines: string[] = [
    '// GENERATED FILE — do not edit by hand.',
    '',
    "import type { TextStyle } from 'react-native';",
    '',
    'export const _textStyles: Record<string, TextStyle> = {',
  ];
  for (const t of plan.textStyles) {
    lines.push(`  ${JSON.stringify(t.getterName)}: ${renderTextStyle(t)},`);
  }
  lines.push('};', '');
  return lines.join('\n');
}

export function emitShadowsTs(plan: ThemePlan): string {
  const lines: string[] = [
    '// GENERATED FILE — do not edit by hand.',
    '',
    "import type { TextStyle } from 'react-native';",
    '',
    'export const _shadows: Record<string, TextStyle> = {',
  ];
  for (const s of plan.shadows) {
    lines.push(`  ${JSON.stringify(s.getterName)}: ${renderShadow(s)},`);
  }
  lines.push('};', '');
  return lines.join('\n');
}

export function emitColorStylesTs(plan: ThemePlan): string {
  const lines: string[] = [
    '// GENERATED FILE — do not edit by hand.',
    '',
    'export const _colorStyles: Record<string, string | null> = {',
  ];
  for (const c of plan.colorStyles) {
    lines.push(`  ${JSON.stringify(c.getterName)}: ${renderColorStyle(c)},`);
  }
  lines.push('};', '');
  return lines.join('\n');
}

export function collectionFileBaseName(c: CollectionPlan): string {
  return c.rootKey
    .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase() || 'collection';
}

function identifierForCollection(c: CollectionPlan): string {
  const raw = c.rootKey.replace(/[^a-zA-Z0-9_$]/g, '_') || 'collection';
  const ident = /^[A-Za-z_$]/.test(raw) ? raw : `collection_${raw}`;
  return `${ident}CollectionData`;
}

function renderLiteral(v: string | number | boolean): string {
  if (typeof v === 'number') return Number.isFinite(v) ? String(v) : '0';
  if (typeof v === 'boolean') return v ? 'true' : 'false';
  return JSON.stringify(v);
}

function renderTextStyle(t: CompositeTextPlan): string {
  const parts: string[] = [];
  if (t.fontFamily !== undefined) parts.push(`fontFamily: ${JSON.stringify(t.fontFamily)}`);
  if (t.fontSize !== undefined) parts.push(`fontSize: ${t.fontSize}`);
  if (t.fontWeight !== undefined) parts.push(`fontWeight: ${JSON.stringify(t.fontWeight)} as const`);
  if (t.lineHeight !== undefined) parts.push(`lineHeight: ${t.lineHeight}`);
  if (t.letterSpacing !== undefined) parts.push(`letterSpacing: ${t.letterSpacing}`);
  return `{ ${parts.join(', ')} }`;
}

function renderShadow(s: CompositeShadowPlan): string {
  if (s.type === 'DROP_SHADOW' || s.type === 'INNER_SHADOW') {
    const off = s.shadowOffset ?? { width: 0, height: 0 };
    return [
      '{ ',
      `shadowColor: ${JSON.stringify(s.shadowColor ?? '#00000000')}, `,
      `shadowOffset: { width: ${off.width}, height: ${off.height} }, `,
      `shadowRadius: ${s.shadowRadius ?? 0}, `,
      `shadowOpacity: ${s.shadowOpacity ?? 1} `,
      '}',
    ].join('');
  }
  return `{ /* ${s.type} not supported in v1 */ }`;
}

function renderColorStyle(c: CompositeColorPlan): string {
  if (c.type === 'SOLID') return JSON.stringify(c.color ?? null);
  return `null /* ${c.type} not supported in v1 */`;
}
