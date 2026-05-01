// Orchestrator: takes IR and returns all files for a complete Flutter
// design-system package. This module must stay browser-safe (no fs/path).

import type { IR } from '../../../ir/types';
import type { Manifest } from '../../../manifest';
import { prepareIR } from './prepare';
import type { PreparedIR } from './prepare';
import type { ExportOptions } from './options';
import { DEFAULT_EXPORT_OPTIONS } from './options';
import { emitCollection } from './collection';
import { emitColorStyles, emitShadows, emitTextStyles } from './composites';
import { emitController, collectionDir } from './controller';
import { emitTheme } from './theme';
import { emitBarrel } from './barrel';
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
      contents: emitCollection(col, prepared.varIndex),
    });
  }

  // Composite files (skip when no styles)
  const hasPaint =
    options.include.composites.colorStyles && prepared.paintStyles.length > 0;
  const hasEffect =
    options.include.composites.shadows && prepared.effectStyles.length > 0;
  const hasText =
    options.include.composites.textStyles && prepared.textStyles.length > 0;
  if (hasPaint) {
    files.push({
      path: 'lib/src/composites/color_styles.dart',
      contents: emitColorStyles(prepared.paintStyles, prepared.varIndex),
    });
  }
  if (hasEffect) {
    files.push({
      path: 'lib/src/composites/shadows.dart',
      contents: emitShadows(prepared.effectStyles, prepared.varIndex),
    });
  }
  if (hasText) {
    files.push({
      path: 'lib/src/composites/text_styles.dart',
      contents: emitTextStyles(prepared.textStyles, prepared.varIndex),
    });
  }

  // Internal + facade
  files.push({ path: 'lib/src/_internal/lerp.dart', contents: lerpDartFile() });
  files.push({
    path: 'lib/src/_internal/controller.dart',
    contents: emitController(collections),
  });
  files.push({
    path: 'lib/src/theme.dart',
    contents: emitTheme(collections, {
      paintStyles: hasPaint,
      effectStyles: hasEffect,
      textStyles: hasText,
    }),
  });
  files.push({ path: 'lib/src/wrapper.dart', contents: wrapperDartFile() });
  files.push({ path: 'lib/src/design_system.dart', contents: publicApiDartFile() });
  files.push({
    path: `lib/${packageName}.dart`,
    contents: emitBarrel(collections, {
      paintStyles: hasPaint,
      effectStyles: hasEffect,
      textStyles: hasText,
    }),
  });

  // Package metadata
  files.push({ path: 'pubspec.yaml', contents: pubspecYaml(packageName) });
  files.push({ path: 'README.md', contents: readmeMd(packageName) });
  if (options.include.smokeTest) {
    files.push({
      path: 'test/smoke_test.dart',
      contents: smokeTestDartFile(packageName),
    });
  }

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

