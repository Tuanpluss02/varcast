import type { IR } from '../../ir/types';
import type { Manifest, ManifestTargetSection } from '../../core/manifest';
import type { EmittedFile, PreparedIR, Target } from '../../core/target';
import type { ExportOptions } from './generator/options';
import { DEFAULT_EXPORT_OPTIONS } from './generator/options';
import { prepareIR as prepareFlutterIR } from './generator/prepare';
import { emitPreparedPackage } from './generator/emit';
import { flutterIdentifierProfile } from './identifier';
import { flutterTypeMapping } from './type_mapping';

export type FlutterOptions = ExportOptions;

type PreparedFlutter = ReturnType<typeof prepareFlutterIR> & PreparedIR;

function toTargetSection(prepared: ReturnType<typeof prepareFlutterIR>): ManifestTargetSection {
  return (
    prepared.nextManifest.targets.flutter ?? {
      variables: {},
      collections: {},
    }
  );
}

export const flutterTarget: Target = {
  id: 'flutter',
  profile: flutterIdentifierProfile,
  typeMapping: flutterTypeMapping,

  prepare(ir: IR, manifest: Manifest | null, options: unknown): PreparedFlutter {
    const o = (options as FlutterOptions | undefined) ?? DEFAULT_EXPORT_OPTIONS;
    const prepared = prepareFlutterIR(ir, manifest as any, o);
    return {
      ...prepared,
      nextManifestSection: toTargetSection(prepared),
    };
  },

  emit(prepared: PreparedIR, options: unknown): EmittedFile[] {
    const o = (options as FlutterOptions | undefined) ?? DEFAULT_EXPORT_OPTIONS;
    const out = emitPreparedPackage(prepared as any, o);
    return out.files;
  },
};

