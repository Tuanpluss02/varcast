import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import type { Manifest } from '../core/manifest';
import { loadManifest, saveManifest } from '../manifest_node';

describe('manifest_node: loadManifest and saveManifest', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'varcast-manifest-node-test-'));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('returns null when manifest file does not exist', () => {
    expect(loadManifest(tmpDir)).toBeNull();
  });

  it('loads valid v2 manifest successfully', () => {
    const validManifest: Manifest = {
      version: '2.0',
      fileKey: 'test-file-key',
      lastExportedAt: new Date(0).toISOString(),
      targets: {
        flutter: {
          variables: { 'var:1': 'colorPrimary' },
          collections: { 'col:1': 'Colors' },
          figmaNames: {
            variables: { 'var:1': 'color/primary' },
            collections: { 'col:1': 'Colors' },
          },
        },
      },
    };

    saveManifest(tmpDir, validManifest);
    const loaded = loadManifest(tmpDir);

    expect(loaded).toEqual(validManifest);
  });

  it('throws helpful error when manifest contains invalid JSON syntax', () => {
    const metaDir = path.join(tmpDir, '_meta');
    fs.mkdirSync(metaDir, { recursive: true });
    const manifestPath = path.join(metaDir, 'manifest.json');
    fs.writeFileSync(manifestPath, '{ "version": "2.0", broken json...');

    expect(() => loadManifest(tmpDir)).toThrowError(
      new RegExp(
        `Failed to parse existing manifest at "${path.join(tmpDir, '_meta', 'manifest.json')}".*Refusing to proceed to prevent overwriting existing token IDs\\. Fix or remove the file\\.`,
      ),
    );
  });

  it('throws helpful error when manifest has invalid schema or unsupported version (e.g. v1.0)', () => {
    const metaDir = path.join(tmpDir, '_meta');
    fs.mkdirSync(metaDir, { recursive: true });
    const manifestPath = path.join(metaDir, 'manifest.json');
    const v1 = {
      version: '1.0',
      fileKey: 'k',
      lastExportedAt: new Date(0).toISOString(),
      variables: { 'var:1': 'n900' },
    };
    fs.writeFileSync(manifestPath, JSON.stringify(v1, null, 2));

    const expectedPath = path.join(tmpDir, '_meta', 'manifest.json');
    expect(() => loadManifest(tmpDir)).toThrowError(
      `Existing manifest at "${expectedPath}" is not a valid Varcast v2 manifest. Refusing to proceed to prevent overwriting existing token IDs. Fix or remove the file.`,
    );
  });

  it('throws helpful error when manifest is an invalid structure like empty object or string', () => {
    const metaDir = path.join(tmpDir, '_meta');
    fs.mkdirSync(metaDir, { recursive: true });
    const manifestPath = path.join(metaDir, 'manifest.json');
    fs.writeFileSync(manifestPath, JSON.stringify({ notAManifest: true }));

    const expectedPath = path.join(tmpDir, '_meta', 'manifest.json');
    expect(() => loadManifest(tmpDir)).toThrowError(
      `Existing manifest at "${expectedPath}" is not a valid Varcast v2 manifest. Refusing to proceed to prevent overwriting existing token IDs. Fix or remove the file.`,
    );
  });
});
