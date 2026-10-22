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

export type PartialExportOptions = {
  packageName?: string;
  include?: {
    collections?: string[];
    primitives?: boolean;
    tokens?: boolean;
    composites?: {
      colorStyles?: boolean;
      shadows?: boolean;
      textStyles?: boolean;
    };
  };
};

export function normalizeExportOptions(input?: PartialExportOptions | unknown): ExportOptions {
  const o: ExportOptions = JSON.parse(JSON.stringify(DEFAULT_EXPORT_OPTIONS));
  if (input && typeof input === 'object') {
    const inp = input as PartialExportOptions;
    if (typeof inp.packageName === 'string' && inp.packageName.trim())
      o.packageName = sanitizePackageName(inp.packageName.trim());
    if (Array.isArray(inp.include?.collections)) {
      o.include.collections = inp.include.collections.filter(
        (x): x is string => typeof x === 'string' && x.trim().length > 0,
      );
    }
    if (inp.include?.primitives !== undefined) o.include.primitives = inp.include.primitives;
    if (inp.include?.tokens !== undefined) o.include.tokens = inp.include.tokens;
    if (inp.include?.composites?.colorStyles === false)
      o.include.composites.colorStyles = false;
    if (inp.include?.composites?.shadows === false)
      o.include.composites.shadows = false;
    if (inp.include?.composites?.textStyles === false)
      o.include.composites.textStyles = false;
  }
  return o;
}

/**
 * Sanitizes a package name into a valid Dart pub package identifier (lowercase_with_underscores).
 */
export function sanitizePackageName(name: string): string {
  return (
    name
      .toLowerCase()
      .replace(/[^a-z0-9_]+/g, '_')
      .replace(/_+/g, '_')
      .replace(/^_+|_+$/g, '') || 'design_system'
  );
}
