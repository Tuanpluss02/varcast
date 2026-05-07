import { FILE_HEADER } from './emit_helpers';
import type { PreparedCollection } from './prepare';

// Emit the singleton DesignSystemController. One block per collection wires
// up: current/prev value, animation controller, mode setter, getter.

export function emitController(collections: PreparedCollection[]): string {
  let out = FILE_HEADER;
  out += `import 'package:flutter/animation.dart';\n`;
  out += `import 'package:flutter/foundation.dart';\n\n`;
  for (const col of collections) {
    out += `import '../${collectionDir(col)}/${col.fileBaseName}.dart';\n`;
  }
  out += `\n`;

  out += `class DesignSystemController extends ChangeNotifier {\n`;
  out += `  DesignSystemController._();\n`;
  out += `  static final DesignSystemController instance = DesignSystemController._();\n\n`;

  for (const col of collections) {
    out += controllerBlock(col);
  }

  out += `  Duration _animDuration = const Duration(milliseconds: 300);\n`;
  out += `  Duration get animDuration => _animDuration;\n\n`;
  out += `  void setAnimationDuration(Duration d) {\n`;
  out += `    _animDuration = d;\n`;
  out += `    for (final c in _allAnims) c.duration = d;\n`;
  out += `  }\n\n`;

  out += `  List<AnimationController> get _allAnims => [\n`;
  for (const col of collections) {
    out += `    if (_${col.accessor}Anim != null) _${col.accessor}Anim!,\n`;
  }
  out += `  ];\n\n`;

  out += `  bool _vsyncAttached = false;\n\n`;

  out += `  void attachVsync(TickerProvider vsync) {\n`;
  out += `    if (_vsyncAttached) _detachControllers();\n`;
  out += `    _vsyncAttached = true;\n`;
  out += `    AnimationController make() => AnimationController(vsync: vsync, duration: _animDuration)\n`;
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

  out += `  void _trigger(AnimationController? anim) {\n`;
  out += `    if (anim == null || _animDuration == Duration.zero) {\n`;
  out += `      notifyListeners();\n`;
  out += `      return;\n`;
  out += `    }\n`;
  out += `    anim.forward(from: 0);\n`;
  out += `  }\n\n`;

  out += `  /// Test-only: resets the singleton controller to defaults.\n`;
  out += `  void resetForTest() {\n`;
  out += `    _detachControllers();\n`;
  out += `    _vsyncAttached = false;\n`;
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

function controllerBlock(col: PreparedCollection): string {
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

  out += `  void set${cls}Mode(${cls}Mode mode) {\n`;
  out += `    if (mode == current${cls}Mode) return;\n`;
  out += `    current${cls}Mode = mode;\n`;
  out += `    _${accessor}Prev = ${accessor};\n`;
  out += `    _${accessor} = switch (mode) {\n`;
  for (const m of modes) {
    out += `      ${cls}Mode.${m.camel} => ${concreteClassName(cls, m.pascal)}(),\n`;
  }
  out += `    };\n`;
  out += `    _trigger(_${accessor}Anim);\n`;
  out += `  }\n\n`;

  return out;
}

function defaultConcrete(col: PreparedCollection): string {
  return concreteClassName(col.className, col.modes[col.defaultModeIndex].pascal);
}

function concreteClassName(collectionClassName: string, modePascal: string): string {
  const candidate = `${collectionClassName}${modePascal}`;
  if (candidate === `${collectionClassName}Mode`) return `${candidate}Value`;
  return candidate;
}

function collectionDir(col: PreparedCollection): 'primitives' | 'tokens' {
  for (const v of col.variables) {
    for (const val of Object.values(v.valuesByMode)) {
      if (val.kind === 'alias') return 'tokens';
    }
  }
  return 'primitives';
}

export { collectionDir };

