import { readVariables } from './reader/variables';
import { readPaintStyles } from './reader/paint_styles';
import { readEffectStyles } from './reader/effect_styles';
import { readTextStyles } from './reader/text_styles';
import { validate } from './ir/validate';
import type {
  IR,
  IRVariable,
  IRCollection,
  IRPaintStyle,
  IREffectStyle,
  IRTextStyle,
} from './ir/types';
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
import type {
  VariablePreview,
  PaintStylePreview,
  EffectStylePreview,
  TextStylePreview,
} from './ui/lib/messages';

figma.showUI(__html__, { width: 440, height: 720, themeColors: false });

type Pending = {
  files: { path: string; contents: string }[];
  nextManifest: Manifest;
  packageName: string;
};
let pending: Pending | null = null;

function toHex(rgba: { r: number; g: number; b: number; a: number }): string {
  const r = Math.round(rgba.r * 255)
    .toString(16)
    .padStart(2, '0');
  const g = Math.round(rgba.g * 255)
    .toString(16)
    .padStart(2, '0');
  const b = Math.round(rgba.b * 255)
    .toString(16)
    .padStart(2, '0');
  if (rgba.a < 1) {
    const a = Math.round(rgba.a * 255)
      .toString(16)
      .padStart(2, '0');
    return `#${r}${g}${b}${a}`.toUpperCase();
  }
  return `#${r}${g}${b}`.toUpperCase();
}

function toRgbaString(rgba: { r: number; g: number; b: number; a: number }): string {
  return `rgba(${Math.round(rgba.r * 255)}, ${Math.round(rgba.g * 255)}, ${Math.round(rgba.b * 255)}, ${rgba.a.toFixed(2)})`;
}

function extractVariablePreview(
  v: IRVariable,
  irCollections: IRCollection[],
): VariablePreview {
  const modeKeys = Object.keys(v.valuesByMode);
  const firstVal = modeKeys.length > 0 ? v.valuesByMode[modeKeys[0]] : undefined;

  if (!firstVal) {
    return { id: v.id, name: v.figmaName, type: v.type, valuePreview: '-' };
  }

  if (firstVal.kind === 'alias') {
    let targetName = 'alias';
    let resolvedRgba: { r: number; g: number; b: number; a: number } | undefined;
    for (const c of irCollections) {
      const tv = c.variables.find((x: IRVariable) => x.id === firstVal.targetVariableId);
      if (tv) {
        targetName = tv.figmaName;
        const tKeys = Object.keys(tv.valuesByMode);
        const tVal = tKeys.length > 0 ? tv.valuesByMode[tKeys[0]] : undefined;
        if (
          tVal &&
          tVal.kind === 'literal' &&
          typeof tVal.value === 'object' &&
          tVal.value !== null &&
          'r' in tVal.value
        ) {
          resolvedRgba = tVal.value as any;
        }
        break;
      }
    }
    return {
      id: v.id,
      name: v.figmaName,
      type: v.type,
      valuePreview: targetName,
      colorHex: resolvedRgba ? toHex(resolvedRgba) : undefined,
      colorRgba: resolvedRgba,
      isAlias: true,
    };
  }

  if (v.type === 'COLOR' && typeof firstVal.value === 'object' && firstVal.value !== null) {
    const rgba = firstVal.value as { r: number; g: number; b: number; a: number };
    return {
      id: v.id,
      name: v.figmaName,
      type: v.type,
      valuePreview: toHex(rgba),
      colorHex: toHex(rgba),
      colorRgba: rgba,
      isAlias: false,
    };
  }

  if (v.type === 'FLOAT') {
    return {
      id: v.id,
      name: v.figmaName,
      type: v.type,
      valuePreview: `${firstVal.value}px`,
      isAlias: false,
    };
  }

  return {
    id: v.id,
    name: v.figmaName,
    type: v.type,
    valuePreview: String(firstVal.value),
    isAlias: false,
  };
}

function resolveVarLiteral(
  targetId: string,
  collections: IRCollection[],
  visited = new Set<string>(),
): any {
  if (visited.has(targetId)) return undefined;
  visited.add(targetId);

  for (const col of collections) {
    const v = col.variables.find((x: IRVariable) => x.id === targetId);
    if (!v) continue;
    const modeKeys = Object.keys(v.valuesByMode);
    const val = modeKeys.length > 0 ? v.valuesByMode[modeKeys[0]] : undefined;
    if (!val) return undefined;
    if (val.kind === 'literal') return val.value;
    if (val.kind === 'alias') return resolveVarLiteral(val.targetVariableId, collections, visited);
  }
  return undefined;
}

