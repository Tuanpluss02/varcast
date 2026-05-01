import type { IR } from '../../ir/types';
import type { Manifest, ManifestTargetSection } from '../../core/manifest';
import type { EmittedFile, PreparedIR, Target } from '../../core/target';
import { reactNativeIdentifierProfile } from './identifier';
import { reactNativeTypeMapping } from './type_mapping';
import type { ReactNativeOptions } from './options';
import { DEFAULT_RN_OPTIONS } from './options';
import { packageJson, readmeMd, runtimeIndexTs, themeProviderTsx, tsconfigJson, reactShimDts, modesTs } from './static_files';
import { prepareRN } from './generator/prepare';
import { emitCollections } from './generator/emit_collections';
import { emitRuntime } from './generator/emit_runtime';
import { emitComposites } from './generator/emit_composites';

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
    const o = (options as ReactNativeOptions | undefined) ?? DEFAULT_RN_OPTIONS;
    const base: EmittedFile[] = [
      { path: 'package.json', contents: packageJson(o) },
      { path: 'tsconfig.json', contents: tsconfigJson() },
      { path: 'README.md', contents: readmeMd(o) },
      { path: 'src/index.ts', contents: runtimeIndexTs() },
      { path: 'src/runtime/ThemeProvider.tsx', contents: themeProviderTsx() },
      { path: 'src/runtime/modes.ts', contents: modesTs() },
      { path: 'src/react-shim.d.ts', contents: reactShimDts() },
    ];
    const colFiles = emitCollections(prepared as any);
    const runtimeFiles = emitRuntime(prepared as any);
    const compositeFiles = emitComposites(prepared as any);
    return [...base, ...runtimeFiles, ...compositeFiles, ...colFiles];
  },
};

