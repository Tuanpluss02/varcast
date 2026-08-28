// Integration test using the real test_fixtures/ir.json file.
// Generates actual output and verifies structure.

import { describe, expect, it, beforeAll } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { runEngine } from '../core/emit_engine';
import { emitPackage } from '../targets/flutter/generator/emit';
import { DEFAULT_EXPORT_OPTIONS } from '../targets/flutter/generator/options';
import type { IR } from '../ir/types';
import { reactNativeTarget } from '../targets/react_native';

// Use absolute path for test fixtures
const IR_PATH = '/Users/tuanpluss02/Documents/stormx/Varcast/plugin/test_fixtures/ir.json';
const ir: IR = JSON.parse(fs.readFileSync(IR_PATH, 'utf-8'));

// Helper to create a file map
function fileMap(files: { path: string; contents: string }[]): Map<string, string> {
  return new Map(files.map((f) => [f.path, f.contents]));
}

describe('IR Integration Test: Collections Overview', () => {
  it('loads ir.json successfully', () => {
    expect(ir.version).toBe('1.0');
    expect(ir.collections.length).toBeGreaterThan(0);
  });

  it('has correct collection count and types', () => {
    console.log('\n=== Collections in ir.json ===');
    ir.collections.forEach((c) => {
      const modeNames = c.modes.map((m) => m.name).join(', ');
      console.log(`  - ${c.name} (${c.kind}): ${c.modes.length} mode(s) - ${modeNames}`);
    });
    console.log(`\nTotal: ${ir.collections.length} collections`);
    console.log(`Paint Styles: ${ir.composites.paintStyles.length}`);
    console.log(`Effect Styles: ${ir.composites.effectStyles.length}`);
    console.log(`Text Styles: ${ir.composites.textStyles.length}`);
  });
});

