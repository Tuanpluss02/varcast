import type { Manifest } from '../../core/manifest';
import type { EmittedFile, PreparedIR, Target } from '../../core/target';
import type { IR } from '../../ir/types';
import { androidIdentifierProfile } from './identifier';
import { mergeAndroidOptions, type AndroidOptions } from './options';
import { androidTypeMapping } from './type_mapping';
import { emitComposeAndroid } from './compose';
import { prepareAndroid, type PreparedAndroid } from './shared/prepare';

export type PreparedAndroidTarget = PreparedIR & {
  android: PreparedAndroid;
};

export const androidTarget: Target = {
  id: 'android',
  profile: androidIdentifierProfile,
  typeMapping: androidTypeMapping,

  prepare(ir: IR, manifest: Manifest | null, _options: unknown): PreparedAndroidTarget {
    const android = prepareAndroid(ir, manifest);
    return {
      android,
      nextManifestSection: android.nextManifestSection,
      warnings: android.warnings,
    };
  },

  emit(prepared: PreparedIR, options: unknown): EmittedFile[] {
    const o = mergeAndroidOptions(options);
    return emitComposeAndroid((prepared as PreparedAndroidTarget).android, o);
  },
};

export { mergeAndroidOptions } from './options';
export type { AndroidFlavor, AndroidOptions } from './options';
