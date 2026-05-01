import type {
  IR,
  IRCollection,
  IRPaintStyle,
  IREffectStyle,
  IRTextStyle,
  IRValue,
} from '../../../ir/types';
import {
  newSanitizeContext,
  sanitize,
  sanitizeIdentifier,
} from '../../../sanitize';
import type { Manifest } from '../../../manifest';
import { resolveStableCollectionName, resolveStableName } from '../../../manifest';
import type { ExportOptions } from './options';
import { applyLeafAffixes, DEFAULT_EXPORT_OPTIONS } from './options';

// PreparedIR — the IR with all Dart identifiers finalised and a flat var index
// for cross-collection alias lookup. Generators consume this, never raw IR.

export type DartType = 'Color' | 'double' | 'String' | 'bool';

export interface PreparedMode {
  id: string;
  pascal: string; // e.g. "DarkMode"
  camel: string; // e.g. "darkMode"
}

export interface PreparedVariable {
  id: string;
  figmaName: string;
  groupPath: string[]; // PascalCase segments, leading group classes
  leafName: string; // emitted camelCase getter
  stableLeafName: string; // persisted in manifest (no prefix/suffix)
  dartType: DartType;
  valuesByMode: Record<string, IRValue>;
  emitToPublic: boolean;
}

export interface PreparedCollection {
  id: string;
  className: string; // PascalCase, e.g. "ColorBasic"
  accessor: string; // camelCase, e.g. "colorBasic"
  kind: 'primitive' | 'token';
  defaultModeIndex: number;
  modes: PreparedMode[];
  variables: PreparedVariable[];
  fileBaseName: string; // snake_case, e.g. "color_basic"
}

export interface VarRef {
  collectionAccessor: string;
  groupPath: string[]; // PascalCase
  leafName: string; // camelCase
  dartType: DartType;
}

export interface PreparedPaintStyle {
  id: string;
  type: IRPaintStyle['type'];
  groupName: string; // first segment of figmaName, sanitized PascalCase
  getterName: string; // remaining segments joined into camelCase
  raw: IRPaintStyle;
}

export interface PreparedEffectStyle {
  id: string;
  type: IREffectStyle['type'];
  groupName: string;
  getterName: string;
  raw: IREffectStyle;
}

export interface PreparedTextStyle {
  id: string;
  groupName: string;
  getterName: string;
  raw: IRTextStyle;
}

export type PreparedWarning =
  | {
      type: 'KEYWORD_CONFLICT';
      variableId: string;
      original: string;
      fixed: string;
    }
  | {
      type: 'DUPLICATE_DART_NAME';
      variableId: string;
      original: string;
      fixed: string;
    };

export interface PreparedIR {
  collections: PreparedCollection[];
  paintStyles: PreparedPaintStyle[];
  effectStyles: PreparedEffectStyle[];
  textStyles: PreparedTextStyle[];
  varIndex: Map<string, VarRef>;
  nextManifest: Manifest;
  warnings: PreparedWarning[];
}

export function prepareIR(
  ir: IR,
  manifest: Manifest | null = null,
  options: ExportOptions = DEFAULT_EXPORT_OPTIONS,
): PreparedIR {
  const warnings: PreparedWarning[] = [];
  const collections = ir.collections.map((c) =>
    prepareCollection(c, manifest, options, warnings),
  );
  const varIndex = new Map<string, VarRef>();
  for (const col of collections) {
    for (const v of col.variables) {
      varIndex.set(v.id, {
        collectionAccessor: col.accessor,
        groupPath: v.groupPath,
        leafName: v.leafName,
        dartType: v.dartType,
      });
    }
  }

  const paintStyles = dedupCompositeGetters(
    ir.composites.paintStyles.map((s) => preparePaint(s)),
    (s) => `${s.groupName}`,
  );
  const effectStyles = dedupCompositeGetters(
    ir.composites.effectStyles.map((s) => prepareEffect(s)),
    (s) => `${s.groupName}`,
  );
  const textStyles = dedupCompositeGetters(
    ir.composites.textStyles.map((s) => prepareText(s)),
    (s) => `${s.groupName}`,
  );

  const nextManifest = buildNextManifest(ir, collections, manifest);

  return {
    collections,
    paintStyles,
    effectStyles,
    textStyles,
    varIndex,
    nextManifest,
    warnings,
  };
}

