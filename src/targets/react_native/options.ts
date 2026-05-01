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

export const DEFAULT_RN_OPTIONS: ReactNativeOptions = {
  packageName: 'design-system',
  include: {
    primitives: true,
    tokens: true,
    composites: { colorStyles: true, shadows: true, textStyles: true },
  },
};

