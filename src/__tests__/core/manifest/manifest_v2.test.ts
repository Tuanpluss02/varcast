import { describe, it, expect } from 'vitest';
import {
  MANIFEST_VERSION,
  emptyManifest,
  emptyTargetSection,
  getTargetSection,
  normalizeManifest,
  type Manifest,
  type ManifestTargetSection,
} from '../../../core/manifest/types';
import {
  diffTargetSection,
  diffManifestForTarget,
} from '../../../core/manifest/diff';
import { generateChangelog } from '../../../core/manifest/changelog';
import {
  resolveStableVariableName,
  resolveStableCollectionName,
  resolveStableCompositeName,
} from '../../../core/manifest/stable_names';

describe('Manifest v2 Types & Normalization', () => {
  it('creates empty manifest and target section', () => {
    const m = emptyManifest('file-abc');
    expect(m.version).toBe('2.0');
    expect(m.fileKey).toBe('file-abc');
    expect(m.targets).toEqual({});

    const sec = emptyTargetSection();
    expect(sec.variables).toEqual({});
    expect(sec.collections).toEqual({});
  });

  it('normalizes valid v2 manifest', () => {
    const valid: Manifest = {
      version: '2.0',
      fileKey: 'file-123',
      lastExportedAt: '2026-10-21T00:00:00.000Z',
      targets: {
        flutter: {
          variables: { 'v:1': 'primary' },
          collections: { 'c:1': 'Colors' },
          composites: { 's:1': 'heading1' },
        },
      },
    };
    const res = normalizeManifest(valid);
    expect(res).toEqual(valid);
  });

  it('rejects v1 manifests strictly (no migration)', () => {
    const v1 = {
      version: '1.0',
      fileKey: 'k',
      lastExportedAt: '2026-10-21T00:00:00.000Z',
      variables: { 'v:1': 'primary' },
      collections: { 'c:1': 'Colors' },
    };
    expect(normalizeManifest(v1)).toBeNull();
  });

  it('rejects invalid or corrupted objects', () => {
    expect(normalizeManifest(null)).toBeNull();
    expect(normalizeManifest(undefined)).toBeNull();
    expect(normalizeManifest('string')).toBeNull();
    expect(normalizeManifest(42)).toBeNull();
    expect(normalizeManifest({})).toBeNull();
    expect(normalizeManifest({ version: '2.0' })).toBeNull();
    expect(normalizeManifest({ version: '2.0', fileKey: 123 })).toBeNull();
    expect(
      normalizeManifest({
        version: '2.0',
        fileKey: 'k',
        lastExportedAt: 'now',
        targets: null,
      }),
    ).toBeNull();
  });

  it('retrieves target section from manifest', () => {
    const m: Manifest = {
      version: '2.0',
      fileKey: 'k',
      lastExportedAt: 'now',
      targets: {
        rn: {
          variables: { 'v:1': 'blue' },
          collections: {},
        },
      },
    };
    expect(getTargetSection(m, 'rn')).toEqual({
      variables: { 'v:1': 'blue' },
      collections: {},
    });
    expect(getTargetSection(m, 'flutter')).toBeNull();
    expect(getTargetSection(null, 'rn')).toBeNull();
  });
});

