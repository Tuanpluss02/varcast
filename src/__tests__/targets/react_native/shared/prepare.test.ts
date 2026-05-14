import { describe, expect, it } from 'vitest';
import type { IR, IRCollection } from '../../../../ir/types';
import { prepareRN } from '../../../../targets/react_native/shared/prepare';

function baseIR(collections: IRCollection[]): IR {
  return {
    version: '1.0',
    fileKey: 'k',
    generatedAt: new Date(0).toISOString(),
    collections,
    composites: { paintStyles: [], effectStyles: [], textStyles: [] },
  };
}

describe('prepareRN — collections', () => {
  it('derives faithful camel/pascal/kebab names from Figma collection names', () => {
    const ir = baseIR([
      {
        id: 'c:tokens',
        name: 'Color Token',
        kind: 'token',
        modes: [{ id: 'm:default', name: 'Default' }],
        variables: [],
      },
    ]);
    const out = prepareRN(ir, null);
    expect(out.collections[0].typeNamePascal).toBe('ColorToken');
    expect(out.collections[0].exportNameCamel).toBe('colorToken');
    expect(out.collections[0].fileBaseNameKebab).toBe('color-token');
  });

  it('builds mode keys with a `Mode` suffix', () => {
    const ir = baseIR([
      {
        id: 'c:m',
        name: 'Mode',
        kind: 'token',
        modes: [
          { id: 'm:dark', name: 'Dark' },
          { id: 'm:light', name: 'Light' },
        ],
        variables: [],
      },
    ]);
    const out = prepareRN(ir, null);
    expect(out.collections[0].modes.map((m) => m.keyCamel)).toEqual(['darkMode', 'lightMode']);
    expect(out.collections[0].modes.map((m) => m.keyKebab)).toEqual(['dark-mode', 'light-mode']);
    expect(out.collections[0].defaultModeId).toBe('m:dark');
  });
});

describe('prepareRN — variables', () => {
  it('splits groupPath into camel/kebab segments + leaf', () => {
    const ir = baseIR([
      {
        id: 'c:t',
        name: 'Tokens',
        kind: 'token',
        modes: [{ id: 'm:d', name: 'Default' }],
        variables: [
          {
            id: 'v:1',
            figmaName: 'background/surface/primary-hover',
            groupPath: ['background', 'surface', 'primary-hover'],
            type: 'COLOR',
            scopes: [],
            hiddenFromPublishing: false,
            emitToPublic: true,
            valuesByMode: {
              'm:d': { kind: 'literal', value: { r: 0, g: 0, b: 0, a: 1 } },
            },
          },
        ],
      },
    ]);
    const v = prepareRN(ir, null).collections[0].variables[0];
    expect(v.groupCamel).toEqual(['background', 'surface']);
    expect(v.groupKebab).toEqual(['background', 'surface']);
    expect(v.leafCamel).toBe('primaryHover');
    expect(v.leafKebab).toBe('primary-hover');
    expect(v.stableLeafKey).toBe('primaryHover');
  });

  it('skips variables with emitToPublic=false', () => {
    const ir = baseIR([
      {
        id: 'c:t',
        name: 'Tokens',
        kind: 'token',
        modes: [{ id: 'm:d', name: 'Default' }],
        variables: [
          {
            id: 'v:1',
            figmaName: 'a',
            groupPath: ['a'],
            type: 'COLOR',
            scopes: [],
            hiddenFromPublishing: true,
            emitToPublic: false,
            valuesByMode: {},
          },
        ],
      },
    ]);
    expect(prepareRN(ir, null).collections[0].variables).toHaveLength(0);
  });

  it('classifies variable into a Tailwind bucket using IR scopes', () => {
    const ir = baseIR([
      {
        id: 'c:t',
        name: 'Tokens',
        kind: 'token',
        modes: [{ id: 'm:d', name: 'Default' }],
        variables: [
          {
            id: 'v:c',
            figmaName: 'brand/500',
            groupPath: ['brand', '500'],
            type: 'COLOR',
            scopes: [],
            hiddenFromPublishing: false,
            emitToPublic: true,
            valuesByMode: {},
          },
          {
            id: 'v:r',
            figmaName: 'radius/md',
            groupPath: ['radius', 'md'],
            type: 'FLOAT',
            scopes: ['CORNER_RADIUS'],
            hiddenFromPublishing: false,
            emitToPublic: true,
            valuesByMode: {},
          },
          {
            id: 'v:s',
            figmaName: 'spacing/4',
            groupPath: ['spacing', '4'],
            type: 'FLOAT',
            scopes: ['GAP', 'WIDTH_HEIGHT'],
            hiddenFromPublishing: false,
            emitToPublic: true,
            valuesByMode: {},
          },
        ],
      },
    ]);
    const vars = prepareRN(ir, null).collections[0].variables;
    expect(vars[0].tailwindBucket).toBe('colors');
    expect(vars[1].tailwindBucket).toBe('borderRadius');
    expect(vars[2].tailwindBucket).toBe('spacing');
  });

  it('dedupes leaf collisions within the same group path and warns', () => {
    const ir = baseIR([
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
    ]);
    const out = prepareRN(ir, null);
    const leaves = out.collections[0].variables.map((v) => v.stableLeafKey);
    expect(leaves).toEqual(['itemOne', 'itemOne2']);
    expect(out.warnings.some((w) => w.code === 'DUPLICATE_LEAF_NAME')).toBe(true);
  });
});

