import { describe, it, expect } from 'vitest';
import { runEngine } from '../../../core/emit_engine';
import { reactNativeTarget } from '../../../targets/react_native';
import { makeIrForRnEmitSmokeFixture } from '../../fixtures/ir_rn_emit_smoke';

describe('react_native target emit smoke', () => {
  it('emits package.json + runtime + token files', () => {
    const ir = makeIrForRnEmitSmokeFixture();

    const out = runEngine(ir, [reactNativeTarget], null, { react_native: { packageName: 'ds' } });
    const paths = out.files.map((f) => f.path).sort();
    expect(paths).toContain('package.json');
    expect(paths).toContain('src/runtime/ThemeProvider.tsx');
    expect(paths).toContain('src/runtime/createTheme.ts');
    expect(paths).toContain('src/tokens/tokens/color-token.ts');
    expect(paths).toContain('src/composites/textStyles.ts');
    expect(paths).toContain('src/composites/shadows.ts');
    expect(paths).toContain('src/composites/colorStyles.ts');
  });

  it('honors include.composites flags — disabled composites are not emitted', () => {
    const ir = makeIrForRnEmitSmokeFixture();

    const out = runEngine(ir, [reactNativeTarget], null, {
      react_native: {
        packageName: 'ds',
        include: {
          primitives: true,
          tokens: true,
          composites: { colorStyles: true, shadows: false, textStyles: false },
        },
      },
    });
    const paths = out.files.map((f) => f.path);
    expect(paths).toContain('src/composites/colorStyles.ts');
    expect(paths).not.toContain('src/composites/shadows.ts');
    expect(paths).not.toContain('src/composites/textStyles.ts');
  });
});

