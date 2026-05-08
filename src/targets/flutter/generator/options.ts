export type ArchMode = 'context' | 'static';

export interface ExportOptions {
  packageName: string;

  /**
   * Architecture for token access.
   * - 'context': InheritedNotifier-based. Reads via `AppTheme.of(context)` or
   *   `context.colorBasic` register a dependency, so widgets — including those
   *   wrapped in `const` — rebuild when modes change.
   * - 'static': singleton-only. `AppTheme.colorBasic.x` works from anywhere
   *   (including non-widget code), but `const` widgets won't rebuild.
   */
  archMode: ArchMode;

  include: {
    primitives: boolean;
    tokens: boolean;
    composites: {
      colorStyles: boolean;
      shadows: boolean;
      textStyles: boolean;
    };
  };
}

export const DEFAULT_EXPORT_OPTIONS: ExportOptions = {
  packageName: 'design_system',
  archMode: 'context',
  include: {
    primitives: true,
    tokens: true,
    composites: { colorStyles: true, shadows: true, textStyles: true },
  },
};

export function normalizeExportOptions(input: any): ExportOptions {
  const o: ExportOptions = JSON.parse(JSON.stringify(DEFAULT_EXPORT_OPTIONS));
  if (input && typeof input === 'object') {
    if (typeof input.packageName === 'string' && input.packageName.trim())
      o.packageName = sanitizePackageName(input.packageName.trim());
    if (input.archMode === 'static' || input.archMode === 'context')
      o.archMode = input.archMode;
    if (input.include?.primitives === false) o.include.primitives = false;
    if (input.include?.tokens === false) o.include.tokens = false;
    if (input.include?.composites?.colorStyles === false)
      o.include.composites.colorStyles = false;
    if (input.include?.composites?.shadows === false)
      o.include.composites.shadows = false;
    if (input.include?.composites?.textStyles === false)
      o.include.composites.textStyles = false;
  }
  return o;
}

function sanitizePackageName(name: string): string {
  // Dart pub package naming: lowercase_with_underscores
  return (
    name
      .toLowerCase()
      .replace(/[^a-z0-9_]+/g, '_')
      .replace(/_+/g, '_')
      .replace(/^_+|_+$/g, '') || 'design_system'
  );
}

