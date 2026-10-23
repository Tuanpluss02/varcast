#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, '..');

const CLI_PATH = path.join(ROOT, 'dist', 'cli.js');
const FIXTURE_PATH = path.join(ROOT, 'test_fixtures', 'golden_tokens.json');
const TMP_DIR = path.join(ROOT, '.tmp_cli_e2e');

if (!fs.existsSync(CLI_PATH)) {
  console.error(`CLI binary not found at ${CLI_PATH}. Please run "pnpm build" first.`);
  process.exit(1);
}

if (!fs.existsSync(FIXTURE_PATH)) {
  console.error(`Fixture not found at ${FIXTURE_PATH}.`);
  process.exit(1);
}

fs.rmSync(TMP_DIR, { recursive: true, force: true });
fs.mkdirSync(TMP_DIR, { recursive: true });

const TARGETS = [
  { id: 'flutter', expectedEntry: 'pubspec.yaml' },
  { id: 'react_native', expectedEntry: 'package.json' },
  { id: 'compose', expectedEntry: 'build.gradle.kts' },
];

console.log('[cli-matrix] Running CLI generation across all targets...');

for (const target of TARGETS) {
  const outDir = path.join(TMP_DIR, target.id);
  console.log(`[cli-matrix] Emitting target: ${target.id} -> ${outDir}`);

  execFileSync(process.execPath, [
    CLI_PATH,
    '--target',
    target.id,
    '--ir',
    FIXTURE_PATH,
    '--out',
    outDir,
    '--name',
    `design_system_${target.id}`,
  ], { stdio: 'inherit' });

  // 1. Verify expected root entrypoint exists
  const entryPath = path.join(outDir, target.expectedEntry);
  if (!fs.existsSync(entryPath)) {
    throw new Error(`Target ${target.id} missing expected entrypoint ${target.expectedEntry}`);
  }

  // 2. Verify _meta/manifest.json exists and is valid JSON
  const manifestPath = path.join(outDir, '_meta', 'manifest.json');
  if (!fs.existsSync(manifestPath)) {
    throw new Error(`Target ${target.id} missing _meta/manifest.json`);
  }
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  if (manifest.version !== '2.0' || !manifest.targets?.[target.id]) {
    throw new Error(`Target ${target.id} produced invalid manifest`);
  }

  // 3. Verify _meta/ir.json exists and is valid JSON
  const irPath = path.join(outDir, '_meta', 'ir.json');
  if (!fs.existsSync(irPath)) {
    throw new Error(`Target ${target.id} missing _meta/ir.json`);
  }
  const ir = JSON.parse(fs.readFileSync(irPath, 'utf8'));
  if (!ir.collections || ir.collections.length === 0) {
    throw new Error(`Target ${target.id} produced invalid _meta/ir.json`);
  }

  // 4. Verify CHANGELOG.md exists
  const changelogPath = path.join(outDir, 'CHANGELOG.md');
  if (!fs.existsSync(changelogPath)) {
    throw new Error(`Target ${target.id} missing CHANGELOG.md`);
  }

  console.log(`[cli-matrix] Target ${target.id} OK`);
}

console.log('[cli-matrix] ALL TARGETS PASSED');
