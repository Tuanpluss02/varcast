import { describe, expect, it } from 'vitest';
import type { IR } from '../../../ir/types';
import { buildSemanticGraph } from '../../../core/graph/build_graph';
import { getTarget, hasTarget } from '../../../core/registry/target_registry';
import {
  composeTarget,
  registerComposeTarget,
  type ComposeOptions,
  type PreparedCompose,
} from '../../../targets/compose';

function createSampleIR(): IR {
  return {
    version: '1.0',
    fileKey: 'sample-compose-target-ir',
    generatedAt: new Date(0).toISOString(),
    collections: [
      {
        id: 'col:primitive',
        name: 'Primitives',
        kind: 'primitive',
        modes: [{ id: 'm:default', name: 'Default' }],
        variables: [
          {
            id: 'v:blue',
            figmaName: 'blue_500',
            groupPath: ['blue_500'],
            type: 'COLOR',
            scopes: ['ALL_FILLS'],
            hiddenFromPublishing: false,
            emitToPublic: true,
            valuesByMode: {
              'm:default': {
                kind: 'literal',
                value: { r: 0.1, g: 0.5, b: 0.9, a: 1.0 },
              },
            },
          },
        ],
      },
      {
        id: 'col:tokens',
        name: 'Tokens',
        kind: 'token',
        modes: [
          { id: 'm:light', name: 'Light' },
          { id: 'm:dark', name: 'Dark' },
        ],
        variables: [
          {
            id: 'v:bg',
            figmaName: 'bg_surface',
            groupPath: ['bg_surface'],
            type: 'COLOR',
            scopes: ['ALL_FILLS'],
            hiddenFromPublishing: false,
            emitToPublic: true,
            valuesByMode: {
              'm:light': { kind: 'alias', targetVariableId: 'v:blue' },
              'm:dark': {
                kind: 'literal',
                value: { r: 0.05, g: 0.05, b: 0.1, a: 1.0 },
              },
            },
          },
        ],
      },
    ],
    composites: {
      paintStyles: [
        {
          id: 'ps:brand',
          figmaName: 'Brand/Primary',
          groupPath: ['Brand', 'Primary'],
          type: 'SOLID',
          color: {
            kind: 'literal',
            rgba: { r: 0.1, g: 0.5, b: 0.9, a: 1.0 },
          },
        },
      ],
      effectStyles: [],
      textStyles: [],
    },
  };
}

