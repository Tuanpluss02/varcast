/**
 * Full pipeline integration test: Flutter target.
 * Loads the real test_fixtures/ir.json, validates it, runs the engine,
 * and asserts structural correctness of the output.
 */

import { describe, it, expect, beforeAll } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import { validate } from '../../ir/validate';
import { runEngine } from '../../core/emit_engine';
import { flutterTarget } from '../../targets/flutter';
import type { IR } from '../../ir/types';
import type { EngineOutput } from '../../core/emit_engine';

const IR_PATH = path.resolve(__dirname, '../../../test_fixtures/ir.json');
const ir: IR = JSON.parse(fs.readFileSync(IR_PATH, 'utf-8'));

describe('Full pipeline: Flutter target', () => {
  let output: EngineOutput;

  beforeAll(() => {
    const result = validate(ir);
    expect(result.errors).toHaveLength(0);
    output = runEngine(ir, [flutterTarget], null, {
      flutter: { packageName: 'design_system' },
    });
  });

  it('produces a non-empty file list', () => {
    expect(output.files.length).toBeGreaterThan(0);
  });

  it('contains pubspec.yaml', () => {
    const paths = output.files.map((f) => f.path);
    expect(paths).toContain('pubspec.yaml');
  });

  it('contains lib/design_system.dart', () => {
    const paths = output.files.map((f) => f.path);
    // The barrel file is named after the package: lib/<packageName>.dart
    const hasBarrel = paths.some((p) => p.startsWith('lib/') && p.endsWith('.dart') && !p.includes('/src/'));
    expect(hasBarrel).toBe(true);
  });

  it('contains lib/src/theme.dart', () => {
    const paths = output.files.map((f) => f.path);
    expect(paths).toContain('lib/src/theme.dart');
  });

  it('contains lib/src/wrapper.dart', () => {
    const paths = output.files.map((f) => f.path);
    expect(paths).toContain('lib/src/wrapper.dart');
  });

  it('contains lib/src/_internal/controller.dart', () => {
    const paths = output.files.map((f) => f.path);
    expect(paths).toContain('lib/src/_internal/controller.dart');
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

  it('nextManifest is non-null and contains flutter target section', () => {
    expect(output.nextManifest).not.toBeNull();
    expect(output.nextManifest.version).toBe('2.0');
    expect(output.nextManifest.targets).toBeDefined();
    expect(output.nextManifest.targets['flutter']).toBeDefined();
    const flutterSection = output.nextManifest.targets['flutter'];
    expect(typeof flutterSection.variables).toBe('object');
    expect(typeof flutterSection.collections).toBe('object');
  });

  it('nextManifest.fileKey matches ir.fileKey', () => {
    expect(output.nextManifest.fileKey).toBe(ir.fileKey);
  });

  it('manifest flutter section contains variable entries', () => {
    const section = output.nextManifest.targets['flutter'];
    expect(Object.keys(section.variables).length).toBeGreaterThan(0);
  });

  it('manifest flutter section contains collection entries', () => {
    const section = output.nextManifest.targets['flutter'];
    expect(Object.keys(section.collections).length).toBeGreaterThan(0);
  });
});
