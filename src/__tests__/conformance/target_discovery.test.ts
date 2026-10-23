import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import { hasTarget, getAllTargets } from '../../core/registry';
// Ensure default targets are registered
import '../../targets/flutter';
import '../../targets/react_native';

describe('Target Discovery Guard', () => {
  const targetsDir = path.resolve(__dirname, '../../targets');
  const targetSubdirs = fs
    .readdirSync(targetsDir, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name);

  it('finds at least one target in src/targets/', () => {
    expect(targetSubdirs.length).toBeGreaterThan(0);
  });

  it.each(targetSubdirs)(
    'directory "src/targets/%s" has a matching registered target in TargetRegistry',
    (dirName) => {
      expect(hasTarget(dirName)).toBe(true);
    },
  );

  it('all registered targets have non-empty metadata', () => {
    const targets = getAllTargets();
    expect(targets.length).toBeGreaterThan(0);
    for (const t of targets) {
      expect(t.id).toBeDefined();
      expect(t.id.trim().length).toBeGreaterThan(0);
      expect(t.displayName).toBeDefined();
      expect(t.displayName.trim().length).toBeGreaterThan(0);
      expect(t.defaultPackageName).toBeDefined();
      expect(t.defaultPackageName.trim().length).toBeGreaterThan(0);
    }
  });
});
