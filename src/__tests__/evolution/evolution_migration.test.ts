import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import { getAllTargets } from '../../core/registry';
import { runEngine } from '../../core/emit_engine';
import { generateMultiTargetChangelog } from '../../core/manifest/changelog';
import type { IR } from '../../ir/types';
import '../../targets/flutter';
import '../../targets/react_native';
import '../../targets/compose';

const V1_IR: IR = JSON.parse(
  fs.readFileSync(path.resolve(__dirname, '../../../test_fixtures/evolution_v1.json'), 'utf-8'),
);
const V2_IR: IR = JSON.parse(
  fs.readFileSync(path.resolve(__dirname, '../../../test_fixtures/evolution_v2.json'), 'utf-8'),
);

describe.each(getAllTargets().map((t) => [t.id, t]))(
  'Two-Phase Token Evolution & Migration: [%s]',
  (targetId, target) => {
    it('preserves stable identifiers on token rename across releases', () => {
      // Release 1: Initial export
      const release1 = runEngine(V1_IR, [target], null);
      const sectionV1 = release1.nextManifest.targets[targetId];
      const initialKey = sectionV1.variables['VariableID:3403:1550'];
      expect(initialKey).toBeDefined();

      // Release 2: Designer renamed token on Figma, but variable ID is preserved
      const release2 = runEngine(V2_IR, [target], release1.nextManifest);
      const sectionV2 = release2.nextManifest.targets[targetId];
      const evolvedKey = sectionV2.variables['VariableID:3403:1550'];

      // Crucial invariant: identifier must remain stable to prevent breaking client code
      expect(evolvedKey).toBe(initialKey);
    });

    it('accurately categorizes added, removed, and renamed variables in diff', () => {
      const release1 = runEngine(V1_IR, [target], null);
      const release2 = runEngine(V2_IR, [target], release1.nextManifest);
      const diff = release2.diffsByTarget[targetId];

      expect(diff).toBeDefined();
      // VariableID:custom:new_accent was added
      expect(diff.variables.added.some((v) => v.id === 'VariableID:custom:new_accent')).toBe(true);
      // VariableID:3403:1551 was removed
      expect(diff.variables.removed.some((v) => v.id === 'VariableID:3403:1551')).toBe(true);
      // VariableID:3403:1550 was renamed in Figma
      expect(diff.variables.renamed.some((v) => v.id === 'VariableID:3403:1550')).toBe(true);
    });

    it('generates well-formatted multi-target changelog documentation', () => {
      const release1 = runEngine(V1_IR, [target], null);
      const release2 = runEngine(V2_IR, [target], release1.nextManifest);
      const changelog = generateMultiTargetChangelog(release2.diffsByTarget);

      expect(changelog).toContain('Changelog');
      expect(changelog).toContain('Added');
      expect(changelog).toContain('Removed');
      expect(changelog).toContain('Renamed');
    });
  },
);
