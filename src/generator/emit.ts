// Orchestrator: takes IR and returns all files for a complete Flutter
// design-system package. This module must stay browser-safe (no fs/path).

import type { IR } from '../ir/types';
import { prepareIR } from './prepare';
import { emitCollection } from './collection';
import { emitColorStyles, emitShadows, emitTextStyles } from './composites';
import { emitController, collectionDir } from './controller';
import { emitTheme } from './theme';
import { emitBarrel } from './barrel';
import { lerpDartFile, wrapperDartFile, pubspecYaml, readmeMd } from './static_files';

export interface EmittedFile {
  path: string; // relative to package root
  contents: string;
}

export function emitPackage(ir: IR, packageName = 'design_system'): EmittedFile[] {
  const prepared = prepareIR(ir);

  // Drop empty collections — they would emit invalid Dart (zero-arm switch).
  const collections = prepared.collections.filter(
    (c) => c.variables.length > 0 && c.modes.length > 0,
  );

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
  const hasPaint = prepared.paintStyles.length > 0;
  const hasEffect = prepared.effectStyles.length > 0;
  const hasText = prepared.textStyles.length > 0;
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

  return files;
}

