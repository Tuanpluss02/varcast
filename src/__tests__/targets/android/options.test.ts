import { describe, expect, it } from 'vitest';
import {
  DEFAULT_ANDROID_NAMESPACE,
  mergeAndroidOptions,
  sanitizeAndroidNamespace,
} from '../../../targets/android/options';

describe('Android options', () => {
  it('preserves a valid custom namespace', () => {
    expect(sanitizeAndroidNamespace('com.example.designsystem')).toBe(
      'com.example.designsystem',
    );
  });

  it('sanitizes invalid namespace segments', () => {
    expect(sanitizeAndroidNamespace(' Com.Example.123 Bad.class ')).toBe(
      'com.example._123_bad.class_',
    );
  });

  it('falls back when namespace is empty', () => {
    expect(sanitizeAndroidNamespace('...')).toBe(DEFAULT_ANDROID_NAMESPACE);
  });

  it('merges defaults with package and namespace input', () => {
    const out = mergeAndroidOptions({
      packageName: 'Design System Android!',
      androidNamespace: 'io.Acme.Design',
      include: { tokens: false },
    });
    expect(out.flavor).toBe('compose');
    expect(out.packageName).toBe('design_system_android');
    expect(out.androidNamespace).toBe('io.acme.design');
    expect(out.include.tokens).toBe(false);
    expect(out.include.primitives).toBe(true);
  });
});
