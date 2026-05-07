import { readVariables } from './reader/variables';
import { readPaintStyles } from './reader/paint_styles';
import { readEffectStyles } from './reader/effect_styles';
import { readTextStyles } from './reader/text_styles';
import { validate } from './ir/validate';
import type { IR } from './ir/types';
import { diffManifest } from './manifest';
import { normalizeManifest } from './core/manifest';
import { generateChangelog } from './targets/flutter/generator/changelog';
import { buildZip } from './zip';
import { normalizeExportOptions, DEFAULT_EXPORT_OPTIONS } from './targets/flutter/generator/options';
import { runEngine } from './core/emit_engine';
import { flutterTarget } from './targets/flutter';
import { reactNativeTarget } from './targets/react_native';

figma.showUI(__html__, { width: 440, height: 720, themeColors: false });

figma.ui.onmessage = async (msg: { type: string }) => {
  if (msg.type === 'export') {
    try {
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
      if (result.errors.length > 0) {
        figma.ui.postMessage({
          type: 'validation-errors',
          errors: result.errors,
        });
        return;
      }

      // Read both legacy v1 and current v2 keys; normalizeManifest migrates
      // v1 → v2 transparently so older users don't lose stable names.
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

      figma.ui.postMessage({ type: 'exporting' });

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
      });
    } catch (err) {
      figma.ui.postMessage({
        type: 'error',
        message: err instanceof Error ? err.message : String(err),
      });
    }
  }

  if (msg.type === 'cancel') {
    figma.closePlugin();
  }
};

