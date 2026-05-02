import type { IR } from '../../ir/types';

export function makeIrForRnCompositesFixture(): IR {
  return {
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
}

