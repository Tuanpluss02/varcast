import { FILE_HEADER } from './emit_helpers';
import { collectionDir } from './controller';
import type { PreparedCollection } from './prepare';

// Emit `lib/src/extensions.dart` — sugar for `AppTheme.of(context).x`.
// Every getter routes through `AppTheme.of(this)` so the InheritedNotifier
// dependency is registered for composites too (their getters read the
// controller singleton internally and would otherwise miss the dependency).
// Only emitted in 'context' archMode.

export function emitExtensions(
  collections: PreparedCollection[],
  hasComposites: { paintStyles: boolean; effectStyles: boolean; textStyles: boolean },
): string {
  let out = FILE_HEADER;
  out += `import 'package:flutter/widgets.dart';\n`;
  out += `import 'theme.dart';\n`;
  for (const col of collections) {
    out += `import '${collectionDir(col)}/${col.fileBaseName}.dart';\n`;
  }
  if (hasComposites.paintStyles) out += `import 'composites/color_styles.dart';\n`;
  if (hasComposites.effectStyles) out += `import 'composites/shadows.dart';\n`;
  if (hasComposites.textStyles) out += `import 'composites/text_styles.dart';\n`;
  out += `\n`;

  out += `extension AppThemeContext on BuildContext {\n`;
  for (const col of collections) {
    out += `  ${col.className} get ${col.accessor} => AppTheme.of(this).${col.accessor};\n`;
  }
  if (collections.length > 0 &&
      (hasComposites.textStyles || hasComposites.effectStyles || hasComposites.paintStyles))
    out += `\n`;
  if (hasComposites.textStyles)
    out += `  DSStyles get textStyles => AppTheme.of(this).textStyles;\n`;
  if (hasComposites.effectStyles)
    out += `  DSShadows get shadows => AppTheme.of(this).shadows;\n`;
  if (hasComposites.paintStyles)
    out += `  DSColorStyles get colorStyle => AppTheme.of(this).colorStyle;\n`;
  out += `}\n`;
  return out;
}
