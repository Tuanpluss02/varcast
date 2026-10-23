import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import { getAllTargets } from '../../core/registry';
import { runEngine } from '../../core/emit_engine';
import type { IR } from '../../ir/types';
import '../../targets/flutter';
import '../../targets/react_native';
import '../../targets/compose';

const GOLDEN_IR: IR = JSON.parse(
  fs.readFileSync(path.resolve(__dirname, '../../../test_fixtures/golden_tokens.json'), 'utf-8'),
);

describe.each(getAllTargets().map((t) => [t.id, t]))(
  'Target Conformance Suite: [%s]',
  (targetId, target) => {
    describe('Contract Invariants', () => {
      it('has valid targetId format /^[a-z][a-z0-9_-]*$/', () => {
        expect(target.id).toMatch(/^[a-z][a-z0-9_-]*$/);
      });

      it('has valid non-empty displayName and defaultPackageName', () => {
        expect(target.displayName.length).toBeGreaterThan(0);
        expect(target.defaultPackageName.length).toBeGreaterThan(0);
      });
    });

    describe('Pipeline Sanity', () => {
      it('emits non-empty files without path traversal', () => {
        const out = runEngine(GOLDEN_IR, [target], null);
        expect(out.files.length).toBeGreaterThan(0);
        for (const f of out.files) {
          expect(f.path).not.toMatch(/\.\./);
          expect(f.path).not.toMatch(/^[/\\]/);
          expect(f.contents.trim().length).toBeGreaterThan(0);
        }
      });

      it('produces valid nextManifest with target section', () => {
        const out = runEngine(GOLDEN_IR, [target], null);
        const section = out.nextManifest.targets[targetId];
        expect(section).toBeDefined();
        expect(Object.keys(section.variables).length).toBeGreaterThan(0);
        expect(Object.keys(section.collections).length).toBeGreaterThan(0);
      });
    });

    describe('Idempotency (0 diffs on re-export)', () => {
      it('re-export with nextManifest produces 0 added, removed, or renamed diffs', () => {
        const run1 = runEngine(GOLDEN_IR, [target], null);
        const run2 = runEngine(GOLDEN_IR, [target], run1.nextManifest);
        const diff = run2.diffsByTarget[targetId];

        expect(diff.variables.added).toHaveLength(0);
        expect(diff.variables.removed).toHaveLength(0);
        expect(diff.variables.renamed).toHaveLength(0);
        expect(diff.collections.added).toHaveLength(0);
        expect(diff.collections.removed).toHaveLength(0);
      });
    });

    describe('Edge Cases & Fault Tolerance', () => {
      it('gracefully handles empty collections without crashing', () => {
        const emptyIR: IR = {
          version: '1.0',
          fileKey: 'empty',
          generatedAt: new Date(0).toISOString(),
          collections: [],
          composites: { paintStyles: [], effectStyles: [], textStyles: [] },
        };
        expect(() => runEngine(emptyIR, [target], null)).not.toThrow();
      });

      it('gracefully handles dangling aliases by capturing warnings without throwing', () => {
        const danglingIR: IR = {
          version: '1.0',
          fileKey: 'dangling',
          generatedAt: new Date(0).toISOString(),
          collections: [
            {
              id: 'col:1',
              name: 'Tokens',
              kind: 'token',
              modes: [{ id: 'm:1', name: 'Default' }],
              variables: [
                {
                  id: 'v:broken',
                  figmaName: 'broken_alias',
                  groupPath: ['broken_alias'],
                  type: 'COLOR',
                  scopes: [],
                  hiddenFromPublishing: false,
                  emitToPublic: true,
                  valuesByMode: {
                    'm:1': { kind: 'alias', targetVariableId: 'v:non_existent' },
                  },
                },
              ],
            },
          ],
          composites: { paintStyles: [], effectStyles: [], textStyles: [] },
        };
        const out = runEngine(danglingIR, [target], null);
        expect(out.warnings.some((w) => w.code === 'UNRESOLVED_ALIAS')).toBe(true);
      });
    });
  },
);
