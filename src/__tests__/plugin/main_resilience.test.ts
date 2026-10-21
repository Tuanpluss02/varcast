import { describe, expect, it, vi } from 'vitest';
import {
  handleDownloadZip,
  type PendingExportData,
  type PluginToUiMessage,
  type StorageLike,
} from '../../download_handler';
import { emptyManifest } from '../../core/manifest';

describe('handleDownloadZip resilience', () => {
  const dummyPending: PendingExportData = {
    nextManifest: emptyManifest('test-file-key'),
    packageName: 'test_tokens',
    files: [
      { path: 'tokens/colors.ts', contents: 'export const red = "#ff0000";' },
    ],
  };

  it('posts an error and aborts when pending is null', async () => {
    const storage: StorageLike = {
      setAsync: vi.fn().mockResolvedValue(undefined),
    };
    const messages: PluginToUiMessage[] = [];
    const postMessage = vi.fn((msg: PluginToUiMessage) => messages.push(msg));
    const buildZipFn = vi.fn();

    await handleDownloadZip(null, storage, postMessage, buildZipFn);

    expect(messages).toEqual([
      {
        type: 'error',
        message: 'No pending export. Run Export again.',
      },
    ]);
    expect(storage.setAsync).not.toHaveBeenCalled();
    expect(buildZipFn).not.toHaveBeenCalled();
  });

  it('posts a warning when clientStorage quota is exceeded, but still completes zip export', async () => {
    const storageError = new Error('QuotaExceededError: storage limit reached');
    const storage: StorageLike = {
      setAsync: vi.fn().mockRejectedValue(storageError),
    };
    const messages: PluginToUiMessage[] = [];
    const postMessage = vi.fn((msg: PluginToUiMessage) => messages.push(msg));
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    await expect(
      handleDownloadZip(dummyPending, storage, postMessage),
    ).resolves.toBeUndefined();

    expect(storage.setAsync).toHaveBeenCalledWith('manifest_v2', dummyPending.nextManifest);
    expect(warnSpy).toHaveBeenCalledWith(
      'Failed to save manifest to clientStorage:',
      storageError,
    );
    warnSpy.mockRestore();

    expect(messages).toHaveLength(3);
    expect(messages[0]).toEqual({ type: 'exporting' });
    expect(messages[1]).toEqual({
      type: 'warning',
      message:
        'Could not save token mapping to Figma local storage (quota exceeded). Downloads succeeded, but future renames in Figma might lose tracking.',
    });
    expect(messages[2]).toMatchObject({
      type: 'zip-ready',
      filename: 'test_tokens.zip',
    });
    if (messages[2].type === 'zip-ready') {
      expect(messages[2].bytes).toBeInstanceOf(Uint8Array);
      expect(messages[2].bytes.length).toBeGreaterThan(0);
    }
  });

  it('posts an error message when zip generation throws', async () => {
    const storage: StorageLike = {
      setAsync: vi.fn().mockResolvedValue(undefined),
    };
    const messages: PluginToUiMessage[] = [];
    const postMessage = vi.fn((msg: PluginToUiMessage) => messages.push(msg));
    const throwingBuildZip = vi.fn(() => {
      throw new Error('Out of memory during compression');
    });

    await expect(
      handleDownloadZip(dummyPending, storage, postMessage, throwingBuildZip),
    ).resolves.toBeUndefined();

    expect(storage.setAsync).toHaveBeenCalledWith('manifest_v2', dummyPending.nextManifest);
    expect(messages).toEqual([
      { type: 'exporting' },
      {
        type: 'error',
        message: 'Export failed: Out of memory during compression',
      },
    ]);
  });

  it('handles non-Error throwables during zip generation', async () => {
    const storage: StorageLike = {
      setAsync: vi.fn().mockResolvedValue(undefined),
    };
    const messages: PluginToUiMessage[] = [];
    const postMessage = vi.fn((msg: PluginToUiMessage) => messages.push(msg));
    const throwingBuildZip = vi.fn(() => {
      throw 'Unknown catastrophic failure';
    });

    await handleDownloadZip(dummyPending, storage, postMessage, throwingBuildZip);

    expect(messages).toEqual([
      { type: 'exporting' },
      {
        type: 'error',
        message: 'Export failed: Unknown catastrophic failure',
      },
    ]);
  });

  it('successfully exports zip on the happy path', async () => {
    const storage: StorageLike = {
      setAsync: vi.fn().mockResolvedValue(undefined),
    };
    const messages: PluginToUiMessage[] = [];
    const postMessage = vi.fn((msg: PluginToUiMessage) => messages.push(msg));

    await handleDownloadZip(dummyPending, storage, postMessage);

    expect(storage.setAsync).toHaveBeenCalledWith('manifest_v2', dummyPending.nextManifest);
    expect(messages).toHaveLength(2);
    expect(messages[0]).toEqual({ type: 'exporting' });
    expect(messages[1]).toMatchObject({
      type: 'zip-ready',
      filename: 'test_tokens.zip',
    });
  });
});
