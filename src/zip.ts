import { zipSync, strToU8 } from 'fflate';

export interface ZipInputFile {
  path: string;
  contents: string;
}

/**
 * Bundles emitted files into a zip archive byte array.
 */
export function buildZip(files: ZipInputFile[]): Uint8Array {
  const entries: Record<string, Uint8Array> = {};
  for (const f of files) {
    const p = f.path.replace(/^\/+/, '');
    entries[p] = strToU8(f.contents);
  }
  return zipSync(entries, { level: 6 });
}

