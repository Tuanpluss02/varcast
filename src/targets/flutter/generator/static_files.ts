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

Generated Flutter design system package. Do not edit by hand.

## Install

Recommended: commit this generated package into your repo and add a path dependency.

\`\`\`yaml
dependencies:
  ${packageName}:
    path: ../packages/${packageName}
\`\`\`

Then:

\`\`\`bash
flutter pub get
\`\`\`

## Import

\`\`\`dart
import 'package:${packageName}/${packageName}.dart';
\`\`\`

## Setup (put once near app root)

\`\`\`dart
void main() {
  runApp(
    DesignSystemWrapper(
      // Optional: animate mode transitions
      duration: const Duration(milliseconds: 200),
      builder: (_) => const MyApp(),
    ),
  );
}
\`\`\`

## Read tokens (context mode)

Context mode is the default because it works correctly with \`const\` widgets.
Reads register an \`InheritedNotifier\` dependency, so widgets are invalidated
when modes change.

\`\`\`dart
@override
Widget build(BuildContext context) {
  // Full access
  final theme = AppTheme.of(context);
  final bg = theme.colorToken.background.primary;

  // Shorter access via BuildContext extensions
  final fg = context.colorToken.text.primary;

  return Container(color: bg);
}
\`\`\`

## Switch modes at runtime

Each collection has an enum for its modes (e.g. \`ColorTokenMode\`).

\`\`\`dart
// Imperative — no context needed.
AppTheme.setColorTokenMode(ColorTokenMode.darkMode);
\`\`\`

## What you can change

These are controlled by export options in Varcast:
- \`packageName\`: pub package name.
- \`archMode\`: \`context\` (recommended) vs \`static\`.
- \`include.primitives\`: include primitive collections.
- \`include.tokens\`: include token collections.
- \`include.composites.{colorStyles,shadows,textStyles}\`: include each composite file.

## Why context-based?

In Flutter, widgets wrapped in \`const\` are canonical and don't rebuild even
when an ancestor \`ListenableBuilder\` emits. Reading tokens via
\`AppTheme.of(context)\` (or the \`context.x\` extensions) registers an
\`InheritedNotifier\` dependency, so \`const\` widgets are correctly invalidated
when modes change.
`;
  }

  return `# ${packageName}

Generated Flutter design system package. Do not edit by hand.

## Install

Add a path dependency (recommended):

\`\`\`yaml
dependencies:
  ${packageName}:
    path: ../packages/${packageName}
\`\`\`

Then:

\`\`\`bash
flutter pub get
\`\`\`

## Import

\`\`\`dart
import 'package:${packageName}/${packageName}.dart';
\`\`\`

## Setup (put once near app root)

\`\`\`dart
void main() {
  runApp(
    DesignSystemWrapper(
      duration: const Duration(milliseconds: 200),
      builder: (_) => const MyApp(),
    ),
  );
}
\`\`\`

## Read tokens (static mode)

Static mode exposes tokens off a singleton, so it works without a \`BuildContext\`.

\`\`\`dart
final bg = AppTheme.colorToken.background.primary;
final r  = AppTheme.numberBasic.spacing.n16;
\`\`\`

## Switch modes at runtime

\`\`\`dart
AppTheme.setColorTokenMode(ColorTokenMode.darkMode);
\`\`\`

## Rebuild on mode changes

In static mode, tokens are context-less (\`AppTheme.*\`). Flutter only updates the
UI when widgets rebuild, and \`DesignSystemWrapper\` provides the official rebuild
bridge via its \`builder\` callback.

> Widgets wrapped in \`const\` won't rebuild on mode changes in this mode.
> Use \`archMode: context\` in the export options if you need that.

## What you can change

These are controlled by export options in Varcast:
- \`packageName\`: pub package name.
- \`archMode\`: \`context\` (recommended) vs \`static\`.
- \`include.primitives\`: include primitive collections.
- \`include.tokens\`: include token collections.
- \`include.composites.{colorStyles,shadows,textStyles}\`: include each composite file.
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

