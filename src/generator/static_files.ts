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
class DesignSystemWrapper extends StatefulWidget {
  const DesignSystemWrapper({
    super.key,
    required this.child,
    this.duration = const Duration(milliseconds: 300),
  });

  final Widget child;
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
      builder: (_, __) => widget.child,
    );
  }
}
`
  );
}

export function pubspecYaml(packageName = 'design_system'): string {
  return `name: ${packageName}
description: >
  Generated Flutter design system package.
  Produced by the Figma → Flutter plugin. Do not edit by hand.
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

Generated Flutter design system. Do not edit by hand.

## Usage

\`\`\`dart
import 'package:${packageName}/${packageName}.dart';

void main() {
  runApp(const DesignSystemWrapper(child: MyApp()));
}

// Read tokens from anywhere — no BuildContext needed.
final bg = AppTheme.colorToken.background.primary;
final r  = AppTheme.numberBasic.spacing.n16;

// Switch mode at runtime.
AppTheme.setColorTokenMode(ColorTokenMode.lightMode);
\`\`\`
`;
}
