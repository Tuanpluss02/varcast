import { FILE_HEADER } from './emit_helpers';

// Emit `lib/src/_internal/scope.dart` — the InheritedNotifier that exposes the
// DesignSystemController to the widget subtree. Internal: not re-exported from
// the package barrel. Used by the generated wrapper, AppTheme.of(context), and
// the BuildContext extension.

export function emitScope(): string {
  let out = FILE_HEADER;
  out += `import 'package:flutter/widgets.dart';\n`;
  out += `import 'controller.dart';\n\n`;

  out += `class DesignSystemScope extends InheritedNotifier<DesignSystemController> {\n`;
  out += `  const DesignSystemScope({\n`;
  out += `    super.key,\n`;
  out += `    required DesignSystemController controller,\n`;
  out += `    required super.child,\n`;
  out += `  }) : super(notifier: controller);\n\n`;

  out += `  static DesignSystemController of(BuildContext context) {\n`;
  out += `    final scope =\n`;
  out += `        context.dependOnInheritedWidgetOfExactType<DesignSystemScope>();\n`;
  out += `    assert(\n`;
  out += `      scope != null,\n`;
  out += `      'No DesignSystemScope found above context. '\n`;
  out += `      'Wrap your app with DesignSystemWrapper.',\n`;
  out += `    );\n`;
  out += `    return scope!.notifier!;\n`;
  out += `  }\n`;
  out += `}\n`;
  return out;
}
