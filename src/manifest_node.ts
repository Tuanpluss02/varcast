// Node-only manifest persistence. Keep separate so the Figma plugin bundle
// never imports `fs`/`path`.

import * as fs from 'fs';
import * as path from 'path';
import type { Manifest } from './manifest';

const MANIFEST_REL = path.join('_meta', 'manifest.json');

export function loadManifest(packagePath: string): Manifest | null {
  const p = path.join(packagePath, MANIFEST_REL);
  if (!fs.existsSync(p)) return null;
  const raw = fs.readFileSync(p, 'utf-8');
  const parsed = JSON.parse(raw) as Manifest;
  if (!parsed || parsed.version !== '1.0') return null;
  return parsed;
}

export function saveManifest(packagePath: string, manifest: Manifest): void {
  const metaDir = path.join(packagePath, '_meta');
  fs.mkdirSync(metaDir, { recursive: true });
  fs.writeFileSync(
    path.join(metaDir, 'manifest.json'),
    JSON.stringify(manifest, null, 2) + '\n',
  );
}

