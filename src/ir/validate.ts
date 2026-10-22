import type { IR, IRCollection, IRVariable } from './types';

export interface ValidationResult {
  errors: ValidationError[];
  warnings: ValidationWarning[];
}

export type ValidationError = { type: 'CYCLE'; path: string[] };

/**
 * Target-neutral validation warnings.
 * Per-target naming conflicts (e.g., reserved words) are handled in the target's prepare step.
 */
export type ValidationWarning =
  | { type: 'UNRESOLVED_ALIAS'; variableId: string; targetId: string }
  | { type: 'DIAMOND_APPROXIMATED'; styleId: string }
  | { type: 'IMAGE_ASSET_REQUIRED'; styleId: string; assetName: string };

/**
 * Validates the IR for cycles and warnings.
 * Pure inspection — does not mutate the IR.
 * @returns Validation errors (blocks emit) and warnings (surfaced in UI).
 */
export function validate(ir: IR): ValidationResult {
  const errors: ValidationError[] = [];
  const warnings: ValidationWarning[] = [];

  const allVars = new Map<string, IRVariable>();
  for (const col of ir.collections) {
    for (const v of col.variables) {
      allVars.set(v.id, v);
    }
  }

  const reported = new Set<string>();
  const visited = new Set<string>();
  for (const col of ir.collections) {
    detectCycles(col, allVars, errors, visited, reported);
    findUnresolvedAliases(col, allVars, warnings);
  }

  for (const style of ir.composites.paintStyles) {
    if (style.type === 'GRADIENT_DIAMOND') {
      warnings.push({ type: 'DIAMOND_APPROXIMATED', styleId: style.id });
    }
  }

  return { errors, warnings };
}

/**
 * Detects cyclic alias dependencies using iterative post-order DFS (O(V + E)).
 * Cycles are canonicalized to avoid duplicate reports from different entry points.
 */
function detectCycles(
  col: IRCollection,
  allVars: Map<string, IRVariable>,
  errors: ValidationError[],
  visited: Set<string>,
  reported: Set<string>,
): void {
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
  const verts = cycle.slice(0, -1);
  let minIdx = 0;
  for (let i = 1; i < verts.length; i++) {
    if (verts[i] < verts[minIdx]) minIdx = i;
  }
  const rotated = verts.slice(minIdx).concat(verts.slice(0, minIdx));
  return rotated.join('→');
}

function findUnresolvedAliases(
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
      }
    }
  }
}
