import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import { getAllTargets } from '../../core/registry';
import { runEngine } from '../../core/emit_engine';
import type { IR } from '../../ir/types';
import '../../targets/flutter';
import '../../targets/react_native';

const GOLDEN_IR: IR = JSON.parse(
  fs.readFileSync(path.resolve(__dirname, '../../../test_fixtures/golden_tokens.json'), 'utf-8'),
);

describe('Cross-Target Parity Matrix', () => {
  it('all registered targets manage the exact same set of public variable IDs', () => {
    const targets = getAllTargets();
    expect(targets.length).toBeGreaterThan(1);

    const summaries = targets.map((t) => {
      const out = runEngine(GOLDEN_IR, [t], null);
      const section = out.nextManifest.targets[t.id];
      return {
        targetId: t.id,
        variableIds: Object.keys(section.variables).sort(),
        collectionIds: Object.keys(section.collections).sort(),
      };
    });

    const baseline = summaries[0];
    for (const other of summaries.slice(1)) {
      expect(other.variableIds).toEqual(baseline.variableIds);
      expect(other.collectionIds).toEqual(baseline.collectionIds);
    }
  });

  it('all registered targets produce identical version 2.0 and fileKey in manifest', () => {
    const targets = getAllTargets();
    const outputs = targets.map((t) => runEngine(GOLDEN_IR, [t], null));

    for (const out of outputs) {
      expect(out.nextManifest.version).toBe('2.0');
      expect(out.nextManifest.fileKey).toBe(GOLDEN_IR.fileKey);
    }
  });
});
