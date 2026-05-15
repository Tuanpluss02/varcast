// Unistyles flavor — orchestrates the per-emitter file list.

import type { EmittedFile } from '../../../core/target';
import type { ReactNativeOptions } from '../options';
import type { PreparedRN } from '../shared/prepare';
import { emitBuildThemeTs } from './emit_build_theme';
import { emitPackageIndexTs } from './emit_pkg_index';
import {
  collectionFileBaseName,
  emitCollectionDataTs,
  emitColorStylesTs,
  emitDataIndexTs,
  emitDataTypesTs,
  emitShadowsTs,
  emitTextStylesTs,
} from './emit_raw';
import { emitThemesTs } from './emit_themes';
import { emitTypesTs } from './emit_types';
import { buildThemePlan } from './planner';
import { npmrc, packageJson, readmeMd, tsconfigJson } from './static_files';

export function emitUnistyles(prepared: PreparedRN, options: ReactNativeOptions): EmittedFile[] {
  const plan = buildThemePlan(prepared);

  const files: EmittedFile[] = [
    { path: '.npmrc', contents: npmrc() },
    { path: 'package.json', contents: packageJson(options) },
    { path: 'tsconfig.json', contents: tsconfigJson() },
    { path: 'README.md', contents: readmeMd(options, plan) },
    { path: 'src/index.ts', contents: emitPackageIndexTs(plan) },
    { path: 'src/types.ts', contents: emitTypesTs(plan) },
    { path: 'src/data/types.ts', contents: emitDataTypesTs() },
    { path: 'src/data/index.ts', contents: emitDataIndexTs(plan) },
    { path: 'src/composites/text-styles.ts', contents: emitTextStylesTs(plan) },
    { path: 'src/composites/shadows.ts', contents: emitShadowsTs(plan) },
    { path: 'src/composites/color-styles.ts', contents: emitColorStylesTs(plan) },
    { path: 'src/build-theme.ts', contents: emitBuildThemeTs(plan) },
    { path: 'src/themes.ts', contents: emitThemesTs(plan) },
  ];

  for (const collection of plan.collections) {
    files.push({
      path: `src/collections/${collectionFileBaseName(collection)}.ts`,
      contents: emitCollectionDataTs(collection),
    });
  }

  return files;
}
