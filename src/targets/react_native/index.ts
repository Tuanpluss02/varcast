// React Native target dispatcher. Runs the shared `prepareRN` step exactly
// once, then routes to the picked flavor's emit pipeline.
//
// One Target instance, two flavors — picked at export time via
// `options.flavor` (decision #2 in the rewrite plan).

import type { Manifest, ManifestTargetSection } from '../../core/manifest';
import type { EmittedFile, PreparedIR, Target } from '../../core/target';
import type { IR } from '../../ir/types';
import { emitNativeWind } from './nativewind';
import { emitUnistyles } from './unistyles';
import { reactNativeIdentifierProfile } from './identifier';
import { mergeRnOptions, type ReactNativeOptions } from './options';
import { prepareRN, type PreparedRN } from './shared/prepare';
import { reactNativeTypeMapping } from './type_mapping';

export type PreparedReactNative = PreparedIR & {
  rn: PreparedRN;
};

export const reactNativeTarget: Target = {
  id: 'react_native',
  profile: reactNativeIdentifierProfile,
  typeMapping: reactNativeTypeMapping,

  prepare(ir: IR, manifest: Manifest | null, _options: unknown): PreparedReactNative {
    const rn = prepareRN(ir, manifest);
    return {
      rn,
      nextManifestSection: rn.nextManifestSection,
      warnings: rn.warnings,
    };
  },

  emit(prepared: PreparedIR, options: unknown): EmittedFile[] {
    const o = mergeRnOptions(options);
    const rn = filteredPrepared((prepared as PreparedReactNative).rn, o);
    return o.flavor === 'unistyles' ? emitUnistyles(rn, o) : emitNativeWind(rn, o);
  },
};

/**
 * Apply include flags from the export UI by dropping collections / composites
 * that the user opted out of. Each flavor receives the already-filtered IR
 * so it doesn't have to re-implement the include logic.
 */
function filteredPrepared(rn: PreparedRN, o: ReactNativeOptions): PreparedRN {
  const collections = rn.collections.filter((c) => {
    if (c.kind === 'primitive' && !o.include.primitives) return false;
    if (c.kind === 'token' && !o.include.tokens) return false;
    return true;
  });
  return {
    ...rn,
    collections,
    paintStyles: o.include.composites.colorStyles ? rn.paintStyles : [],
    effectStyles: o.include.composites.shadows ? rn.effectStyles : [],
    textStyles: o.include.composites.textStyles ? rn.textStyles : [],
  };
}

// Re-export the merger so the plugin entry can normalize incoming options.
export { mergeRnOptions } from './options';
export type { ReactNativeFlavor, ReactNativeOptions } from './options';

// Helper for the unused-section warning.
export function emptyRnManifestSection(): ManifestTargetSection {
  return { variables: {}, collections: {} };
}
