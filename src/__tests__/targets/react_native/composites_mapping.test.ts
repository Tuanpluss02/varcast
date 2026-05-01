import { describe, it, expect } from 'vitest';
import type { IR } from '../../../ir/types';
import { runEngine } from '../../../core/emit_engine';
import { reactNativeTarget } from '../../../targets/react_native';

function fileMap(files: { path: string; contents: string }[]) {
  const m = new Map<string, string>();
  for (const f of files) m.set(f.path, f.contents);
  return m;
}

describe('react_native composites mapping', () => {
  it('emits textStyles and shadows with per-mode values', () => {
    const ir: IR = {
      version: '1.0',
      fileKey: 'k',
      generatedAt: new Date(0).toISOString(),
      collections: [
        {
          id: 'col:1',
          name: 'Numbers',
          kind: 'primitive',
          modes: [
            { id: 'm:dark', name: 'Dark' },
            { id: 'm:light', name: 'Light' },
          ],
          variables: [
            {
              id: 'var:size',
              figmaName: 'font/size',
              groupPath: ['font', 'size'],
              type: 'FLOAT',
              scopes: [],
              hiddenFromPublishing: false,
              emitToPublic: true,
              valuesByMode: {
                'm:dark': { kind: 'literal', value: 16 },
                'm:light': { kind: 'literal', value: 18 },
              },
            },
          ],
        },
      ],
      composites: {
        paintStyles: [],
        effectStyles: [
          {
            id: 'E:1',
            figmaName: 'Shadow/Primary',
            groupPath: ['Shadow', 'Primary'],
            type: 'DROP_SHADOW',
            color: { kind: 'literal', rgba: { r: 0, g: 0, b: 0, a: 0.5 } },
            offsetX: 0,
            offsetY: 2,
            blurRadius: 8,
            spreadRadius: 0,
          },
        ],
        textStyles: [
          {
            id: 'T:1',
            figmaName: 'Body/Regular',
            groupPath: ['Body', 'Regular'],
            fontFamily: { kind: 'literal', value: 'Inter' },
            fontSize: { kind: 'alias', targetVariableId: 'var:size' },
            fontWeight: { kind: 'literal', value: 400 },
            lineHeight: { kind: 'literal', value: 150, unit: 'PERCENT' },
            letterSpacing: { kind: 'literal', value: 0, unit: 'PIXELS' },
          },
        ],
      },
    };

    const out = runEngine(ir, [reactNativeTarget], null, { react_native: { packageName: 'ds' } });
    const files = fileMap(out.files);
    const text = files.get('src/composites/textStyles.ts')!;
    const shadow = files.get('src/composites/shadows.ts')!;
    expect(text).toContain('export const textStyles');
    expect(text).toContain('Inter');
    expect(shadow).toContain('shadowOpacity');
    expect(shadow).toContain('#00000080'); // 0.5 alpha -> 0x80
  });
});

