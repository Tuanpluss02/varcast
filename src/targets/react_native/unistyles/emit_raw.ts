// Emits `src/raw.ts` — flat tables of raw per-mode values + composite plans.
// Aliases are preserved as `{ $alias: '<varId>' }` so the runtime resolver in
// build-theme can follow them against the active axis combo.

import type { CompositeColorPlan, CompositeShadowPlan, CompositeTextPlan, ThemePlan } from './planner';

export function emitRawTs(plan: ThemePlan): string {
  const lines: string[] = [];
  lines.push('// GENERATED FILE — do not edit by hand.');
  lines.push('');
  lines.push("import type { TextStyle } from 'react-native';");
  lines.push('');

  // ── Type-only declarations ────────────────────────────────────────────
  lines.push('export type Alias = { $alias: string };');
  lines.push('export type RawLeaf = string | number | boolean | Alias;');
  lines.push('');

  // ── _vars: varId → { c: collectionId, v: { [modeKey]: RawLeaf } } ──────
  lines.push('export const _vars: Record<string, { c: string; v: Record<string, RawLeaf> }> = {');
  for (const c of plan.collections) {
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
  }
  lines.push('};');
  lines.push('');

  // ── _collections: colId → { axis, modes, defaultMode, shape } ─────────
  lines.push(
    'export const _collections: Record<string, { axis: string | null; modes: string[]; defaultMode: string; shape: { path: string[]; leaf: string; varId: string }[] }> = {',
  );
  for (const c of plan.collections) {
    lines.push(`  ${JSON.stringify(c.id)}: {`);
    lines.push(`    axis: ${c.axisKey === null ? 'null' : JSON.stringify(c.axisKey)},`);
    lines.push(`    modes: ${JSON.stringify(c.modeKeys)},`);
    lines.push(`    defaultMode: ${JSON.stringify(c.defaultModeKey)},`);
    lines.push('    shape: [');
    for (const v of c.variables) {
      lines.push(
        `      { path: ${JSON.stringify(v.path)}, leaf: ${JSON.stringify(v.leaf)}, varId: ${JSON.stringify(v.id)} },`,
      );
    }
    lines.push('    ],');
    lines.push('  },');
  }
  lines.push('};');
  lines.push('');

  // ── Static composites (resolved at codegen) ───────────────────────────
  lines.push('export const _textStyles: Record<string, TextStyle> = {');
  for (const t of plan.textStyles) lines.push(`  ${JSON.stringify(t.getterName)}: ${renderTextStyle(t)},`);
  lines.push('};');
  lines.push('');

  lines.push('export const _shadows: Record<string, TextStyle> = {');
  for (const s of plan.shadows) lines.push(`  ${JSON.stringify(s.getterName)}: ${renderShadow(s)},`);
  lines.push('};');
  lines.push('');

  lines.push('export const _colorStyles: Record<string, string | null> = {');
  for (const c of plan.colorStyles) lines.push(`  ${JSON.stringify(c.getterName)}: ${renderColorStyle(c)},`);
  lines.push('};');
  lines.push('');

  return lines.join('\n');
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
