import { FILE_HEADER } from './emit_helpers';
import type { PreparedCollection } from './prepare';

/**
 * Emits the AppTheme static facade class file.
 */
export function emitTheme(
  collections: PreparedCollection[],
  hasComposites: { paintStyles: boolean; effectStyles: boolean; textStyles: boolean },
): string {
  let out = FILE_HEADER;
  out += `import '_internal/controller.dart';\n`;
  if (hasComposites.paintStyles) out += `import 'composites/color_styles.dart';\n`;
  if (hasComposites.effectStyles) out += `import 'composites/shadows.dart';\n`;
  if (hasComposites.textStyles) out += `import 'composites/text_styles.dart';\n`;
  for (const col of collections) {
    out += `import 'collections/${col.fileBaseName}/${col.fileBaseName}.dart';\n`;
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
    out += `  static void set${col.className}Mode(${col.className}Mode m, {Duration? duration}) =>\n`;
    out += `      DesignSystemController.instance.set${col.className}Mode(m, duration: duration);\n\n`;
  }

  out += `  /// Default animation duration for mode transitions. Defaults to [Duration.zero].\n`;
  out += `  static Duration get defaultDuration =>\n`;
  out += `      DesignSystemController.instance.defaultDuration;\n\n`;
  out += `  static set defaultDuration(Duration d) {\n`;
  out += `    assert(!d.isNegative, 'defaultDuration must not be negative');\n`;
  out += `    DesignSystemController.instance.defaultDuration = d;\n`;
  out += `  }\n\n`;

  out += `  static void setAnimationDuration(Duration d) => defaultDuration = d;\n\n`;

  for (const col of collections) {
    out += `  static ${col.className}Mode get current${col.className}Mode =>\n`;
    out += `      DesignSystemController.instance.current${col.className}Mode;\n\n`;
  }

  out += `}\n`;
  return out;
}
