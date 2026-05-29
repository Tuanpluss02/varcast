import { KOTLIN_RESERVED } from './identifier';

export type AndroidFlavor = 'compose';

export interface AndroidOptions {
  flavor: AndroidFlavor;
  packageName: string;
  androidNamespace: string;
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

export const DEFAULT_ANDROID_NAMESPACE = 'com.varcast.designsystem';

export const DEFAULT_ANDROID_OPTIONS: AndroidOptions = {
  flavor: 'compose',
  packageName: 'design_system_android',
  androidNamespace: DEFAULT_ANDROID_NAMESPACE,
  include: {
    primitives: true,
    tokens: true,
    composites: { colorStyles: true, shadows: true, textStyles: true },
  },
};

type AndroidIncludePartial = {
  primitives?: boolean;
  tokens?: boolean;
  composites?: {
    colorStyles?: boolean;
    shadows?: boolean;
    textStyles?: boolean;
  };
};

type AndroidOptionsPartial = {
  flavor?: string;
  packageName?: string;
  androidNamespace?: string;
  namespace?: string;
  include?: AndroidIncludePartial;
};

export function mergeAndroidOptions(input: unknown): AndroidOptions {
  const partial = (input ?? {}) as AndroidOptionsPartial;
  const includeIn = partial.include ?? {};
  const compositesIn = includeIn.composites ?? {};
  return {
    flavor: 'compose',
    packageName: sanitizePackageName(partial.packageName),
    androidNamespace: sanitizeAndroidNamespace(
      partial.androidNamespace ?? partial.namespace,
    ),
    include: {
      primitives: includeIn.primitives ?? DEFAULT_ANDROID_OPTIONS.include.primitives,
      tokens: includeIn.tokens ?? DEFAULT_ANDROID_OPTIONS.include.tokens,
      composites: {
        colorStyles:
          compositesIn.colorStyles ??
          DEFAULT_ANDROID_OPTIONS.include.composites.colorStyles,
        shadows:
          compositesIn.shadows ?? DEFAULT_ANDROID_OPTIONS.include.composites.shadows,
        textStyles:
          compositesIn.textStyles ??
          DEFAULT_ANDROID_OPTIONS.include.composites.textStyles,
      },
    },
  };
}

export function sanitizePackageName(input: unknown): string {
  if (typeof input !== 'string') return DEFAULT_ANDROID_OPTIONS.packageName;
  const out = input
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^[_-]+|[_-]+$/g, '');
  return out || DEFAULT_ANDROID_OPTIONS.packageName;
}

export function sanitizeAndroidNamespace(input: unknown): string {
  if (typeof input !== 'string') return DEFAULT_ANDROID_NAMESPACE;
  const segments = input
    .trim()
    .split('.')
    .map((segment) =>
      segment
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9_]+/g, '_')
        .replace(/_+/g, '_')
        .replace(/^_+|_+$/g, ''),
    )
    .filter(Boolean)
    .map((segment) => {
      let out = segment;
      if (/^\d/.test(out)) out = `_${out}`;
      if (KOTLIN_RESERVED.has(out)) out = `${out}_`;
      return out;
    });

  if (segments.length === 0) return DEFAULT_ANDROID_NAMESPACE;
  return segments.join('.');
}

export function namespacePath(namespace: string): string {
  return namespace.split('.').join('/');
}