describe('Compose Target Assembly & Registry', () => {
  it('registers composeTarget in TargetRegistry on module load', () => {
    registerComposeTarget();
    expect(hasTarget('compose')).toBe(true);
    const target = getTarget<ComposeOptions, PreparedCompose>('compose');
    expect(target).toBe(composeTarget);
    expect(target.id).toBe('compose');
    expect(target.displayName).toBe('Jetpack Compose');
    expect(target.defaultPackageName).toBe('com.example.designsystem');
  });

  it('provides package name sanitization via target.sanitizePackageName', () => {
    expect(composeTarget.sanitizePackageName?.('My App.Tokens#1')).toBe(
      'my_app.tokens_1',
    );
    expect(composeTarget.sanitizePackageName?.('')).toBe(
      'com.example.designsystem',
    );
  });

  it('validates options via target.validateOptions', () => {
    expect(composeTarget.validateOptions?.(null)).toBeNull();
    expect(composeTarget.validateOptions?.({})).toBeNull();
    expect(composeTarget.validateOptions?.('invalid' as unknown)).toEqual([
      'Compose options must be an object',
    ]);
  });

  it('normalizes options via target.normalizeOptions', () => {
    const norm = composeTarget.normalizeOptions?.({
      packageName: 'org.mybrand.ui',
      include: { primitives: false },
    });
    expect(norm).toBeDefined();
    expect(norm?.packageName).toBe('org.mybrand.ui');
    expect(norm?.include.primitives).toBe(false);
    expect(norm?.include.tokens).toBe(true);
    expect(norm?.include.composites.colorStyles).toBe(true);
  });

  it('prepares and emits full package with all expected files', () => {
    const ir = createSampleIR();
    const graph = buildSemanticGraph(ir);
    const prepared = composeTarget.prepare(graph, null, {
      packageName: 'com.acme.designsystem',
      include: {
        primitives: true,
        tokens: true,
        composites: { colorStyles: true, shadows: true, textStyles: true },
      },
    });

    expect(prepared.targetId).toBe('compose');
    expect(prepared.collections).toHaveLength(2);
    expect(prepared.paintStyles).toHaveLength(1);
    expect(prepared.nextManifestSection).toBeDefined();

    const files = composeTarget.emit(prepared, {
      packageName: 'com.acme.designsystem',
      include: {
        primitives: true,
        tokens: true,
        composites: { colorStyles: true, shadows: true, textStyles: true },
      },
    });

    const paths = files.map((f) => f.path);

    // Root static files
    expect(paths).toContain('build.gradle.kts');
    expect(paths).toContain('src/main/AndroidManifest.xml');
    expect(paths).toContain('README.md');

    // Collections
    expect(paths).toContain(
      'src/main/kotlin/com/acme/designsystem/collections/Primitives.kt',
    );
    expect(paths).toContain(
      'src/main/kotlin/com/acme/designsystem/collections/Tokens.kt',
    );

    // Composites
    expect(paths).toContain(
      'src/main/kotlin/com/acme/designsystem/composites/ColorStyles.kt',
    );
    expect(paths).toContain(
      'src/main/kotlin/com/acme/designsystem/composites/TextStyles.kt',
    );
    expect(paths).toContain(
      'src/main/kotlin/com/acme/designsystem/composites/Shadows.kt',
    );

    // Runtime Theming
    expect(paths).toContain(
      'src/main/kotlin/com/acme/designsystem/theme/ThemeMode.kt',
    );
    expect(paths).toContain(
      'src/main/kotlin/com/acme/designsystem/theme/DesignSystemController.kt',
    );
    expect(paths).toContain(
      'src/main/kotlin/com/acme/designsystem/theme/Theme.kt',
    );
    expect(paths).toContain(
      'src/main/kotlin/com/acme/designsystem/theme/AppTheme.kt',
    );
  });

  it('filters collections based on include.primitives and include.tokens', () => {
    const ir = createSampleIR();
    const graph = buildSemanticGraph(ir);
    const prepared = composeTarget.prepare(graph, null);

    // Filter out primitives
    const filesNoPrimitives = composeTarget.emit(prepared, {
      packageName: 'com.acme.ds',
      include: {
        primitives: false,
        tokens: true,
        composites: { colorStyles: true, shadows: true, textStyles: true },
      },
    });
    const pathsNoPrimitives = filesNoPrimitives.map((f) => f.path);
    expect(pathsNoPrimitives).not.toContain(
      'src/main/kotlin/com/acme/ds/collections/Primitives.kt',
    );
    expect(pathsNoPrimitives).toContain(
      'src/main/kotlin/com/acme/ds/collections/Tokens.kt',
    );

    // Filter out tokens
    const filesNoTokens = composeTarget.emit(prepared, {
      packageName: 'com.acme.ds',
      include: {
        primitives: true,
        tokens: false,
        composites: { colorStyles: true, shadows: true, textStyles: true },
      },
    });
    const pathsNoTokens = filesNoTokens.map((f) => f.path);
    expect(pathsNoTokens).toContain(
      'src/main/kotlin/com/acme/ds/collections/Primitives.kt',
    );
    expect(pathsNoTokens).not.toContain(
      'src/main/kotlin/com/acme/ds/collections/Tokens.kt',
    );
  });

  it('filters collections based on include.collections list', () => {
    const ir = createSampleIR();
    const graph = buildSemanticGraph(ir);
    const prepared = composeTarget.prepare(graph, null);

    const filesSelected = composeTarget.emit(prepared, {
      packageName: 'com.acme.ds',
      include: {
        primitives: true,
        tokens: true,
        composites: { colorStyles: true, shadows: true, textStyles: true },
        collections: ['col:primitive'],
      },
    });
    const pathsSelected = filesSelected.map((f) => f.path);
    expect(pathsSelected).toContain(
      'src/main/kotlin/com/acme/ds/collections/Primitives.kt',
    );
    expect(pathsSelected).not.toContain(
      'src/main/kotlin/com/acme/ds/collections/Tokens.kt',
    );
  });

  it('filters composites based on include.composites flags', () => {
    const ir = createSampleIR();
    const graph = buildSemanticGraph(ir);
    const prepared = composeTarget.prepare(graph, null);

    const filesNoComposites = composeTarget.emit(prepared, {
      packageName: 'com.acme.ds',
      include: {
        primitives: true,
        tokens: true,
        composites: { colorStyles: false, shadows: false, textStyles: false },
      },
    });
    const paths = filesNoComposites.map((f) => f.path);
    expect(paths).not.toContain(
      'src/main/kotlin/com/acme/ds/composites/ColorStyles.kt',
    );
    expect(paths).not.toContain(
      'src/main/kotlin/com/acme/ds/composites/TextStyles.kt',
    );
    expect(paths).not.toContain(
      'src/main/kotlin/com/acme/ds/composites/Shadows.kt',
    );
  });
});
