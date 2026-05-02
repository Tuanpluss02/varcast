import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { execFileSync } from 'node:child_process';

// This is a runtime smoke test for the *generated* RN package.
// It avoids importing the package entrypoint because that depends on React at runtime.

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.join(__dirname, '..');
const OUT = path.join(ROOT, '.tmp_rn_pkg_runtime');

function writeFiles(root, files) {
  for (const f of files) {
    const full = path.join(root, f.path);
    fs.mkdirSync(path.dirname(full), { recursive: true });
    fs.writeFileSync(full, f.contents);
  }
}

async function main() {
  fs.rmSync(OUT, { recursive: true, force: true });

  // Prefer the output produced by `scripts/rn_smoke_cli.mjs`.
  const cliOut = path.join(ROOT, '.tmp_rn_cli_smoke', 'out');
  const fallback = path.join(ROOT, '.tmp_rn_pkg');
  if (!fs.existsSync(OUT)) {
    const src = fs.existsSync(cliOut) ? cliOut : fs.existsSync(fallback) ? fallback : null;
    if (!src) {
      throw new Error(
        `Expected generated package at ${cliOut}. Run: pnpm smoke:rn`,
      );
    }
    fs.cpSync(src, OUT, { recursive: true });
  }

  const tscPath = path.join(ROOT, 'node_modules', '.bin', process.platform === 'win32' ? 'tsc.cmd' : 'tsc');
  execFileSync(tscPath, ['-p', path.join(OUT, 'tsconfig.json')], { stdio: 'inherit' });

  const createThemeUrl = pathToFileURL(path.join(OUT, 'dist', 'runtime', 'createTheme.js')).toString();
  const modesUrl = pathToFileURL(path.join(OUT, 'dist', 'runtime', 'modes.js')).toString();

  const { createTheme } = await import(createThemeUrl);
  const { setTokenMode } = await import(modesUrl);

  let state = {};
  const setModes = (updater) => {
    state = typeof updater === 'function' ? updater(state) : updater;
  };

  const theme = createTheme({}, setModes);
  setTokenMode(theme, 'colorToken', 'darkMode');

  if (state.colorToken !== 'darkMode') {
    throw new Error(`Expected state.colorToken to be 'darkMode', got ${JSON.stringify(state)}`);
  }

  console.log('[rn-smoke-runtime] OK');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

