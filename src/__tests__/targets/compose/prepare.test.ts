import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import {
  prepareCompose,
  inferKotlinType,
  type KotlinPrimitiveType,
} from '../../../targets/compose/generator/prepare';
import { buildSemanticGraph } from '../../../core/graph/build_graph';
import type { IR, IRVariable, VariableScope } from '../../../ir/types';
import type { ManifestTargetSection } from '../../../core/manifest';

const GOLDEN_IR: IR = JSON.parse(
  fs.readFileSync(
    path.resolve(__dirname, '../../../../test_fixtures/golden_tokens.json'),
    'utf-8',
  ),
);

describe('Compose Target Prepare Pipeline', () => {
  describe('inferKotlinType', () => {
    it('infers Color for COLOR type', () => {
      const v: IRVariable = {
        id: 'v:1',
        figmaName: 'color',
        groupPath: ['color'],
        type: 'COLOR',
        scopes: [],
        hiddenFromPublishing: false,
        emitToPublic: true,
        valuesByMode: {},
      };
      expect(inferKotlinType(v)).toBe('Color');
    });

    it('infers TextUnit for FLOAT variables with typography scopes', () => {
      const makeFloat = (scopes: VariableScope[]): IRVariable => ({
        id: 'v:1',
        figmaName: 'text',
        groupPath: ['text'],
        type: 'FLOAT',
        scopes,
        hiddenFromPublishing: false,
        emitToPublic: true,
        valuesByMode: {},
      });

      expect(inferKotlinType(makeFloat(['FONT_SIZE']))).toBe('TextUnit');
      expect(inferKotlinType(makeFloat(['LINE_HEIGHT']))).toBe('TextUnit');
      expect(inferKotlinType(makeFloat(['LETTER_SPACING']))).toBe('TextUnit');
    });

    it('infers Dp for FLOAT variables with dimension/spacing scopes', () => {
      const makeFloat = (scopes: VariableScope[]): IRVariable => ({
        id: 'v:1',
        figmaName: 'dim',
        groupPath: ['dim'],
        type: 'FLOAT',
        scopes,
        hiddenFromPublishing: false,
        emitToPublic: true,
        valuesByMode: {},
      });

      expect(inferKotlinType(makeFloat(['GAP']))).toBe('Dp');
      expect(inferKotlinType(makeFloat(['CORNER_RADIUS']))).toBe('Dp');
      expect(inferKotlinType(makeFloat(['WIDTH_HEIGHT']))).toBe('Dp');
      expect(inferKotlinType(makeFloat(['EFFECT_FLOAT']))).toBe('Dp');
    });

    it('infers Float for FLOAT variables with OPACITY scope', () => {
      const v: IRVariable = {
        id: 'v:1',
        figmaName: 'opacity',
        groupPath: ['opacity'],
        type: 'FLOAT',
        scopes: ['OPACITY'],
        hiddenFromPublishing: false,
        emitToPublic: true,
        valuesByMode: {},
      };
      expect(inferKotlinType(v)).toBe('Float');
    });

    it('falls back to Dp for unscoped or unknown FLOAT variables', () => {
      const v: IRVariable = {
        id: 'v:1',
        figmaName: 'size',
        groupPath: ['size'],
        type: 'FLOAT',
        scopes: ['ALL_SCOPES'],
        hiddenFromPublishing: false,
        emitToPublic: true,
        valuesByMode: {},
      };
      expect(inferKotlinType(v)).toBe('Dp');

      const unscoped: IRVariable = {
        ...v,
        scopes: [],
      };
      expect(inferKotlinType(unscoped)).toBe('Dp');
    });

    it('infers String and Boolean for STRING and BOOLEAN types', () => {
      const strVar: IRVariable = {
        id: 'v:1',
        figmaName: 'font',
        groupPath: ['font'],
        type: 'STRING',
        scopes: [],
        hiddenFromPublishing: false,
        emitToPublic: true,
        valuesByMode: {},
      };
      expect(inferKotlinType(strVar)).toBe('String');

      const boolVar: IRVariable = {
        id: 'v:2',
        figmaName: 'flag',
        groupPath: ['flag'],
        type: 'BOOLEAN',
        scopes: [],
        hiddenFromPublishing: false,
        emitToPublic: true,
        valuesByMode: {},
      };
      expect(inferKotlinType(boolVar)).toBe('Boolean');
    });
  });

  describe('prepareCompose execution', () => {
    it('maps variables to Kotlin types and preserves stable manifest identifiers', () => {
      const mockIR: IR = {
        version: '1.0',
        fileKey: 'test',
        generatedAt: '2026-10-23T00:00:00.000Z',
        collections: [
          {
            id: 'col:1',
            name: 'Color Tokens',
            kind: 'token',
            modes: [
              { id: 'm:1', name: 'Light' },
              { id: 'm:2', name: 'Dark' },
            ],
            variables: [
              {
                id: 'v:1',
                figmaName: 'brand/primary',
                groupPath: ['brand', 'primary'],
                type: 'COLOR',
                scopes: ['ALL_FILLS'],
                hiddenFromPublishing: false,
                emitToPublic: true,
                valuesByMode: {
                  'm:1': { kind: 'literal', value: { r: 0.1, g: 0.2, b: 0.8, a: 1.0 } },
                  'm:2': { kind: 'literal', value: { r: 0.2, g: 0.4, b: 0.9, a: 1.0 } },
                },
              },
            ],
          },
        ],
        composites: { paintStyles: [], effectStyles: [], textStyles: [] },
      };

      const graph = buildSemanticGraph(mockIR);
      const prepared = prepareCompose(graph, null);

      expect(prepared.targetId).toBe('compose');
      expect(prepared.collections).toHaveLength(1);

      const col = prepared.collections[0];
      expect(col.id).toBe('col:1');
      expect(col.name).toBe('Color Tokens');
      expect(col.className).toBe('ColorTokens');
      expect(col.accessor).toBe('colorTokens');
      expect(col.fileBaseName).toBe('ColorTokens');
      expect(col.modes).toHaveLength(2);
      expect(col.modes[0]).toEqual({
        id: 'm:1',
        name: 'Light',
        key: 'light',
        pascalName: 'Light',
      });

      expect(col.variables).toHaveLength(1);
      const variable = col.variables[0];
      expect(variable.id).toBe('v:1');
      expect(variable.propertyName).toBe('brandPrimary');
      expect(variable.kotlinType).toBe('Color');
      expect(variable.stableLeafKey).toBe('brandPrimary');

      // Check nextManifestSection
      expect(prepared.nextManifestSection).toBeDefined();
      expect(prepared.nextManifestSection.collections['col:1']).toBe('ColorTokens');
      expect(prepared.nextManifestSection.variables['v:1']).toBe('brandPrimary');
      expect(prepared.nextManifestSection.figmaNames?.variables?.['v:1']).toBe('brand/primary');
    });

    it('deduplicates sibling variables in collection colliding on derived property names', () => {
      const mockIR: IR = {
        version: '1.0',
        fileKey: 'test',
        generatedAt: '2026-10-23T00:00:00.000Z',
        collections: [
          {
            id: 'col:1',
            name: 'Colors',
            kind: 'token',
            modes: [{ id: 'm:1', name: 'Default' }],
            variables: [
              {
                id: 'v:1',
                figmaName: 'brand/primary',
                groupPath: ['brand', 'primary'],
                type: 'COLOR',
                scopes: [],
                hiddenFromPublishing: false,
                emitToPublic: true,
                valuesByMode: {
                  'm:1': { kind: 'literal', value: { r: 1, g: 0, b: 0, a: 1 } },
                },
              },
              {
                id: 'v:2',
                figmaName: 'brand-primary',
                groupPath: ['brand-primary'],
                type: 'COLOR',
                scopes: [],
                hiddenFromPublishing: false,
                emitToPublic: true,
                valuesByMode: {
                  'm:1': { kind: 'literal', value: { r: 0, g: 1, b: 0, a: 1 } },
                },
              },
            ],
          },
        ],
        composites: { paintStyles: [], effectStyles: [], textStyles: [] },
      };

      const graph = buildSemanticGraph(mockIR);
      const prepared = prepareCompose(graph, null);

      expect(prepared.collections[0].variables).toHaveLength(2);
      const v1 = prepared.collections[0].variables.find((v) => v.id === 'v:1')!;
      const v2 = prepared.collections[0].variables.find((v) => v.id === 'v:2')!;

      expect(v1.propertyName).toBe('brandPrimary');
      expect(v2.propertyName).toBe('brandPrimary2');
      expect(prepared.nextManifestSection.variables['v:1']).toBe('brandPrimary');
      expect(prepared.nextManifestSection.variables['v:2']).toBe('brandPrimary2');

      expect(prepared.warnings.some((w) => w.code === 'DUPLICATE_LEAF_NAME')).toBe(true);
    });

    it('preserves existing manifest stable variable names across re-exports', () => {
      const mockIR: IR = {
        version: '1.0',
        fileKey: 'test',
        generatedAt: '2026-10-23T00:00:00.000Z',
        collections: [
          {
            id: 'col:1',
            name: 'Tokens',
            kind: 'token',
            modes: [{ id: 'm:1', name: 'Default' }],
            variables: [
              {
                id: 'v:renamed',
                figmaName: 'brand/renamed_accent',
                groupPath: ['brand', 'renamed_accent'],
                type: 'COLOR',
                scopes: [],
                hiddenFromPublishing: false,
                emitToPublic: true,
                valuesByMode: {
                  'm:1': { kind: 'literal', value: { r: 0.5, g: 0.5, b: 0.5, a: 1 } },
                },
              },
            ],
          },
        ],
        composites: { paintStyles: [], effectStyles: [], textStyles: [] },
      };

      const existingSection: ManifestTargetSection = {
        variables: {
          'v:renamed': 'brandPrimaryLegacy',
        },
        collections: {
          'col:1': 'OriginalTokensClass',
        },
        composites: {},
        figmaNames: {
          variables: { 'v:renamed': 'brand/primary' },
          collections: { 'col:1': 'Tokens' },
          composites: {},
        },
      };

      const graph = buildSemanticGraph(mockIR);
      const prepared = prepareCompose(graph, existingSection);

      expect(prepared.collections[0].className).toBe('OriginalTokensClass');
      expect(prepared.collections[0].variables[0].propertyName).toBe('brandPrimaryLegacy');
      expect(prepared.collections[0].variables[0].stableLeafKey).toBe('brandPrimaryLegacy');
      expect(prepared.nextManifestSection.variables['v:renamed']).toBe('brandPrimaryLegacy');
    });

    it('escapes Kotlin reserved keywords in property names and records warning', () => {
      const mockIR: IR = {
        version: '1.0',
        fileKey: 'test',
        generatedAt: '2026-10-23T00:00:00.000Z',
        collections: [
          {
            id: 'col:1',
            name: 'Tokens',
            kind: 'token',
            modes: [{ id: 'm:1', name: 'Default' }],
            variables: [
              {
                id: 'v:val',
                figmaName: 'val',
                groupPath: ['val'],
                type: 'STRING',
                scopes: [],
                hiddenFromPublishing: false,
                emitToPublic: true,
                valuesByMode: {
                  'm:1': { kind: 'literal', value: 'hello' },
                },
              },
            ],
          },
        ],
        composites: { paintStyles: [], effectStyles: [], textStyles: [] },
      };

      const graph = buildSemanticGraph(mockIR);
      const prepared = prepareCompose(graph, null);

      expect(prepared.collections[0].variables[0].propertyName).toBe('`val`');
      expect(prepared.warnings.some((w) => w.code === 'KEYWORD_CONFLICT')).toBe(true);
    });

    it('prepares paint, effect, and text styles with deduplicated getters', () => {
      const mockIR: IR = {
        version: '1.0',
        fileKey: 'test',
        generatedAt: '2026-10-23T00:00:00.000Z',
        collections: [],
        composites: {
          paintStyles: [
            {
              id: 'p:1',
              figmaName: 'Primary Gradient',
              groupPath: ['Primary Gradient'],
              type: 'GRADIENT_LINEAR',
              stops: [
                { position: 0, color: { kind: 'literal', rgba: { r: 1, g: 0, b: 0, a: 1 } } },
                { position: 1, color: { kind: 'literal', rgba: { r: 0, g: 0, b: 1, a: 1 } } },
              ],
              angleRadians: 0,
            },
            {
              id: 'p:2',
              figmaName: 'Primary-Gradient',
              groupPath: ['Primary-Gradient'],
              type: 'GRADIENT_LINEAR',
              stops: [
                { position: 0, color: { kind: 'literal', rgba: { r: 0, g: 1, b: 0, a: 1 } } },
              ],
              angleRadians: 0,
            },
          ],
          effectStyles: [
            {
              id: 'e:1',
              figmaName: 'Card Elevation',
              groupPath: ['Card Elevation'],
              type: 'DROP_SHADOW',
              color: { kind: 'literal', rgba: { r: 0, g: 0, b: 0, a: 0.2 } },
              offsetX: 0,
              offsetY: 4,
              blurRadius: 8,
              spreadRadius: 0,
            },
          ],
          textStyles: [
            {
              id: 't:1',
              figmaName: 'Heading 1',
              groupPath: ['Heading 1'],
              fontFamily: { kind: 'literal', value: 'Inter' },
              fontWeight: { kind: 'literal', value: 700 },
              fontSize: { kind: 'literal', value: 32 },
              lineHeight: { kind: 'literal', value: 40, unit: 'PIXELS' },
              letterSpacing: { kind: 'literal', value: 0, unit: 'PIXELS' },
            },
          ],
        },
      };

      const graph = buildSemanticGraph(mockIR);
      const prepared = prepareCompose(graph, null);

      expect(prepared.paintStyles).toHaveLength(2);
      expect(prepared.paintStyles[0].getterName).toBe('primaryGradient');
      expect(prepared.paintStyles[1].getterName).toBe('primaryGradient2');

      expect(prepared.effectStyles).toHaveLength(1);
      expect(prepared.effectStyles[0].getterName).toBe('cardElevation');

      expect(prepared.textStyles).toHaveLength(1);
      expect(prepared.textStyles[0].getterName).toBe('heading1');

      expect(prepared.nextManifestSection.composites?.['p:1']).toBe('primaryGradient');
      expect(prepared.nextManifestSection.composites?.['p:2']).toBe('primaryGradient2');
      expect(prepared.nextManifestSection.composites?.['e:1']).toBe('cardElevation');
      expect(prepared.nextManifestSection.composites?.['t:1']).toBe('heading1');
    });

    it('prepares golden tokens fixture and maintains idempotency across re-exports', () => {
      const graph = buildSemanticGraph(GOLDEN_IR);
      const run1 = prepareCompose(graph, null);

      expect(run1.collections.length).toBeGreaterThan(0);
      expect(run1.nextManifestSection).toBeDefined();

      const run2 = prepareCompose(graph, run1.nextManifestSection);

      expect(run2.nextManifestSection.variables).toEqual(
        run1.nextManifestSection.variables,
      );
      expect(run2.nextManifestSection.collections).toEqual(
        run1.nextManifestSection.collections,
      );
      expect(run2.nextManifestSection.composites).toEqual(
        run1.nextManifestSection.composites,
      );
    });
  });
});
