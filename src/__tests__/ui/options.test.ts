import { describe, expect, it, beforeAll } from 'vitest';
import { pillText } from '../../ui/components/options';
import type { ExportOptions } from '../../ui/components/options';
import { registerFlutterTarget } from '../../targets/flutter';
import { registerReactNativeTarget } from '../../targets/react_native';

describe('ui/components/options: pillText', () => {
  beforeAll(() => {
    registerFlutterTarget();
    registerReactNativeTarget();
  });

  it('resolves displayName from target registry for Flutter', () => {
    const opts: ExportOptions = {
      targetId: 'flutter',
      packageName: 'design_system',
      include: {
        collections: ['col1', 'col2'],
        composites: { colorStyles: true, shadows: true, textStyles: true },
      },
    };
    expect(pillText(opts, 2)).toBe('Flutter · All collections · defaults');
    expect(pillText(opts, 5)).toBe('Flutter · 2/5 collections · defaults');
  });

  it('resolves displayName from target registry for React Native', () => {
    const opts: ExportOptions = {
      targetId: 'react_native',
      packageName: 'design-system',
      include: {
        composites: { colorStyles: true, shadows: false, textStyles: true },
      },
    };
    expect(pillText(opts)).toBe('React Native · All collections · customized');
  });

  it('falls back to targetId when target is not registered', () => {
    const opts: ExportOptions = {
      targetId: 'custom_target',
      packageName: 'custom_pkg',
      include: {
        collections: ['col1'],
        composites: { colorStyles: true, shadows: true, textStyles: true },
      },
    };
    expect(pillText(opts, 1)).toBe('custom_target · All collections · defaults');
  });
});
