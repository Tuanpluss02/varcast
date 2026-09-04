// Integration test using the real test_fixtures/ir.json file (based on v5 Golden Reference).
// Generates actual output and verifies structure for both Flutter and React Native targets.

import { describe, expect, it, beforeAll } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { runEngine } from '../core/emit_engine';
import { emitPackage } from '../targets/flutter/generator/emit';
import { DEFAULT_EXPORT_OPTIONS } from '../targets/flutter/generator/options';
import type { IR } from '../ir/types';
import { reactNativeTarget } from '../targets/react_native';

// Relative path to test fixtures
const IR_PATH = path.resolve(__dirname, '../../test_fixtures/ir.json');
const ir: IR = JSON.parse(fs.readFileSync(IR_PATH, 'utf-8'));

// Helper to create a file map
function fileMap(files: { path: string; contents: string }[]): Map<string, string> {
  return new Map(files.map((f) => [f.path, f.contents]));
}

describe('IR Integration Test: Collections Overview', () => {
  it('loads ir.json successfully with correct structure', () => {
    expect(ir.version).toBe('1.0');
    expect(ir.collections.length).toBe(7);
  });

  it('has correct collection count, names, and style totals', () => {
    const names = ir.collections.map((c) => c.name);
    expect(names).toContain('Typography');
    expect(names).toContain('All Colors');
    expect(names).toContain('Theme');
    expect(names).toContain('Brand color');
    expect(names).toContain('Spacing');
    expect(names).toContain('Corner');
    expect(names).toContain('Font Family');

    expect(ir.composites.paintStyles.length).toBe(3);
    expect(ir.composites.effectStyles.length).toBe(35);
    expect(ir.composites.textStyles.length).toBe(48);
  });
});

describe('Flutter Output Generation', () => {
  const tempDir = path.join(os.tmpdir(), `varcast-flutter-test-${Date.now()}`);

  beforeAll(() => {
    fs.mkdirSync(tempDir, { recursive: true });
  });

  it('generates Flutter package with all 7 collection folders', () => {
    const out = emitPackage(ir, null, DEFAULT_EXPORT_OPTIONS);
    expect(out.files.length).toBeGreaterThan(0);

    const files = fileMap(out.files);

    // Group files by collection folder
    const collectionFolders = new Set<string>();
    out.files.forEach((f) => {
      const match = f.path.match(/^lib\/src\/collections\/([^/]+)\//);
      if (match) {
        collectionFolders.add(match[1]);
      }
    });

    expect(collectionFolders.size).toBe(7);
    expect(collectionFolders.has('typography')).toBe(true);
    expect(collectionFolders.has('all_colors')).toBe(true);
    expect(collectionFolders.has('theme')).toBe(true);
    expect(collectionFolders.has('brand_color')).toBe(true);
    expect(collectionFolders.has('spacing')).toBe(true);
    expect(collectionFolders.has('corner')).toBe(true);
    expect(collectionFolders.has('font_family')).toBe(true);

    // Write files to temp dir for inspection
    out.files.forEach((f) => {
      const fullPath = path.join(tempDir, f.path);
      fs.mkdirSync(path.dirname(fullPath), { recursive: true });
      fs.writeFileSync(fullPath, f.contents);
    });
  });

  it('verifies each collection has base file and mode files', () => {
    const out = emitPackage(ir, null, DEFAULT_EXPORT_OPTIONS);
    const files = fileMap(out.files);

    ir.collections.forEach((col) => {
      const folderName = toSnakeCase(sanitizeCollectionName(col.name));
      const baseFilePath = `lib/src/collections/${folderName}/${folderName}.dart`;

      expect(files.has(baseFilePath)).toBe(true);

      // Check mode files
      col.modes.forEach((mode) => {
        let rawName = mode.name;
        if (rawName === 'Mode') rawName = 'default';
        const modeFileName = toSnakeCase(rawName) + '.dart';
        const modeFilePath = `lib/src/collections/${folderName}/${modeFileName}`;
        expect(files.has(modeFilePath)).toBe(true);
      });
    });
  });

  it('verifies composites, wrapper, and theme facade are emitted', () => {
    const out = emitPackage(ir, null, DEFAULT_EXPORT_OPTIONS);
    const files = fileMap(out.files);

    expect(files.has('lib/src/composites/color_styles.dart')).toBe(true);
    expect(files.has('lib/src/composites/shadows.dart')).toBe(true);
    expect(files.has('lib/src/composites/text_styles.dart')).toBe(true);

    expect(files.has('lib/src/wrapper.dart')).toBe(true);
    expect(files.has('lib/src/theme.dart')).toBe(true);
    expect(files.has('lib/src/_internal/controller.dart')).toBe(true);
    expect(files.has('lib/design_system.dart')).toBe(true);
  });

  it('verifies alias references are preserved via AppTheme in token collections', () => {
    const out = emitPackage(ir, null, DEFAULT_EXPORT_OPTIONS);

    const tokenCollections = ir.collections.filter((c) => c.kind === 'token');
    tokenCollections.forEach((col) => {
      const folderName = toSnakeCase(sanitizeCollectionName(col.name));
      const modeFiles = out.files.filter((f) => f.path.startsWith(`lib/src/collections/${folderName}/`));

      const hasAlias = modeFiles.some((f) => f.contents.includes('AppTheme.'));
      expect(hasAlias).toBe(true);
    });
  });
});

describe('React Native Output Generation', () => {
  const tempDir = path.join(os.tmpdir(), `varcast-rn-test-${Date.now()}`);

  beforeAll(() => {
    fs.mkdirSync(tempDir, { recursive: true });
  });

  it('generates React Native package with token files and composites', () => {
    const out = runEngine(ir, [reactNativeTarget], null, {
      react_native: { packageName: 'design-system' },
    });

    expect(out.files.length).toBeGreaterThan(0);
    const files = fileMap(out.files);

    // Verify core structure
    expect(files.has('src/index.ts')).toBe(true);
    expect(files.has('src/runtime/createTheme.ts')).toBe(true);
    expect(files.has('src/runtime/modes.ts')).toBe(true);
    expect(files.has('src/runtime/ThemeProvider.tsx')).toBe(true);

    // Verify composites
    expect(files.has('src/composites/colorStyles.ts')).toBe(true);
    expect(files.has('src/composites/shadows.ts')).toBe(true);
    expect(files.has('src/composites/textStyles.ts')).toBe(true);

    // Verify each collection produces a token file
    ir.collections.forEach((col) => {
      const kebabName = toKebabCase(sanitizeCollectionName(col.name));
      const subDir = col.kind === 'primitive' ? 'primitives' : 'tokens';
      const tokenPath = `src/tokens/${subDir}/${kebabName}.ts`;
      expect(files.has(tokenPath)).toBe(true);
    });

    // Write files to temp dir
    out.files.forEach((f) => {
      const fullPath = path.join(tempDir, f.path);
      fs.mkdirSync(path.dirname(fullPath), { recursive: true });
      fs.writeFileSync(fullPath, f.contents);
    });
  });
});

// Helper functions
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

function toSnakeCase(str: string): string {
  return str
    .replace(/([a-z])([A-Z])/g, '$1_$2')
    .replace(/[\s-]+/g, '_')
    .toLowerCase();
}

function sanitizeCollectionName(name: string): string {
  const cleaned = name.replace(/^\[[\d]+\]\s*/, '');
  return toPascalCase(cleaned);
}
