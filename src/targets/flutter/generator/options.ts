export interface ExportOptions {
  packageName: string;

  include: {
    primitives: boolean;
    tokens: boolean;
    composites: {
      colorStyles: boolean;
      shadows: boolean;
      textStyles: boolean;
    };
    smokeTest: boolean;
  };

  naming: {
    leafPrefix: string; // e.g. "ds"
    leafSuffix: string; // e.g. "Token"
  };
}

export const DEFAULT_EXPORT_OPTIONS: ExportOptions = {
  packageName: 'design_system',
  include: {
    primitives: true,
    tokens: true,
    composites: { colorStyles: true, shadows: true, textStyles: true },
    smokeTest: true,
  },
  naming: {
    leafPrefix: '',
    leafSuffix: '',
  },
};

export function normalizeExportOptions(input: any): ExportOptions {
  const o: ExportOptions = JSON.parse(JSON.stringify(DEFAULT_EXPORT_OPTIONS));
  if (input && typeof input === 'object') {
    if (typeof input.packageName === 'string' && input.packageName.trim())
      o.packageName = sanitizePackageName(input.packageName.trim());
    if (input.include?.primitives === false) o.include.primitives = false;
    if (input.include?.tokens === false) o.include.tokens = false;
    if (input.include?.smokeTest === false) o.include.smokeTest = false;
    if (input.include?.composites?.colorStyles === false)
      o.include.composites.colorStyles = false;
    if (input.include?.composites?.shadows === false)
      o.include.composites.shadows = false;
    if (input.include?.composites?.textStyles === false)
      o.include.composites.textStyles = false;

    if (typeof input.naming?.leafPrefix === 'string')
      o.naming.leafPrefix = sanitizeCamelAffix(input.naming.leafPrefix);
    if (typeof input.naming?.leafSuffix === 'string')
      o.naming.leafSuffix = sanitizePascalAffix(input.naming.leafSuffix);
  }
  return o;
}

export function applyLeafAffixes(
  leaf: string,
  prefix: string,
  suffix: string,
): string {
  let out = leaf;
  if (prefix) out = prefix + capitalize(out);
  if (suffix) out = out + capitalize(suffix);
  return out;
}

function capitalize(s: string): string {
  if (!s) return s;
  return s[0].toUpperCase() + s.slice(1);
}

function sanitizeCamelAffix(s: string): string {
  const cleaned = s.replace(/[^a-zA-Z0-9]+/g, ' ').trim();
  if (!cleaned) return '';
  const parts = cleaned.split(/\s+/).filter(Boolean);
  const camel = parts[0].toLowerCase() + parts.slice(1).map(capitalize).join('');
  return camel;
}

function sanitizePascalAffix(s: string): string {
  const cleaned = s.replace(/[^a-zA-Z0-9]+/g, ' ').trim();
  if (!cleaned) return '';
  return cleaned
    .split(/\s+/)
    .filter(Boolean)
    .map(capitalize)
    .join('');
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

