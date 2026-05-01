import { describe, it, expect } from 'vitest';
import type { IR } from '../../../ir/types';
import { runEngine } from '../../../core/emit_engine';
import { reactNativeTarget } from '../../../targets/react_native';

describe('react_native target emit smoke', () => {
  it('emits package.json + runtime + token files', () => {
    const ir: IR = {
      version: '1.0',
      fileKey: 'k',
      generatedAt: new Date(0).toISOString(),
      collections: [
        {
          id: 'col:1',
          name: 'Color Token',
          kind: 'token',
          modes: [
            { id: 'm:dark', name: 'Dark' },
            { id: 'm:light', name: 'Light' },
          ],
          variables: [
            {
              id: 'var:1',
              figmaName: 'Background/primary',
              groupPath: ['Background', 'primary'],
              type: 'COLOR',
              scopes: [],
              hiddenFromPublishing: false,
              emitToPublic: true,
              valuesByMode: {
                'm:dark': { kind: 'literal', value: { r: 1, g: 0, b: 0, a: 1 } },
                'm:light': { kind: 'literal', value: { r: 0, g: 1, b: 0, a: 1 } },
              },
            },
          ],
        },
      ],
      composites: { paintStyles: [], effectStyles: [], textStyles: [] },
    };

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
});

