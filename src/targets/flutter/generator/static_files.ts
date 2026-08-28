// Static (non-IR-dependent) files emitted into the package: lerp extensions,
// the wrapper widget, pubspec, and the README scaffold.

import { FILE_HEADER } from './emit_helpers';

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

export function wrapperDartFile(): string {
  return (
    FILE_HEADER +
    `import 'package:flutter/widgets.dart';
import '_internal/controller.dart';

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
    return ListenableBuilder(
      listenable: DesignSystemController.instance,
      builder: (context, _) => widget.builder(context),
    );
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

export function readmeMd(packageName = 'design_system'): string {
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

## Read tokens

Access tokens anywhere via \`AppTheme\`.

\`\`\`dart
final bg = AppTheme.colorToken.backgroundPrimary;
final r  = AppTheme.numberBasic.spacingN16;
\`\`\`

## Switch modes at runtime

\`\`\`dart
AppTheme.setColorTokenMode(ColorTokenMode.darkMode);
\`\`\`

## Rebuild on mode changes

Tokens are read via \`AppTheme.*\`. \`DesignSystemWrapper\` provides the rebuild bridge via its \`builder\` callback whenever modes transition.

## What you can change

These are controlled by export options in Varcast:
- \`packageName\`: pub package name.
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
    expect(AppTheme, isNotNull);
    expect(DesignSystemWrapper, isNotNull);
  });
}
`;
}
