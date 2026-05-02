import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const ROOT = path.resolve(new URL('..', import.meta.url).pathname);

function run(cmd, args, opts = {}) {
  execFileSync(cmd, args, { stdio: 'inherit', ...opts });
}

function writeJson(p, obj) {
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, JSON.stringify(obj, null, 2), 'utf8');
}

async function main() {
  const tmp = path.join(ROOT, '.tmp_rn_cli_smoke');
  fs.rmSync(tmp, { recursive: true, force: true });
  fs.mkdirSync(tmp, { recursive: true });

  const irPath = path.join(tmp, 'ir.json');
  const outDir = path.join(tmp, 'out');

  const ir = {
    version: '1.0',
    fileKey: 'k',
    generatedAt: new Date(0).toISOString(),
    collections: [
      {
        id: 'col:1',
        name: 'Color Token',
        kind: 'token',
        modes: [
          { id: 'm:dark', name: 'Dark' },
          { id: 'm:light', name: 'Light' },
        ],
        variables: [
          {
            id: 'var:1',
            figmaName: 'Background/primary',
            groupPath: ['Background', 'primary'],
            type: 'COLOR',
            scopes: [],
            hiddenFromPublishing: false,
            emitToPublic: true,
            valuesByMode: {
              'm:dark': { kind: 'literal', value: { r: 1, g: 0, b: 0, a: 1 } },
              'm:light': { kind: 'literal', value: { r: 0, g: 1, b: 0, a: 1 } },
            },
          },
        ],
      },
    ],
    composites: { paintStyles: [], effectStyles: [], textStyles: [] },
  };

  writeJson(irPath, ir);

  const node = process.execPath;
  const cli = path.join(ROOT, 'dist', 'cli.js');
  if (!fs.existsSync(cli)) {
    throw new Error(`Missing ${cli}. Run: pnpm build`);
  }

  run(node, [cli, '--target', 'react_native', '--ir', irPath, '--out', outDir, '--name', 'ds']);

  const tsc = path.join(ROOT, 'node_modules', '.bin', process.platform === 'win32' ? 'tsc.cmd' : 'tsc');
  run(tsc, ['-p', path.join(outDir, 'tsconfig.json'), '--noEmit']);

  // Build JS to validate runtime entrypoints that do not depend on React.
  run(tsc, ['-p', path.join(outDir, 'tsconfig.json')]);
  const createThemePath = path.join(outDir, 'dist', 'runtime', 'createTheme.js');
  const modesPath = path.join(outDir, 'dist', 'runtime', 'modes.js');
  if (!fs.existsSync(createThemePath) || !fs.existsSync(modesPath)) {
    throw new Error('Expected dist/runtime files to exist after build.');
  }

  console.log('[rn-smoke-cli] OK');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

