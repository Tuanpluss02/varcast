import { readVariables } from './reader/variables';
import { readPaintStyles } from './reader/paint_styles';
import { readEffectStyles } from './reader/effect_styles';
import { readTextStyles } from './reader/text_styles';
import { validate } from './ir/validate';
import type { IR } from './ir/types';
import type { Manifest } from './manifest';
import { diffManifest } from './manifest';
import { normalizeManifest } from './core/manifest';
import { generateChangelog } from './targets/flutter/generator/changelog';
import { buildZip } from './zip';
import { normalizeExportOptions, DEFAULT_EXPORT_OPTIONS } from './targets/flutter/generator/options';
import { runEngine } from './core/emit_engine';
import { flutterTarget } from './targets/flutter';
import { reactNativeTarget } from './targets/react_native';

figma.showUI(__html__, { width: 440, height: 720, themeColors: false });

type PendingExport = {
  ir: IR;
  warnings: any[];
  errors: any[];
  oldManifest: Manifest | null;
  nextManifest: Manifest;
  diff: ReturnType<typeof diffManifest>;
  files: { path: string; contents: string }[];
  changelog: string;
  options: ReturnType<typeof normalizeExportOptions>;
  targetId: string;
};

let pending: PendingExport | null = null;

figma.ui.onmessage = async (msg: { type: string }) => {
  if (msg.type === 'export') {
    try {
      pending = null;
      figma.ui.postMessage({ type: 'validating' });
      const options = normalizeExportOptions((msg as any).options ?? DEFAULT_EXPORT_OPTIONS);
      const targetId = ((msg as any).options?.targetId as string | undefined) ?? 'flutter';
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
      // Read both legacy v1 and current v2 keys; normalizeManifest migrates
      // v1 → v2 transparently so older users don't lose stable names.
      const rawManifest =
        (await figma.clientStorage.getAsync('manifest_v2')) ??
        (await figma.clientStorage.getAsync('manifest_v1'));
      const oldManifest: Manifest | null = normalizeManifest(rawManifest);
      const targets =
        targetId === 'react_native' ? [reactNativeTarget] : [flutterTarget];
      const { files, nextManifest, warnings: targetWarnings } = runEngine(
        ir,
        targets,
        oldManifest,
        targetId === 'react_native' ? { react_native: options } : { flutter: options },
      );
      const diff = diffManifest(oldManifest, nextManifest);

      // Merge IR validation warnings with per-target prepare warnings so the
      // UI can display all non-fatal diagnostics in one place.
      const mergedWarnings = [
        ...result.warnings,
        ...targetWarnings.map((w) => ({
          type: 'TARGET_WARNING' as const,
          targetId: w.targetId,
          code: w.code,
          message: w.message,
        })),
      ];

      const changelog = generateChangelog(diff);
      pending = {
        ir,
        warnings: mergedWarnings,
        errors: result.errors,
        oldManifest,
        nextManifest,
        diff,
        files,
        changelog,
        options,
        targetId,
      };

      // UX: "Export" should export immediately (no warnings/ready screens).
      // Errors still block export. Warnings are non-fatal and only logged.
      if (mergedWarnings.length > 0) {
        console.log('Non-fatal warnings (auto-fixed):', mergedWarnings);
      }

      figma.ui.postMessage({ type: 'exporting' });

      // Persist manifest now (stable regen). Write v2 going forward.
      await figma.clientStorage.setAsync('manifest_v2', nextManifest);

      const extra = [
        {
          path: '_meta/manifest.json',
          contents: JSON.stringify(nextManifest, null, 2) + '\n',
        },
        { path: 'CHANGELOG.md', contents: changelog + '\n' },
      ];
      const zipBytes = buildZip([...files, ...extra]);

      figma.ui.postMessage({
        type: 'zip-ready',
        filename: `${options.packageName}.zip`,
        bytes: zipBytes,
        changelog,
        diff,
        summary: summarize(ir, files),
      });

      pending = null;
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
    figma.ui.postMessage({
      type: 'ready',
      diff: pending.diff,
      summary: summarize(pending.ir, pending.files),
      options: pending.options,
    });
  }

  if (msg.type === 'download-zip') {
    if (!pending) {
      figma.ui.postMessage({ type: 'error', message: 'No pending export.' });
      return;
    }
    figma.ui.postMessage({ type: 'exporting' });

    // Persist manifest now (stable regen). Write v2 going forward.
    await figma.clientStorage.setAsync('manifest_v2', pending.nextManifest);

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
      filename: `${pending.options.packageName}.zip`,
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