// Disallow collisions with Flutter/Dart SDK symbols that show up in generated
// files (e.g. `FontWeight`, `Color`). Keep this list small and additive.
const DISALLOWED_COLLECTION_CLASS_NAMES = new Set(['FontWeight', 'Color']);

function prepareCollection(
  col: IRCollection,
  manifest: Manifest | null,
  options: ExportOptions,
  warnings: PreparedWarning[],
): PreparedCollection {
  let className = sanitizeIdentifier(col.name, 'pascal');
  if (DISALLOWED_COLLECTION_CLASS_NAMES.has(className)) {
    className = `${className}Tokens`;
  }
  className = resolveStableCollectionName(col.id, className, manifest);
  const accessor = lowerFirst(className);
  const modes: PreparedMode[] = col.modes.map((m) => ({
    id: m.id,
    pascal: sanitizeIdentifier(m.name, 'pascal'),
    camel: sanitizeIdentifier(m.name, 'camel'),
  }));

  // Sanitize each variable's path. Dedup is per-collection (a fresh ctx).
  const ctx = newSanitizeContext();
  const finalNamesByParent = new Map<string, Set<string>>();
  const variables: PreparedVariable[] = [];
  for (const v of col.variables) {
    if (!v.emitToPublic) continue;
    const { groupPath, leafName, notes } = sanitize(v.groupPath, ctx);
    if (notes.keywordFixedFrom) {
      warnings.push({
        type: 'KEYWORD_CONFLICT',
        variableId: v.id,
        original: notes.keywordFixedFrom,
        fixed: leafName,
      });
    }
    if (notes.dedupedAs !== undefined) {
      const base = leafName.slice(0, -String(notes.dedupedAs).length);
      warnings.push({
        type: 'DUPLICATE_DART_NAME',
        variableId: v.id,
        original: base,
        fixed: leafName,
      });
    }
    let stableLeaf = resolveStableName(v.id, leafName, manifest);
    stableLeaf = dedupLeafName(finalNamesByParent, groupPath.join('/'), stableLeaf);
    const emittedLeaf = applyLeafAffixes(
      stableLeaf,
      options.naming.leafPrefix,
      options.naming.leafSuffix,
    );
    variables.push({
      id: v.id,
      figmaName: v.figmaName,
      groupPath,
      leafName: emittedLeaf,
      stableLeafName: stableLeaf,
      dartType: dartTypeOf(v.type),
      valuesByMode: v.valuesByMode,
      emitToPublic: v.emitToPublic,
    });
  }

  return {
    id: col.id,
    className,
    accessor,
    kind: col.kind,
    defaultModeIndex: 0,
    modes,
    variables,
    fileBaseName: pascalToSnake(className),
  };
}

function dedupLeafName(
  usedByParent: Map<string, Set<string>>,
  parentKey: string,
  leaf: string,
): string {
  let used = usedByParent.get(parentKey);
  if (!used) {
    used = new Set();
    usedByParent.set(parentKey, used);
  }
  if (!used.has(leaf)) {
    used.add(leaf);
    return leaf;
  }
  let i = 2;
  while (used.has(`${leaf}${i}`)) i++;
  const next = `${leaf}${i}`;
  used.add(next);
  return next;
}

function buildNextManifest(
  ir: IR,
  cols: PreparedCollection[],
  oldManifest: Manifest | null,
): Manifest {
  const variables: Record<string, string> = {};
  const collections: Record<string, string> = {};
  const figmaVar: Record<string, string> = {};
  const figmaCol: Record<string, string> = {};

  for (const c of cols) {
    collections[c.id] = c.className;
  }
  for (const c of ir.collections) {
    figmaCol[c.id] = c.name;
    for (const v of c.variables) {
      figmaVar[v.id] = v.figmaName;
    }
  }
  for (const c of cols) {
    for (const v of c.variables) {
      variables[v.id] = v.stableLeafName;
    }
  }

  const preservedTargets: Manifest['targets'] = { ...(oldManifest?.targets ?? {}) };
  preservedTargets[FLUTTER_TARGET_ID] = {
    variables,
    collections,
    figmaNames: { variables: figmaVar, collections: figmaCol },
  };

  return {
    version: '2.0',
    fileKey: ir.fileKey,
    lastExportedAt: new Date().toISOString(),
    targets: preservedTargets,
  };
}

