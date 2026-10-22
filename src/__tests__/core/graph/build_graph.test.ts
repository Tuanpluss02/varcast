import { describe, it, expect } from 'vitest';
import type { IR, IRCollection, IRVariable } from '../../../ir/types';
import {
  buildSemanticGraph,
} from '../../../core/graph/build_graph';
import {
  resolveVariableLiteral,
} from '../../../core/graph/alias_resolver';
import {
  buildGroupTree,
  flatGetterName,
} from '../../../core/graph/group_tree';
import type { RGBAValue } from '../../../core/graph/types';

function createTestIR(collections: IRCollection[]): IR {
  return {
    version: '1.0',
    fileKey: 'test-file-key',
    generatedAt: '2026-10-21T00:00:00.000Z',
    collections,
    composites: {
      paintStyles: [],
      effectStyles: [],
      textStyles: [],
    },
  };
}

function createVariable(
  id: string,
  figmaName: string,
  valuesByMode: IRVariable['valuesByMode'],
  type: IRVariable['type'] = 'COLOR',
  emitToPublic = true,
): IRVariable {
  const segments = figmaName.split('/').map((s) => s.trim()).filter(Boolean);
  return {
    id,
    figmaName,
    groupPath: segments,
    type,
    scopes: [],
    hiddenFromPublishing: false,
    emitToPublic,
    valuesByMode,
  };
}

