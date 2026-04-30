import { readVariables } from './reader/variables';
import { readPaintStyles } from './reader/paint_styles';
import { readEffectStyles } from './reader/effect_styles';
import { readTextStyles } from './reader/text_styles';
import { validate } from './ir/validate';
import type { IR } from './ir/types';
import { emitPackage } from './generator/emit';
import type { Manifest } from './manifest';
import { diffManifest } from './manifest';
import { generateChangelog } from './generator/changelog';
import { buildZip } from './zip';

figma.showUI(__html__, { width: 400, height: 300 });

type PendingExport = {
  ir: IR;
  warnings: any[];
  errors: any[];
  oldManifest: Manifest | null;
  nextManifest: Manifest;
  diff: ReturnType<typeof diffManifest>;
  files: { path: string; contents: string }[];
  changelog: string;
};

let pending: PendingExport | null = null;

figma.ui.onmessage = async (msg: { type: string }) => {
  if (msg.type === 'export') {
    try {
      pending = null;
      figma.ui.postMessage({ type: 'validating' });
      const ir: IR = {
        version: '1.0',
        fileKey: figma.fileKey ?? 'unknown',
        generatedAt: new Date().toISOString(),
        collections: await readVariables(),
        composites: {
          paintStyles: await readPaintStyles(),
          effectStyles: await readEffectStyles(),
          textStyles: await readTextStyles(),
        },
      };

      const result = validate(ir);
      console.log('Validation:', {
        errors: result.errors.length,
        warnings: result.warnings.length,
      });
      if (result.warnings.length > 0) {
        console.log('Warnings:', result.warnings);
      }

      if (result.errors.length > 0) {
        console.error('Validation errors — emit blocked:', result.errors);
        figma.ui.postMessage({
          type: 'validation-errors',
          errors: result.errors,
        });
        return;
      }

      // Phase 6: generate package in-memory + diff + changelog + ZIP.
      const oldManifest = (await figma.clientStorage.getAsync(
        'manifest_v1',
      )) as Manifest | null;
      const { files, nextManifest } = emitPackage(
        ir,
        'design_system',
        oldManifest,
      );
      const diff = diffManifest(oldManifest, nextManifest);

      const changelog = generateChangelog(diff);
      pending = {
        ir,
        warnings: result.warnings,
        errors: result.errors,
        oldManifest,
        nextManifest,
        diff,
        files,
        changelog,
      };

      // If warnings exist, show warning screen before allowing export.
      if (result.warnings.length > 0) {
        figma.ui.postMessage({ type: 'validation-warnings', warnings: result.warnings, diff });
        return;
      }
      figma.ui.postMessage({ type: 'ready', diff, summary: summarize(ir, files) });
    } catch (err) {
      console.error('Export failed:', err);
      figma.ui.postMessage({
        type: 'error',
        message: err instanceof Error ? err.message : String(err),
      });
    }
  }

  if (msg.type === 'cancel') {
    pending = null;
    figma.closePlugin();
  }

  if (msg.type === 'continue') {
    if (!pending) {
      figma.ui.postMessage({ type: 'error', message: 'No pending export.' });
      return;
    }
    figma.ui.postMessage({ type: 'ready', diff: pending.diff, summary: summarize(pending.ir, pending.files) });
  }

  if (msg.type === 'download-zip') {
    if (!pending) {
      figma.ui.postMessage({ type: 'error', message: 'No pending export.' });
      return;
    }
    figma.ui.postMessage({ type: 'exporting' });

    // Persist manifest now (stable regen)
    await figma.clientStorage.setAsync('manifest_v1', pending.nextManifest);

    const extra = [
      {
        path: '_meta/manifest.json',
        contents: JSON.stringify(pending.nextManifest, null, 2) + '\n',
      },
      { path: 'CHANGELOG.md', contents: pending.changelog + '\n' },
    ];
    const zipBytes = buildZip([...pending.files, ...extra]);

    figma.ui.postMessage({
      type: 'zip-ready',
      filename: 'design_system.zip',
      bytes: zipBytes,
      changelog: pending.changelog,
      diff: pending.diff,
      summary: summarize(pending.ir, pending.files),
    });
  }
};

function summarize(ir: IR, files: { path: string; contents: string }[]) {
  const variableCount = ir.collections.reduce((acc, c) => acc + c.variables.length, 0);
  const compositeCount =
    ir.composites.paintStyles.length +
    ir.composites.effectStyles.length +
    ir.composites.textStyles.length;
  return {
    collections: ir.collections.length,
    variables: variableCount,
    composites: compositeCount,
    fileCount: files.length,
  };
}
