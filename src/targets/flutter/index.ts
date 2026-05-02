import type { IR } from '../../ir/types';
import type { Manifest, ManifestTargetSection } from '../../core/manifest';
import type { EmittedFile, PreparedIR, Target, TargetWarning } from '../../core/target';
import type { ExportOptions } from './generator/options';
import { DEFAULT_EXPORT_OPTIONS } from './generator/options';
import { prepareIR as prepareFlutterIR } from './generator/prepare';
import type { PreparedWarning } from './generator/prepare';
import { emitPreparedPackage } from './generator/emit';
import { flutterIdentifierProfile } from './identifier';
import { flutterTypeMapping } from './type_mapping';

export type FlutterOptions = ExportOptions;

type PreparedFlutter = Omit<ReturnType<typeof prepareFlutterIR>, 'warnings'> & PreparedIR;

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

export const flutterTarget: Target = {
  id: 'flutter',
  profile: flutterIdentifierProfile,
  typeMapping: flutterTypeMapping,

  prepare(ir: IR, manifest: Manifest | null, options: unknown): PreparedFlutter {
    const o = (options as FlutterOptions | undefined) ?? DEFAULT_EXPORT_OPTIONS;
    const prepared = prepareFlutterIR(ir, manifest as any, o);
    const { warnings: preparedWarnings, ...rest } = prepared;
    return {
      ...rest,
      nextManifestSection: toTargetSection(prepared),
      warnings: toTargetWarnings(preparedWarnings),
    };
  },

  emit(prepared: PreparedIR, options: unknown): EmittedFile[] {
    const o = (options as FlutterOptions | undefined) ?? DEFAULT_EXPORT_OPTIONS;
    const out = emitPreparedPackage(prepared as any, o);
    return out.files;
  },
};

