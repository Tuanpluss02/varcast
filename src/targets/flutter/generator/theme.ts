import { FILE_HEADER } from './emit_helpers';
import { collectionDir } from './controller';
import type { ArchMode } from './options';
import type { PreparedCollection } from './prepare';

// Emit `lib/src/theme.dart`. The shape depends on archMode:
//
// 'static' — AppTheme is a static facade with per-collection getters that
//   delegate to the singleton controller. Composites are const instances.
//
// 'context' — AppTheme exposes only `of(BuildContext)` (entry point) and
//   imperative APIs (mode setters, current mode, animation duration). The
//   per-collection accessors live on AppThemeData (the view returned by `of`)
//   and trigger an InheritedNotifier dependency, so const widgets rebuild
//   correctly. The legacy static collection getters are intentionally absent.

/**
 * `compositesUseAlias` mirrors what `composites.ts` decided when emitting each
 * composite class. In context mode, when a composite contains aliases, its
 * class takes a `DesignSystemController` ctor arg; the AppThemeData getter
 * here must construct it the same way (`DSStyles(_c)` instead of
 * `const DSStyles()`). When false, the composite is const-only and we keep
 * the const literal.
 */
export function emitTheme(
  collections: PreparedCollection[],
  hasComposites: { paintStyles: boolean; effectStyles: boolean; textStyles: boolean },
  archMode: ArchMode = 'static',
  compositesUseAlias: { paintStyles: boolean; effectStyles: boolean; textStyles: boolean } = {
    paintStyles: false,
    effectStyles: false,
    textStyles: false,
  },
): string {
  return archMode === 'context'
    ? emitContextTheme(collections, hasComposites, compositesUseAlias)
    : emitStaticTheme(collections, hasComposites);
}

function emitStaticTheme(
  collections: PreparedCollection[],
  hasComposites: { paintStyles: boolean; effectStyles: boolean; textStyles: boolean },
): string {
  let out = FILE_HEADER;
  out += `import '_internal/controller.dart';\n`;
  if (hasComposites.paintStyles) out += `import 'composites/color_styles.dart';\n`;
  if (hasComposites.effectStyles) out += `import 'composites/shadows.dart';\n`;
  if (hasComposites.textStyles) out += `import 'composites/text_styles.dart';\n`;
  for (const col of collections) {
    out += `import '${collectionDir(col)}/${col.fileBaseName}.dart';\n`;
  }
  out += `\n`;

  out += `class AppTheme {\n`;
  out += `  AppTheme._();\n\n`;

  for (const col of collections) {
    out += `  static ${col.className} get ${col.accessor} =>\n`;
    out += `      DesignSystemController.instance.${col.accessor};\n\n`;
  }

  if (hasComposites.textStyles)
    out += `  static const DSStyles textStyles = DSStyles();\n`;
  if (hasComposites.effectStyles)
    out += `  static const DSShadows shadows = DSShadows();\n`;
  if (hasComposites.paintStyles)
    out += `  static const DSColorStyles colorStyle = DSColorStyles();\n`;
  out += `\n`;

  for (const col of collections) {
    out += `  static void set${col.className}Mode(${col.className}Mode m) =>\n`;
    out += `      DesignSystemController.instance.set${col.className}Mode(m);\n\n`;
  }

  out += `  static void setAnimationDuration(Duration d) =>\n`;
  out += `      DesignSystemController.instance.setAnimationDuration(d);\n\n`;

  for (const col of collections) {
    out += `  static ${col.className}Mode get current${col.className}Mode =>\n`;
    out += `      DesignSystemController.instance.current${col.className}Mode;\n\n`;
  }

  out += `}\n`;
  return out;
}

function emitContextTheme(
  collections: PreparedCollection[],
  hasComposites: { paintStyles: boolean; effectStyles: boolean; textStyles: boolean },
  compositesUseAlias: { paintStyles: boolean; effectStyles: boolean; textStyles: boolean },
): string {
  let out = FILE_HEADER;
  out += `import 'package:flutter/widgets.dart';\n`;
  out += `import '_internal/controller.dart';\n`;
  out += `import '_internal/scope.dart';\n`;
  if (hasComposites.paintStyles) out += `import 'composites/color_styles.dart';\n`;
  if (hasComposites.effectStyles) out += `import 'composites/shadows.dart';\n`;
  if (hasComposites.textStyles) out += `import 'composites/text_styles.dart';\n`;
  for (const col of collections) {
    out += `import '${collectionDir(col)}/${col.fileBaseName}.dart';\n`;
  }
  out += `\n`;

  // ── AppThemeData (view returned by AppTheme.of) ────────────────────────────
  out += `/// Snapshot view of the design system at a given BuildContext.\n`;
  out += `/// Returned by [AppTheme.of]. Reading any field registers a dependency\n`;
  out += `/// on the active scope, so widgets — including const ones — rebuild when\n`;
  out += `/// modes change.\n`;
  out += `class AppThemeData {\n`;
  out += `  const AppThemeData._(this._c);\n`;
  out += `  final DesignSystemController _c;\n\n`;

  for (const col of collections) {
    out += `  ${col.className} get ${col.accessor} => _c.${col.accessor};\n`;
  }
  if (collections.length > 0) out += `\n`;

  if (hasComposites.textStyles) {
    const ctor = compositesUseAlias.textStyles ? 'DSStyles(_c)' : 'const DSStyles()';
    out += `  DSStyles get textStyles => ${ctor};\n`;
  }
  if (hasComposites.effectStyles) {
    const ctor = compositesUseAlias.effectStyles ? 'DSShadows(_c)' : 'const DSShadows()';
    out += `  DSShadows get shadows => ${ctor};\n`;
  }
  if (hasComposites.paintStyles) {
    const ctor = compositesUseAlias.paintStyles ? 'DSColorStyles(_c)' : 'const DSColorStyles()';
    out += `  DSColorStyles get colorStyle => ${ctor};\n`;
  }
  out += `}\n\n`;

  // ── AppTheme (entry point + imperative APIs) ───────────────────────────────
  out += `class AppTheme {\n`;
  out += `  AppTheme._();\n\n`;

  out += `  /// Entry point. Reads register a dependency on the design system\n`;
  out += `  /// scope, so the calling widget rebuilds on mode changes.\n`;
  out += `  static AppThemeData of(BuildContext context) =>\n`;
  out += `      AppThemeData._(DesignSystemScope.of(context));\n\n`;

  for (const col of collections) {
    out += `  static void set${col.className}Mode(${col.className}Mode m) =>\n`;
    out += `      DesignSystemController.instance.set${col.className}Mode(m);\n\n`;
  }

  out += `  static void setAnimationDuration(Duration d) =>\n`;
  out += `      DesignSystemController.instance.setAnimationDuration(d);\n\n`;

  for (const col of collections) {
    out += `  static ${col.className}Mode get current${col.className}Mode =>\n`;
    out += `      DesignSystemController.instance.current${col.className}Mode;\n\n`;
  }

  out += `}\n`;
  return out;
}
