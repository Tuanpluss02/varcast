const esbuild = require('esbuild');
const fs = require('fs');
const path = require('path');

const watch = process.argv.includes('--watch');

async function copyUi() {
  const srcHtml = path.join(__dirname, 'src', 'ui', 'index.html');
  const srcCss = path.join(__dirname, 'src', 'ui', 'ui.css');
  const distDir = path.join(__dirname, 'dist');
  if (!fs.existsSync(distDir)) fs.mkdirSync(distDir, { recursive: true });

  const distUiJs = path.join(distDir, 'ui.js');
  const html = fs.readFileSync(srcHtml, 'utf8');
  const css = fs.existsSync(srcCss) ? fs.readFileSync(srcCss, 'utf8') : '';
  const js = fs.existsSync(distUiJs) ? fs.readFileSync(distUiJs, 'utf8') : '';

  // Inline assets into ui.html for reliability in Figma WebView.
  const inlined = html
    .replace(
      /<link\s+rel=["']stylesheet["']\s+href=["'][^"']+["']\s*\/?>/i,
      `<style>\n${css}\n</style>`,
    )
    .replace(
      /<script\s+src=["'][^"']+["']\s*><\/script>/i,
      `<script>\n${js}\n</script>`,
    );

  fs.writeFileSync(path.join(distDir, 'ui.html'), inlined, 'utf8');
  // Keep ui.css around (nice for debugging, but ui.html no longer depends on it).
  if (fs.existsSync(srcCss)) fs.copyFileSync(srcCss, path.join(distDir, 'ui.css'));
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

  const uiOpts = {
    entryPoints: [path.join(__dirname, 'src', 'ui', 'main.ts')],
    outfile: path.join(__dirname, 'dist', 'ui.js'),
    bundle: true,
    platform: 'browser',
    target: 'es2017',
    format: 'iife',
    logLevel: 'info',
  };

  if (watch) {
    const pluginCtx = await esbuild.context(pluginOpts);
    const cliCtx = await esbuild.context(cliOpts);
    const uiCtx = await esbuild.context(uiOpts);
    await pluginCtx.watch();
    await cliCtx.watch();
    await uiCtx.watch();
    fs.watch(path.join(__dirname, 'src', 'ui', 'index.html'), copyUi);
    fs.watch(path.join(__dirname, 'src', 'ui', 'ui.css'), copyUi);
    await copyUi();
    console.log('esbuild: watching for changes…');
  } else {
    await esbuild.build(pluginOpts);
    await esbuild.build(cliOpts);
    await esbuild.build(uiOpts);
    await copyUi();
  }
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