describe('prepareRN — manifest stability', () => {
  it('reuses persisted leaf names across runs', () => {
    const ir = baseIR([
      {
        id: 'c:t',
        name: 'Tokens',
        kind: 'token',
        modes: [{ id: 'm:d', name: 'Default' }],
        variables: [
          {
            id: 'v:1',
            figmaName: 'oldGroup/oldName',
            groupPath: ['oldGroup', 'oldName'],
            type: 'COLOR',
            scopes: [],
            hiddenFromPublishing: false,
            emitToPublic: true,
            valuesByMode: {},
          },
        ],
      },
    ]);
    const out = prepareRN(ir, {
      version: '2.0',
      fileKey: 'k',
      lastExportedAt: new Date(0).toISOString(),
      targets: {
        react_native: {
          variables: { 'v:1': 'pinnedName' },
          collections: { 'c:t': 'TokensPinned' },
        },
      },
    });
    expect(out.collections[0].typeNamePascal).toBe('TokensPinned');
    expect(out.collections[0].variables[0].stableLeafKey).toBe('pinnedName');
  });
});

describe('prepareRN — axes + composites', () => {
  it('exposes axes for collections with multiple modes', () => {
    const ir = baseIR([
      {
        id: 'c:m',
        name: 'Mode',
        kind: 'token',
        modes: [
          { id: 'm:l', name: 'Light' },
          { id: 'm:d', name: 'Dark' },
        ],
        variables: [],
      },
      {
        id: 'c:b',
        name: 'Brand',
        kind: 'token',
        modes: [{ id: 'b:1', name: 'Blue' }],
        variables: [],
      },
    ]);
    const out = prepareRN(ir, null);
    expect(out.axes.map((a) => a.keyCamel)).toEqual(['mode']);
    expect(out.axes[0].isLightDarkLike).toBe(true);
  });

  it('resolves variable literals per mode for composites', () => {
    const ir = baseIR([
      {
        id: 'c:t',
        name: 'Tokens',
        kind: 'primitive',
        modes: [{ id: 'm:d', name: 'Default' }],
        variables: [
          {
            id: 'v:size',
            figmaName: 'size',
            groupPath: ['size'],
            type: 'FLOAT',
            scopes: ['FONT_SIZE'],
            hiddenFromPublishing: false,
            emitToPublic: true,
            valuesByMode: { 'm:d': { kind: 'literal', value: 14 } },
          },
        ],
      },
    ]);
    expect(prepareRN(ir, null).resolvedByMode['m:d']['v:size']).toBe(14);
  });

  it('prepares composite styles with deduped getter names', () => {
    const ir: IR = {
      version: '1.0',
      fileKey: 'k',
      generatedAt: new Date(0).toISOString(),
      collections: [],
      composites: {
        paintStyles: [
          {
            id: 'p:1',
            figmaName: 'Brand/Primary',
            groupPath: ['Brand', 'Primary'],
            type: 'SOLID',
            color: { kind: 'literal', rgba: { r: 1, g: 0, b: 0, a: 1 } },
          },
          {
            id: 'p:2',
            figmaName: 'Brand/Primary',
            groupPath: ['Brand', 'Primary'],
            type: 'SOLID',
            color: { kind: 'literal', rgba: { r: 0, g: 1, b: 0, a: 1 } },
          },
        ],
        effectStyles: [],
        textStyles: [],
      },
    };
    const out = prepareRN(ir, null);
    expect(out.paintStyles.map((s) => s.getterName)).toEqual(['primary', 'primary2']);
    expect(out.paintStyles[0].groupName).toBe('Brand');
  });
});
