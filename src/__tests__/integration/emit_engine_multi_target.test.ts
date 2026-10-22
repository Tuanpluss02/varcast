/**
 * Multi-target emit engine test.
 * Runs runEngine() with both Flutter and React Native targets simultaneously
 * and asserts that output files are namespaced, manifest is complete,
 * and no cross-target path collisions exist.
 */

import { describe, it, expect, beforeAll } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import { validate } from '../../ir/validate';
import { runEngine } from '../../core/emit_engine';
import { buildSemanticGraph } from '../../core/graph/build_graph';
import { flutterTarget } from '../../targets/flutter';
import { reactNativeTarget } from '../../targets/react_native';
import type { IR } from '../../ir/types';
import type { EngineOutput } from '../../core/emit_engine';

const IR_PATH = path.resolve(__dirname, '../../../test_fixtures/ir.json');
const ir: IR = JSON.parse(fs.readFileSync(IR_PATH, 'utf-8'));

describe('Emit engine: multi-target simultaneous run', () => {
  let output: EngineOutput;

  beforeAll(() => {
    const result = validate(ir);
    expect(result.errors).toHaveLength(0);
    output = runEngine(ir, [flutterTarget, reactNativeTarget], null, {
      flutter: { packageName: 'design_system' },
      react_native: { packageName: 'design-system' },
    });
  });

  it('produces a non-empty combined file list', () => {
    expect(output.files.length).toBeGreaterThan(0);
  });

  it('flutter output files are namespaced under flutter/ prefix', () => {
    const flutterFiles = output.files.filter((f) => f.path.startsWith('flutter/'));
    expect(flutterFiles.length).toBeGreaterThan(0);
  });

  it('react_native output files are namespaced under react_native/ prefix', () => {
    const rnFiles = output.files.filter((f) => f.path.startsWith('react_native/'));
    expect(rnFiles.length).toBeGreaterThan(0);
  });

  it('flutter namespace contains pubspec.yaml', () => {
    const paths = output.files.map((f) => f.path);
    expect(paths).toContain('flutter/pubspec.yaml');
  });

  it('flutter namespace contains lib/src/theme.dart', () => {
    const paths = output.files.map((f) => f.path);
    expect(paths).toContain('flutter/lib/src/theme.dart');
  });

  it('react_native namespace contains package.json', () => {
    const paths = output.files.map((f) => f.path);
    expect(paths).toContain('react_native/package.json');
  });

  it('react_native namespace contains src/index.ts', () => {
    const paths = output.files.map((f) => f.path);
    expect(paths).toContain('react_native/src/index.ts');
  });

  it('manifest contains flutter target section', () => {
    expect(output.nextManifest.targets['flutter']).toBeDefined();
  });

  it('manifest contains react_native target section', () => {
    expect(output.nextManifest.targets['react_native']).toBeDefined();
  });

  it('no cross-target file path collisions exist', () => {
    const paths = output.files.map((f) => f.path);
    const unique = new Set(paths);
    expect(unique.size).toBe(paths.length);
  });

  it('every file path starts with a known target prefix', () => {
    const knownPrefixes = ['flutter/', 'react_native/'];
    for (const file of output.files) {
      const hasKnownPrefix = knownPrefixes.some((prefix) => file.path.startsWith(prefix));
      expect(hasKnownPrefix, `Unexpected path without target prefix: ${file.path}`).toBe(true);
    }
  });

  it('all output files have non-empty string contents', () => {
    for (const file of output.files) {
      expect(typeof file.contents).toBe('string');
      expect(file.contents.trim().length, `Empty contents for: ${file.path}`).toBeGreaterThan(0);
    }
  });

  it('flutter and react_native file sets are disjoint', () => {
    const flutterPaths = new Set(
      output.files.filter((f) => f.path.startsWith('flutter/')).map((f) => f.path),
    );
    const rnPaths = new Set(
      output.files.filter((f) => f.path.startsWith('react_native/')).map((f) => f.path),
    );
    for (const p of flutterPaths) {
      expect(rnPaths.has(p)).toBe(false);
    }
  });

  it('nextManifest.fileKey matches ir.fileKey', () => {
    expect(output.nextManifest.fileKey).toBe(ir.fileKey);
  });

  it('computes diffsByTarget for each executed target', () => {
    expect(output.diffsByTarget).toBeDefined();
    expect(output.diffsByTarget['flutter']).toBeDefined();
    expect(output.diffsByTarget['react_native']).toBeDefined();
    expect(output.diffsByTarget['flutter'].variables.added.length).toBeGreaterThan(0);
    expect(output.diffsByTarget['react_native'].variables.added.length).toBeGreaterThan(0);
  });

  it('accepts target IDs as strings and produces identical output', () => {
    const stringOutput = runEngine(ir, ['flutter', 'react_native'], null, {
      flutter: { packageName: 'design_system' },
      react_native: { packageName: 'design-system' },
    });
    expect(stringOutput.files.map((f) => f.path)).toEqual(output.files.map((f) => f.path));
    expect(stringOutput.nextManifest.fileKey).toBe(output.nextManifest.fileKey);
    expect(stringOutput.diffsByTarget['flutter'].variables.added.length).toBe(
      output.diffsByTarget['flutter'].variables.added.length,
    );
  });

  it('preserves unselected target manifest sections when running a subset', () => {
    // Re-run with flutter only, passing previous nextManifest
    const flutterOnlyOutput = runEngine(ir, ['flutter'], output.nextManifest, {
      flutter: { packageName: 'design_system' },
    });
    // Flutter section updated
    expect(flutterOnlyOutput.nextManifest.targets['flutter']).toBeDefined();
    // React Native section preserved from previous manifest
    expect(flutterOnlyOutput.nextManifest.targets['react_native']).toBeDefined();
    expect(flutterOnlyOutput.nextManifest.targets['react_native']).toEqual(
      output.nextManifest.targets['react_native'],
    );
    // Single target emit produces unprefixed paths
    expect(flutterOnlyOutput.files.every((f) => !f.path.startsWith('flutter/'))).toBe(true);
    expect(flutterOnlyOutput.diffsByTarget['flutter'].variables.added).toHaveLength(0); // no changes
  });

  it('accepts pre-built SemanticTokenGraph directly', () => {
    const graph = buildSemanticGraph(ir);
    const graphOutput = runEngine(graph, [flutterTarget, reactNativeTarget], null, {
      flutter: { packageName: 'design_system' },
      react_native: { packageName: 'design-system' },
    });
    expect(graphOutput.files.length).toBe(output.files.length);
    expect(graphOutput.nextManifest.fileKey).toBe(ir.fileKey);
  });
});
