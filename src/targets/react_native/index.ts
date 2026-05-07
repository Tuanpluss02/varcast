import type { Manifest, ManifestTargetSection } from '../../core/manifest';
import type { EmittedFile, PreparedIR, Target } from '../../core/target';
import type { IR } from '../../ir/types';
import { emitCollections } from './generator/emit_collections';
import { emitComposites } from './generator/emit_composites';
import { emitRuntime } from './generator/emit_runtime';
import { prepareRN } from './generator/prepare';
import { reactNativeIdentifierProfile } from './identifier';
import type { ReactNativeOptions } from './options';
import { DEFAULT_RN_OPTIONS } from './options';
import { modesTs, packageJson, reactShimDts, readmeMd, runtimeIndexTs, themeProviderTsx, tsconfigJson } from './static_files';
import { reactNativeTypeMapping } from './type_mapping';

export type PreparedReactNative = PreparedIR & {
  nextManifestSection: ManifestTargetSection;
  collections: ReturnType<typeof prepareRN>['collections'];
};

function emptySection(): ManifestTargetSection {
  return { variables: {}, collections: {} };
}

export const reactNativeTarget: Target = {
  id: 'react_native',
  profile: reactNativeIdentifierProfile,
  typeMapping: reactNativeTypeMapping,

  prepare(_ir: IR, manifest: Manifest | null, _options: unknown): PreparedReactNative {
    const prepared = prepareRN(_ir, manifest);
    return {
      ...prepared,
      nextManifestSection: prepared.nextManifestSection,
    } as any;
  },

  emit(prepared: PreparedIR, options: unknown): EmittedFile[] {
    const o = mergeRnOptions(options);
    const base: EmittedFile[] = [
      { path: 'package.json', contents: packageJson(o) },
      { path: 'tsconfig.json', contents: tsconfigJson() },
      { path: 'README.md', contents: readmeMd(o) },
      { path: 'src/index.ts', contents: runtimeIndexTs() },
      { path: 'src/runtime/ThemeProvider.tsx', contents: themeProviderTsx() },
      { path: 'src/runtime/modes.ts', contents: modesTs() },
      { path: 'src/react-shim.d.ts', contents: reactShimDts() },
    ];
    // Filter collections by kind so toggling primitives/tokens off in the UI
    // actually drops the corresponding collection files (and their imports
    // in the generated runtime).
    const filteredCollections = (prepared as PreparedReactNative).collections.filter((c) => {
      if (c.kind === 'primitive' && !o.include.primitives) return false;
      if (c.kind === 'token' && !o.include.tokens) return false;
      return true;
    });
    const filtered = { ...prepared, collections: filteredCollections } as PreparedReactNative;
    const colFiles = emitCollections(filtered as any);
    const runtimeFiles = emitRuntime(filtered as any);
    const compositeFiles = emitComposites(filtered as any).filter((f) => {
      if (f.path.endsWith('colorStyles.ts')) return o.include.composites.colorStyles;
      if (f.path.endsWith('shadows.ts')) return o.include.composites.shadows;
      if (f.path.endsWith('textStyles.ts')) return o.include.composites.textStyles;
      return true;
    });
    return [...base, ...runtimeFiles, ...compositeFiles, ...colFiles];
  },
};

// Merge user-supplied RN options with defaults so partial inputs (e.g. just
// `{ packageName }` from a test or older UI) still produce a fully-formed
// options object.
type RnIncludePartial = {
  primitives?: boolean;
  tokens?: boolean;
  composites?: {
    colorStyles?: boolean;
    shadows?: boolean;
    textStyles?: boolean;
  };
};

type RnOptionsPartial = {
  packageName?: string;
  include?: RnIncludePartial;
};

function mergeRnOptions(options: unknown): ReactNativeOptions {
  const partial: RnOptionsPartial = (options ?? {}) as RnOptionsPartial;
  const includeIn: RnIncludePartial = partial.include ?? {};
  const compositesIn = includeIn.composites ?? {};
  return {
    packageName: partial.packageName ?? DEFAULT_RN_OPTIONS.packageName,
    include: {
      primitives: includeIn.primitives ?? DEFAULT_RN_OPTIONS.include.primitives,
      tokens: includeIn.tokens ?? DEFAULT_RN_OPTIONS.include.tokens,
      composites: {
        colorStyles:
          compositesIn.colorStyles ?? DEFAULT_RN_OPTIONS.include.composites.colorStyles,
        shadows: compositesIn.shadows ?? DEFAULT_RN_OPTIONS.include.composites.shadows,
        textStyles:
          compositesIn.textStyles ?? DEFAULT_RN_OPTIONS.include.composites.textStyles,
      },
    },
  };
}

