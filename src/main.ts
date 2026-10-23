import { readIR } from './reader';
import { validate } from './ir/validate';
import type { Manifest } from './core/manifest';
import { normalizeManifest, diffManifestForTarget } from './core/manifest';
import { generateMultiTargetChangelog } from './core/manifest/changelog';
import { handleDownloadZip, type PendingExportData } from './download_handler';
import { runEngine } from './core/emit_engine';
import { getAllTargets, getTarget } from './core/registry';
// Ensure default targets are registered:
import './targets/flutter';
import './targets/react_native';
import './targets/compose';
import {
  extractVariablePreview,
  extractPaintPreview,
  extractEffectPreview,
  extractTextPreview,
} from './ui/preview_adapter';

figma.showUI(__html__, { width: 440, height: 720, themeColors: false });

let pending: PendingExportData | null = null;

figma.ui.onmessage = async (msg: unknown) => {
  const m = (msg ?? {}) as { type?: string; options?: unknown };
  if (m.type === 'init') {
    try {
      const ir = await readIR();
      const { collections } = ir;
      const { paintStyles, effectStyles, textStyles } = ir.composites;

      figma.ui.postMessage({
        type: 'init-data',
        collections: collections.map((c) => ({
          id: c.id,
          name: c.name,
          kind: c.kind,
          variableCount: c.variables.length,
          modeCount: c.modes.length,
          variables: c.variables.map((v) => extractVariablePreview(v, collections)),
        })),
        composites: {
          paintStylesCount: paintStyles.length,
          effectStylesCount: effectStyles.length,
          textStylesCount: textStyles.length,
          paintStyles: paintStyles.map((p) => extractPaintPreview(p, collections)),
          effectStyles: effectStyles.map((e) => extractEffectPreview(e, collections)),
          textStyles: textStyles.map((t) => extractTextPreview(t, collections)),
        },
        availableTargets: getAllTargets().map((t) => ({
          id: t.id,
          displayName: t.displayName ?? t.id,
          defaultPackageName: t.defaultPackageName ?? 'tokens',
        })),
      });
    } catch (err) {
      figma.ui.postMessage({
        type: 'error',
        message: err instanceof Error ? err.message : String(err),
      });
    }
  }

  if (m.type === 'export') {
    try {
      pending = null;
      const rawOptions = (m.options ?? {}) as Record<string, unknown>;
      const targetId = (rawOptions.targetId as string | undefined) ?? 'flutter';
      const target = getTarget(targetId);

      const rawPkg = rawOptions.packageName as string | undefined;
      const packageName = rawPkg
        ? (target.sanitizePackageName ? target.sanitizePackageName(rawPkg) : rawPkg)
        : (target.defaultPackageName ?? 'tokens');

      const ir = await readIR();

      const result = validate(ir);
      if (result.errors.length > 0) {
        figma.ui.postMessage({
          type: 'validation-errors',
          errors: result.errors,
        });
        return;
      }

      const rawManifest =
        (await figma.clientStorage.getAsync('manifest_v2')) ??
        (await figma.clientStorage.getAsync('manifest_v1'));
      const oldManifest = normalizeManifest(rawManifest);

      const { files, nextManifest, diffsByTarget } = runEngine(
        ir,
        [target],
        oldManifest,
        { [targetId]: rawOptions },
      );
      const diff = diffsByTarget[targetId] ?? diffManifestForTarget(oldManifest, nextManifest, targetId);
      const changelog = generateMultiTargetChangelog(diffsByTarget);

      const allFiles = [
        ...files,
        {
          path: '_meta/manifest.json',
          contents: JSON.stringify(nextManifest, null, 2) + '\n',
        },
        {
          path: '_meta/ir.json',
          contents: JSON.stringify(ir, null, 2) + '\n',
        },
        { path: 'CHANGELOG.md', contents: changelog + '\n' },
      ];

      pending = {
        files: allFiles,
        nextManifest,
        packageName,
      };

      const previewFiles = allFiles.map((f) => ({
        path: f.path,
        contents: f.contents,
        size: byteLength(f.contents),
      }));
      const totalBytes = previewFiles.reduce((acc, f) => acc + f.size, 0);

      figma.ui.postMessage({
        type: 'preview-ready',
        files: previewFiles,
        diff: {
          added:
            diff.variables.added.length +
            diff.collections.added.length +
            diff.composites.added.length,
          removed:
            diff.variables.removed.length +
            diff.collections.removed.length +
            diff.composites.removed.length,
          renamed:
            diff.variables.renamed.length +
            diff.collections.renamed.length +
            diff.composites.renamed.length,
        },
        summary: {
          fileCount: previewFiles.length,
          totalBytes,
        },
      });
    } catch (err) {
      figma.ui.postMessage({
        type: 'error',
        message: err instanceof Error ? err.message : String(err),
      });
    }
  }

  if (m.type === 'download-zip') {
    await handleDownloadZip(
      pending,
      figma.clientStorage,
      figma.ui.postMessage.bind(figma.ui),
    );
  }

  if (m.type === 'cancel') {
    pending = null;
    figma.closePlugin();
  }
};

function byteLength(s: string): number {
  let n = 0;
  for (const ch of s) {
    const cp = ch.codePointAt(0)!;
    if (cp < 0x80) n += 1;
    else if (cp < 0x800) n += 2;
    else if (cp < 0x10000) n += 3;
    else n += 4;
  }
  return n;
}
