import type {
  IR,
  IRCollection,
  IREffectStyle,
  IRMode,
  IRPaintStyle,
  IRTextStyle,
  IRValue,
  IRVariable,
} from '../../../ir/types';
import type { Manifest, ManifestTargetSection } from '../../../core/manifest';
import {
  resolveStableCollectionName,
  resolveStableVariableName,
} from '../../../core/manifest';
import type { TargetWarning } from '../../../core/target';
import {
  androidClassName,
  androidMemberName,
  KOTLIN_RESERVED,
} from '../identifier';

export const ANDROID_TARGET_ID = 'android';

export type KotlinType = 'Color' | 'Float' | 'String' | 'Boolean';

export interface PreparedAndroidMode {
  id: string;
  figmaName: string;
  enumEntry: string;
}

export interface PreparedAndroidVariable {
  id: string;
  figmaName: string;
  type: IRVariable['type'];
  scopes: IRVariable['scopes'];
  groupPath: string[];
  leafName: string;
  stableLeafName: string;
  kotlinType: KotlinType;
  valuesByMode: Record<string, IRValue>;
}

export interface PreparedAndroidCollection {
  id: string;
  figmaName: string;
  className: string;
  accessor: string;
  kind: IRCollection['kind'];
  defaultModeIndex: number;
  modes: PreparedAndroidMode[];
  variables: PreparedAndroidVariable[];
  fileName: string;
}

export interface AndroidVarRef {
  collectionAccessor: string;
  groupPath: string[];
  leafName: string;
  kotlinType: KotlinType;
  type: IRVariable['type'];
  scopes: IRVariable['scopes'];
}

export interface PreparedAndroidPaintStyle {
  id: string;
  type: IRPaintStyle['type'];
  getterName: string;
  raw: IRPaintStyle;
}

export interface PreparedAndroidEffectStyle {
  id: string;
  type: IREffectStyle['type'];
  getterName: string;
  raw: IREffectStyle;
}

export interface PreparedAndroidTextStyle {
  id: string;
  getterName: string;
  raw: IRTextStyle;
}

export interface PreparedAndroid {
  collections: PreparedAndroidCollection[];
  paintStyles: PreparedAndroidPaintStyle[];
  effectStyles: PreparedAndroidEffectStyle[];
  textStyles: PreparedAndroidTextStyle[];
  varIndex: Map<string, AndroidVarRef>;
  nextManifestSection: ManifestTargetSection;
  warnings: TargetWarning[];
}

const DISALLOWED_COLLECTION_CLASS_NAMES = new Set([
  'Color',
  'TextStyle',
  'FontWeight',
  'Brush',
  'Dp',
  'TextUnit',
  'AppTheme',
  'AppThemeData',
  'DesignSystem',
  'DesignSystemWrapper',
  'DesignSystemController',
  'DSColorStyles',
  'DSShadows',
  'DSStyles',
  'DSTextStyle',
  'DSShadow',
]);

export function prepareAndroid(ir: IR, manifest: Manifest | null): PreparedAndroid {
  const warnings: TargetWarning[] = [];
  const collections = ir.collections.map((c) =>
    prepareCollection(c, manifest, warnings),
  );
  const varIndex = new Map<string, AndroidVarRef>();
  for (const col of collections) {
    for (const v of col.variables) {
      varIndex.set(v.id, {
        collectionAccessor: col.accessor,
        groupPath: v.groupPath,
        leafName: v.leafName,
        kotlinType: v.kotlinType,
        type: v.type,
        scopes: v.scopes,
      });
    }
  }

  const paintStyles = dedupCompositeGetters(
    ir.composites.paintStyles.map(preparePaint),
    () => 'paint',
  );
  const effectStyles = dedupCompositeGetters(
    ir.composites.effectStyles.map((s) => prepareEffect(s, warnings)),
    () => 'effect',
  );
  const textStyles = dedupCompositeGetters(
    ir.composites.textStyles.map(prepareText),
    () => 'text',
  );

  return {
    collections,
    paintStyles,
    effectStyles,
    textStyles,
    varIndex,
    nextManifestSection: buildManifestSection(ir, collections),
    warnings,
  };
}

