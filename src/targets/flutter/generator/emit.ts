// Orchestrator: takes IR and returns all files for a complete Flutter
// design-system package. This module must stay browser-safe (no fs/path).

import type { IR } from '../../../ir/types';
import type { Manifest } from '../../../manifest';
import { prepareIR } from './prepare';
import type { PreparedIR } from './prepare';
import type { ExportOptions } from './options';
import { DEFAULT_EXPORT_OPTIONS } from './options';
import { emitCollection } from './collection';
import {
  emitColorStyles,
  emitShadows,
  emitTextStyles,
  paintStylesUseAlias,
  effectStylesUseAlias,
  textStylesUseAlias,
} from './composites';
import { emitController, collectionDir } from './controller';
import { emitTheme } from './theme';
import { emitBarrel } from './barrel';
import { emitScope } from './scope';
import { emitExtensions } from './extensions';
import {
  lerpDartFile,
  wrapperDartFile,
  publicApiDartFile,
  pubspecYaml,
  readmeMd,
  smokeTestDartFile,
} from './static_files';

export interface EmittedFile {
  path: string; // relative to package root
  contents: string;
}

export function emitPreparedPackage(
  prepared: PreparedIR,
  options: ExportOptions = DEFAULT_EXPORT_OPTIONS,
): { files: EmittedFile[]; nextManifest: Manifest } {
  const packageName = options.packageName;
  const archMode = options.archMode;

  // Drop empty collections — they would emit invalid Dart (zero-arm switch).
  const collections = prepared.collections.filter((c) => {
    if (c.variables.length === 0 || c.modes.length === 0) return false;
    if (c.kind === 'primitive' && !options.include.primitives) return false;
    if (c.kind === 'token' && !options.include.tokens) return false;
    return true;
  });

  const files: EmittedFile[] = [];

  // Per-collection files
  for (const col of collections) {
    const dir = collectionDir(col);
    files.push({
      path: `lib/src/${dir}/${col.fileBaseName}.dart`,
      contents: emitCollection(col, prepared.varIndex, archMode),
    });
  }

  // Composite files (skip when no styles)
  const hasPaint =
    options.include.composites.colorStyles && prepared.paintStyles.length > 0;
  const hasEffect =
    options.include.composites.shadows && prepared.effectStyles.length > 0;
  const hasText =
    options.include.composites.textStyles && prepared.textStyles.length > 0;
  const hasComposites = {
    paintStyles: hasPaint,
    effectStyles: hasEffect,
    textStyles: hasText,
  };
  // Whether each composite needs the controller injected via ctor in context
  // mode. Mirrors the decision composites.ts makes when emitting the class.
  const compositesUseAlias = {
    paintStyles: hasPaint && paintStylesUseAlias(prepared.paintStyles),
    effectStyles: hasEffect && effectStylesUseAlias(prepared.effectStyles),
    textStyles: hasText && textStylesUseAlias(prepared.textStyles),
  };
  if (hasPaint) {
    files.push({
      path: 'lib/src/composites/color_styles.dart',
      contents: emitColorStyles(prepared.paintStyles, prepared.varIndex, archMode),
    });
  }
  if (hasEffect) {
    files.push({
      path: 'lib/src/composites/shadows.dart',
      contents: emitShadows(prepared.effectStyles, prepared.varIndex, archMode),
    });
  }
  if (hasText) {
    files.push({
      path: 'lib/src/composites/text_styles.dart',
      contents: emitTextStyles(prepared.textStyles, prepared.varIndex, archMode),
    });
  }

  // Internal + facade
  files.push({ path: 'lib/src/_internal/lerp.dart', contents: lerpDartFile() });
  files.push({
    path: 'lib/src/_internal/controller.dart',
    contents: emitController(collections, archMode),
  });
  if (archMode === 'context') {
    files.push({
      path: 'lib/src/_internal/scope.dart',
      contents: emitScope(),
    });
  }
  files.push({
    path: 'lib/src/theme.dart',
    contents: emitTheme(collections, hasComposites, archMode, compositesUseAlias),
  });
  if (archMode === 'context') {
    files.push({
      path: 'lib/src/extensions.dart',
      contents: emitExtensions(collections, hasComposites),
    });
  }
  files.push({
    path: 'lib/src/wrapper.dart',
    contents: wrapperDartFile(archMode),
  });
  files.push({ path: 'lib/src/design_system.dart', contents: publicApiDartFile() });
  files.push({
    path: `lib/${packageName}.dart`,
    contents: emitBarrel(collections, hasComposites, archMode),
  });

  // Package metadata
  files.push({ path: 'pubspec.yaml', contents: pubspecYaml(packageName) });
  files.push({ path: 'README.md', contents: readmeMd(packageName, archMode) });
  files.push({
    path: 'test/smoke_test.dart',
    contents: smokeTestDartFile(packageName),
  });

  return { files, nextManifest: prepared.nextManifest };
}

export function emitPackage(
  ir: IR,
  manifest: Manifest | null = null,
  options: ExportOptions = DEFAULT_EXPORT_OPTIONS,
): { files: EmittedFile[]; nextManifest: Manifest } {
  const prepared = prepareIR(ir, manifest, options);
  return emitPreparedPackage(prepared, options);
}

