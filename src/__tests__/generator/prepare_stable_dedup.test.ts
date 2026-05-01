import { describe, it, expect } from 'vitest';
import type { IR } from '../../ir/types';
import type { Manifest } from '../../manifest';
import { prepareIR } from '../../targets/flutter/generator/prepare';

function baseIR(variables: IR['collections'][0]['variables']): IR {
  return {
    version: '1.0',
    fileKey: 'k',
    generatedAt: new Date(0).toISOString(),
    collections: [
      {
        id: 'col:1',
        name: 'Color Token',
        kind: 'token',
        modes: [{ id: 'm:1', name: 'Light' }],
        variables,
      },
    ],
    composites: { paintStyles: [], effectStyles: [], textStyles: [] },
  };
}

function makeVar(id: string, groupPath: string[]): IR['collections'][0]['variables'][0] {
  return {
    id,
    figmaName: groupPath.join('/'),
    groupPath,
    type: 'COLOR',
    scopes: [],
    hiddenFromPublishing: false,
    emitToPublic: true,
    valuesByMode: { 'm:1': { kind: 'literal', value: { r: 0, g: 0, b: 0, a: 1 } } },
  };
}

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
          kind: 'token',
          modes: [{ id: 'm:1', name: 'Light' }],
          variables: [
            {
              id: 'var:1',
              figmaName: 'Background/bgSecondary',
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
      version: '2.0',
      fileKey: 'k',
      lastExportedAt: new Date(0).toISOString(),
      targets: {
        flutter: {
          variables: { 'var:1': 'bgSecondary', 'var:2': 'bgSecondary' },
          collections: { 'col:1': 'ColorToken' },
        },
      },
    };

    const prepared = prepareIR(ir, manifest);
    const col = prepared.collections[0];
    const bg = col.variables.filter((v) => v.groupPath.join('/') === 'Background');
    expect(bg.map((v) => v.leafName)).toEqual(['bgSecondary', 'bgSecondary2']);

    // next manifest should persist the unique names under the flutter target
    expect(prepared.nextManifest.targets.flutter.variables['var:2']).toBe('bgSecondary2');
  });
});

describe('prepareIR keyword conflict warnings', () => {
  it('emits KEYWORD_CONFLICT warning when leaf is a Dart reserved word', () => {
    const ir = baseIR([makeVar('v:1', ['Border', 'default'])]);
    const prepared = prepareIR(ir);
    const w = prepared.warnings.find((w) => w.type === 'KEYWORD_CONFLICT');
    expect(w).toBeDefined();
    expect(w!.variableId).toBe('v:1');
    expect((w as { fixed: string }).fixed).toBe('default_');
    const col = prepared.collections[0];
    expect(col.variables[0].leafName).toBe('default_');
  });

  it('does not emit KEYWORD_CONFLICT when leaf is not a reserved word', () => {
    const ir = baseIR([makeVar('v:1', ['Border', 'primary'])]);
    const prepared = prepareIR(ir);
    expect(prepared.warnings.filter((w) => w.type === 'KEYWORD_CONFLICT')).toHaveLength(0);
  });

  it('emits DUPLICATE_DART_NAME when two variables resolve to the same leaf in same parent', () => {
    const ir = baseIR([
      makeVar('v:1', ['Background', 'primary']),
      makeVar('v:2', ['Background', 'primary']),
      makeVar('v:3', ['Background', 'primary']),
    ]);
    const prepared = prepareIR(ir);
    const dups = prepared.warnings.filter((w) => w.type === 'DUPLICATE_DART_NAME');
    expect(dups).toHaveLength(2);
    const col = prepared.collections[0];
    const leaves = col.variables.map((v) => v.leafName);
    expect(leaves).toEqual(['primary', 'primary2', 'primary3']);
  });

  it('siblings with same leaf in different parent groups are NOT duplicates', () => {
    const ir = baseIR([
      makeVar('v:1', ['Background', 'primary']),
      makeVar('v:2', ['Action', 'primary']),
    ]);
    const prepared = prepareIR(ir);
    expect(prepared.warnings.filter((w) => w.type === 'DUPLICATE_DART_NAME')).toHaveLength(0);
    const col = prepared.collections[0];
    expect(col.variables[0].leafName).toBe('primary');
    expect(col.variables[1].leafName).toBe('primary');
  });
});

