import { describe, it, expect } from 'vitest';
import type { IR } from '../../ir/types';
import type { Manifest } from '../../manifest';
import { prepareIR } from '../../generator/prepare';

describe('prepareIR stable naming dedup', () => {
  it('dedups colliding manifest leaf names within the same parent group', () => {
    const ir: IR = {
      version: '1.0',
      fileKey: 'k',
      generatedAt: new Date(0).toISOString(),
      collections: [
        {
          id: 'col:1',
          name: 'Color Token',
          dartName: 'ColorToken',
          kind: 'token',
          modes: [{ id: 'm:1', name: 'Light', dartName: 'light' }],
          variables: [
            {
              id: 'var:1',
              figmaName: 'Background/bgSecondary',
              dartName: 'bgSecondary',
              groupPath: ['Background', 'bgSecondary'],
              type: 'COLOR',
              scopes: ['ALL_FILLS'],
              hiddenFromPublishing: false,
              emitToPublic: true,
              valuesByMode: { 'm:1': { kind: 'literal', value: { r: 0, g: 0, b: 0, a: 1 } } },
            },
            {
              id: 'var:2',
              figmaName: 'Background/bgSecondary Duplicate',
              dartName: 'bgSecondary',
              groupPath: ['Background', 'bgSecondary'],
              type: 'COLOR',
              scopes: ['ALL_FILLS'],
              hiddenFromPublishing: false,
              emitToPublic: true,
              valuesByMode: { 'm:1': { kind: 'literal', value: { r: 1, g: 1, b: 1, a: 1 } } },
            },
          ],
        },
      ],
      composites: { paintStyles: [], effectStyles: [], textStyles: [] },
    };

    const manifest: Manifest = {
      version: '1.0',
      fileKey: 'k',
      lastExportedAt: new Date(0).toISOString(),
      variables: { 'var:1': 'bgSecondary', 'var:2': 'bgSecondary' },
      collections: { 'col:1': 'ColorToken' },
    };

    const prepared = prepareIR(ir, manifest);
    const col = prepared.collections[0];
    const bg = col.variables.filter((v) => v.groupPath.join('/') === 'Background');
    expect(bg.map((v) => v.leafName)).toEqual(['bgSecondary', 'bgSecondary2']);

    // next manifest should persist the unique names
    expect(prepared.nextManifest.variables['var:2']).toBe('bgSecondary2');
  });
});

