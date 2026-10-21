import type { SemanticTokenGraph } from '../../core/graph/types';
import type { Manifest, ManifestTargetSection } from '../../core/manifest';
import { hasTarget, registerTarget } from '../../core/registry/target_registry';
import type { EmittedFile, Target } from '../../core/target';
import type { IR } from '../../ir/types';
import { emitCollections } from './generator/emit_collections';
import { emitComposites } from './generator/emit_composites';
import { emitRuntime } from './generator/emit_runtime';
import { prepareRN } from './generator/prepare';
import type { PreparedRN } from './generator/prepare';
import { reactNativeIdentifierProfile } from './identifier';
import type { PartialReactNativeOptions } from './options';
import { DEFAULT_RN_OPTIONS, mergeRnOptions, sanitizePackageName } from './options';
import {
  modesTs,
  packageJson,
  reactShimDts,
  readmeMd,
  runtimeIndexTs,
  themeProviderTsx,
  tsconfigJson,
} from './static_files';
import { reactNativeTypeMapping } from './type_mapping';

export type PreparedReactNative = PreparedRN;
export type ReactNativeOptions = PartialReactNativeOptions;
export type { PartialReactNativeOptions };
export { DEFAULT_RN_OPTIONS, mergeRnOptions, sanitizePackageName };
export { reactNativeIdentifierProfile, reactNativeTypeMapping };

export const reactNativeTarget: Target<ReactNativeOptions, PreparedReactNative> = {
  id: 'react_native',
  displayName: 'React Native',
  defaultPackageName: 'design-system',
  defaultOptions: DEFAULT_RN_OPTIONS,
  sanitizePackageName,
  normalizeOptions: mergeRnOptions,

  prepare(
    input: SemanticTokenGraph | IR,
    manifest: Manifest | ManifestTargetSection | null = null,
    _options?: ReactNativeOptions,
  ): PreparedReactNative {
    return prepareRN(input, manifest);
  },

  emit(prepared: PreparedReactNative, options?: ReactNativeOptions): EmittedFile[] {
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
    const filteredCollections = prepared.collections.filter((c) => {
      if (c.kind === 'primitive' && !o.include.primitives) return false;
      if (c.kind === 'token' && !o.include.tokens) return false;
      return true;
    });
    const filtered: PreparedReactNative = { ...prepared, collections: filteredCollections };
    const colFiles = emitCollections(filtered);
    const runtimeFiles = emitRuntime(filtered);
    const compositeFiles = emitComposites(filtered).filter((f) => {
      if (f.path.endsWith('colorStyles.ts')) return o.include.composites.colorStyles;
      if (f.path.endsWith('shadows.ts')) return o.include.composites.shadows;
      if (f.path.endsWith('textStyles.ts')) return o.include.composites.textStyles;
      return true;
    });
    return [...base, ...runtimeFiles, ...compositeFiles, ...colFiles];
  },
};

export function registerReactNativeTarget(): void {
  if (!hasTarget('react_native')) {
    registerTarget(reactNativeTarget);
  }
}

registerReactNativeTarget();
