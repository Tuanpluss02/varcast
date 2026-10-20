/**
 * Emits all files for a complete Flutter design system package.
 */

import type { IR } from '../../../ir/types';
import type { SemanticTokenGraph } from '../../../core/graph/types';
import type { Manifest } from '../../../core/manifest';
import { prepareIR } from './prepare';
import type { PreparedIR } from './prepare';
import type { ExportOptions } from './options';
import { DEFAULT_EXPORT_OPTIONS } from './options';
import { emitCollection } from './collection';
import {
  emitColorStyles,
  emitShadows,
  emitTextStyles,
} from './composites';
import { emitController } from './controller';
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
  path: string;
  contents: string;
}

export function emitPreparedPackage(
  prepared: Omit<PreparedIR, 'warnings'> & { warnings?: unknown },
  options: ExportOptions = DEFAULT_EXPORT_OPTIONS,
): { files: EmittedFile[]; nextManifest: Manifest } {
  const packageName = options.packageName;

  const selectedColIds = options.include?.collections
    ? new Set(options.include.collections)
    : null;

  const collections = prepared.collections.filter((c) => {
    if (c.variables.length === 0 || c.modes.length === 0) return false;
    if (selectedColIds) {
      return (
        selectedColIds.has(c.id) ||
        selectedColIds.has(c.className) ||
        selectedColIds.has(c.fileBaseName)
      );
    }
    if (c.kind === 'primitive' && options.include?.primitives === false) return false;
    if (c.kind === 'token' && options.include?.tokens === false) return false;
    return true;
  });

  const exportedColIds = new Set(collections.map((c) => c.id));
  const files: EmittedFile[] = [];

  for (const col of collections) {
    const colFiles = emitCollection(col, prepared.varIndex, exportedColIds, prepared.ir);
    for (const colFile of colFiles) {
      files.push({
        path: `lib/src/collections/${col.fileBaseName}/${colFile.fileName}`,
        contents: colFile.contents,
      });
    }
  }

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

  if (hasPaint) {
    files.push({
      path: 'lib/src/composites/color_styles.dart',
      contents: emitColorStyles(prepared.paintStyles, prepared.varIndex, exportedColIds, prepared.ir),
    });
  }
  if (hasEffect) {
    files.push({
      path: 'lib/src/composites/shadows.dart',
      contents: emitShadows(prepared.effectStyles, prepared.varIndex, exportedColIds, prepared.ir),
    });
  }
  if (hasText) {
    files.push({
      path: 'lib/src/composites/text_styles.dart',
      contents: emitTextStyles(prepared.textStyles, prepared.varIndex, exportedColIds, prepared.ir),
    });
  }

  files.push({ path: 'lib/src/_internal/lerp.dart', contents: lerpDartFile() });
  files.push({
    path: 'lib/src/_internal/controller.dart',
    contents: emitController(collections),
  });
  files.push({
    path: 'lib/src/theme.dart',
    contents: emitTheme(collections, hasComposites),
  });
  files.push({
    path: 'lib/src/wrapper.dart',
    contents: wrapperDartFile(),
  });
  files.push({ path: 'lib/src/design_system.dart', contents: publicApiDartFile() });
  files.push({
    path: `lib/${packageName}.dart`,
    contents: emitBarrel(collections, hasComposites),
  });

  files.push({ path: 'pubspec.yaml', contents: pubspecYaml(packageName) });
  files.push({ path: 'README.md', contents: readmeMd(packageName) });
  files.push({
    path: 'test/smoke_test.dart',
    contents: smokeTestDartFile(packageName),
  });

  if (prepared.ir) {
    files.push({
      path: '_meta/ir.json',
      contents: JSON.stringify(prepared.ir, null, 2),
    });
  }

  return { files, nextManifest: prepared.nextManifest };
}

export function emitPackage(
  ir: SemanticTokenGraph | IR,
  manifest: Manifest | null = null,
  options: ExportOptions = DEFAULT_EXPORT_OPTIONS,
): { files: EmittedFile[]; nextManifest: Manifest } {
  const prepared = prepareIR(ir, manifest, options);
  return emitPreparedPackage(prepared, options);
}