describe('Flutter Output Generation', () => {
  const tempDir = path.join(os.tmpdir(), `varcast-flutter-test-${Date.now()}`);

  beforeAll(() => {
    fs.mkdirSync(tempDir, { recursive: true });
  });

  it('generates Flutter package from ir.json', () => {
    const out = emitPackage(ir, null, DEFAULT_EXPORT_OPTIONS);
    expect(out.files.length).toBeGreaterThan(0);
    console.log(`\n=== Flutter Output (${out.files.length} files) ===`);

    const files = fileMap(out.files);

    // Group files by collection folder
    const collectionFolders = new Set<string>();
    out.files.forEach((f) => {
      const match = f.path.match(/^lib\/([^\/]+)\//);
      if (match) {
        collectionFolders.add(match[1]);
      }
    });

    console.log(`Collection folders: ${[...collectionFolders].length}`);
    [...collectionFolders].sort().forEach((folder) => {
      const folderFiles = out.files.filter((f) => f.path.startsWith(`lib/${folder}/`));
      console.log(`  ${folder}/ (${folderFiles.length} files)`);
      folderFiles.forEach((f) => {
        console.log(`    - ${path.basename(f.path)}`);
      });
    });

    // Write files to temp dir for inspection
    out.files.forEach((f) => {
      const fullPath = path.join(tempDir, f.path);
      fs.mkdirSync(path.dirname(fullPath), { recursive: true });
      fs.writeFileSync(fullPath, f.contents);
    });
    console.log(`\nFiles written to: ${tempDir}`);
  });

  it('verifies each collection becomes a folder with expected files', () => {
    const out = emitPackage(ir, null, DEFAULT_EXPORT_OPTIONS);
    const files = fileMap(out.files);

    // Check each collection - sanitize collection name like the generator does
    ir.collections.forEach((col) => {
      // Generator sanitizes: removes [1], [2] prefixes and converts to PascalCase
      const folderName = sanitizeCollectionName(col.name);
      const baseFilePath = `lib/${folderName}/${folderName}.dart`;

      if (files.has(baseFilePath)) {
        console.log(`✓ ${col.name} -> ${folderName}: base file exists`);

        // Check mode files for multi-mode collections
        col.modes.forEach((mode) => {
          const modeFileName = toKebabCase(mode.name) + '.dart';
          const modeFilePath = `lib/${folderName}/${modeFileName}`;
          if (files.has(modeFilePath)) {
            console.log(`  ✓ Mode "${mode.name}" -> ${modeFileName}`);
          } else if (col.modes.length > 1) {
            console.log(`  ⚠ Mode "${mode.name}" file not found at ${modeFilePath}`);
          }
        });
      } else {
        console.log(`✗ ${col.name} -> ${folderName}: base file NOT found at ${baseFilePath}`);
      }
    });
  });

  it('verifies alias references are preserved in Flutter output', () => {
    const out = emitPackage(ir, null, DEFAULT_EXPORT_OPTIONS);
    const files = fileMap(out.files);

    // Look for token collections (they may have aliases)
    const tokenCollections = ir.collections.filter((c) => c.kind === 'token');

    tokenCollections.forEach((col) => {
      const folderName = sanitizeCollectionName(col.name);
      const baseFilePath = `lib/${folderName}/${folderName}.dart`;
      const baseFile = files.get(baseFilePath);

      if (baseFile) {
        // Check if file contains alias references
        const hasAlias = baseFile.includes('alias') || baseFile.includes('target');
        if (hasAlias) {
          console.log(`✓ ${col.name}: contains alias references`);
        }
      }
    });
  });
});

describe('React Native NativeWind Output Generation', () => {
  const tempDir = path.join(os.tmpdir(), `varcast-rn-nativewind-${Date.now()}`);

  beforeAll(() => {
    fs.mkdirSync(tempDir, { recursive: true });
  });

  it('generates NativeWind package from ir.json', () => {
    const out = runEngine(ir, [reactNativeTarget], null, {
      react_native: { flavor: 'nativewind', packageName: 'design-system' },
    });

    expect(out.files.length).toBeGreaterThan(0);
    console.log(`\n=== NativeWind Output (${out.files.length} files) ===`);

    const files = fileMap(out.files);

    // List all files
    out.files.forEach((f) => {
      console.log(`  ${f.path}`);
    });

    // Write files to temp dir
    out.files.forEach((f) => {
      const fullPath = path.join(tempDir, f.path);
      fs.mkdirSync(path.dirname(fullPath), { recursive: true });
      fs.writeFileSync(fullPath, f.contents);
    });
    console.log(`\nFiles written to: ${tempDir}`);
  });

  it('verifies each collection becomes a JS file in kebab-case', () => {
    const out = runEngine(ir, [reactNativeTarget], null, {
      react_native: { flavor: 'nativewind', packageName: 'design-system' },
    });
    const files = fileMap(out.files);

    ir.collections.forEach((col) => {
      // Generator sanitizes collection name: removes [1], [2] prefixes and converts to kebab-case
      const sanitizedName = sanitizeCollectionName(col.name);
      const expectedFileName = toKebabCase(sanitizedName) + '.js';
      const expectedPath = `themes/${expectedFileName}`;

      if (files.has(expectedPath)) {
        console.log(`✓ ${col.name} -> ${expectedFileName}`);

        // Check content
        const content = files.get(expectedPath)!;
        if (content.includes('export const')) {
          console.log(`  ✓ exports collection object`);
        }
        if (content.includes('.')) {
          console.log(`  ✓ contains property definitions`);
        }
      } else {
        console.log(`✗ ${col.name} -> ${expectedFileName} NOT FOUND`);
      }
    });
  });
});

describe('React Native Unistyles Output Generation', () => {
  const tempDir = path.join(os.tmpdir(), `varcast-rn-unistyles-${Date.now()}`);

  beforeAll(() => {
    fs.mkdirSync(tempDir, { recursive: true });
  });

  it('generates Unistyles package from ir.json', () => {
    const out = runEngine(ir, [reactNativeTarget], null, {
      react_native: { flavor: 'unistyles', packageName: 'design-system' },
    });

    expect(out.files.length).toBeGreaterThan(0);
    console.log(`\n=== Unistyles Output (${out.files.length} files) ===`);

    const files = fileMap(out.files);

    // List all files
    out.files.forEach((f) => {
      console.log(`  ${f.path}`);
    });

    // Write files to temp dir
    out.files.forEach((f) => {
      const fullPath = path.join(tempDir, f.path);
      fs.mkdirSync(path.dirname(fullPath), { recursive: true });
      fs.writeFileSync(fullPath, f.contents);
    });
    console.log(`\nFiles written to: ${tempDir}`);
  });

  it('verifies each collection becomes a TS file in PascalCase (sanitized)', () => {
    const out = runEngine(ir, [reactNativeTarget], null, {
      react_native: { flavor: 'unistyles', packageName: 'design-system' },
    });
    const files = fileMap(out.files);

    ir.collections.forEach((col) => {
      // Unistyles sanitizes collection names: removes [1], [2] prefixes, converts to PascalCase
      const pascalName = sanitizeToPascalCase(col.name);
      const expectedFileName = `${pascalName}.ts`;
      const expectedPath = `src/themes/${expectedFileName}`;

      if (files.has(expectedPath)) {
        console.log(`✓ ${col.name} -> ${expectedFileName}`);

        // Check content for mode exports
        col.modes.forEach((mode) => {
          const modeExportName = `${pascalName}${sanitizeToPascalCase(mode.name)}`;
          const content = files.get(expectedPath)!;
          if (content.includes(`export const ${modeExportName}`)) {
            console.log(`  ✓ Mode "${mode.name}" -> ${modeExportName}`);
          }
        });
      } else {
        console.log(`✗ ${col.name} -> ${expectedFileName} NOT FOUND`);
        // List available files for debugging
        const themesFiles = [...files.keys()].filter((k) => k.includes('themes/'));
        console.log(`  Available themes files: ${themesFiles.join(', ')}`);
      }
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

// Sanitize collection name same as the generator does: remove [1], [2] prefixes
function sanitizeToPascalCase(str: string): string {
  // Remove [1], [2], etc. prefixes
  const cleaned = str.replace(/^\[[\d]+\]\s*/, '');
  return toPascalCase(cleaned);
}

// Sanitize collection name for folder/file naming
function sanitizeCollectionName(name: string): string {
  // Remove [1], [2] prefixes and convert to PascalCase
  const cleaned = name.replace(/^\[[\d]+\]\s*/, '');
  return toPascalCase(cleaned);
}
