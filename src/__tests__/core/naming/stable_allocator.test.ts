import { describe, it, expect } from 'vitest';
import {
  allocateStableCollectionIdentifiers,
  type AllocatedIdentifier,
} from '../../../core/naming/dedup';
import type { ManifestTargetSection } from '../../../core/manifest';

describe('allocateStableCollectionIdentifiers', () => {
  interface TestVar {
    id: string;
    figmaName: string;
    groupPath?: string[];
    leafName?: string;
    emitToPublic?: boolean;
  }

  const identitySanitize = (leaf: string) => leaf;

  describe('Pass 1 & Pass 2 basic behavior (initial export, null manifest)', () => {
    it('allocates identifiers for variables when manifestSection is null', () => {
      const variables: TestVar[] = [
        { id: 'v1', figmaName: 'Primary', groupPath: ['colors'], leafName: 'primary' },
        { id: 'v2', figmaName: 'Secondary', groupPath: ['colors'], leafName: 'secondary' },
      ];

      const result = allocateStableCollectionIdentifiers(
        variables,
        null,
        identitySanitize,
      );

      expect(result.get('v1')).toEqual<AllocatedIdentifier>({
        stableLeafKey: 'primary',
        isStable: false,
        wasDeduplicated: false,
      });
      expect(result.get('v2')).toEqual<AllocatedIdentifier>({
        stableLeafKey: 'secondary',
        isStable: false,
        wasDeduplicated: false,
      });
    });

    it('deduplicates sibling leaf collisions within the same group', () => {
      const variables: TestVar[] = [
        { id: 'v1', figmaName: 'Color/Primary', groupPath: ['colors'], leafName: 'primary' },
        { id: 'v2', figmaName: 'Color/Primary', groupPath: ['colors'], leafName: 'primary' },
        { id: 'v3', figmaName: 'Color/Primary', groupPath: ['colors'], leafName: 'primary' },
      ];

      const result = allocateStableCollectionIdentifiers(
        variables,
        null,
        identitySanitize,
      );

      expect(result.get('v1')?.stableLeafKey).toBe('primary');
      expect(result.get('v1')?.wasDeduplicated).toBe(false);

      expect(result.get('v2')?.stableLeafKey).toBe('primary2');
      expect(result.get('v2')?.wasDeduplicated).toBe(true);

      expect(result.get('v3')?.stableLeafKey).toBe('primary3');
      expect(result.get('v3')?.wasDeduplicated).toBe(true);
    });

    it('does not collide across different group paths', () => {
      const variables: TestVar[] = [
        { id: 'v1', figmaName: 'Colors/bg', groupPath: ['colors'], leafName: 'bg' },
        { id: 'v2', figmaName: 'Typography/bg', groupPath: ['typography'], leafName: 'bg' },
      ];

      const result = allocateStableCollectionIdentifiers(
        variables,
        null,
        identitySanitize,
      );

      expect(result.get('v1')?.stableLeafKey).toBe('bg');
      expect(result.get('v2')?.stableLeafKey).toBe('bg');
    });
  });

  describe('Stable identifier preservation (with manifest)', () => {
    it('preserves stable names from manifest in Pass 1 even when Figma name changes', () => {
      const manifest: ManifestTargetSection = {
        variables: {
          v1: 'oldStablePrimary',
        },
        collections: {},
        composites: {},
      };

      const variables: TestVar[] = [
        { id: 'v1', figmaName: 'New Renamed Figma Name', groupPath: ['colors'], leafName: 'newLeaf' },
      ];

      const result = allocateStableCollectionIdentifiers(
        variables,
        manifest,
        identitySanitize,
      );

      expect(result.get('v1')).toEqual<AllocatedIdentifier>({
        stableLeafKey: 'oldStablePrimary',
        isStable: true,
      });
    });

    it('ensures stable items in Pass 1 are not displaced by preceding new items', () => {
      const manifest: ManifestTargetSection = {
        variables: {
          v2: 'accent', // v2 has stable name 'accent'
        },
        collections: {},
      };

      // v1 is a new variable appearing before v2 in order, also wanting 'accent'
      const variables: TestVar[] = [
        { id: 'v1', figmaName: 'New Accent', groupPath: ['colors'], leafName: 'accent' },
        { id: 'v2', figmaName: 'Old Accent', groupPath: ['colors'], leafName: 'accent' },
      ];

      const result = allocateStableCollectionIdentifiers(
        variables,
        manifest,
        identitySanitize,
      );

      // v2 must get 'accent' because it was pinned in Pass 1
      expect(result.get('v2')).toEqual<AllocatedIdentifier>({
        stableLeafKey: 'accent',
        isStable: true,
      });

      // v1 must be deduplicated to 'accent2' in Pass 2
      expect(result.get('v1')).toEqual<AllocatedIdentifier>({
        stableLeafKey: 'accent2',
        isStable: false,
        wasDeduplicated: true,
      });
    });
  });

  describe('Filtering and options', () => {
    it('skips variables where emitToPublic === false', () => {
      const variables: TestVar[] = [
        { id: 'v1', figmaName: 'Internal/Var', groupPath: ['internal'], leafName: 'var', emitToPublic: false },
        { id: 'v2', figmaName: 'Public/Var', groupPath: ['public'], leafName: 'var', emitToPublic: true },
        { id: 'v3', figmaName: 'Default/Var', groupPath: ['default'], leafName: 'var' }, // undefined emitToPublic
      ];

      const result = allocateStableCollectionIdentifiers(
        variables,
        null,
        identitySanitize,
      );

      expect(result.has('v1')).toBe(false);
      expect(result.has('v2')).toBe(true);
      expect(result.has('v3')).toBe(true);
    });

    it('uses custom getGroupKey when provided', () => {
      const variables: TestVar[] = [
        { id: 'v1', figmaName: 'A/Item', groupPath: ['A'], leafName: 'item' },
        { id: 'v2', figmaName: 'B/Item', groupPath: ['B'], leafName: 'item' },
      ];

      // Custom getGroupKey that collapses everything into a single root bucket
      const result = allocateStableCollectionIdentifiers(
        variables,
        null,
        identitySanitize,
        {
          getGroupKey: () => 'global_bucket',
        },
      );

      expect(result.get('v1')?.stableLeafKey).toBe('item');
      expect(result.get('v2')?.stableLeafKey).toBe('item2');
      expect(result.get('v2')?.wasDeduplicated).toBe(true);
    });

    it('applies custom formatStableName when provided', () => {
      const manifest: ManifestTargetSection = {
        variables: {
          v1: 'primary',
        },
        collections: {},
      };

      const variables: TestVar[] = [
        { id: 'v1', figmaName: 'Primary', groupPath: ['colors'], leafName: 'primary' },
        { id: 'v2', figmaName: 'Secondary', groupPath: ['colors'], leafName: 'secondary' },
      ];

      // Prefix every variable with 'token_'
      const result = allocateStableCollectionIdentifiers(
        variables,
        manifest,
        identitySanitize,
        {
          formatStableName: (_id, name) => `token_${name}`,
        },
      );

      expect(result.get('v1')?.stableLeafKey).toBe('token_primary');
      expect(result.get('v1')?.isStable).toBe(true);

      expect(result.get('v2')?.stableLeafKey).toBe('token_secondary');
      expect(result.get('v2')?.isStable).toBe(false);
    });

    it('falls back to "unnamed" when leafName is undefined', () => {
      const variables: TestVar[] = [
        { id: 'v1', figmaName: 'Unnamed Var' },
      ];

      const result = allocateStableCollectionIdentifiers(
        variables,
        null,
        (leaf) => leaf.toUpperCase(),
      );

      expect(result.get('v1')?.stableLeafKey).toBe('UNNAMED');
    });
  });
});
