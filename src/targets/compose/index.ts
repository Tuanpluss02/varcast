import type { SemanticTokenGraph } from '../../core/graph/types';
import type { ManifestTargetSection } from '../../core/manifest';
import { hasTarget, registerTarget } from '../../core/registry/target_registry';
import type { EmittedFile, Target } from '../../core/target';
import { emitCollections } from './generator/emit_collections';
import { emitComposites } from './generator/emit_composites';
import { emitTheme } from './generator/emit_theme';
import { prepareCompose } from './generator/prepare';
import type { PreparedCompose } from './generator/prepare';
import { emitStaticFiles } from './generator/static_files';
import type { ComposeOptions, PartialComposeOptions } from './options';
import {
  DEFAULT_COMPOSE_OPTIONS,
  normalizeComposeOptions,
  sanitizePackageName,
  validateComposeOptions,
} from './options';

export type { ComposeOptions, PartialComposeOptions, PreparedCompose };
export {
  DEFAULT_COMPOSE_OPTIONS,
  normalizeComposeOptions,
  sanitizePackageName,
  validateComposeOptions,
};

export const composeTarget: Target<ComposeOptions, PreparedCompose> = {
  id: 'compose',
  displayName: 'Jetpack Compose',
  defaultPackageName: 'com.example.designsystem',
  defaultOptions: DEFAULT_COMPOSE_OPTIONS,
  sanitizePackageName,
  normalizeOptions: normalizeComposeOptions,
  validateOptions: validateComposeOptions,

  prepare(
    graph: SemanticTokenGraph,
    section: ManifestTargetSection | null = null,
    options?: ComposeOptions,
  ): PreparedCompose {
    return prepareCompose(
      graph,
      section,
      options ? normalizeComposeOptions(options) : DEFAULT_COMPOSE_OPTIONS,
    );
  },

  emit(prepared: PreparedCompose, options?: ComposeOptions): EmittedFile[] {
    const o = normalizeComposeOptions(options);
    const selectedColIds = o.include.collections
      ? new Set(o.include.collections)
      : null;

    const filteredCollections = prepared.collections.filter((col) => {
      if (selectedColIds) {
        if (
          !selectedColIds.has(col.id) &&
          !selectedColIds.has(col.className) &&
          !selectedColIds.has(col.name)
        ) {
          return false;
        }
      }
      if (col.kind === 'primitive' && !o.include.primitives) return false;
      if (col.kind === 'token' && !o.include.tokens) return false;
      return true;
    });

    const filteredPrepared: PreparedCompose = {
      ...prepared,
      collections: filteredCollections,
    };

    const packagePath = o.packageName.replace(/\./g, '/');

    const staticFiles = emitStaticFiles(o.packageName);
    const collectionFiles = emitCollections(
      filteredPrepared,
      packagePath,
      o.packageName,
    );
    const compositeFiles = emitComposites(
      filteredPrepared,
      packagePath,
      o.packageName,
    ).filter((f) => {
      if (f.path.endsWith('ColorStyles.kt')) return o.include.composites.colorStyles;
      if (f.path.endsWith('Shadows.kt')) return o.include.composites.shadows;
      if (f.path.endsWith('TextStyles.kt')) return o.include.composites.textStyles;
      return true;
    });
    const themeFiles = emitTheme(
      filteredPrepared,
      packagePath,
      o.packageName,
    );

    return [
      ...staticFiles,
      ...collectionFiles,
      ...compositeFiles,
      ...themeFiles,
    ];
  },
};

export function registerComposeTarget(): void {
  if (!hasTarget('compose')) {
    registerTarget(composeTarget);
  }
}

registerComposeTarget();
