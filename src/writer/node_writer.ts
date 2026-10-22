/**
 * Filesystem writer for emitted packages in Node.js environments.
 */

import * as fs from 'fs';
import * as path from 'path';
import type { EmittedFile } from '../core/target';

export function writePackage(files: EmittedFile[], outDir: string): void {
  for (const f of files) {
    const full = path.join(outDir, f.path);
    fs.mkdirSync(path.dirname(full), { recursive: true });
    fs.writeFileSync(full, f.contents);
  }
}
