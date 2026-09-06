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
 * Merge user-supplied options with default React Native options.
 */
export function mergeRnOptions(options?: PartialReactNativeOptions | unknown): ReactNativeOptions {
  const partial = (options ?? {}) as PartialReactNativeOptions;
  const includeIn = partial.include ?? {};
  const compositesIn = includeIn.composites ?? {};
  return {
    packageName: partial.packageName ?? DEFAULT_RN_OPTIONS.packageName,
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


