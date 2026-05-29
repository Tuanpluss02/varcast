import { FILE_HEADER, internalPackageLine, packageLine } from './emit_helpers';
import { collectionDir, concreteClassName } from './collection';
import type { PreparedAndroidCollection } from '../shared/prepare';

export function emitController(
  namespace: string,
  collections: PreparedAndroidCollection[],
): string {
  let out = FILE_HEADER;
  out += internalPackageLine(namespace);
  out += `import androidx.compose.runtime.getValue\n`;
  out += `import androidx.compose.runtime.mutableStateOf\n`;
  out += `import androidx.compose.runtime.setValue\n`;
  for (const col of collections) {
    out += `import ${namespace}.${collectionDir(col)}.${col.className}\n`;
    out += `import ${namespace}.${collectionDir(col)}.${col.className}Mode\n`;
    for (const mode of col.modes) {
      out += `import ${namespace}.${collectionDir(col)}.${concreteClassName(col.className, mode.enumEntry)}\n`;
    }
  }
  out += `\n`;

  out += `class DesignSystemController internal constructor() {\n`;
  out += `    companion object {\n`;
  out += `        val instance: DesignSystemController = DesignSystemController()\n`;
  out += `    }\n\n`;

  for (const col of collections) {
    out += controllerBlock(col);
  }

  out += `    fun resetForTest() {\n`;
  for (const col of collections) {
    const defaultMode = col.modes[col.defaultModeIndex];
    const concrete = concreteClassName(col.className, defaultMode.enumEntry);
    out += `        current${col.className}Mode = ${col.className}Mode.${defaultMode.enumEntry}\n`;
    out += `        ${col.accessor} = ${concrete}(${collectionUsesAlias(col) ? 'this' : ''})\n`;
  }
  out += `    }\n`;
  out += `}\n`;
  return out;
}

export function emitScope(namespace: string): string {
  return (
    FILE_HEADER +
    internalPackageLine(namespace) +
    `import androidx.compose.runtime.staticCompositionLocalOf\n\n` +
    `internal val LocalDesignSystemController = staticCompositionLocalOf {\n` +
    `    DesignSystemController.instance\n` +
    `}\n`
  );
}

export function emitTheme(
  namespace: string,
  collections: PreparedAndroidCollection[],
  hasComposites: { paintStyles: boolean; effectStyles: boolean; textStyles: boolean },
): string {
  let out = FILE_HEADER;
  out += packageLine(namespace);
  out += `import androidx.compose.runtime.Composable\n`;
  if (hasComposites.paintStyles) out += `import ${namespace}.composites.DSColorStyles\n`;
  if (hasComposites.effectStyles) out += `import ${namespace}.composites.DSShadows\n`;
  if (hasComposites.textStyles) out += `import ${namespace}.composites.DSStyles\n`;
  out += `import ${namespace}.internal.DesignSystemController\n`;
  out += `import ${namespace}.internal.LocalDesignSystemController\n`;
  for (const col of collections) {
    out += `import ${namespace}.${collectionDir(col)}.${col.className}\n`;
    out += `import ${namespace}.${collectionDir(col)}.${col.className}Mode\n`;
  }
  out += `\n`;

  out += `class AppThemeData internal constructor(\n`;
  out += `    private val c: DesignSystemController,\n`;
  out += `) {\n`;
  for (const col of collections) {
    out += `    val ${col.accessor}: ${col.className}\n`;
    out += `        get() = c.${col.accessor}\n`;
  }
  if (hasComposites.textStyles) {
    out += `    val textStyles: DSStyles\n`;
    out += `        get() = DSStyles(c)\n`;
  }
  if (hasComposites.effectStyles) {
    out += `    val shadows: DSShadows\n`;
    out += `        get() = DSShadows(c)\n`;
  }
  if (hasComposites.paintStyles) {
    out += `    val colorStyle: DSColorStyles\n`;
    out += `        get() = DSColorStyles(c)\n`;
  }
  out += `}\n\n`;

  out += `object AppTheme {\n`;
  out += `    val current: AppThemeData\n`;
  out += `        @Composable get() = AppThemeData(LocalDesignSystemController.current)\n\n`;
  for (const col of collections) {
    out += `    fun set${col.className}Mode(mode: ${col.className}Mode) {\n`;
    out += `        DesignSystemController.instance.set${col.className}Mode(mode)\n`;
    out += `    }\n\n`;
  }
  for (const col of collections) {
    out += `    val current${col.className}Mode: ${col.className}Mode\n`;
    out += `        get() = DesignSystemController.instance.current${col.className}Mode\n\n`;
  }
  out += `}\n`;
  return out;
}

function controllerBlock(col: PreparedAndroidCollection): string {
  const defaultMode = col.modes[col.defaultModeIndex];
  const defaultConcrete = concreteClassName(col.className, defaultMode.enumEntry);
  let out = '';
  out += `    var ${col.accessor}: ${col.className} by mutableStateOf(${defaultConcrete}(${collectionUsesAlias(col) ? 'this' : ''}))\n`;
  out += `        private set\n`;
  out += `    var current${col.className}Mode: ${col.className}Mode by mutableStateOf(${col.className}Mode.${defaultMode.enumEntry})\n`;
  out += `        private set\n\n`;
  out += `    fun set${col.className}Mode(mode: ${col.className}Mode) {\n`;
  out += `        if (mode == current${col.className}Mode) return\n`;
  out += `        current${col.className}Mode = mode\n`;
  out += `        ${col.accessor} = when (mode) {\n`;
  for (const mode of col.modes) {
    out += `            ${col.className}Mode.${mode.enumEntry} -> ${concreteClassName(col.className, mode.enumEntry)}(${collectionUsesAlias(col) ? 'this' : ''})\n`;
  }
  out += `        }\n`;
  out += `    }\n\n`;
  return out;
}

function collectionUsesAlias(col: PreparedAndroidCollection): boolean {
  return col.variables.some((v) =>
    Object.values(v.valuesByMode).some((val) => val.kind === 'alias'),
  );
}
