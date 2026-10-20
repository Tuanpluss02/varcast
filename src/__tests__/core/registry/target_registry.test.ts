import { beforeEach, describe, expect, it } from 'vitest';
import type { EmittedFile, PreparedTarget, Target } from '../../../core/target';
import {
  clearRegistry,
  getAllTargets,
  getTarget,
  hasTarget,
  registerTarget,
  TargetRegistry,
} from '../../../core/registry/target_registry';

function createMockTarget(
  id: string,
  extra: Partial<Target<any, any>> = {},
): Target<any, PreparedTarget> {
  return {
    id,
    displayName: `Target ${id}`,
    defaultPackageName: `pkg_${id}`,
    prepare: () => ({
      targetId: id,
      nextManifestSection: { variables: {}, collections: {} },
    }),
    emit: (): EmittedFile[] => [],
    ...extra,
  };
}

describe('TargetRegistry', () => {
  beforeEach(() => {
    clearRegistry();
  });

  describe('global registry functions', () => {
    it('registers a target and retrieves it by id', () => {
      const target = createMockTarget('flutter');
      registerTarget(target);

      expect(hasTarget('flutter')).toBe(true);
      expect(getTarget('flutter')).toBe(target);
    });

    it('throws when registering duplicate target id', () => {
      const target1 = createMockTarget('react_native');
      const target2 = createMockTarget('react_native');

      registerTarget(target1);
      expect(() => registerTarget(target2)).toThrow(/already registered/i);
    });

    it('throws when retrieving an unregistered target id', () => {
      expect(hasTarget('unknown_target')).toBe(false);
      expect(() => getTarget('unknown_target')).toThrow(/not registered|unknown/i);
    });

    it('returns all registered targets in registration order', () => {
      const t1 = createMockTarget('target_c');
      const t2 = createMockTarget('target_a');
      const t3 = createMockTarget('target_b');

      registerTarget(t1);
      registerTarget(t2);
      registerTarget(t3);

      const all = getAllTargets();
      expect(all).toHaveLength(3);
      expect(all[0].id).toBe('target_c');
      expect(all[1].id).toBe('target_a');
      expect(all[2].id).toBe('target_b');
      expect(all).toEqual([t1, t2, t3]);
    });

    it('clears registry completely', () => {
      registerTarget(createMockTarget('t1'));
      registerTarget(createMockTarget('t2'));

      expect(getAllTargets()).toHaveLength(2);

      clearRegistry();

      expect(getAllTargets()).toHaveLength(0);
      expect(hasTarget('t1')).toBe(false);
      expect(() => getTarget('t1')).toThrow();
    });

    it('preserves target metadata, sanitizePackageName, and normalizeOptions', () => {
      const mockTarget = createMockTarget('custom', {
        displayName: 'Custom Target',
        defaultPackageName: 'custom_pkg',
        defaultOptions: { splitFiles: true },
        sanitizePackageName: (raw: string) => raw.toLowerCase().replace(/[^a-z0-9_]/g, '_'),
        normalizeOptions: (raw?: unknown) => ({ splitFiles: Boolean((raw as any)?.splitFiles) }),
      });

      registerTarget(mockTarget);
      const retrieved = getTarget('custom');

      expect(retrieved.displayName).toBe('Custom Target');
      expect(retrieved.defaultPackageName).toBe('custom_pkg');
      expect(retrieved.sanitizePackageName?.('My-Package!')).toBe('my_package_');
      expect(retrieved.normalizeOptions?.({ splitFiles: 1 })).toEqual({ splitFiles: true });
    });
  });

  describe('TargetRegistry class instance', () => {
    it('allows independent isolated registry instances', () => {
      const reg1 = new TargetRegistry();
      const reg2 = new TargetRegistry();

      const t1 = createMockTarget('t1');
      const t2 = createMockTarget('t2');

      reg1.register(t1);
      reg2.register(t2);

      expect(reg1.has('t1')).toBe(true);
      expect(reg1.has('t2')).toBe(false);
      expect(reg2.has('t1')).toBe(false);
      expect(reg2.has('t2')).toBe(true);

      expect(reg1.get('t1')).toBe(t1);
      expect(() => reg1.get('t2')).toThrow();
      expect(reg1.getAll()).toEqual([t1]);
      expect(reg2.getAll()).toEqual([t2]);

      reg1.clear();
      expect(reg1.getAll()).toEqual([]);
      expect(reg2.getAll()).toEqual([t2]);
    });
  });
});
