import type {
  IR,
  IRCollection,
  IRPaintStyle,
  IREffectStyle,
  IRTextStyle,
  IRValue,
} from '../ir/types';
import {
  newSanitizeContext,
  sanitize,
  sanitizeIdentifier,
} from '../sanitize';

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
  leafName: string; // camelCase getter
  dartType: DartType;
  valuesByMode: Record<string, IRValue>;
  emitToPublic: boolean;
}

export interface PreparedCollection {
  id: string;
  className: string; // PascalCase, e.g. "ColorBasic"
  accessor: string; // camelCase, e.g. "colorBasic"
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

export interface PreparedIR {
  collections: PreparedCollection[];
  paintStyles: PreparedPaintStyle[];
  effectStyles: PreparedEffectStyle[];
  textStyles: PreparedTextStyle[];
  varIndex: Map<string, VarRef>;
}

export function prepareIR(ir: IR): PreparedIR {
  const collections = ir.collections.map(prepareCollection);
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

  return {
    collections,
    paintStyles: ir.composites.paintStyles.map((s) => preparePaint(s)),
    effectStyles: ir.composites.effectStyles.map((s) => prepareEffect(s)),
    textStyles: ir.composites.textStyles.map((s) => prepareText(s)),
    varIndex,
  };
}

function prepareCollection(col: IRCollection): PreparedCollection {
  const className = sanitizeIdentifier(col.name, 'pascal');
  const accessor = lowerFirst(className);
  const modes: PreparedMode[] = col.modes.map((m) => ({
    id: m.id,
    pascal: sanitizeIdentifier(m.name, 'pascal'),
    camel: sanitizeIdentifier(m.name, 'camel'),
  }));

  // Sanitize each variable's path. Dedup is per-collection (a fresh ctx).
  const ctx = newSanitizeContext();
  const variables: PreparedVariable[] = [];
  for (const v of col.variables) {
    if (!v.emitToPublic) continue;
    const { groupPath, leafName } = sanitize(v.groupPath, ctx);
    variables.push({
      id: v.id,
      figmaName: v.figmaName,
      groupPath,
      leafName,
      dartType: dartTypeOf(v.type),
      valuesByMode: v.valuesByMode,
      emitToPublic: v.emitToPublic,
    });
  }

  return {
    id: col.id,
    className,
    accessor,
    defaultModeIndex: 0,
    modes,
    variables,
    fileBaseName: pascalToSnake(className),
  };
}

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
  // Text styles bucket on first figma path segment instead of type.
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

// All paints of a given Figma type land in the same Dart subgroup.
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
