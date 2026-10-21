import type { SemanticTokenGraph } from '../../core/graph/types';
import type { ManifestTargetSection } from '../../core/manifest';
import type { EmittedFile, PreparedTarget, Target, TargetWarning } from '../../core/target';
import { hasTarget, registerTarget } from '../../core/registry/target_registry';
import type { ExportOptions, PartialExportOptions } from './generator/options';
import {
  DEFAULT_EXPORT_OPTIONS,
  normalizeExportOptions,
  sanitizePackageName,
} from './generator/options';
import { prepareIR as prepareFlutterIR } from './generator/prepare';
import type { PreparedFlutterIR, PreparedWarning } from './generator/prepare';
import { emitPreparedPackage } from './generator/emit';

export type FlutterOptions = PartialExportOptions;

export interface PreparedFlutter extends PreparedTarget {
  readonly targetId: 'flutter';
  readonly flutterPrepared: PreparedFlutterIR;
  readonly nextManifestSection: ManifestTargetSection;
  readonly warnings: TargetWarning[];
}

export type { PreparedFlutterIR };

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
  displayName: 'Flutter',
  defaultPackageName: 'design_system',
  defaultOptions: DEFAULT_EXPORT_OPTIONS,
  sanitizePackageName,
  normalizeOptions: normalizeExportOptions,

  prepare(
    graph: SemanticTokenGraph,
    section: ManifestTargetSection | null = null,
    options?: FlutterOptions,
  ): PreparedFlutter {
    const o = normalizeExportOptions(options);
    const prepared = prepareFlutterIR(graph, section, o);
    const { warnings: preparedWarnings } = prepared;
    return {
      targetId: 'flutter',
      flutterPrepared: prepared,
      nextManifestSection: prepared.nextManifestSection,
      warnings: toTargetWarnings(preparedWarnings),
    };
  },

  emit(prepared: PreparedFlutter, options?: FlutterOptions): EmittedFile[] {
    const o = normalizeExportOptions(options);
    const out = emitPreparedPackage(prepared.flutterPrepared, o);
    return out.files;
  },
};

export function registerFlutterTarget(): void {
  if (!hasTarget('flutter')) {
    registerTarget(flutterTarget);
  }
}

registerFlutterTarget();
