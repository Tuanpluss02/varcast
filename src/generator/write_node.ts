// Node-only filesystem writer for emitted packages.
// Keep this module separate so the Figma plugin build never pulls in `fs`.

import * as fs from 'fs';
import * as path from 'path';
import type { EmittedFile } from './emit';

export function writePackage(files: EmittedFile[], outDir: string): void {
  for (const f of files) {
    const full = path.join(outDir, f.path);
    fs.mkdirSync(path.dirname(full), { recursive: true });
    fs.writeFileSync(full, f.contents);
  }
}

