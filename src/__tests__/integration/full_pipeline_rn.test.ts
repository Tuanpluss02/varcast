/**
 * Full pipeline integration test: React Native target.
 * Loads the real test_fixtures/ir.json, validates it, runs the engine,
 * and asserts structural correctness of the output.
 */

import { describe, it, expect, beforeAll } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import { validate } from '../../ir/validate';
import { runEngine } from '../../core/emit_engine';
import { reactNativeTarget } from '../../targets/react_native';
import type { IR } from '../../ir/types';
import type { EngineOutput } from '../../core/emit_engine';

const IR_PATH = path.resolve(__dirname, '../../../test_fixtures/ir.json');
const ir: IR = JSON.parse(fs.readFileSync(IR_PATH, 'utf-8'));

describe('Full pipeline: React Native target', () => {
  let output: EngineOutput;

  beforeAll(() => {
    const result = validate(ir);
    expect(result.errors).toHaveLength(0);
    output = runEngine(ir, [reactNativeTarget], null, {
      react_native: { packageName: 'design-system' },
    });
  });

  it('produces a non-empty file list', () => {
    expect(output.files.length).toBeGreaterThan(0);
  });

  it('contains package.json', () => {
    const paths = output.files.map((f) => f.path);
    expect(paths).toContain('package.json');
  });

  it('contains src/index.ts', () => {
    const paths = output.files.map((f) => f.path);
    expect(paths).toContain('src/index.ts');
  });

  it('contains src/runtime/ThemeProvider.tsx', () => {
    const paths = output.files.map((f) => f.path);
    expect(paths).toContain('src/runtime/ThemeProvider.tsx');
  });

  it('contains src/runtime/modes.ts', () => {
    const paths = output.files.map((f) => f.path);
    expect(paths).toContain('src/runtime/modes.ts');
  });

  it('contains composite files', () => {
    const paths = output.files.map((f) => f.path);
    expect(paths).toContain('src/composites/colorStyles.ts');
    expect(paths).toContain('src/composites/shadows.ts');
    expect(paths).toContain('src/composites/textStyles.ts');
  });

  it('all output files have non-empty string contents', () => {
    for (const file of output.files) {
      expect(typeof file.contents).toBe('string');
      expect(file.contents.trim().length).toBeGreaterThan(0);
    }
  });

  it('has no duplicate file paths in output', () => {
    const paths = output.files.map((f) => f.path);
    const unique = new Set(paths);
    expect(unique.size).toBe(paths.length);
  });

  it('nextManifest is non-null and contains react_native target section', () => {
    expect(output.nextManifest).not.toBeNull();
    expect(output.nextManifest.version).toBe('2.0');
    expect(output.nextManifest.targets).toBeDefined();
    expect(output.nextManifest.targets['react_native']).toBeDefined();
    const rnSection = output.nextManifest.targets['react_native'];
    expect(typeof rnSection.variables).toBe('object');
    expect(typeof rnSection.collections).toBe('object');
  });

  it('nextManifest.fileKey matches ir.fileKey', () => {
    expect(output.nextManifest.fileKey).toBe(ir.fileKey);
  });

  it('manifest react_native section contains variable entries', () => {
    const section = output.nextManifest.targets['react_native'];
    expect(Object.keys(section.variables).length).toBeGreaterThan(0);
  });

  it('manifest react_native section contains collection entries', () => {
    const section = output.nextManifest.targets['react_native'];
    expect(Object.keys(section.collections).length).toBeGreaterThan(0);
  });

  it('each collection in IR produces a token file', () => {
    const paths = output.files.map((f) => f.path);
    for (const col of ir.collections) {
      const kebab = toKebabCase(sanitizeCollectionName(col.name));
      const subDir = col.kind === 'primitive' ? 'primitives' : 'tokens';
      expect(paths).toContain(`src/tokens/${subDir}/${kebab}.ts`);
    }
  });
});

function toKebabCase(str: string): string {
  return str
    .replace(/([a-z])([A-Z])/g, '$1-$2')
    .replace(/[\s_]+/g, '-')
    .toLowerCase();
}

function toPascalCase(str: string): string {
  return str
    .split(/[-\s_]+/)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join('');
}

function sanitizeCollectionName(name: string): string {
  const cleaned = name.replace(/^\[[\d]+\]\s*/, '');
  return toPascalCase(cleaned);
}