describe('Manifest Diff Engine (3-way)', () => {
  const oldSection: ManifestTargetSection = {
    variables: {
      'v:1': 'primary',
      'v:2': 'secondary',
    },
    collections: {
      'c:1': 'AppColors',
      'c:2': 'Typography',
    },
    composites: {
      's:1': 'elevation1',
      's:2': 'bodyMedium',
    },
    figmaNames: {
      variables: {
        'v:1': 'color/primary',
        'v:2': 'color/secondary',
      },
      collections: {
        'c:1': 'Colors',
        'c:2': 'Typography',
      },
      composites: {
        's:1': 'Shadow/Elev1',
        's:2': 'Text/BodyMedium',
      },
    },
  };

  const nextSection: ManifestTargetSection = {
    variables: {
      'v:1': 'primary', // renamed in figma
      'v:3': 'accent', // added
      // v:2 removed
    },
    collections: {
      'c:1': 'AppColors', // renamed in figma
      'c:3': 'Spacing', // added
      // c:2 removed
    },
    composites: {
      's:1': 'elevation1', // renamed in figma
      's:3': 'headingLarge', // added
      // s:2 removed
    },
    figmaNames: {
      variables: {
        'v:1': 'color/primary-brand', // rename
        'v:3': 'color/accent',
      },
      collections: {
        'c:1': 'BrandColors', // rename
        'c:3': 'Spacing',
      },
      composites: {
        's:1': 'Shadow/Elev-1', // rename
        's:3': 'Text/HeadingLarge',
      },
    },
  };

  it('diffs target section across variables, collections, and composites', () => {
    const diff = diffTargetSection(oldSection, nextSection, 'flutter');

    expect(diff.targetId).toBe('flutter');

    // Variables diff
    expect(diff.variables.added).toEqual([
      { id: 'v:3', name: 'accent', figmaName: 'color/accent' },
    ]);
    expect(diff.variables.removed).toEqual([
      { id: 'v:2', name: 'secondary', figmaName: 'color/secondary' },
    ]);
    expect(diff.variables.renamed).toEqual([
      {
        id: 'v:1',
        name: 'primary',
        oldFigmaName: 'color/primary',
        newFigmaName: 'color/primary-brand',
      },
    ]);

    // Collections diff
    expect(diff.collections.added).toEqual([
      { id: 'c:3', name: 'Spacing', figmaName: 'Spacing' },
    ]);
    expect(diff.collections.removed).toEqual([
      { id: 'c:2', name: 'Typography', figmaName: 'Typography' },
    ]);
    expect(diff.collections.renamed).toEqual([
      {
        id: 'c:1',
        name: 'AppColors',
        oldFigmaName: 'Colors',
        newFigmaName: 'BrandColors',
      },
    ]);

    // Composites diff
    expect(diff.composites.added).toEqual([
      { id: 's:3', name: 'headingLarge', figmaName: 'Text/HeadingLarge' },
    ]);
    expect(diff.composites.removed).toEqual([
      { id: 's:2', name: 'bodyMedium', figmaName: 'Text/BodyMedium' },
    ]);
    expect(diff.composites.renamed).toEqual([
      {
        id: 's:1',
        name: 'elevation1',
        oldFigmaName: 'Shadow/Elev1',
        newFigmaName: 'Shadow/Elev-1',
      },
    ]);
  });

  it('handles null oldSection (initial export)', () => {
    const diff = diffTargetSection(null, nextSection, 'react_native');
    expect(diff.targetId).toBe('react_native');
    expect(diff.variables.added.length).toBe(2);
    expect(diff.variables.removed).toEqual([]);
    expect(diff.variables.renamed).toEqual([]);
    expect(diff.collections.added.length).toBe(2);
    expect(diff.composites.added.length).toBe(2);
  });

  it('diffs through diffManifestForTarget', () => {
    const oldM: Manifest = {
      version: '2.0',
      fileKey: 'f',
      lastExportedAt: 'now',
      targets: { rn: oldSection },
    };
    const nextM: Manifest = {
      version: '2.0',
      fileKey: 'f',
      lastExportedAt: 'now',
      targets: { rn: nextSection },
    };

    const diff = diffManifestForTarget(oldM, nextM, 'rn');
    expect(diff.targetId).toBe('rn');
    expect(diff.variables.added).toEqual([
      { id: 'v:3', name: 'accent', figmaName: 'color/accent' },
    ]);
  });
});

