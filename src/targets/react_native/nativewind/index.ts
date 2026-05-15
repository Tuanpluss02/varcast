// NativeWind flavor — orchestrates the per-emitter file list.

import type { EmittedFile } from '../../../core/target';
import type { ReactNativeOptions } from '../options';
import type { PreparedRN } from '../shared/prepare';
import { emitTailwindPresetCjs } from './emit_preset';
import { emitThemeCss } from './emit_themes_css';
import {
  emitThemeVarsJs,
  emitThemesIndexDts,
  emitThemesIndexJs,
} from './emit_themes_js';
import { buildNativeWindPlan } from './planner';
import { packageJson, readmeMd, tailwindPresetDts } from './static_files';

export function emitNativeWind(prepared: PreparedRN, options: ReactNativeOptions): EmittedFile[] {
  const plan = buildNativeWindPlan(prepared);

  const out: EmittedFile[] = [
    { path: 'package.json', contents: packageJson(options) },
    { path: 'README.md', contents: readmeMd(options) },
    { path: 'tailwind.preset.cjs', contents: emitTailwindPresetCjs(plan) },
    { path: 'tailwind.preset.d.ts', contents: tailwindPresetDts() },
    { path: 'themes/index.js', contents: emitThemesIndexJs(plan) },
    { path: 'themes/index.d.ts', contents: emitThemesIndexDts(plan) },
  ];

  for (const tf of plan.themeFiles) {
    out.push({ path: `themes/${tf.slug}.css`, contents: emitThemeCss(tf) });
    out.push({ path: `themes/${tf.slug}.vars.js`, contents: emitThemeVarsJs(tf) });
  }

  return out;
}