function extractPaintPreview(p: IRPaintStyle, collections: IRCollection[]): PaintStylePreview {
  if (p.type === 'SOLID') {
    let rgba: { r: number; g: number; b: number; a: number } | undefined;
    if (p.color.kind === 'literal') {
      rgba = p.color.rgba;
    } else if (p.color.kind === 'alias') {
      const resolved = resolveVarLiteral(p.color.targetVariableId, collections);
      if (resolved && typeof resolved === 'object' && 'r' in resolved) rgba = resolved;
    }
    return { id: p.id, name: p.figmaName, type: p.type, colorHex: rgba ? toHex(rgba) : '#7C5CFF' };
  }
  if (p.type === 'GRADIENT_LINEAR') {
    const stops = p.stops
      .map((st) => {
        let rgba = st.color.kind === 'literal' ? st.color.rgba : undefined;
        if (!rgba && st.color.kind === 'alias') {
          const resolved = resolveVarLiteral(st.color.targetVariableId, collections);
          if (resolved && typeof resolved === 'object' && 'r' in resolved) rgba = resolved;
        }
        const hex = rgba ? toRgbaString(rgba) : '#7C5CFF';
        return `${hex} ${Math.round(st.position * 100)}%`;
      })
      .join(', ');
    const deg = Math.round((p.angleRadians * 180) / Math.PI) + 90;
    return {
      id: p.id,
      name: p.figmaName,
      type: p.type,
      gradientCss: `linear-gradient(${deg}deg, ${stops})`,
    };
  }
  return { id: p.id, name: p.figmaName, type: p.type, colorHex: '#7C5CFF' };
}

function extractEffectPreview(e: IREffectStyle, collections: IRCollection[]): EffectStylePreview {
  if (e.type === 'DROP_SHADOW' || e.type === 'INNER_SHADOW') {
    let rgba = e.color.kind === 'literal' ? e.color.rgba : undefined;
    if (!rgba && e.color.kind === 'alias') {
      const resolved = resolveVarLiteral(e.color.targetVariableId, collections);
      if (resolved && typeof resolved === 'object' && 'r' in resolved) rgba = resolved;
    }
    const colorStr = rgba ? toRgbaString(rgba) : 'rgba(0,0,0,0.25)';
    const inset = e.type === 'INNER_SHADOW' ? 'inset ' : '';
    return {
      id: e.id,
      name: e.figmaName,
      type: e.type,
      boxShadowCss: `${inset}${e.offsetX}px ${e.offsetY}px ${e.blurRadius}px ${e.spreadRadius}px ${colorStr}`,
    };
  }
  return { id: e.id, name: e.figmaName, type: e.type };
}

function extractTextPreview(t: IRTextStyle, collections: IRCollection[]): TextStylePreview {
  let family = 'Inter';
  if (t.fontFamily.kind === 'literal') {
    family = String(t.fontFamily.value);
  } else if (t.fontFamily.kind === 'alias') {
    const resolved = resolveVarLiteral(t.fontFamily.targetVariableId, collections);
    if (typeof resolved === 'string') family = resolved;
  }

  let size = 14;
  if (t.fontSize.kind === 'literal') {
    size = Number(t.fontSize.value) || 14;
  } else if (t.fontSize.kind === 'alias') {
    const resolved = resolveVarLiteral(t.fontSize.targetVariableId, collections);
    if (typeof resolved === 'number') size = resolved;
  }

  let weight = 400;
  if (t.fontWeight.kind === 'literal') {
    weight = Number(t.fontWeight.value) || 400;
  } else if (t.fontWeight.kind === 'alias') {
    const resolved = resolveVarLiteral(t.fontWeight.targetVariableId, collections);
    if (typeof resolved === 'number') {
      weight = resolved;
    } else if (typeof resolved === 'string') {
      const parsed = parseInt(resolved, 10);
      if (!isNaN(parsed) && parsed >= 100 && parsed <= 900) {
        weight = parsed;
      } else if (/black|extra.*bold/i.test(resolved)) {
        weight = 900;
      } else if (/bold/i.test(resolved)) {
        weight = 700;
      } else if (/semi.*bold/i.test(resolved)) {
        weight = 600;
      } else if (/medium/i.test(resolved)) {
        weight = 500;
      } else if (/light/i.test(resolved)) {
        weight = 300;
      } else if (/thin/i.test(resolved)) {
        weight = 100;
      }
    }
  }

  return {
    id: t.id,
    name: t.figmaName,
    fontFamily: family,
    fontSize: size,
    fontWeight: weight,
  };
}

figma.ui.onmessage = async (msg: { type: string }) => {
  if (msg.type === 'init') {
    try {
      const collections = await readVariables();
      const paintStyles = await readPaintStyles();
      const effectStyles = await readEffectStyles();
      const textStyles = await readTextStyles();

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

  if (msg.type === 'export') {
    try {
      pending = null;
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
