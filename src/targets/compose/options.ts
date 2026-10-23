/**
 * Configuration options for Jetpack Compose token and style code generation.
 */
export interface ComposeOptions {
  packageName: string;
  include: {
    primitives: boolean;
    tokens: boolean;
    composites: {
      colorStyles: boolean;
      shadows: boolean;
      textStyles: boolean;
    };
    collections?: string[];
  };
}

export type PartialComposeOptions = {
  packageName?: string;
  include?: {
    primitives?: boolean;
    tokens?: boolean;
    composites?: {
      colorStyles?: boolean;
      shadows?: boolean;
      textStyles?: boolean;
    };
    collections?: string[];
  };
};

export const DEFAULT_COMPOSE_OPTIONS: ComposeOptions = {
  packageName: 'com.example.designsystem',
  include: {
    primitives: true,
    tokens: true,
    composites: {
      colorStyles: true,
      shadows: true,
      textStyles: true,
    },
  },
};

/**
 * Sanitizes a raw string into a valid Kotlin package name convention.
 * Lowercases input, replaces invalid characters ([^a-z0-9_.]) with '_',
 * collapses consecutive dots, and trims leading/trailing dots and underscores.
 * Falls back to 'com.example.designsystem' if empty.
 */
export function sanitizePackageName(raw?: string | null): string {
  if (!raw || typeof raw !== 'string') {
    return DEFAULT_COMPOSE_OPTIONS.packageName;
  }
  const sanitized = raw
    .toLowerCase()
    .replace(/[^a-z0-9_.]+/g, '_')
    .replace(/\.+/g, '.')
    .replace(/^[_.]+|[_.]+$/g, '');

  return sanitized || DEFAULT_COMPOSE_OPTIONS.packageName;
}

/**
 * Normalizes user-supplied options, applying defaults for missing fields.
 */
export function normalizeComposeOptions(input?: unknown): ComposeOptions {
  if (!input || typeof input !== 'object') {
    return {
      packageName: DEFAULT_COMPOSE_OPTIONS.packageName,
      include: {
        primitives: DEFAULT_COMPOSE_OPTIONS.include.primitives,
        tokens: DEFAULT_COMPOSE_OPTIONS.include.tokens,
        composites: {
          colorStyles: DEFAULT_COMPOSE_OPTIONS.include.composites.colorStyles,
          shadows: DEFAULT_COMPOSE_OPTIONS.include.composites.shadows,
          textStyles: DEFAULT_COMPOSE_OPTIONS.include.composites.textStyles,
        },
      },
    };
  }

  const partial = input as PartialComposeOptions;
  const includeIn = partial.include ?? {};
  const compositesIn = includeIn.composites ?? {};
  const rawPkg = partial.packageName;
  const packageName = rawPkg ? sanitizePackageName(rawPkg) : DEFAULT_COMPOSE_OPTIONS.packageName;

  const collections = Array.isArray(includeIn.collections)
    ? includeIn.collections.filter((c): c is string => typeof c === 'string')
    : undefined;

  return {
    packageName,
    include: {
      primitives:
        typeof includeIn.primitives === 'boolean'
          ? includeIn.primitives
          : DEFAULT_COMPOSE_OPTIONS.include.primitives,
      tokens:
        typeof includeIn.tokens === 'boolean'
          ? includeIn.tokens
          : DEFAULT_COMPOSE_OPTIONS.include.tokens,
      composites: {
        colorStyles:
          typeof compositesIn.colorStyles === 'boolean'
            ? compositesIn.colorStyles
            : DEFAULT_COMPOSE_OPTIONS.include.composites.colorStyles,
        shadows:
          typeof compositesIn.shadows === 'boolean'
            ? compositesIn.shadows
            : DEFAULT_COMPOSE_OPTIONS.include.composites.shadows,
        textStyles:
          typeof compositesIn.textStyles === 'boolean'
            ? compositesIn.textStyles
            : DEFAULT_COMPOSE_OPTIONS.include.composites.textStyles,
      },
      collections,
    },
  };
}

export const mergeComposeOptions = normalizeComposeOptions;

/**
 * Validates compose options input. Returns a list of error strings or null if valid.
 */
export function validateComposeOptions(input?: unknown): string[] | null {
  if (input === undefined || input === null) return null;
  if (typeof input !== 'object') return ['Compose options must be an object'];
  return null;
}
