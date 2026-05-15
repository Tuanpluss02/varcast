import { readVariables } from './reader/variables';
import { readPaintStyles } from './reader/paint_styles';
import { readEffectStyles } from './reader/effect_styles';
import { readTextStyles } from './reader/text_styles';
import { validate } from './ir/validate';
import type { IR } from './ir/types';
import type { Manifest } from './core/manifest';
import { diffManifestForTarget, normalizeManifest } from './core/manifest';
import { generateChangelog } from './targets/flutter/generator/changelog';
import { buildZip } from './zip';
import { normalizeExportOptions, DEFAULT_EXPORT_OPTIONS } from './targets/flutter/generator/options';
import { runEngine } from './core/emit_engine';
import { flutterTarget } from './targets/flutter';
import { mergeRnOptions, reactNativeTarget } from './targets/react_native';

figma.showUI(__html__, { width: 440, height: 720, themeColors: false });

// Cached between Export and Download so we don't re-read or re-prepare the IR.
// Cleared on a fresh Export run, on cancel, or once the ZIP is delivered.
type Pending = {
  files: { path: string; contents: string }[];
  nextManifest: Manifest;
  packageName: string;
};
let pending: Pending | null = null;

figma.ui.onmessage = async (msg: { type: string }) => {
  if (msg.type === 'export') {
    try {
      pending = null;
      const rawOpts = (msg as any).options ?? DEFAULT_EXPORT_OPTIONS;
      const targetId = (rawOpts.targetId as string | undefined) ?? 'flutter';
      // Each target normalizes its own option shape — Flutter has archMode,
      // RN has flavor, etc. The UI sends the raw form for both.
      const flutterOptions =
        targetId === 'flutter' ? normalizeExportOptions(rawOpts) : null;
      const rnOptions =
        targetId === 'react_native'
          ? mergeRnOptions({
              flavor: rawOpts.rnFlavor,
              packageName: rawOpts.packageName,
              include: rawOpts.include,
            })
          : null;
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
        targetId === 'react_native'
          ? { react_native: rnOptions }
          : { flutter: flutterOptions },
      );
      const diff = diffManifestForTarget(oldManifest, nextManifest, targetId);
      const changelog = generateChangelog(diff);

      const allFiles = [
        ...files,
        {
          path: '_meta/manifest.json',
          contents: JSON.stringify(nextManifest, null, 2) + '\n',
        },
        { path: 'CHANGELOG.md', contents: changelog + '\n' },
      ];

      const packageName =
        targetId === 'react_native' ? rnOptions!.packageName : flutterOptions!.packageName;

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

  if (msg.type === 'download-zip') {
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

  if (msg.type === 'cancel') {
    pending = null;
    figma.closePlugin();
  }
};

// Figma's plugin sandbox doesn't expose TextEncoder, so count UTF-8 bytes by hand.
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
