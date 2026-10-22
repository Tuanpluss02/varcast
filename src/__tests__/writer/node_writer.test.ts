import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { writePackage } from '../../writer/node_writer';
import type { EmittedFile } from '../../core/target';

describe('node_writer: writePackage', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'varcast-writer-test-'));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('writes flat and nested files creating directories recursively', () => {
    const files: EmittedFile[] = [
      { path: 'pubspec.yaml', contents: 'name: my_package\n' },
      { path: 'lib/src/colors.dart', contents: 'class DSColors {}\n' },
      { path: 'nested/dir/deep/file.txt', contents: 'deep content' },
    ];

    writePackage(files, tmpDir);

    expect(fs.readFileSync(path.join(tmpDir, 'pubspec.yaml'), 'utf-8')).toBe('name: my_package\n');
    expect(fs.readFileSync(path.join(tmpDir, 'lib/src/colors.dart'), 'utf-8')).toBe('class DSColors {}\n');
    expect(fs.readFileSync(path.join(tmpDir, 'nested/dir/deep/file.txt'), 'utf-8')).toBe('deep content');
  });

  it('handles empty file list gracefully', () => {
    expect(() => writePackage([], tmpDir)).not.toThrow();
  });
});
