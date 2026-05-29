import { describe, expect, it } from 'vitest';
import type { IR, IRCollection } from '../../../ir/types';
import { prepareAndroid } from '../../../targets/android/shared/prepare';

function baseIR(collections: IRCollection[]): IR {
  return {
    version: '1.0',
    fileKey: 'k',
    generatedAt: new Date(0).toISOString(),
    collections,
    composites: { paintStyles: [], effectStyles: [], textStyles: [] },
  };
}

describe('prepareAndroid', () => {
  it('derives Kotlin collection names and mode entries', () => {
    const out = prepareAndroid(
      baseIR([
        {
          id: 'c:color',
          name: 'Color Token',
          kind: 'token',
          modes: [
            { id: 'm:dark', name: 'Dark' },
            { id: 'm:light', name: 'Light' },
          ],
          variables: [],
        },
      ]),
      null,
    );
    expect(out.collections[0].className).toBe('ColorToken');
    expect(out.collections[0].accessor).toBe('colorToken');
    expect(out.collections[0].modes.map((m) => m.enumEntry)).toEqual([
      'DarkMode',
      'LightMode',
    ]);
  });

  it('dedupes leaf collisions and warns', () => {
    const out = prepareAndroid(
      baseIR([
        {
          id: 'c:t',
          name: 'Tokens',
          kind: 'token',
          modes: [{ id: 'm:d', name: 'Default' }],
          variables: [
            {
              id: 'v:1',
              figmaName: 'group/Item One',
              groupPath: ['group', 'Item One'],
              type: 'COLOR',
              scopes: [],
              hiddenFromPublishing: false,
              emitToPublic: true,
              valuesByMode: {},
            },
            {
              id: 'v:2',
              figmaName: 'group/itemOne',
              groupPath: ['group', 'itemOne'],
              type: 'COLOR',
              scopes: [],
              hiddenFromPublishing: false,
              emitToPublic: true,
              valuesByMode: {},
            },
          ],
        },
      ]),
      null,
    );
    expect(out.collections[0].variables.map((v) => v.stableLeafName)).toEqual([
      'itemOne',
      'itemOne2',
    ]);
    expect(out.warnings.some((w) => w.code === 'DUPLICATE_LEAF_NAME')).toBe(true);
  });

  it('fixes Kotlin reserved words', () => {
    const out = prepareAndroid(
      baseIR([
        {
          id: 'c:t',
          name: 'Tokens',
          kind: 'token',
          modes: [{ id: 'm:d', name: 'Default' }],
          variables: [
            {
              id: 'v:class',
              figmaName: 'class',
              groupPath: ['class'],
              type: 'STRING',
              scopes: [],
              hiddenFromPublishing: false,
              emitToPublic: true,
              valuesByMode: {},
            },
          ],
        },
      ]),
      null,
    );
    expect(out.collections[0].variables[0].stableLeafName).toBe('class_');
    expect(out.warnings.some((w) => w.code === 'KEYWORD_CONFLICT')).toBe(true);
  });

  it('reuses persisted stable names under the Android manifest section', () => {
    const out = prepareAndroid(
      baseIR([
        {
          id: 'c:t',
          name: 'Tokens Renamed',
          kind: 'token',
          modes: [{ id: 'm:d', name: 'Default' }],
          variables: [
            {
              id: 'v:1',
              figmaName: 'new/name',
              groupPath: ['new', 'name'],
              type: 'COLOR',
              scopes: [],
              hiddenFromPublishing: false,
              emitToPublic: true,
              valuesByMode: {},
            },
          ],
        },
      ]),
      {
        version: '2.0',
        fileKey: 'k',
        lastExportedAt: new Date(0).toISOString(),
        targets: {
          android: {
            variables: { 'v:1': 'pinnedName' },
            collections: { 'c:t': 'PinnedTokens' },
          },
        },
      },
    );
    expect(out.collections[0].className).toBe('PinnedTokens');
    expect(out.collections[0].variables[0].stableLeafName).toBe('pinnedName');
  });
});
