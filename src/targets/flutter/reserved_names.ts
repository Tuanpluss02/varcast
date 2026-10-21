/**
 * Reserved Flutter/Dart SDK symbols to prevent collisions in generated files.
 * Shadowing these would break imports in the consumer codebase.
 */
export const DISALLOWED_COLLECTION_CLASS_NAMES: ReadonlySet<string> = new Set([
  'FontWeight',
  'Color',
  'TextStyle',
  'BoxShadow',
  'Gradient',
  'LinearGradient',
  'RadialGradient',
  'SweepGradient',
  'ImageFilter',
  'AnimationController',
  'ChangeNotifier',
  'ThemeData',
  'AppTheme',
  'DesignSystemController',
  'DSColorStyles',
  'DSShadows',
  'DSStyles',
  'DSTextStyle',
  'DSShadow',
]);
