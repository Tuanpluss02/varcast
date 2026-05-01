import type { IR, IRCollection, IRVariable } from './types';

export interface ValidationResult {
  errors: ValidationError[];
  warnings: ValidationWarning[];
}

export type ValidationError = { type: 'CYCLE'; path: string[] };

// Target-neutral warnings only. Per-target naming concerns (reserved-word
// conflicts, duplicate identifier conflicts) live in each target's prepare
// step because reserved-word sets and identifier rules differ per language.
export type ValidationWarning =
  | { type: 'UNRESOLVED_ALIAS'; variableId: string; targetId: string }
  | { type: 'DIAMOND_APPROXIMATED'; styleId: string }
  | { type: 'IMAGE_ASSET_REQUIRED'; styleId: string; assetName: string };

// Mutates the IR in place: rounds floats, applies hidden flag, marks
// unresolved aliases. Returns errors (block emit) and warnings (emit
// proceeds; surfaced in UI).
export function validate(ir: IR): ValidationResult {
  const errors: ValidationError[] = [];
  const warnings: ValidationWarning[] = [];

  const allVars = new Map<string, IRVariable>();
  for (const col of ir.collections) {
    for (const v of col.variables) {
      allVars.set(v.id, v);
    }
  }

  for (const col of ir.collections) {
    detectCycles(col, allVars, errors);
    resolveAliases(col, allVars, warnings);
    roundFloats(col);
    applyHidden(col);
  }

  for (const style of ir.composites.paintStyles) {
    if (style.type === 'GRADIENT_DIAMOND') {
      warnings.push({ type: 'DIAMOND_APPROXIMATED', styleId: style.id });
    }
  }

  return { errors, warnings };
}

// ── Rule 1: cycle detection ─────────────────────────────────────────────────
//
// DFS from each variable, treating alias targets as edges. A cycle is reported
// once per unique vertex set; we canonicalise the path by rotating to start at
// the lexicographically smallest id, so the same cycle reached from different
// entry points dedupes.

function detectCycles(
  col: IRCollection,
  allVars: Map<string, IRVariable>,
  errors: ValidationError[],
): void {
  const reported = new Set<string>();

  for (const v of col.variables) {
    const cycle = findCycle(v.id, allVars);
    if (!cycle) continue;
    const key = canonicalCycleKey(cycle);
    if (reported.has(key)) continue;
    reported.add(key);
    errors.push({ type: 'CYCLE', path: cycle });
  }
}

function findCycle(
  startId: string,
  allVars: Map<string, IRVariable>,
): string[] | null {
  const stack: { id: string; path: string[] }[] = [
    { id: startId, path: [] },
  ];
  // Iterative DFS to avoid stack blowups on pathological graphs.
  while (stack.length > 0) {
    const { id, path } = stack.pop()!;
    if (path.includes(id)) {
      const start = path.indexOf(id);
      return [...path.slice(start), id];
    }
    const v = allVars.get(id);
    if (!v) continue;
    const nextPath = [...path, id];
    for (const val of Object.values(v.valuesByMode)) {
      if (val.kind === 'alias') {
        stack.push({ id: val.targetVariableId, path: nextPath });
      }
    }
  }
  return null;
}

function canonicalCycleKey(cycle: string[]): string {
  // cycle is [a, b, c, a]; vertex set is [a, b, c]
  const verts = cycle.slice(0, -1);
  let minIdx = 0;
  for (let i = 1; i < verts.length; i++) {
    if (verts[i] < verts[minIdx]) minIdx = i;
  }
  const rotated = verts.slice(minIdx).concat(verts.slice(0, minIdx));
  return rotated.join('→');
}

// ── Rule 2: unresolved alias ────────────────────────────────────────────────

function resolveAliases(
  col: IRCollection,
  allVars: Map<string, IRVariable>,
  warnings: ValidationWarning[],
): void {
  for (const v of col.variables) {
    for (const val of Object.values(v.valuesByMode)) {
      if (val.kind !== 'alias') continue;
      if (!allVars.has(val.targetVariableId)) {
        warnings.push({
          type: 'UNRESOLVED_ALIAS',
          variableId: v.id,
          targetId: val.targetVariableId,
        });
        v.emitToPublic = false;
      }
    }
  }
}

// ── Rule 3: float noise rounding ────────────────────────────────────────────
//
// Figma stores some floats as binary32 (e.g. 0.30000001192092896). Round all
// FLOAT literals to 6 decimals so emitted Dart is readable.

function roundFloats(col: IRCollection): void {
  for (const v of col.variables) {
    if (v.type !== 'FLOAT') continue;
    for (const [modeId, val] of Object.entries(v.valuesByMode)) {
      if (val.kind === 'literal' && typeof val.value === 'number') {
        v.valuesByMode[modeId] = {
          kind: 'literal',
          value: Math.round(val.value * 1e6) / 1e6,
        };
      }
    }
  }
}

// ── Rule 4: hidden flag → emitToPublic=false (no warning) ───────────────────

function applyHidden(col: IRCollection): void {
  for (const v of col.variables) {
    if (v.hiddenFromPublishing) v.emitToPublic = false;
  }
}
