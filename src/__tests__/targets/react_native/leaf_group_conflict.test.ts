import { describe, it, expect } from 'vitest';
import { prepareRN } from '../../../targets/react_native/generator/prepare';
import { reactNativeTarget } from '../../../targets/react_native';
import { setDeep } from '../../../targets/react_native/generator/emit_collections';
import type { IR } from '../../../ir/types';

describe('React Native Intermediate Group vs Leaf Conflict Guard', () => {
  it('detects and renames leaf that collides with an intermediate group path', () => {
    const irWithConflict: IR = {
      version: '1.0',
      fileKey: 'key',
      generatedAt: '2026-10-21T00:00:00.000Z',
      collections: [
        {
          id: 'col_1',
          name: 'Buttons',
          kind: 'token',
          modes: [{ id: 'm1', name: 'Default' }],
          variables: [
            // Variable 1: button/primary (leaf 'primary' under group 'button')
            {
              id: 'v1',
              figmaName: 'button/primary',
              type: 'COLOR',
              groupPath: ['button', 'primary'],
              scopes: [],
              hiddenFromPublishing: false,
              emitToPublic: true,
              valuesByMode: { m1: { kind: 'literal', value: { r: 1, g: 0, b: 0, a: 1 } } },
            },
            // Variable 2: button/primary/background (leaf 'background' under group 'button', 'primary')
            {
              id: 'v2',
              figmaName: 'button/primary/background',
              type: 'COLOR',
              groupPath: ['button', 'primary', 'background'],
              scopes: [],
              hiddenFromPublishing: false,
              emitToPublic: true,
              valuesByMode: { m1: { kind: 'literal', value: { r: 0, g: 1, b: 0, a: 1 } } },
            },
          ],
        },
      ],
      composites: { paintStyles: [], effectStyles: [], textStyles: [] },
    };

    const prepared = prepareRN(irWithConflict, null);
    // Variable 1 should have been renamed to avoid conflicting with the intermediate group 'button/primary'
    const v1Prepared = prepared.collections[0].variables.find((v) => v.id === 'v1');
    expect(v1Prepared?.leafKey).toBe('primaryValue');

    // Should have logged a warning
    expect(
      prepared.warnings?.some((w) => w.code === 'LEAF_GROUP_CONFLICT'),
    ).toBe(true);

    // reactNativeTarget.emit should succeed without throwing
    const emitted = reactNativeTarget.emit(prepared);
    expect(emitted.length).toBeGreaterThan(0);
  });

  describe('setDeep fail-fast guard', () => {
    it('throws descriptive error if path segment is already a primitive', () => {
      const obj: Record<string, any> = {
        color: 'red', // color is a primitive string
      };
      expect(() => {
        setDeep(obj, ['color'], 'primary', '#ff0000');
      }).toThrow(/Path segment "color" in path "color.primary" is already set to a primitive value/);
    });

    it('throws descriptive error if leaf attempts to overwrite existing container object', () => {
      const obj: Record<string, any> = {
        button: {
          primary: { background: 'blue' }, // button.primary is an object
        },
      };
      expect(() => {
        setDeep(obj, ['button'], 'primary', '#ff0000');
      }).toThrow(/Leaf "primary" in path "button.primary" cannot overwrite an existing group object/);
    });
  });
});
