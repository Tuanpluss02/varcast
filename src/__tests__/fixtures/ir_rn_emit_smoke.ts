import type { IR } from '../../ir/types';

export function makeIrForRnEmitSmokeFixture(): IR {
  return {
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
}

