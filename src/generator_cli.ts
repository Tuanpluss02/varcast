/**
 * Command-line interface for reading IR JSON, validating, and generating packages.
 */

import * as fs from 'fs';
import * as path from 'path';
import { runEngine } from './core/emit_engine';
import type { Manifest } from './core/manifest';
import { generateMultiTargetChangelog } from './core/manifest/changelog';
import { getTarget } from './core/registry';
import type { IR } from './ir/types';
import { validate } from './ir/validate';
import { loadManifest, saveManifest } from './manifest_node';
import { writePackage } from './writer/node_writer';
// Ensure default targets are registered:
import './targets/flutter';
import './targets/react_native';

interface Args {
  ir: string;
  out: string;
  name?: string;
  target?: string;
  collections?: string[];
}

function parseArgs(argv: string[]): Args {
  const args: Partial<Args> = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--ir') args.ir = argv[++i];
    else if (a === '--out') args.out = argv[++i];
    else if (a === '--name') args.name = argv[++i];
    else if (a === '--target') args.target = argv[++i];
    else if (a === '--collections')
      args.collections = argv[++i]
        ?.split(',')
        .map((s) => s.trim())
        .filter(Boolean);
  }
  if (!args.ir || !args.out) {
    console.error(
      'Usage: generator_cli --ir <ir.json> --out <dir> [--target <id>] [--name <package>] [--collections <id1,id2>]',
    );
    process.exit(2);
  }
  return args as Args;
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const irPath = path.resolve(args.ir);
  const outDir = path.resolve(args.out);

  const ir: IR = JSON.parse(fs.readFileSync(irPath, 'utf-8'));

  const result = validate(ir);
  if (result.errors.length > 0) {
    console.error('Validation errors — emit blocked:');
    for (const e of result.errors) console.error(`  ${e.type}: ${e.path.join(' → ')}`);
    process.exit(1);
  }

  if (result.warnings.length > 0) {
    const byType: Record<string, number> = {};
    for (const w of result.warnings) byType[w.type] = (byType[w.type] ?? 0) + 1;
    console.warn(
      'Warnings:',
      Object.entries(byType)
        .map(([k, v]) => `${k}=${v}`)
        .join(', '),
    );
  }

  let oldManifest: Manifest | null = null;
  try {
    oldManifest = loadManifest(outDir);
  } catch (err: unknown) {
    console.error(err instanceof Error ? err.message : String(err));
    process.exit(1);
  }
  const targetId = args.target ?? 'flutter';
  const target = getTarget(targetId);

  const defaultPkg = target.defaultPackageName ?? 'tokens';
  const packageName = args.name
    ? (target.sanitizePackageName ? target.sanitizePackageName(args.name) : args.name)
    : defaultPkg;

  const targetOptions: Record<string, unknown> = {
    ...(target.defaultOptions ?? {}),
    packageName,
  };

  if (args.collections) {
    targetOptions.include = {
      ...((targetOptions.include as Record<string, unknown>) ?? {}),
      collections: args.collections,
    };
  }

  const { files, nextManifest, diffsByTarget } = runEngine(
    ir,
    [target],
    oldManifest,
    { [targetId]: targetOptions },
  );
  fs.mkdirSync(outDir, { recursive: true });
  writePackage(files, outDir);
  saveManifest(outDir, nextManifest);
  fs.writeFileSync(
    path.join(outDir, 'CHANGELOG.md'),
    generateMultiTargetChangelog(diffsByTarget) + '\n',
  );

  console.log(
    `✓ Wrote ${files.length} files to ${outDir} (${ir.collections.length} collections, ${ir.composites.paintStyles.length} paints, ${ir.composites.effectStyles.length} effects, ${ir.composites.textStyles.length} text styles)`,
  );
}

main();
