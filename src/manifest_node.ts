// Node-only manifest persistence. Keep separate so the Figma plugin bundle
// never imports `fs`/`path`.

import * as fs from 'fs';
import * as path from 'path';
import type { Manifest } from './core/manifest';
import { normalizeManifest } from './core/manifest';

const MANIFEST_REL = path.join('_meta', 'manifest.json');

export function loadManifest(packagePath: string): Manifest | null {
  const p = path.join(packagePath, MANIFEST_REL);
  if (!fs.existsSync(p)) return null;
  const raw = fs.readFileSync(p, 'utf-8');
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }
  // normalizeManifest auto-migrates v1 → v2 transparently.
  return normalizeManifest(parsed);
}

export function saveManifest(packagePath: string, manifest: Manifest): void {
  const metaDir = path.join(packagePath, '_meta');
  fs.mkdirSync(metaDir, { recursive: true });
  fs.writeFileSync(
    path.join(metaDir, 'manifest.json'),
    JSON.stringify(manifest, null, 2) + '\n',
  );
}
