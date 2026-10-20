import { describe, expect, it } from 'vitest';
import { unzipSync, strFromU8 } from 'fflate';
import { buildZip } from '../../writer/zip';
import { buildZip as buildZipFromRoot } from '../../zip';
import { buildZip as buildZipFromWriterIndex } from '../../writer';

describe('writer/zip: buildZip', () => {
  it('bundles files into a valid zip archive and strips leading slashes', () => {
    const files = [
      { path: '/README.md', contents: '# Hello World' },
      { path: 'src/index.ts', contents: 'export const a = 1;' },
    ];

    const bytes = buildZip(files);
    expect(bytes).toBeInstanceOf(Uint8Array);
    expect(bytes.length).toBeGreaterThan(0);

    const unzipped = unzipSync(bytes);
    expect(Object.keys(unzipped).sort()).toEqual(['README.md', 'src/index.ts']);
    expect(strFromU8(unzipped['README.md'])).toBe('# Hello World');
    expect(strFromU8(unzipped['src/index.ts'])).toBe('export const a = 1;');
  });

  it('is consistently re-exported across writer index and root zip', () => {
    expect(buildZipFromRoot).toBe(buildZip);
    expect(buildZipFromWriterIndex).toBe(buildZip);
  });
});
