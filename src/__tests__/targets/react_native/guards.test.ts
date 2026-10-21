import { describe, expect, it } from 'vitest';
import type { IR } from '../../../ir/types';
import { isJsReservedWord } from '../../../targets/react_native/reserved';
import { prepareRN } from '../../../targets/react_native/generator/prepare';
import { reactNativeTarget } from '../../../targets/react_native';

describe('React Native Target Hardening: Reserved Word Guards', () => {
  it('correctly identifies JavaScript reserved keywords', () => {
    const reserved = [
      'break', 'case', 'catch', 'class', 'const', 'continue', 'debugger',
      'default', 'delete', 'do', 'else', 'export', 'extends', 'finally',
      'for', 'function', 'if', 'import', 'in', 'instanceof', 'new',
      'return', 'super', 'switch', 'this', 'throw', 'try', 'typeof',
      'var', 'void', 'while', 'with', 'yield', 'let', 'static', 'enum',
      'await', 'implements', 'package', 'protected', 'interface', 'private', 'public',
      'null', 'true', 'false',
    ];

    for (const word of reserved) {
      expect(isJsReservedWord(word)).toBe(true);
    }
  });

  it('returns false for regular identifiers', () => {
    const validIdentifiers = [
      'color', 'primary', 'tokens', 'defaultTokens', 'myClass', 'brandColors',
      'neutral900', 'surfaceLight', 'typography', 'component',
    ];

    for (const word of validIdentifiers) {
      expect(isJsReservedWord(word)).toBe(false);
    }
  });

  it('escapes collection named "Default" to "defaultTokens" and emits warning', () => {
    const ir: IR = {
      version: '1.0',
      fileKey: 'test-file',
      generatedAt: new Date(0).toISOString(),
      collections: [
        {
          id: 'col:default',
          name: 'Default',
          kind: 'token',
          modes: [{ id: 'm:1', name: 'Mode 1' }],
          variables: [
            {
              id: 'v:1',
              figmaName: 'color/primary',
              groupPath: ['color', 'primary'],
              type: 'COLOR',
              scopes: ['ALL_FILLS'],
              hiddenFromPublishing: false,
              emitToPublic: true,
              valuesByMode: {
                'm:1': { kind: 'literal', value: { r: 1, g: 0, b: 0, a: 1 } },
              },
            },
          ],
        },
      ],
      composites: { paintStyles: [], effectStyles: [], textStyles: [] },
    };

    const prepared = prepareRN(ir);

    expect(prepared.collections[0].exportName).toBe('defaultTokens');
    expect(prepared.warnings).toBeDefined();

    const reservedWarning = prepared.warnings?.find(
      (w) => w.code === 'RESERVED_WORD_ESCAPED',
    );
    expect(reservedWarning).toBeDefined();
    expect(reservedWarning).toEqual({
      targetId: 'react_native',
      code: 'RESERVED_WORD_ESCAPED',
      message: 'Collection export name "Default" is a JavaScript reserved word; escaped to "defaultTokens".',
    });

    const emitted = reactNativeTarget.emit(prepared);
    const colFile = emitted.find((f) => f.path.includes('default.ts'));
    expect(colFile).toBeDefined();
    expect(colFile!.contents).toContain('export const defaultTokens =');
    expect(colFile!.contents).not.toContain('export const default =');

    const runtimeTheme = emitted.find((f) => f.path.includes('createTheme.ts'));
    expect(runtimeTheme).toBeDefined();
    expect(runtimeTheme!.contents).toContain("import { defaultTokens } from '../tokens/tokens/default';");
  });
});

