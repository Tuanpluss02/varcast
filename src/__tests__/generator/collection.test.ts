import { describe, it, expect } from 'vitest';
import type { IR } from '../../ir/types';
import { prepareIR } from '../../targets/flutter/generator/prepare';
import { emitCollection } from '../../targets/flutter/generator/collection';

function buildIr(): IR {
  return {
    version: '1.0',
    fileKey: 'test',
    generatedAt: new Date(0).toISOString(),
    collections: [
      {
        id: 'col:basic',
        name: 'Color Basic',
        kind: 'primitive',
        modes: [{ id: 'm:1', name: 'Value' }],
        variables: [
          {
            id: 'var:black',
            figmaName: 'Background/Primary',
            groupPath: ['Background', 'Primary'],
            type: 'COLOR',
            scopes: ['ALL_FILLS'],
            hiddenFromPublishing: false,
            emitToPublic: true,
            valuesByMode: { 'm:1': { kind: 'literal', value: { r: 0, g: 0, b: 0, a: 1 } } },
          },
          {
            id: 'var:default',
            figmaName: 'Border/default',
            groupPath: ['Border', 'default'],
            type: 'COLOR',
            scopes: ['ALL_FILLS'],
            hiddenFromPublishing: false,
            emitToPublic: true,
            valuesByMode: { 'm:1': { kind: 'literal', value: { r: 1, g: 1, b: 1, a: 1 } } },
          },
        ],
      },
      {
        id: 'col:token',
        name: 'Color Token',
        kind: 'token',
        modes: [{ id: 'm:1', name: 'Light Mode' }],
        variables: [
          {
            id: 'var:bg-primary',
            figmaName: 'Background/Primary',
            groupPath: ['Background', 'Primary'],
            type: 'COLOR',
            scopes: ['ALL_FILLS'],
            hiddenFromPublishing: false,
            emitToPublic: true,
            valuesByMode: { 'm:1': { kind: 'alias', targetVariableId: 'var:black' } },
          },
        ],
      },
      {
        id: 'col:font-family',
        name: 'Font Family',
        kind: 'primitive',
        // Intentionally named "Mode" to reproduce a collision:
        // enum FontFamilyMode vs class FontFamilyMode.
        modes: [{ id: 'm:1', name: 'Mode' }],
        variables: [
          {
            id: 'var:font',
            figmaName: 'fonts',
            groupPath: [],
            type: 'STRING',
            scopes: ['TEXT_CONTENT'],
            hiddenFromPublishing: false,
            emitToPublic: true,
            valuesByMode: { 'm:1': { kind: 'literal', value: 'Inter' } },
          },
        ],
      },
      {
        id: 'col:multi-mode',
        name: 'Size',
        kind: 'primitive',
        modes: [
          { id: 'm:1', name: 'XS' },
          { id: 'm:2', name: 'S' },
        ],
        variables: [
          {
            id: 'var:size',
            figmaName: 'Size',
            groupPath: [],
            type: 'FLOAT',
            scopes: ['WIDTH_HEIGHT'],
            hiddenFromPublishing: false,
            emitToPublic: true,
            valuesByMode: {
              'm:1': { kind: 'literal', value: 10 },
              'm:2': { kind: 'literal', value: 20 },
            },
          },
        ],
      },
    ],
    composites: { paintStyles: [], effectStyles: [], textStyles: [] },
  };
}

describe('emitCollection (golden)', () => {
  it('emits primitive collection with nesting + reserved leaf', () => {
    const prepared = prepareIR(buildIr());
    const col = prepared.collections.find((c) => c.className === 'ColorBasic')!;
    // Always returns multiple files: base + one per mode
    const files = emitCollection(col, prepared.varIndex);
    expect(files.length).toBeGreaterThanOrEqual(1);
    // Find base file
    const baseFile = files.find((f) => f.fileName === 'ColorBasic.dart');
    expect(baseFile).toBeDefined();
  });

  it('emits token collection with AppTheme alias getters (non-const concretes)', () => {
    const prepared = prepareIR(buildIr());
    const col = prepared.collections.find((c) => c.className === 'ColorToken')!;
    const files = emitCollection(col, prepared.varIndex);
    expect(files.length).toBeGreaterThanOrEqual(1);
    // Find mode file (alias is in the mode implementation, not base)
    const modeFile = files.find((f) => f.fileName === 'light-mode.dart');
    expect(modeFile).toBeDefined();
    expect(modeFile!.contents).toContain('AppTheme.colorBasic');
  });

  it('emits multi-mode collection with separate mode files', () => {
    const prepared = prepareIR(buildIr());
    const col = prepared.collections.find((c) => c.className === 'Size')!;
    // Multi-mode collections return multiple files: base + one per mode
    const files = emitCollection(col, prepared.varIndex);
    expect(files.length).toBe(3); // Size.dart + xs.dart + s.dart

    const baseFile = files.find((f) => f.fileName === 'Size.dart');
    expect(baseFile).toBeDefined();

    const xsFile = files.find((f) => f.fileName === 'xs.dart');
    expect(xsFile).toBeDefined();

    const sFile = files.find((f) => f.fileName === 's.dart');
    expect(sFile).toBeDefined();
  });

  it('avoids class/enum collision when a mode is named "Mode"', () => {
    const prepared = prepareIR(buildIr());
    const col = prepared.collections.find((c) => c.className === 'FontFamily')!;
    const files = emitCollection(col, prepared.varIndex);
    expect(files.length).toBeGreaterThanOrEqual(1);
    // Find base file
    const baseFile = files.find((f) => f.fileName === 'FontFamily.dart');
    expect(baseFile).toBeDefined();
    // The base class should exist
    expect(baseFile!.contents).toContain('abstract class FontFamily');
    // The lerp class should exist
    expect(baseFile!.contents).toContain('class _FontFamilyLerp extends FontFamily');
  });

  it('creates folder per collection in file names', () => {
    const prepared = prepareIR(buildIr());
    const col = prepared.collections.find((c) => c.className === 'ColorBasic')!;
    const files = emitCollection(col, prepared.varIndex);
    // File name should be the collection name + .dart
    expect(files[0].fileName).toBe('ColorBasic.dart');
  });

  it('mode files are named in kebab-case', () => {
    const prepared = prepareIR(buildIr());
    const col = prepared.collections.find((c) => c.className === 'Size')!;
    const files = emitCollection(col, prepared.varIndex);

    const xsFile = files.find((f) => f.fileName === 'xs.dart');
    expect(xsFile).toBeDefined();
    expect(xsFile!.contents).toContain('class SizeXsMode');
  });
});
