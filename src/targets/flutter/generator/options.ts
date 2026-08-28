export interface ExportOptions {
  packageName: string;

  include: {
    collections?: string[]; // Array of selected collection IDs or names (if undefined, all collections are included)
    primitives?: boolean; // legacy compat
    tokens?: boolean; // legacy compat
    composites: {
      colorStyles: boolean;
      shadows: boolean;
      textStyles: boolean;
    };
  };
}

export const DEFAULT_EXPORT_OPTIONS: ExportOptions = {
  packageName: 'design_system',
  include: {
    composites: { colorStyles: true, shadows: true, textStyles: true },
  },
};

export function normalizeExportOptions(input: any): ExportOptions {
  const o: ExportOptions = JSON.parse(JSON.stringify(DEFAULT_EXPORT_OPTIONS));
  if (input && typeof input === 'object') {
    if (typeof input.packageName === 'string' && input.packageName.trim())
      o.packageName = sanitizePackageName(input.packageName.trim());
    if (Array.isArray(input.include?.collections)) {
      o.include.collections = input.include.collections.filter(
        (x: any) => typeof x === 'string' && x.trim().length > 0,
      );
    }
    if (input.include?.primitives !== undefined) o.include.primitives = input.include.primitives;
    if (input.include?.tokens !== undefined) o.include.tokens = input.include.tokens;
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
