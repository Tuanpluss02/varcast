import { zipSync, strToU8 } from 'fflate';

export interface ZipInputFile {
  path: string;
  contents: string;
}

export function buildZip(files: ZipInputFile[]): Uint8Array {
  const entries: Record<string, Uint8Array> = {};
  for (const f of files) {
    // ZIP paths must be relative, no leading slash.
    const p = f.path.replace(/^\/+/, '');
    entries[p] = strToU8(f.contents);
  }
  return zipSync(entries, { level: 6 });
}

