import { describe, it, expect } from 'vitest';
import {
  assembleTargetSection,
  type TargetSectionAssemblyInput,
} from '../../../core/manifest/section_assembler';
import {
  assembleTargetSection as reexportedAssembler,
  normalizeManifest,
  MANIFEST_VERSION,
  diffTargetSection,
} from '../../../core/manifest';

describe('assembleTargetSection', () => {
  it('is re-exported from core/manifest index', () => {
    expect(reexportedAssembler).toBe(assembleTargetSection);
  });

  it('assembles an empty target section when given empty collections and no composites', () => {
    const input: TargetSectionAssemblyInput = {
      collections: [],
    };

    const section = assembleTargetSection(input);

    expect(section).toEqual({
      variables: {},
      collections: {},
      composites: {},
      figmaNames: {
        variables: {},
        collections: {},
        composites: {},
      },
    });

    // Verify it is compliant with normalizeManifest
    const manifest = normalizeManifest({
      version: MANIFEST_VERSION,
      fileKey: 'test-file',
      lastExportedAt: new Date().toISOString(),
      targets: { testTarget: section },
    });
    expect(manifest).not.toBeNull();
  });

  it('maps collections and variables correctly with figmaNames', () => {
    const input: TargetSectionAssemblyInput = {
      collections: [
        {
          id: 'col:colors',
          name: 'Brand Colors',
          exportName: 'brandColors',
          variables: [
            {
              id: 'var:primary',
              figmaName: 'Primary/Default',
              stableLeafKey: 'primaryDefault',
            },
            {
              id: 'var:secondary',
              figmaName: 'Secondary/Default',
              stableLeafKey: 'secondaryDefault',
            },
          ],
        },
        {
          id: 'col:spacing',
          name: 'Spacing & Layout',
          exportName: 'spacing',
          variables: [
            {
              id: 'var:spacing-sm',
              figmaName: 'Small',
              stableLeafKey: 'sm',
            },
          ],
        },
      ],
    };

    const section = assembleTargetSection(input);

    expect(section.collections).toEqual({
      'col:colors': 'brandColors',
      'col:spacing': 'spacing',
    });

    expect(section.variables).toEqual({
      'var:primary': 'primaryDefault',
      'var:secondary': 'secondaryDefault',
      'var:spacing-sm': 'sm',
    });

    expect(section.figmaNames).toEqual({
      collections: {
        'col:colors': 'Brand Colors',
        'col:spacing': 'Spacing & Layout',
      },
      variables: {
        'var:primary': 'Primary/Default',
        'var:secondary': 'Secondary/Default',
        'var:spacing-sm': 'Small',
      },
      composites: {},
    });
  });

  it('maps composites and their figmaNames when provided', () => {
    const input: TargetSectionAssemblyInput = {
      collections: [
        {
          id: 'col:typography',
          name: 'Typography',
          exportName: 'typography',
          variables: [],
        },
      ],
      composites: [
        {
          id: 'comp:headline',
          figmaName: 'Header / Display Large',
          getterName: 'headerDisplayLarge',
        },
        {
          id: 'comp:elevation',
          figmaName: 'Elevation / Low',
          getterName: 'elevationLow',
        },
      ],
    };

    const section = assembleTargetSection(input);

    expect(section.composites).toEqual({
      'comp:headline': 'headerDisplayLarge',
      'comp:elevation': 'elevationLow',
    });

    expect(section.figmaNames?.composites).toEqual({
      'comp:headline': 'Header / Display Large',
      'comp:elevation': 'Elevation / Low',
    });
  });

  it('produces diff-compatible sections for diffTargetSections', () => {
    const v1Input: TargetSectionAssemblyInput = {
      collections: [
        {
          id: 'col:1',
          name: 'Col 1',
          exportName: 'colOne',
          variables: [
            { id: 'var:1', figmaName: 'Old Name', stableLeafKey: 'primary' },
          ],
        },
      ],
    };
    const v2Input: TargetSectionAssemblyInput = {
      collections: [
        {
          id: 'col:1',
          name: 'Col 1 Renamed',
          exportName: 'colOne',
          variables: [
            { id: 'var:1', figmaName: 'New Name', stableLeafKey: 'primary' },
            { id: 'var:2', figmaName: 'Brand 2', stableLeafKey: 'brand2' },
          ],
        },
      ],
    };

    const s1 = assembleTargetSection(v1Input);
    const s2 = assembleTargetSection(v2Input);

    const diff = diffTargetSection(s1, s2);
    expect(diff.collections.renamed).toEqual([
      { id: 'col:1', name: 'colOne', oldFigmaName: 'Col 1', newFigmaName: 'Col 1 Renamed' },
    ]);
    expect(diff.variables.renamed).toEqual([
      { id: 'var:1', name: 'primary', oldFigmaName: 'Old Name', newFigmaName: 'New Name' },
    ]);
    expect(diff.variables.added).toEqual([
      { id: 'var:2', name: 'brand2', figmaName: 'Brand 2' },
    ]);
  });
});