const FLUTTER_TARGET_ID = 'flutter';

function preparePaint(s: IRPaintStyle): PreparedPaintStyle {
  const { groupName, getterName } = splitFigmaNameForComposite(
    paintBucket(s.type),
    s.figmaName,
  );
  return { id: s.id, type: s.type, groupName, getterName, raw: s };
}

function prepareEffect(s: IREffectStyle): PreparedEffectStyle {
  const { groupName, getterName } = splitFigmaNameForComposite(
    effectBucket(s.type),
    s.figmaName,
  );
  return { id: s.id, type: s.type, groupName, getterName, raw: s };
}

function prepareText(s: IRTextStyle): PreparedTextStyle {
  const segments = s.figmaName.split('/').map((x) => x.trim()).filter(Boolean);
  let groupName: string;
  let getterParts: string[];
  if (segments.length >= 2) {
    groupName = sanitizeIdentifier(segments[0], 'pascal');
    getterParts = segments.slice(1);
  } else {
    groupName = 'Main';
    getterParts = segments;
  }
  const getterName = sanitizeIdentifier(getterParts.join(' '), 'camel');
  return { id: s.id, groupName, getterName, raw: s };
}

function paintBucket(t: IRPaintStyle['type']): string {
  switch (t) {
    case 'SOLID':
      return 'Solid';
    case 'GRADIENT_LINEAR':
      return 'Linear';
    case 'GRADIENT_RADIAL':
      return 'Radial';
    case 'GRADIENT_ANGULAR':
      return 'Angular';
    case 'GRADIENT_DIAMOND':
      return 'Diamond';
    case 'IMAGE':
      return 'Image';
  }
}

function effectBucket(t: IREffectStyle['type']): string {
  switch (t) {
    case 'DROP_SHADOW':
      return 'Drop';
    case 'INNER_SHADOW':
      return 'Inner';
    case 'LAYER_BLUR':
      return 'LayerBlur';
    case 'BACKGROUND_BLUR':
      return 'BackgroundBlur';
  }
}

function splitFigmaNameForComposite(
  groupName: string,
  figmaName: string,
): { groupName: string; getterName: string } {
  const segments = figmaName.split('/').map((s) => s.trim()).filter(Boolean);
  const getter = segments.length === 0 ? 'unnamed' : segments.join(' ');
  return { groupName, getterName: sanitizeIdentifier(getter, 'camel') };
}

function dedupCompositeGetters<T extends { getterName: string }>(
  items: T[],
  bucketKey: (item: T) => string,
): T[] {
  const used = new Map<string, number>();
  for (const it of items) {
    const base = it.getterName;
    const key = `${bucketKey(it)}::${base}`;
    const n = used.get(key);
    if (n === undefined) {
      used.set(key, 1);
      continue;
    }
    const next = n + 1;
    used.set(key, next);
    it.getterName = `${base}_${next}`;
  }
  return items;
}

function dartTypeOf(t: 'COLOR' | 'FLOAT' | 'STRING' | 'BOOLEAN'): DartType {
  switch (t) {
    case 'COLOR':
      return 'Color';
    case 'FLOAT':
      return 'double';
    case 'STRING':
      return 'String';
    case 'BOOLEAN':
      return 'bool';
  }
}

function lowerFirst(s: string): string {
  if (!s) return s;
  return s[0].toLowerCase() + s.slice(1);
}

function pascalToSnake(s: string): string {
  return s
    .replace(/([a-z0-9])([A-Z])/g, '$1_$2')
    .replace(/([A-Z]+)([A-Z][a-z])/g, '$1_$2')
    .toLowerCase();
}

