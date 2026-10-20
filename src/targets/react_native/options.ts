export interface ReactNativeOptions {
  packageName: string;
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

export type PartialReactNativeOptions = {
  packageName?: string;
  include?: {
    primitives?: boolean;
    tokens?: boolean;
    composites?: {
      colorStyles?: boolean;
      shadows?: boolean;
      textStyles?: boolean;
    };
  };
};

export const DEFAULT_RN_OPTIONS: ReactNativeOptions = {
  packageName: 'design-system',
  include: {
    primitives: true,
    tokens: true,
    composites: { colorStyles: true, shadows: true, textStyles: true },
  },
};

/**
 * Sanitizes a string into a valid npm package name convention.
 */
export function sanitizePackageName(raw: string): string {
  return (
    raw
      .toLowerCase()
      .replace(/[^a-z0-9@/._-]+/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-+|-+$/g, '') || 'design-system'
  );
}

/**
 * Merge user-supplied options with default React Native options.
 */
export function mergeRnOptions(options?: PartialReactNativeOptions | unknown): ReactNativeOptions {
  const partial = (options ?? {}) as PartialReactNativeOptions;
  const includeIn = partial.include ?? {};
  const compositesIn = includeIn.composites ?? {};
  const rawPkg = partial.packageName;
  const packageName = rawPkg ? sanitizePackageName(rawPkg) : DEFAULT_RN_OPTIONS.packageName;
  return {
    packageName,
    include: {
      primitives: includeIn.primitives ?? DEFAULT_RN_OPTIONS.include.primitives,
      tokens: includeIn.tokens ?? DEFAULT_RN_OPTIONS.include.tokens,
      composites: {
        colorStyles:
          compositesIn.colorStyles ?? DEFAULT_RN_OPTIONS.include.composites.colorStyles,
        shadows: compositesIn.shadows ?? DEFAULT_RN_OPTIONS.include.composites.shadows,
        textStyles:
          compositesIn.textStyles ?? DEFAULT_RN_OPTIONS.include.composites.textStyles,
      },
    },
  };
}


