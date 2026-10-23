#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync, execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, '..');

const CLI_PATH = path.join(ROOT, 'dist', 'cli.js');
const FIXTURE_PATH = path.join(ROOT, 'test_fixtures', 'golden_tokens.json');
const OUT_DIR = path.join(ROOT, '.tmp_flutter_runtime');

function hasCommand(cmd) {
  try {
    execSync(`which ${cmd}`, { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

async function main() {
  if (!fs.existsSync(CLI_PATH)) {
    throw new Error(`Missing ${CLI_PATH}. Run: pnpm build`);
  }

  fs.rmSync(OUT_DIR, { recursive: true, force: true });
  fs.mkdirSync(OUT_DIR, { recursive: true });

  console.log('[flutter-runtime] Emitting Flutter package via CLI...');
  execFileSync(process.execPath, [
    CLI_PATH,
    '--target',
    'flutter',
    '--ir',
    FIXTURE_PATH,
    '--out',
    OUT_DIR,
    '--name',
    'design_system',
  ], { stdio: 'inherit' });

  if (!hasCommand('dart')) {
    console.log('[flutter-runtime] Dart SDK not found in PATH; skipping analyze check.');
    return;
  }

  console.log('[flutter-runtime] Running "dart pub get" and "dart analyze"...');
  execFileSync('dart', ['pub', 'get'], { cwd: OUT_DIR, stdio: 'inherit' });
  execFileSync('dart', ['analyze'], { cwd: OUT_DIR, stdio: 'inherit' });

  console.log('[flutter-runtime] OK');
}

main().catch((err) => {
  console.error('[flutter-runtime] FAILED:', err);
  process.exit(1);
});
