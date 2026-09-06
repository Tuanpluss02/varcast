import type { IR } from '../../ir/types';
import type { Manifest, ManifestTargetSection } from '../../core/manifest';
import type { EmittedFile, PreparedIR, Target, TargetWarning } from '../../core/target';
import type { ExportOptions } from './generator/options';
import { normalizeExportOptions } from './generator/options';
import { prepareIR as prepareFlutterIR } from './generator/prepare';
import type { PreparedWarning } from './generator/prepare';
import { emitPreparedPackage } from './generator/emit';
import { flutterIdentifierProfile } from './identifier';
import { flutterTypeMapping } from './type_mapping';

export type FlutterOptions = ExportOptions;

export type PreparedFlutter = PreparedIR & {
  flutterPrepared: ReturnType<typeof prepareFlutterIR>;
};

function toTargetSection(prepared: ReturnType<typeof prepareFlutterIR>): ManifestTargetSection {
  return (
    prepared.nextManifest.targets.flutter ?? {
      variables: {},
      collections: {},
    }
  );
}

function toTargetWarnings(ws: PreparedWarning[]): TargetWarning[] {
  return ws.map((w) => {
    if (w.type === 'KEYWORD_CONFLICT') {
      return {
        targetId: 'flutter',
        code: 'KEYWORD_CONFLICT',
        message: `Variable ${w.variableId}: "${w.original}" is a Dart reserved word — renamed to "${w.fixed}".`,
        details: { variableId: w.variableId, original: w.original, fixed: w.fixed },
      };
    }
    return {
      targetId: 'flutter',
      code: 'DUPLICATE_DART_NAME',
      message: `Variable ${w.variableId}: leaf "${w.original}" collided with a sibling — renamed to "${w.fixed}".`,
      details: { variableId: w.variableId, original: w.original, fixed: w.fixed },
    };
  });
}

export const flutterTarget: Target<FlutterOptions, PreparedFlutter> = {
  id: 'flutter',
  profile: flutterIdentifierProfile,
  typeMapping: flutterTypeMapping,

  prepare(ir: IR, manifest: Manifest | null, options?: FlutterOptions): PreparedFlutter {
    const o = normalizeExportOptions(options);
    const prepared = prepareFlutterIR(ir, manifest, o);
    const { warnings: preparedWarnings } = prepared;
    return {
      flutterPrepared: prepared,
      nextManifestSection: toTargetSection(prepared),
      warnings: toTargetWarnings(preparedWarnings),
    };
  },

  emit(prepared: PreparedFlutter, options?: FlutterOptions): EmittedFile[] {
    const o = normalizeExportOptions(options);
    const out = emitPreparedPackage(prepared.flutterPrepared, o);
    return out.files;
  },
};