describe('React Native Target Hardening: Sibling Key Deduplication', () => {
  it('deduplicates colliding leaf names under the same group path into distinct keys (main, main2)', () => {
    const ir: IR = {
      version: '1.0',
      fileKey: 'test-file',
      generatedAt: new Date(0).toISOString(),
      collections: [
        {
          id: 'col:colors',
          name: 'Colors',
          kind: 'token',
          modes: [{ id: 'm:1', name: 'Mode 1' }],
          variables: [
            {
              id: 'v:main1',
              figmaName: 'color/brand/main',
              groupPath: ['color', 'brand', 'main'],
              type: 'COLOR',
              scopes: ['ALL_FILLS'],
              hiddenFromPublishing: false,
              emitToPublic: true,
              valuesByMode: {
                'm:1': { kind: 'literal', value: { r: 1, g: 0, b: 0, a: 1 } },
              },
            },
            {
              id: 'v:main2',
              figmaName: 'color/brand/main',
              groupPath: ['color', 'brand', 'main'],
              type: 'COLOR',
              scopes: ['ALL_FILLS'],
              hiddenFromPublishing: false,
              emitToPublic: true,
              valuesByMode: {
                'm:1': { kind: 'literal', value: { r: 0, g: 1, b: 0, a: 1 } },
              },
            },
            {
              id: 'v:main3',
              figmaName: 'color/other/main',
              groupPath: ['color', 'other', 'main'],
              type: 'COLOR',
              scopes: ['ALL_FILLS'],
              hiddenFromPublishing: false,
              emitToPublic: true,
              valuesByMode: {
                'm:1': { kind: 'literal', value: { r: 0, g: 0, b: 1, a: 1 } },
              },
            },
          ],
        },
      ],
      composites: { paintStyles: [], effectStyles: [], textStyles: [] },
    };

    const prepared = prepareRN(ir);
    const col = prepared.collections[0];

    const var1 = col.variables.find((v) => v.id === 'v:main1')!;
    const var2 = col.variables.find((v) => v.id === 'v:main2')!;
    const var3 = col.variables.find((v) => v.id === 'v:main3')!;

    expect(var1.stableLeafKey).toBe('main');
    expect(var2.stableLeafKey).toBe('main2');
    expect(var3.stableLeafKey).toBe('main');

    const emitted = reactNativeTarget.emit(prepared);
    const colFile = emitted.find((f) => f.path.includes('colors.ts'))!;
    expect(colFile).toBeDefined();

    expect(colFile.contents).toContain('"main": "#FF0000FF"');
    expect(colFile.contents).toContain('"main2": "#00FF00FF"');
  });
});

describe('React Native Target Hardening: Warnings Diagnostic Output', () => {
  it('outputs non-empty warnings when unresolvable aliases occur', () => {
    const ir: IR = {
      version: '1.0',
      fileKey: 'test-file',
      generatedAt: new Date(0).toISOString(),
      collections: [
        {
          id: 'col:tokens',
          name: 'Tokens',
          kind: 'token',
          modes: [{ id: 'm:1', name: 'Mode 1' }],
          variables: [
            {
              id: 'v:alias',
              figmaName: 'color/alias',
              groupPath: ['color', 'alias'],
              type: 'COLOR',
              scopes: ['ALL_FILLS'],
              hiddenFromPublishing: false,
              emitToPublic: true,
              valuesByMode: {
                'm:1': { kind: 'alias', targetVariableId: 'v:nonexistent' },
              },
            },
          ],
        },
      ],
      composites: { paintStyles: [], effectStyles: [], textStyles: [] },
    };

    const prepared = prepareRN(ir);

    expect(prepared.warnings).toBeDefined();
    expect(prepared.warnings!.length).toBeGreaterThan(0);

    const aliasWarning = prepared.warnings!.find((w) => w.code === 'UNRESOLVED_ALIAS');
    expect(aliasWarning).toBeDefined();
    expect(aliasWarning!.targetId).toBe('react_native');
    expect(aliasWarning!.details?.targetId).toBe('v:nonexistent');
  });

  it('outputs non-empty warnings when unsupported effect styles occur', () => {
    const ir: IR = {
      version: '1.0',
      fileKey: 'test-file',
      generatedAt: new Date(0).toISOString(),
      collections: [
        {
          id: 'col:base',
          name: 'Base',
          kind: 'primitive',
          modes: [{ id: 'm:1', name: 'Mode 1' }],
          variables: [],
        },
      ],
      composites: {
        paintStyles: [],
        effectStyles: [
          {
            id: 'fx:inner',
            figmaName: 'Inner Glow',
            groupPath: ['Inner Glow'],
            type: 'INNER_SHADOW',
            offsetX: 0,
            offsetY: 2,
            blurRadius: 4,
            spreadRadius: 0,
            color: { kind: 'literal', rgba: { r: 0, g: 0, b: 0, a: 0.5 } },
          },
        ],
        textStyles: [],
      },
    };

    const prepared = prepareRN(ir);

    expect(prepared.warnings).toBeDefined();
    expect(prepared.warnings!.length).toBeGreaterThan(0);

    const effectWarning = prepared.warnings!.find((w) => w.code === 'UNSUPPORTED_EFFECT');
    expect(effectWarning).toBeDefined();
    expect(effectWarning!.targetId).toBe('react_native');
    expect(effectWarning!.details?.type).toBe('INNER_SHADOW');
  });
});
