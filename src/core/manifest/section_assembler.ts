import type { ManifestTargetSection } from './types';

export interface TargetSectionAssemblyInput {
  collections: Array<{
    id: string;
    name: string;
    exportName: string;
    variables: Array<{
      id: string;
      figmaName: string;
      stableLeafKey: string;
    }>;
  }>;
  composites?: Array<{
    id: string;
    figmaName: string;
    getterName: string;
  }>;
}

/**
 * Assembles a compliant ManifestTargetSection from target collections and optional composites.
 */
export function assembleTargetSection(
  input: TargetSectionAssemblyInput,
): ManifestTargetSection {
  const variables: Record<string, string> = {};
  const collections: Record<string, string> = {};
  const composites: Record<string, string> = {};
  const figmaVariables: Record<string, string> = {};
  const figmaCollections: Record<string, string> = {};
  const figmaComposites: Record<string, string> = {};

  for (const col of input.collections) {
    collections[col.id] = col.exportName;
    figmaCollections[col.id] = col.name;
    for (const v of col.variables) {
      variables[v.id] = v.stableLeafKey;
      figmaVariables[v.id] = v.figmaName;
    }
  }

  if (input.composites) {
    for (const comp of input.composites) {
      composites[comp.id] = comp.getterName;
      figmaComposites[comp.id] = comp.figmaName;
    }
  }

  return {
    variables,
    collections,
    composites,
    figmaNames: {
      variables: figmaVariables,
      collections: figmaCollections,
      composites: figmaComposites,
    },
  };
}
