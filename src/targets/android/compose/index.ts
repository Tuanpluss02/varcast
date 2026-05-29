import type { EmittedFile } from '../../../core/target';
import type { AndroidOptions } from '../options';
import { namespacePath } from '../options';
import type { PreparedAndroid } from '../shared/prepare';
import { collectionDir, emitCollection } from './collection';
import { emitColorStyles, emitShadows, emitTextStyles } from './composites';
import {
  androidManifestXml,
  buildGradleKts,
  designSystemKt,
  lerpKt,
  readmeMd,
  settingsGradleKts,
  smokeTestKt,
  wrapperKt,
} from './static_files';
import { emitController, emitScope, emitTheme } from './theme';

export function emitComposeAndroid(
  prepared: PreparedAndroid,
  options: AndroidOptions,
): EmittedFile[] {
  const namespace = options.androidNamespace;
  const root = `src/main/kotlin/${namespacePath(namespace)}`;
  const testRoot = `src/test/kotlin/${namespacePath(namespace)}`;
  const collections = prepared.collections.filter((c) => {
    if (c.variables.length === 0 || c.modes.length === 0) return false;
    if (c.kind === 'primitive' && !options.include.primitives) return false;
    if (c.kind === 'token' && !options.include.tokens) return false;
    return true;
  });
  const hasPaint =
    options.include.composites.colorStyles && prepared.paintStyles.length > 0;
  const shadowStyles = prepared.effectStyles.filter(
    (s) => s.type === 'DROP_SHADOW' || s.type === 'INNER_SHADOW',
  );
  const hasEffect = options.include.composites.shadows && shadowStyles.length > 0;
  const hasText =
    options.include.composites.textStyles && prepared.textStyles.length > 0;

  const files: EmittedFile[] = [
    { path: 'settings.gradle.kts', contents: settingsGradleKts(options) },
    { path: 'build.gradle.kts', contents: buildGradleKts(options) },
    { path: 'README.md', contents: readmeMd(options) },
    { path: 'src/main/AndroidManifest.xml', contents: androidManifestXml() },
    { path: `${root}/internal/Lerp.kt`, contents: lerpKt(namespace) },
    { path: `${root}/internal/DesignSystemScope.kt`, contents: emitScope(namespace) },
    {
      path: `${root}/internal/DesignSystemController.kt`,
      contents: emitController(namespace, collections),
    },
    { path: `${root}/AppTheme.kt`, contents: emitTheme(namespace, collections, {
      paintStyles: hasPaint,
      effectStyles: hasEffect,
      textStyles: hasText,
    }) },
    { path: `${root}/DesignSystem.kt`, contents: designSystemKt(namespace) },
    { path: `${root}/DesignSystemWrapper.kt`, contents: wrapperKt(namespace) },
    { path: `${testRoot}/SmokeTest.kt`, contents: smokeTestKt(namespace) },
  ];

  for (const col of collections) {
    files.push({
      path: `${root}/${collectionDir(col)}/${col.fileName}`,
      contents: emitCollection(namespace, col, prepared.varIndex),
    });
  }

  if (hasPaint) {
    files.push({
      path: `${root}/composites/DSColorStyles.kt`,
      contents: emitColorStyles(namespace, prepared.paintStyles, prepared.varIndex),
    });
  }
  if (hasEffect) {
    files.push({
      path: `${root}/composites/DSShadows.kt`,
      contents: emitShadows(namespace, shadowStyles, prepared.varIndex),
    });
  }
  if (hasText) {
    files.push({
      path: `${root}/composites/DSStyles.kt`,
      contents: emitTextStyles(namespace, prepared.textStyles, prepared.varIndex),
    });
  }

  return files;
}
