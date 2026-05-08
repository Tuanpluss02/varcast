// Static (non-IR-dependent) files emitted into the package: lerp extensions,
// the wrapper widget, pubspec, and the README scaffold.

import { FILE_HEADER } from './emit_helpers';
import type { ArchMode } from './options';

export function lerpDartFile(): string {
  return (
    FILE_HEADER +
    `import 'dart:ui' show Color, lerpDouble, ImageFilter;

extension LerpDouble on double {
  double lerpTo(double b, double t) => lerpDouble(this, b, t) ?? this;
}

extension LerpColor on Color {
  Color lerpTo(Color b, double t) => Color.lerp(this, b, t) ?? this;
}

extension LerpString on String {
  String lerpTo(String b, double t) => t < 0.5 ? this : b;
}

extension LerpBool on bool {
  bool lerpTo(bool b, double t) => t < 0.5 ? this : b;
}

extension LerpImageFilter on ImageFilter {
  ImageFilter lerpTo(ImageFilter b, double t) => t < 0.5 ? this : b;
}
`
  );
}

export function wrapperDartFile(archMode: ArchMode = 'static'): string {
  const extraImport =
    archMode === 'context' ? `import '_internal/scope.dart';\n` : '';
  const buildBody =
    archMode === 'context'
      ? `    return DesignSystemScope(
      controller: DesignSystemController.instance,
      child: Builder(builder: widget.builder),
    );`
      : `    return ListenableBuilder(
      listenable: DesignSystemController.instance,
      builder: (context, _) => widget.builder(context),
    );`;

  return (
    FILE_HEADER +
    `import 'package:flutter/widgets.dart';
import '_internal/controller.dart';
${extraImport}
/// Place once near the root of your widget tree, above [MaterialApp].
///
/// This widget attaches vsync for animated mode transitions and sets the
/// animation duration. It does NOT force a subtree reset.
class DesignSystemWrapper extends StatefulWidget {
  const DesignSystemWrapper({
    super.key,
    required this.builder,
    this.duration = Duration.zero,
  });

  /// A builder callback that is re-evaluated when modes change.
  final WidgetBuilder builder;
  final Duration duration;

  @override
  State<DesignSystemWrapper> createState() => _DesignSystemWrapperState();
}

class _DesignSystemWrapperState extends State<DesignSystemWrapper>
    with TickerProviderStateMixin {
  @override
  void initState() {
    super.initState();
    DesignSystemController.instance
      ..setAnimationDuration(widget.duration)
      ..attachVsync(this);
  }

  @override
  void didUpdateWidget(covariant DesignSystemWrapper old) {
    super.didUpdateWidget(old);
    if (old.duration != widget.duration) {
      DesignSystemController.instance.setAnimationDuration(widget.duration);
    }
  }

  @override
  void dispose() {
    DesignSystemController.instance.detachVsync();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
${buildBody}
  }
}
`
  );
}

export function publicApiDartFile(): string {
  return (
    FILE_HEADER +
    `import '_internal/controller.dart';

/// Public helpers for tests and tooling.
class DesignSystem {
  DesignSystem._();

  /// Test-only: resets the singleton controller to defaults.
  static void resetForTest() {
    DesignSystemController.instance.resetForTest();
  }
}
`
  );
}

export function pubspecYaml(packageName = 'design_system'): string {
  return `name: ${packageName}
description: >
  Generated Flutter design system package.
  Produced by Varcast. Do not edit by hand.
version: 0.1.0
publish_to: "none"

environment:
  sdk: ">=3.0.0 <4.0.0"

dependencies:
  flutter:
    sdk: flutter

dev_dependencies:
  flutter_lints: ^4.0.0
  flutter_test:
    sdk: flutter

flutter:
  uses-material-design: true
`;
}

export function readmeMd(
  packageName = 'design_system',
  archMode: ArchMode = 'static',
): string {
  if (archMode === 'context') {
    return `# ${packageName}

Generated Flutter design system. Do not edit by hand.

## Usage

\`\`\`dart
import 'package:${packageName}/${packageName}.dart';

void main() {
  runApp(DesignSystemWrapper(builder: (_) => MyApp()));
}

// Inside a widget — read via context. Reads register a dependency on the
// design system scope, so const widgets rebuild correctly on mode changes.
@override
Widget build(BuildContext context) {
  final theme = AppTheme.of(context);
  return Container(color: theme.colorToken.background.primary);
}

// Or use the BuildContext extension for shorter access.
@override
Widget build(BuildContext context) {
  return Container(color: context.colorToken.background.primary);
}

// Switch mode at runtime (imperative — no context needed).
AppTheme.setColorTokenMode(ColorTokenMode.lightMode);
\`\`\`

## Why context-based?

In Flutter, widgets wrapped in \`const\` are canonical and don't rebuild even
when an ancestor \`ListenableBuilder\` emits. Reading tokens via
\`AppTheme.of(context)\` (or the \`context.x\` extension) registers an
\`InheritedNotifier\` dependency, so \`const\` widgets are correctly invalidated
when modes change.
`;
  }

  return `# ${packageName}

Generated Flutter design system. Do not edit by hand.

## Usage

\`\`\`dart
import 'package:${packageName}/${packageName}.dart';

void main() {
  runApp(DesignSystemWrapper(builder: (_) => MyApp()));
}

// Read tokens from anywhere — no BuildContext needed.
final bg = AppTheme.colorToken.background.primary;
final r  = AppTheme.numberBasic.spacing.n16;

// Switch mode at runtime.
AppTheme.setColorTokenMode(ColorTokenMode.lightMode);
\`\`\`

## Rebuild on mode changes

Tokens are context-less (\`AppTheme.*\`). Flutter only updates the UI when widgets
rebuild, and \`DesignSystemWrapper\` provides the official rebuild bridge via its
\`builder\` callback.

> ⚠️ Widgets wrapped in \`const\` won't rebuild on mode changes in this mode.
> Switch to context mode in the export options if you need that.
`;
}

export function smokeTestDartFile(packageName = 'design_system'): string {
  return `import 'package:flutter_test/flutter_test.dart';
import 'package:${packageName}/${packageName}.dart';

void main() {
  test('design system package loads', () {
    // Access something to ensure generated symbols exist.
    expect(AppTheme, isNotNull);
  });
}
`;
}

