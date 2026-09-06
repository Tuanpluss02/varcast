import { readIR } from './reader';
import { validate } from './ir/validate';
import { diffManifest } from './manifest';
import type { Manifest } from './core/manifest';
import { normalizeManifest } from './core/manifest';
import { generateChangelog } from './targets/flutter/generator/changelog';
import { buildZip } from './zip';
import {
  normalizeExportOptions,
  DEFAULT_EXPORT_OPTIONS,
} from './targets/flutter/generator/options';
import { runEngine } from './core/emit_engine';
import { flutterTarget } from './targets/flutter';
import { reactNativeTarget } from './targets/react_native';
import {
  extractVariablePreview,
  extractPaintPreview,
  extractEffectPreview,
  extractTextPreview,
} from './ui/preview_adapter';

figma.showUI(__html__, { width: 440, height: 720, themeColors: false });

type Pending = {
  files: { path: string; contents: string }[];
  nextManifest: Manifest;
  packageName: string;
};
let pending: Pending | null = null;

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
      const rawOptions = m.options;
      const options = normalizeExportOptions(rawOptions as Parameters<typeof normalizeExportOptions>[0] ?? DEFAULT_EXPORT_OPTIONS);
      const targetId = (rawOptions as { targetId?: string } | undefined)?.targetId ?? 'flutter';
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
      const targets =
        targetId === 'react_native' ? [reactNativeTarget] : [flutterTarget];
      const { files, nextManifest } = runEngine(
        ir,
        targets,
        oldManifest,
        targetId === 'react_native' ? { react_native: options } : { flutter: options },
      );
      const diff = diffManifest(oldManifest, nextManifest);
      const changelog = generateChangelog(diff);

      const allFiles = [
        ...files,
        {
          path: '_meta/manifest.json',
          contents: JSON.stringify(nextManifest, null, 2) + '\n',
        },
        { path: 'CHANGELOG.md', contents: changelog + '\n' },
      ];

      pending = {
        files: allFiles,
        nextManifest,
        packageName: options.packageName,
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
          added: diff.added.length,
          removed: diff.removed.length,
          renamed: diff.renamed.length,
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
    if (!pending) {
      figma.ui.postMessage({
        type: 'error',
        message: 'No pending export. Run Export again.',
      });
      return;
    }
    figma.ui.postMessage({ type: 'exporting' });
    await figma.clientStorage.setAsync('manifest_v2', pending.nextManifest);
    const zipBytes = buildZip(pending.files);
    figma.ui.postMessage({
      type: 'zip-ready',
      filename: `${pending.packageName}.zip`,
      bytes: zipBytes,
    });
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
