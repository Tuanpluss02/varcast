// React Native target options. The user picks one flavor per export
// (decision #2 in the rewrite plan).

export type ReactNativeFlavor = 'nativewind' | 'unistyles';

export interface ReactNativeOptions {
  flavor: ReactNativeFlavor;
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

export const DEFAULT_RN_OPTIONS: ReactNativeOptions = {
  flavor: 'nativewind',
  packageName: 'design-system',
  include: {
    primitives: true,
    tokens: true,
    composites: { colorStyles: true, shadows: true, textStyles: true },
  },
};

type RnIncludePartial = {
  primitives?: boolean;
  tokens?: boolean;
  composites?: {
    colorStyles?: boolean;
    shadows?: boolean;
    textStyles?: boolean;
  };
};

type RnOptionsPartial = {
  flavor?: string;
  packageName?: string;
  include?: RnIncludePartial;
};

/**
 * Merge user-supplied options with defaults so partial inputs (e.g. an older
 * UI version that doesn't pass `flavor`) still produce a fully-formed object.
 * Unknown flavor strings fall back to the default flavor.
 */
export function mergeRnOptions(input: unknown): ReactNativeOptions {
  const partial: RnOptionsPartial = (input ?? {}) as RnOptionsPartial;
  const includeIn: RnIncludePartial = partial.include ?? {};
  const compositesIn = includeIn.composites ?? {};
  const flavor = isFlavor(partial.flavor) ? partial.flavor : DEFAULT_RN_OPTIONS.flavor;
  return {
    flavor,
    packageName: partial.packageName?.trim() || DEFAULT_RN_OPTIONS.packageName,
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

function isFlavor(s: unknown): s is ReactNativeFlavor {
  return s === 'nativewind' || s === 'unistyles';
}
