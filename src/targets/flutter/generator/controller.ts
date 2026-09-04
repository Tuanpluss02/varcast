import { FILE_HEADER } from './emit_helpers';
import type { PreparedCollection } from './prepare';

// Emit the singleton DesignSystemController. One block per collection wires
// up: current/prev value, animation controller, mode setter, getter.

export function emitController(
  collections: PreparedCollection[],
): string {
  let out = FILE_HEADER;
  out += `import 'package:flutter/animation.dart';\n`;
  out += `import 'package:flutter/foundation.dart';\n\n`;
  for (const col of collections) {
    // Controller is at lib/src/_internal/, collections are at lib/src/collections/<col>/
    out += `import '../collections/${col.fileBaseName}/${col.fileBaseName}.dart';\n`;
  }
  out += `\n`;

  out += `class DesignSystemController extends ChangeNotifier {\n`;
  out += `  DesignSystemController._();\n`;
  out += `  static final DesignSystemController instance = DesignSystemController._();\n\n`;

  for (const col of collections) {
    out += controllerBlock(col);
  }

  out += `  Duration defaultDuration = Duration.zero;\n\n`;

  out += `  void setAnimationDuration(Duration d) => defaultDuration = d;\n\n`;

  out += `  bool _vsyncAttached = false;\n\n`;

  out += `  void attachVsync(TickerProvider vsync) {\n`;
  out += `    if (_vsyncAttached) _detachControllers();\n`;
  out += `    _vsyncAttached = true;\n`;
  out += `    AnimationController make() => AnimationController(vsync: vsync)\n`;
  out += `      ..addListener(notifyListeners);\n`;
  for (const col of collections) {
    out += `    _${col.accessor}Anim = make();\n`;
  }
  out += `  }\n\n`;

  out += `  void detachVsync() {\n`;
  out += `    _detachControllers();\n`;
  out += `    _vsyncAttached = false;\n`;
  out += `  }\n\n`;

  out += `  void _detachControllers() {\n`;
  for (const col of collections) {
    out += `    _${col.accessor}Anim?.removeListener(notifyListeners);\n`;
    out += `    _${col.accessor}Anim?.dispose();\n`;
    out += `    _${col.accessor}Anim = null;\n`;
  }
  out += `  }\n\n`;

  out += `  void _trigger(AnimationController? anim, Duration duration) {\n`;
  out += `    if (anim == null || duration == Duration.zero) {\n`;
  out += `      anim?.stop();\n`;
  out += `      notifyListeners();\n`;
  out += `      return;\n`;
  out += `    }\n`;
  out += `    anim.duration = duration;\n`;
  out += `    anim.forward(from: 0);\n`;
  out += `  }\n\n`;

  out += `  /// Test-only: resets the singleton controller to defaults.\n`;
  out += `  void resetForTest() {\n`;
  out += `    _detachControllers();\n`;
  out += `    _vsyncAttached = false;\n`;
  out += `    defaultDuration = Duration.zero;\n`;
  for (const col of collections) {
    const def = defaultConcrete(col);
    out += `    _${col.accessor} = ${def}();\n`;
    out += `    _${col.accessor}Prev = ${def}();\n`;
    out += `    current${col.className}Mode = ${col.className}Mode.${col.modes[col.defaultModeIndex].camel};\n`;
  }
  out += `  }\n`;
  out += `}\n`;
  return out;
}

function controllerBlock(
  col: PreparedCollection,
): string {
  const accessor = col.accessor;
  const cls = col.className;
  const def = defaultConcrete(col);
  const modes = col.modes;
  const defaultMode = modes[col.defaultModeIndex];

  let out = '';
  out += `  // ${cls}\n`;
  out += `  ${cls} _${accessor} = ${def}();\n`;
  out += `  ${cls} _${accessor}Prev = ${def}();\n`;
  out += `  AnimationController? _${accessor}Anim;\n`;
  out += `  ${cls}Mode current${cls}Mode = ${cls}Mode.${defaultMode.camel};\n\n`;

  out += `  ${cls} get ${accessor} {\n`;
  out += `    final a = _${accessor}Anim;\n`;
  out += `    if (a != null && a.isAnimating) return ${cls}.lerp(_${accessor}Prev, _${accessor}, a.value);\n`;
  out += `    return _${accessor};\n`;
  out += `  }\n\n`;

  out += `  void set${cls}Mode(${cls}Mode mode, {Duration? duration}) {\n`;
  out += `    if (mode == current${cls}Mode) return;\n`;
  out += `    current${cls}Mode = mode;\n`;
  out += `    _${accessor}Prev = ${accessor};\n`;
  out += `    _${accessor} = switch (mode) {\n`;
  for (const m of modes) {
    const modeClassName = `${cls}${modeClassSuffix(m.pascal)}Mode`;
    out += `      ${cls}Mode.${m.camel} => ${modeClassName}(),\n`;
  }
  out += `    };\n`;
  out += `    _trigger(_${accessor}Anim, duration ?? defaultDuration);\n`;
  out += `  }\n\n`;

  return out;
}

/**
 * Gets the mode class name suffix from the PascalCase mode name.
 * E.g., "Light" -> "Light", "DarkMode" -> "Dark", "XS" -> "XS"
 * This avoids naming collisions like "_FooModeMode".
 */
export function modeClassSuffix(modePascal: string): string {
  if (modePascal.endsWith('Mode')) {
    return modePascal.slice(0, -4);
  }
  return modePascal;
}

function defaultConcrete(col: PreparedCollection): string {
  const cls = col.className;
  const modePascal = col.modes[col.defaultModeIndex].pascal;
  return `${cls}${modeClassSuffix(modePascal)}Mode`;
}
