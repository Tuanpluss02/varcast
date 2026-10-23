import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import type { IR } from '../../ir/types';

const GOLDEN_IR: IR = JSON.parse(
  fs.readFileSync(path.resolve(__dirname, '../../../test_fixtures/golden_tokens.json'), 'utf-8'),
);

describe('Figma Plugin Sandbox & UI Bridge Flow', () => {
  let postedMessages: any[] = [];
  let onMessageHandler: ((msg: any) => Promise<void>) | null = null;
  let clientStorageData: Record<string, any> = {};

  beforeEach(async () => {
    vi.resetModules();
    postedMessages = [];
    clientStorageData = {};
    (globalThis as any).__html__ = '<div>UI</div>';

    // Mock Figma globals
    (globalThis as any).figma = {
      showUI: vi.fn(),
      closePlugin: vi.fn(),
      ui: {
        postMessage: (msg: any) => postedMessages.push(msg),
        set onmessage(fn: any) {
          onMessageHandler = fn;
        },
        get onmessage() {
          return onMessageHandler;
        },
      },
      clientStorage: {
        getAsync: vi.fn(async (key: string) => clientStorageData[key] ?? null),
        setAsync: vi.fn(async (key: string, val: any) => {
          clientStorageData[key] = val;
        }),
      },
    };

    // Mock reader to return GOLDEN_IR
    vi.doMock('../../reader', () => ({
      readIR: async () => GOLDEN_IR,
    }));

    // Import main to wire listeners
    await import('../../main');
  });

  it('handles "init" message and returns availableTargets and preview collections', async () => {
    expect(onMessageHandler).toBeDefined();
    await onMessageHandler!({ type: 'init' });

    const initMsg = postedMessages.find((m) => m.type === 'init-data');
    expect(initMsg).toBeDefined();
    expect(initMsg.collections.length).toBe(GOLDEN_IR.collections.length);
    expect(initMsg.availableTargets.length).toBeGreaterThanOrEqual(2);
    expect(initMsg.availableTargets.some((t: any) => t.id === 'flutter')).toBe(true);
    expect(initMsg.availableTargets.some((t: any) => t.id === 'react_native')).toBe(true);
  });

  it('handles "export" message and returns preview files with diff summary for flutter', async () => {
    await onMessageHandler!({
      type: 'export',
      options: { targetId: 'flutter', packageName: 'test_flutter_ds' },
    });

    const previewMsg = postedMessages.find((m) => m.type === 'preview-ready');
    expect(previewMsg).toBeDefined();
    expect(previewMsg.files.length).toBeGreaterThan(0);
    expect(previewMsg.summary.totalBytes).toBeGreaterThan(0);
    expect(previewMsg.diff).toBeDefined();

    // Verify both manifest and ir.json are included in preview
    const paths = previewMsg.files.map((f: any) => f.path);
    expect(paths).toContain('_meta/manifest.json');
    expect(paths).toContain('_meta/ir.json');
    expect(paths).toContain('CHANGELOG.md');
  });

  it('handles "export" message and returns preview files for react_native', async () => {
    await onMessageHandler!({
      type: 'export',
      options: { targetId: 'react_native', packageName: 'test_rn_ds' },
    });

    const previewMsg = postedMessages.find((m) => m.type === 'preview-ready');
    expect(previewMsg).toBeDefined();
    expect(previewMsg.files.length).toBeGreaterThan(0);
    const paths = previewMsg.files.map((f: any) => f.path);
    expect(paths).toContain('_meta/manifest.json');
    expect(paths).toContain('_meta/ir.json');
  });

  it('handles "download-zip" message and emits zip-ready with manifest stored', async () => {
    // Run export first to populate pending state
    await onMessageHandler!({
      type: 'export',
      options: { targetId: 'react_native', packageName: 'test_rn_ds' },
    });

    await onMessageHandler!({ type: 'download-zip' });

    const zipReadyMsg = postedMessages.find((m) => m.type === 'zip-ready');
    expect(zipReadyMsg).toBeDefined();
    expect(zipReadyMsg.filename).toBe('test_rn_ds.zip');
    expect(zipReadyMsg.bytes).toBeInstanceOf(Uint8Array);
    expect(zipReadyMsg.bytes.length).toBeGreaterThan(0);

    // Verify manifest was saved to clientStorage
    expect(clientStorageData['manifest_v2']).toBeDefined();
  });
});
