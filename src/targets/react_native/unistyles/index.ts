// Unistyles flavor — orchestrates the per-emitter file list.

import type { EmittedFile } from '../../../core/target';
import type { ReactNativeOptions } from '../options';
import type { PreparedRN } from '../shared/prepare';
import { emitBuildThemeTs } from './emit_build_theme';
import { emitModuleAugmentationDts } from './emit_module_aug';
import { emitPackageIndexTs } from './emit_pkg_index';
import { emitRawTs } from './emit_raw';
import { emitThemesTs } from './emit_themes';
import { emitTypesTs } from './emit_types';
import { buildThemePlan } from './planner';
import { packageJson, readmeMd, tsconfigJson } from './static_files';

export function emitUnistyles(prepared: PreparedRN, options: ReactNativeOptions): EmittedFile[] {
  const plan = buildThemePlan(prepared);

  return [
    { path: 'package.json', contents: packageJson(options) },
    { path: 'tsconfig.json', contents: tsconfigJson() },
    { path: 'README.md', contents: readmeMd(options) },
    { path: 'src/index.ts', contents: emitPackageIndexTs(plan) },
    { path: 'src/types.ts', contents: emitTypesTs(plan) },
    { path: 'src/raw.ts', contents: emitRawTs(plan) },
    { path: 'src/build-theme.ts', contents: emitBuildThemeTs(plan) },
    { path: 'src/themes.ts', contents: emitThemesTs(plan) },
    { path: 'src/module-augmentation.d.ts', contents: emitModuleAugmentationDts(plan) },
  ];
}
