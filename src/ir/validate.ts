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
// Iterative DFS with a global "visited" set: each variable is explored at most
// once across the whole pass (O(V + E) overall). When DFS revisits a node
// already on the current stack we have a back-edge → cycle. Cycles are
// canonicalised (rotated to start at the lexicographically smallest id) so the
// same cycle reached from different entry points dedupes.

function detectCycles(
  col: IRCollection,
  allVars: Map<string, IRVariable>,
  errors: ValidationError[],
): void {
  const reported = new Set<string>();
  const visited = new Set<string>();

  for (const v of col.variables) {
    if (visited.has(v.id)) continue;
    findCyclesFrom(v.id, allVars, visited, reported, errors);
  }
}

type Frame = { id: string; aliasIds: string[]; cursor: number };

function findCyclesFrom(
  startId: string,
  allVars: Map<string, IRVariable>,
  visited: Set<string>,
  reported: Set<string>,
  errors: ValidationError[],
): void {
  const onStack = new Set<string>();
  const stack: Frame[] = [];

  const push = (id: string) => {
    if (visited.has(id) || onStack.has(id)) return;
    const v = allVars.get(id);
    const aliasIds: string[] = [];
    if (v) {
      for (const val of Object.values(v.valuesByMode)) {
        if (val.kind === 'alias') aliasIds.push(val.targetVariableId);
      }
    }
    onStack.add(id);
    stack.push({ id, aliasIds, cursor: 0 });
  };

  push(startId);

  while (stack.length > 0) {
    const top = stack[stack.length - 1];
    if (top.cursor >= top.aliasIds.length) {
      onStack.delete(top.id);
      visited.add(top.id);
      stack.pop();
      continue;
    }
    const next = top.aliasIds[top.cursor++];
    if (onStack.has(next)) {
      const startIdx = stack.findIndex((f) => f.id === next);
      const cycle = stack.slice(startIdx).map((f) => f.id);
      cycle.push(next);
      const key = canonicalCycleKey(cycle);
      if (!reported.has(key)) {
        reported.add(key);
        errors.push({ type: 'CYCLE', path: cycle });
      }
      continue;
    }
    if (visited.has(next)) continue;
    push(next);
  }
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
