import * as fs from 'fs';
import * as path from 'path';
import { runEngine } from '../src/core/emit_engine';
import { reactNativeTarget } from '../src/targets/react_native';
import type { IR } from '../src/ir/types';

function writeFiles(root: string, files: { path: string; contents: string }[]) {
  for (const f of files) {
    const full = path.join(root, f.path);
    fs.mkdirSync(path.dirname(full), { recursive: true });
    fs.writeFileSync(full, f.contents);
  }
}

async function main() {
  const outRoot = path.join(__dirname, '..', '.tmp_rn_pkg');
  fs.rmSync(outRoot, { recursive: true, force: true });

  const ir: IR = {
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

  const out = runEngine(ir, [reactNativeTarget], null, {
    react_native: { packageName: 'ds' },
  });

  writeFiles(outRoot, out.files);
  console.log(`Wrote RN package to ${outRoot}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

