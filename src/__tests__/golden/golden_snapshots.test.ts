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

describe.each(getAllTargets().map((t) => [t.id, t]))(
  'Golden Snapshot Regression: [%s]',
  (targetId, target) => {
    it('matches golden file manifest and emitted file structure', () => {
      const out = runEngine(GOLDEN_IR, [target], null, {
        [targetId]: { packageName: 'test_ds' },
      });

      const fileMap = out.files
        .sort((a, b) => a.path.localeCompare(b.path))
        .map((f) => ({
          path: f.path,
          contents: f.contents,
        }));

      expect(fileMap).toMatchSnapshot('files');
      expect(out.nextManifest.targets[targetId]).toMatchSnapshot('manifest_section');
    });
  },
);