function prepareCollection(
  col: IRCollection,
  manifest: Manifest | null,
  warnings: TargetWarning[],
): PreparedAndroidCollection {
  let derivedClass = androidClassName(col.name);
  if (DISALLOWED_COLLECTION_CLASS_NAMES.has(derivedClass)) {
    derivedClass = `${derivedClass}Tokens`;
  }
  const className = resolveStableCollectionName(
    ANDROID_TARGET_ID,
    col.id,
    derivedClass,
    manifest,
  );
  const accessor = lowerFirst(className);
  const modes = col.modes.map(prepareMode);
  const finalNamesByParent = new Map<string, Set<string>>();
  const variables: PreparedAndroidVariable[] = [];

  for (const v of col.variables) {
    if (!v.emitToPublic) continue;
    const segs = (v.groupPath ?? [])
      .map((s) => (s ?? '').trim())
      .filter(Boolean);
    const groupRaw = segs.slice(0, -1);
    const leafRaw = segs[segs.length - 1] ?? 'unnamed';
    const groupPath = groupRaw.map(androidClassName);
    const derivedLeaf = androidMemberName(leafRaw);
    if (isReservedFixedName(derivedLeaf)) {
      warnings.push({
        targetId: ANDROID_TARGET_ID,
        code: 'KEYWORD_CONFLICT',
        message: `Variable ${v.id}: Kotlin reserved word "${derivedLeaf.slice(0, -1)}" renamed to "${derivedLeaf}".`,
        details: {
          variableId: v.id,
          original: derivedLeaf.slice(0, -1),
          fixed: derivedLeaf,
        },
      });
    }
    let stableLeaf = resolveStableVariableName(
      ANDROID_TARGET_ID,
      v.id,
      derivedLeaf,
      manifest,
    );
    const fixedLeaf = fixMemberName(stableLeaf);
    if (fixedLeaf !== stableLeaf) {
      warnings.push({
        targetId: ANDROID_TARGET_ID,
        code: 'KEYWORD_CONFLICT',
        message: `Variable ${v.id}: Kotlin reserved word "${stableLeaf}" renamed to "${fixedLeaf}".`,
        details: { variableId: v.id, original: stableLeaf, fixed: fixedLeaf },
      });
      stableLeaf = fixedLeaf;
    }
    const parentKey = groupPath.join('/');
    const dedupedLeaf = dedupLeaf(finalNamesByParent, parentKey, stableLeaf);
    if (dedupedLeaf !== stableLeaf) {
      warnings.push({
        targetId: ANDROID_TARGET_ID,
        code: 'DUPLICATE_LEAF_NAME',
        message: `Variable ${v.id}: leaf "${stableLeaf}" collided with a sibling - renamed to "${dedupedLeaf}".`,
        details: { variableId: v.id, original: stableLeaf, fixed: dedupedLeaf },
      });
      stableLeaf = dedupedLeaf;
    }
    variables.push({
      id: v.id,
      figmaName: v.figmaName,
      type: v.type,
      scopes: v.scopes ?? [],
      groupPath,
      leafName: stableLeaf,
      stableLeafName: stableLeaf,
      kotlinType: kotlinTypeOf(v.type),
      valuesByMode: v.valuesByMode,
    });
  }

  return {
    id: col.id,
    figmaName: col.name,
    className,
    accessor,
    kind: col.kind,
    defaultModeIndex: 0,
    modes,
    variables,
    fileName: `${className}.kt`,
  };
}

function prepareMode(m: IRMode): PreparedAndroidMode {
  let entry = androidClassName(m.name);
  if (!/Mode$/.test(entry)) entry = `${entry}Mode`;
  return { id: m.id, figmaName: m.name, enumEntry: entry };
}

function preparePaint(s: IRPaintStyle): PreparedAndroidPaintStyle {
  return {
    id: s.id,
    type: s.type,
    getterName: getterNameFromFigmaName(s.figmaName),
    raw: s,
  };
}

function prepareEffect(
  s: IREffectStyle,
  warnings: TargetWarning[],
): PreparedAndroidEffectStyle {
  if (s.type === 'LAYER_BLUR' || s.type === 'BACKGROUND_BLUR') {
    warnings.push({
      targetId: ANDROID_TARGET_ID,
      code: 'UNSUPPORTED_COMPOSE_EFFECT',
      message: `Effect style ${s.id}: ${s.type} has no direct Compose shadow equivalent and will be skipped.`,
      details: { effectStyleId: s.id, effectType: s.type },
    });
  }
  return {
    id: s.id,
    type: s.type,
    getterName: getterNameFromFigmaName(s.figmaName),
    raw: s,
  };
}

function prepareText(s: IRTextStyle): PreparedAndroidTextStyle {
  return {
    id: s.id,
    getterName: getterNameFromFigmaName(s.figmaName),
    raw: s,
  };
}

function getterNameFromFigmaName(figmaName: string): string {
  const segs = figmaName.split('/').map((s) => s.trim()).filter(Boolean);
  return androidMemberName(segs.length === 0 ? 'unnamed' : segs.join(' '));
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
    it.getterName = `${base}${next}`;
  }
  return items;
}

function buildManifestSection(
  ir: IR,
  cols: PreparedAndroidCollection[],
): ManifestTargetSection {
  const variables: Record<string, string> = {};
  const collections: Record<string, string> = {};
  const figmaVar: Record<string, string> = {};
  const figmaCol: Record<string, string> = {};

  for (const c of cols) collections[c.id] = c.className;
  for (const c of ir.collections) {
    figmaCol[c.id] = c.name;
    for (const v of c.variables) figmaVar[v.id] = v.figmaName;
  }
  for (const c of cols) {
    for (const v of c.variables) variables[v.id] = v.stableLeafName;
  }

  return {
    variables,
    collections,
    figmaNames: { variables: figmaVar, collections: figmaCol },
  };
}

function kotlinTypeOf(t: IRVariable['type']): KotlinType {
  switch (t) {
    case 'COLOR':
      return 'Color';
    case 'FLOAT':
      return 'Float';
    case 'STRING':
      return 'String';
    case 'BOOLEAN':
      return 'Boolean';
  }
}

function fixMemberName(name: string): string {
  return KOTLIN_RESERVED.has(name) ? `${name}_` : name;
}

function isReservedFixedName(name: string): boolean {
  return name.endsWith('_') && KOTLIN_RESERVED.has(name.slice(0, -1));
}

function dedupLeaf(
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

function lowerFirst(s: string): string {
  return s ? s[0].toLowerCase() + s.slice(1) : s;
}
