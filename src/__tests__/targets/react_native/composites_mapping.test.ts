import { describe, it, expect } from 'vitest';
import { runEngine } from '../../../core/emit_engine';
import { reactNativeTarget } from '../../../targets/react_native';
import { makeIrForRnCompositesFixture } from '../../fixtures/ir_composites_minimal';

function fileMap(files: { path: string; contents: string }[]) {
  const m = new Map<string, string>();
  for (const f of files) m.set(f.path, f.contents);
  return m;
}

describe('react_native composites mapping', () => {
  it('emits textStyles and shadows with per-mode values', () => {
    const ir = makeIrForRnCompositesFixture();

    const out = runEngine(ir, [reactNativeTarget], null, { react_native: { packageName: 'ds' } });
    const files = fileMap(out.files);
    const text = files.get('src/composites/textStyles.ts')!;
    const shadow = files.get('src/composites/shadows.ts')!;
    expect(text).toContain('export const textStyles');
    expect(text).toContain('Inter');
    // Should key composites by mode keys (e.g. darkMode/lightMode) instead of raw mode ids.
    expect(text).toContain('"darkMode"');
    expect(text).toContain('"lightMode"');
    expect(text).not.toContain('m:dark');
    expect(text).not.toContain('m:light');
    expect(shadow).toContain('shadowOpacity');
    expect(shadow).toContain('#00000080'); // 0.5 alpha -> 0x80
  });
});