describe('Semantic Token Graph Builder', () => {
  describe('alias_resolver', () => {
    it('resolves primitive literal values and rounds floats to 6 decimals', () => {
      const col: IRCollection = {
        id: 'col-1',
        name: 'Primitives',
        kind: 'primitive',
        modes: [{ id: 'm-1', name: 'Default' }],
        variables: [
          createVariable('v:num', 'spacing/sm', {
            'm-1': { kind: 'literal', value: 12.34567891 },
          }, 'FLOAT'),
          createVariable('v:str', 'font/family', {
            'm-1': { kind: 'literal', value: 'Inter' },
          }, 'STRING'),
          createVariable('v:bool', 'flag/active', {
            'm-1': { kind: 'literal', value: true },
          }, 'BOOLEAN'),
        ],
      };
      const ir = createTestIR([col]);

      expect(resolveVariableLiteral('v:num', 'm-1', ir)).toBe(12.345679);
      expect(resolveVariableLiteral('v:str', 'm-1', ir)).toBe('Inter');
      expect(resolveVariableLiteral('v:bool', 'm-1', ir)).toBe(true);
    });

    it('resolves RGBA literal into RGBAValue with hex and rgbaString', () => {
      const col: IRCollection = {
        id: 'col-1',
        name: 'Colors',
        kind: 'primitive',
        modes: [{ id: 'm-1', name: 'Default' }],
        variables: [
          createVariable('v:red', 'color/red', {
            'm-1': { kind: 'literal', value: { r: 1, g: 0, b: 0, a: 1 } },
          }, 'COLOR'),
          createVariable('v:alpha', 'color/translucent', {
            'm-1': { kind: 'literal', value: { r: 0, g: 1, b: 0, a: 0.5 } },
          }, 'COLOR'),
        ],
      };
      const ir = createTestIR([col]);

      const red = resolveVariableLiteral('v:red', 'm-1', ir) as RGBAValue;
      expect(red).toEqual({
        r: 1,
        g: 0,
        b: 0,
        a: 1,
        hex: '#FF0000FF',
        rgbaString: 'rgba(255, 0, 0, 1)',
      });

      const alpha = resolveVariableLiteral('v:alpha', 'm-1', ir) as RGBAValue;
      expect(alpha).toEqual({
        r: 0,
        g: 1,
        b: 0,
        a: 0.5,
        hex: '#00FF0080',
        rgbaString: 'rgba(0, 255, 0, 0.5)',
      });
    });

    it('resolves multi-hop aliases (A -> B -> literal)', () => {
      const col: IRCollection = {
        id: 'col-1',
        name: 'Colors',
        kind: 'primitive',
        modes: [{ id: 'm-1', name: 'Default' }],
        variables: [
          createVariable('v:a', 'color/a', {
            'm-1': { kind: 'alias', targetVariableId: 'v:b' },
          }),
          createVariable('v:b', 'color/b', {
            'm-1': { kind: 'alias', targetVariableId: 'v:c' },
          }),
          createVariable('v:c', 'color/c', {
            'm-1': { kind: 'literal', value: { r: 0, g: 0, b: 1, a: 1 } },
          }),
        ],
      };
      const ir = createTestIR([col]);

      const resolved = resolveVariableLiteral('v:a', 'm-1', ir) as RGBAValue;
      expect(resolved.hex).toBe('#0000FFFF');
    });

    it('resolves cross-collection aliases with different modes', () => {
      const primitives: IRCollection = {
        id: 'col-primitives',
        name: 'Primitives',
        kind: 'primitive',
        modes: [{ id: 'mode-default', name: 'Value' }],
        variables: [
          createVariable('v:base-blue', 'blue/500', {
            'mode-default': { kind: 'literal', value: { r: 0.2, g: 0.4, b: 0.8, a: 1 } },
          }),
        ],
      };

      const tokens: IRCollection = {
        id: 'col-tokens',
        name: 'Tokens',
        kind: 'token',
        modes: [
          { id: 'mode-light', name: 'Light Mode' },
          { id: 'mode-dark', name: 'Dark Mode' },
        ],
        variables: [
          createVariable('v:brand-primary', 'brand/primary', {
            'mode-light': { kind: 'alias', targetVariableId: 'v:base-blue' },
            'mode-dark': { kind: 'alias', targetVariableId: 'v:base-blue' },
          }),
        ],
      };

      const ir = createTestIR([primitives, tokens]);

      const lightRes = resolveVariableLiteral('v:brand-primary', 'mode-light', ir) as RGBAValue;
      const darkRes = resolveVariableLiteral('v:brand-primary', 'mode-dark', ir) as RGBAValue;

      expect(lightRes).toBeDefined();
      expect(darkRes).toBeDefined();
      expect(lightRes.hex).toBe(darkRes.hex);
    });

    it('returns undefined for circular aliases and missing targets', () => {
      const col: IRCollection = {
        id: 'col-1',
        name: 'BadAliases',
        kind: 'primitive',
        modes: [{ id: 'm-1', name: 'Default' }],
        variables: [
          createVariable('v:cycle1', 'cycle/one', {
            'm-1': { kind: 'alias', targetVariableId: 'v:cycle2' },
          }),
          createVariable('v:cycle2', 'cycle/two', {
            'm-1': { kind: 'alias', targetVariableId: 'v:cycle1' },
          }),
          createVariable('v:dangling', 'missing/target', {
            'm-1': { kind: 'alias', targetVariableId: 'v:does-not-exist' },
          }),
        ],
      };
      const ir = createTestIR([col]);

      expect(resolveVariableLiteral('v:cycle1', 'm-1', ir)).toBeUndefined();
      expect(resolveVariableLiteral('v:dangling', 'm-1', ir)).toBeUndefined();
    });
  });

  describe('group_tree', () => {
    it('computes flat camelCase getter names correctly', () => {
      expect(flatGetterName(['color', 'bg'], 'brand')).toBe('colorBgBrand');
      expect(flatGetterName([], 'brand')).toBe('brand');
      expect(flatGetterName(['color'], 'brand')).toBe('colorBrand');
      expect(flatGetterName(['Color', 'Background'], 'Primary')).toBe('colorBackgroundPrimary');
    });

    it('builds tree hierarchy and navigates nodes', () => {
      const col: IRCollection = {
        id: 'col-1',
        name: 'Theme',
        kind: 'token',
        modes: [{ id: 'm-1', name: 'Default' }],
        variables: [
          createVariable('v:brand', 'color/bg/brand', {
            'm-1': { kind: 'literal', value: 'red' },
          }, 'STRING'),
          createVariable('v:surface', 'color/bg/surface', {
            'm-1': { kind: 'literal', value: 'white' },
          }, 'STRING'),
          createVariable('v:text', 'color/text/primary', {
            'm-1': { kind: 'literal', value: 'black' },
          }, 'STRING'),
        ],
      };
      const ir = createTestIR([col]);
      const graph = buildSemanticGraph(ir);
      const root = graph.collections[0].rootNode;

      expect(root.name).toBe('root');
      expect(root.children.has('color')).toBe(true);

      const colorNode = root.children.get('color')!;
      expect(colorNode.children.has('bg')).toBe(true);
      expect(colorNode.children.has('text')).toBe(true);

      const bgNode = colorNode.children.get('bg')!;
      expect(bgNode.variables.has('brand')).toBe(true);
      expect(bgNode.variables.get('brand')!.id).toBe('v:brand');
      expect(bgNode.variables.has('surface')).toBe(true);
    });

    it('handles sibling deduplication under the same tree node', () => {
      const col: IRCollection = {
        id: 'col-1',
        name: 'Theme',
        kind: 'token',
        modes: [{ id: 'm-1', name: 'Default' }],
        variables: [
          createVariable('v:1', 'color/primary', {
            'm-1': { kind: 'literal', value: 'blue' },
          }, 'STRING'),
          createVariable('v:2', 'color/primary', {
            'm-1': { kind: 'literal', value: 'blue2' },
          }, 'STRING'),
          createVariable('v:3', 'color/primary', {
            'm-1': { kind: 'literal', value: 'blue3' },
          }, 'STRING'),
        ],
      };
      const ir = createTestIR([col]);
      const graph = buildSemanticGraph(ir);
      const colorNode = graph.collections[0].rootNode.children.get('color')!;

      expect(colorNode.variables.has('primary')).toBe(true);
      expect(colorNode.variables.get('primary')!.id).toBe('v:1');
      expect(colorNode.variables.has('primary2')).toBe(true);
      expect(colorNode.variables.get('primary2')!.id).toBe('v:2');
      expect(colorNode.variables.has('primary3')).toBe(true);
      expect(colorNode.variables.get('primary3')!.id).toBe('v:3');
    });
  });

  describe('buildSemanticGraph', () => {
    it('populates variableIndex and allModes with camelCase keys', () => {
      const col1: IRCollection = {
        id: 'col-1',
        name: 'Color Tokens',
        kind: 'token',
        modes: [
          { id: 'm:light', name: 'Light Mode' },
          { id: 'm:dark', name: 'Dark Mode' },
        ],
        variables: [
          createVariable('v:1', 'bg/primary', {
            'm:light': { kind: 'literal', value: 'white' },
            'm:dark': { kind: 'literal', value: 'black' },
          }, 'STRING'),
        ],
      };
      const col2: IRCollection = {
        id: 'col-2',
        name: 'Spacing',
        kind: 'primitive',
        modes: [{ id: 'm:default', name: 'Default' }],
        variables: [
          createVariable('v:2', 'spacing/sm', {
            'm:default': { kind: 'literal', value: 8 },
          }, 'FLOAT'),
        ],
      };
      const ir = createTestIR([col1, col2]);
      const graph = buildSemanticGraph(ir);

      expect(graph.allModes).toEqual([
        { id: 'm:light', name: 'Light Mode', key: 'lightMode' },
        { id: 'm:dark', name: 'Dark Mode', key: 'darkMode' },
        { id: 'm:default', name: 'Default', key: 'default' },
      ]);

      expect(graph.variableIndex.size).toBe(2);
      expect(graph.variableIndex.get('v:1')?.id).toBe('v:1');
      expect(graph.variableIndex.get('v:2')?.id).toBe('v:2');

      const v1 = graph.variableIndex.get('v:1')!;
      expect(v1.leafName).toBe('primary');
      expect(v1.groupPath).toEqual(['bg']);
      expect(v1.resolvedValuesByMode['m:light']).toBe('white');
      expect(v1.resolvedValuesByMode['m:dark']).toBe('black');
      expect(v1.rawValuesByMode['m:light']).toEqual({ kind: 'literal', value: 'white' });
    });

    it('sets emitToPublic to false when an alias cannot be resolved', () => {
      const col: IRCollection = {
        id: 'col-1',
        name: 'Tokens',
        kind: 'token',
        modes: [{ id: 'm-1', name: 'Default' }],
        variables: [
          createVariable('v:good', 'color/good', {
            'm-1': { kind: 'literal', value: 'green' },
          }, 'STRING', true),
          createVariable('v:broken', 'color/broken', {
            'm-1': { kind: 'alias', targetVariableId: 'v:missing' },
          }, 'STRING', true),
        ],
      };
      const ir = createTestIR([col]);
      const graph = buildSemanticGraph(ir);

      const good = graph.variableIndex.get('v:good')!;
      expect(good.emitToPublic).toBe(true);

      const broken = graph.variableIndex.get('v:broken')!;
      expect(broken.emitToPublic).toBe(false);
    });
  });
});
