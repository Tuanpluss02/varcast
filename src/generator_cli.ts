// CLI: read IR JSON, validate, write a Flutter package.
//
// Usage:
//   npx tsx src/generator_cli.ts --ir path/to/ir.json --out path/to/out [--name design_system]
//
// Or after `npm run build:cli` (esbuild bundle to dist/cli.js):
//   node dist/cli.js --ir path/to/ir.json --out path/to/out

import * as fs from 'fs';
import * as path from 'path';
import type { IR } from './ir/types';
import { validate } from './ir/validate';
import { diffManifestForTarget } from './core/manifest';
import { loadManifest, saveManifest } from './manifest_node';
import { generateChangelog } from './targets/flutter/generator/changelog';
import { DEFAULT_EXPORT_OPTIONS } from './targets/flutter/generator/options';
import { runEngine } from './core/emit_engine';
import { flutterTarget } from './targets/flutter';
import { mergeRnOptions, reactNativeTarget, type ReactNativeFlavor } from './targets/react_native';
import { writePackage } from './targets/flutter/generator/write_node';

interface Args {
  ir: string;
  out: string;
  name?: string;
  target?: string;
  flavor?: string;
}

function parseArgs(argv: string[]): Args {
  const args: Partial<Args> = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--ir') args.ir = argv[++i];
    else if (a === '--out') args.out = argv[++i];
    else if (a === '--name') args.name = argv[++i];
    else if (a === '--target') args.target = argv[++i];
    else if (a === '--flavor') args.flavor = argv[++i];
  }
  if (!args.ir || !args.out) {
    console.error(
      'Usage: generator_cli --ir <ir.json> --out <dir> [--target <id>] [--flavor <nativewind|unistyles>] [--name <package>]',
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

  const oldManifest = loadManifest(outDir);
  const targetId = args.target ?? 'flutter';
  const targets =
    targetId === 'react_native' ? [reactNativeTarget] : [flutterTarget];
  const optionsByTarget =
    targetId === 'react_native'
      ? {
          react_native: mergeRnOptions({
            flavor: (args.flavor as ReactNativeFlavor | undefined) ?? 'nativewind',
            packageName: args.name ?? 'design-system',
          }),
        }
      : {
          flutter: { ...DEFAULT_EXPORT_OPTIONS, packageName: args.name ?? 'design_system' },
        };
  const { files, nextManifest } = runEngine(ir, targets, oldManifest, optionsByTarget);
  const diff = diffManifestForTarget(oldManifest, nextManifest, targetId);
  fs.mkdirSync(outDir, { recursive: true });
  writePackage(files, outDir);
  saveManifest(outDir, nextManifest);
  fs.writeFileSync(
    path.join(outDir, 'CHANGELOG.md'),
    generateChangelog(diff) + '\n',
  );

  console.log(
    `✓ Wrote ${files.length} files to ${outDir} (${ir.collections.length} collections, ${ir.composites.paintStyles.length} paints, ${ir.composites.effectStyles.length} effects, ${ir.composites.textStyles.length} text styles)`,
  );
}

main();
