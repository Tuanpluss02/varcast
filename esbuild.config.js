const esbuild = require('esbuild');
const fs = require('fs');
const path = require('path');

const watch = process.argv.includes('--watch');

async function copyUi() {
  const src = path.join(__dirname, 'src', 'ui.html');
  const distDir = path.join(__dirname, 'dist');
  if (!fs.existsSync(distDir)) fs.mkdirSync(distDir, { recursive: true });
  fs.copyFileSync(src, path.join(distDir, 'ui.html'));
}

async function run() {
  const pluginOpts = {
    entryPoints: [path.join(__dirname, 'src', 'main.ts')],
    outfile: path.join(__dirname, 'dist', 'code.js'),
    bundle: true,
    platform: 'browser',
    target: 'es2017',
    logLevel: 'info',
  };

  const cliOpts = {
    entryPoints: [path.join(__dirname, 'src', 'generator_cli.ts')],
    outfile: path.join(__dirname, 'dist', 'cli.js'),
    bundle: true,
    platform: 'node',
    target: 'node18',
    logLevel: 'info',
  };

  if (watch) {
    const pluginCtx = await esbuild.context(pluginOpts);
    const cliCtx = await esbuild.context(cliOpts);
    await pluginCtx.watch();
    await cliCtx.watch();
    fs.watch(path.join(__dirname, 'src', 'ui.html'), copyUi);
    await copyUi();
    console.log('esbuild: watching for changes…');
  } else {
    await esbuild.build(pluginOpts);
    await esbuild.build(cliOpts);
    await copyUi();
  }
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