describe('Generic Changelog Generator', () => {
  it('returns "No changes." when diff is completely empty', () => {
    const emptyDiff = diffTargetSection(
      emptyTargetSection(),
      emptyTargetSection(),
      'test',
    );
    const changelog = generateChangelog(emptyDiff);
    expect(changelog).toBe(
      '# Changelog\n\nGenerated by Varcast. Do not edit by hand.\n\nNo changes.',
    );
  });

  it('formats Added, Removed, and Renamed sections for variables, collections, and composites', () => {
    const diff = {
      targetId: 'flutter',
      variables: {
        added: [{ id: 'v:1', name: 'brandBlue', figmaName: 'brand/blue' }],
        removed: [{ id: 'v:2', name: 'brandRed', figmaName: 'brand/red' }],
        renamed: [
          {
            id: 'v:3',
            name: 'brandGreen',
            oldFigmaName: 'brand/old-green',
            newFigmaName: 'brand/green',
          },
        ],
      },
      collections: {
        added: [{ id: 'c:1', name: 'Themes', figmaName: 'Themes' }],
        removed: [],
        renamed: [],
      },
      composites: {
        added: [],
        removed: [{ id: 's:1', name: 'headline', figmaName: 'Text/Headline' }],
        renamed: [
          {
            id: 's:2',
            name: 'subhead',
            oldFigmaName: 'Text/OldSubhead',
            newFigmaName: 'Text/Subhead',
          },
        ],
      },
    };

    const changelog = generateChangelog(diff);

    expect(changelog).toContain('# Changelog');
    expect(changelog).toContain('## Added');
    expect(changelog).toContain('### Variables');
    expect(changelog).toContain('- `brandBlue` — brand/blue');
    expect(changelog).toContain('### Collections');
    expect(changelog).toContain('- `Themes` — Themes');

    expect(changelog).toContain('## Removed');
    expect(changelog).toContain('- `brandRed` — brand/red');
    expect(changelog).toContain('### Composites');
    expect(changelog).toContain('- `headline` — Text/Headline');

    expect(changelog).toContain('## Renamed');
    expect(changelog).toContain('- `brandGreen`: `brand/old-green` → `brand/green`');
    expect(changelog).toContain('- `subhead`: `Text/OldSubhead` → `Text/Subhead`');
  });
});

describe('Stable Name Resolution', () => {
  const section: ManifestTargetSection = {
    variables: { 'v:1': 'stablePrimary' },
    collections: { 'c:1': 'StableColors' },
    composites: { 's:1': 'stableElev' },
  };

  const manifest: Manifest = {
    version: '2.0',
    fileKey: 'f',
    lastExportedAt: 'now',
    targets: { flutter: section },
  };

  it('resolves stable names passing targetSection object directly', () => {
    expect(resolveStableVariableName(section, 'v:1', 'derivedVar')).toBe('stablePrimary');
    expect(resolveStableVariableName(section, 'v:unknown', 'derivedVar')).toBe('derivedVar');

    expect(resolveStableCollectionName(section, 'c:1', 'DerivedCol')).toBe('StableColors');
    expect(resolveStableCollectionName(section, 'c:unknown', 'DerivedCol')).toBe('DerivedCol');

    expect(resolveStableCompositeName(section, 's:1', 'DerivedComp')).toBe('stableElev');
    expect(resolveStableCompositeName(section, 's:unknown', 'DerivedComp')).toBe('DerivedComp');
  });

  it('resolves stable names passing (targetId, id, derivedName, manifest)', () => {
    expect(resolveStableVariableName('flutter', 'v:1', 'derivedVar', manifest)).toBe(
      'stablePrimary',
    );
    expect(resolveStableVariableName('flutter', 'v:99', 'derivedVar', manifest)).toBe(
      'derivedVar',
    );
    expect(resolveStableVariableName('unknownTarget', 'v:1', 'derivedVar', manifest)).toBe(
      'derivedVar',
    );

    expect(resolveStableCollectionName('flutter', 'c:1', 'DerivedCol', manifest)).toBe(
      'StableColors',
    );
    expect(resolveStableCompositeName('flutter', 's:1', 'DerivedComp', manifest)).toBe(
      'stableElev',
    );
  });

  it('handles null manifest or null targetSection gracefully', () => {
    expect(resolveStableVariableName(null, 'v:1', 'fallback')).toBe('fallback');
    expect(resolveStableCollectionName(null, 'c:1', 'fallback')).toBe('fallback');
    expect(resolveStableCompositeName(null, 's:1', 'fallback')).toBe('fallback');

    expect(resolveStableVariableName('flutter', 'v:1', 'fallback', null)).toBe('fallback');
    expect(resolveStableCollectionName('flutter', 'c:1', 'fallback', null)).toBe('fallback');
    expect(resolveStableCompositeName('flutter', 's:1', 'fallback', null)).toBe('fallback');
  });
});
