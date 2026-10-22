import type { IREffectStyle, IRPaintStyle, IRTextStyle, IRValue } from '../../ir/types';
import type { TargetWarning } from '../target';

export type PrimitiveLiteral = string | number | boolean;

export interface RGBAValue {
  r: number;
  g: number;
  b: number;
  a: number;
  hex: string;
  rgbaString: string;
}

export type ResolvedLiteral = RGBAValue | PrimitiveLiteral;

export interface Mode {
  id: string;
  name: string;
  key: string;
}

export interface ResolvedPaintValue {
  readonly hex: string | null;
  readonly rgba: RGBAValue | null;
  readonly stops?: Array<{
    readonly hex: string | null;
    readonly rgba: RGBAValue | null;
    readonly position: number;
  }>;
  readonly assetName?: string;
}

export interface ResolvedPaintStyle {
  readonly id: string;
  readonly name: string;
  readonly figmaName: string;
  readonly groupPath?: string[];
  readonly type: IRPaintStyle['type'];
  readonly raw: IRPaintStyle;
  readonly valuesByMode: Record<string, ResolvedPaintValue>;
}

export interface ResolvedEffectValue {
  readonly shadowColor: string | null;
  readonly rgba: RGBAValue | null;
  readonly offsetX: number;
  readonly offsetY: number;
  readonly blurRadius: number;
  readonly spread?: number;
  readonly opacity: number;
}

export interface ResolvedEffectStyle {
  readonly id: string;
  readonly name: string;
  readonly figmaName: string;
  readonly groupPath?: string[];
  readonly type: IREffectStyle['type'];
  readonly raw: IREffectStyle;
  readonly valuesByMode: Record<string, ResolvedEffectValue>;
}

export interface ResolvedTextStyle {
  readonly id: string;
  readonly name: string;
  readonly figmaName: string;
  readonly groupPath?: string[];
  readonly raw: IRTextStyle;
  readonly valuesByMode: Record<
    string,
    {
      fontFamily: string | null;
      fontSize: number | null;
      fontWeight: string | null;
      lineHeight: { value: number; unit: 'PIXELS' | 'PERCENT' | 'AUTO' } | null;
      letterSpacing: { value: number; unit: 'PIXELS' | 'PERCENT' | 'AUTO' } | null;
    }
  >;
}

export interface ResolvedComposites {
  readonly paintStyles: ResolvedPaintStyle[];
  readonly effectStyles: ResolvedEffectStyle[];
  readonly textStyles: ResolvedTextStyle[];
}

export interface ResolvedVariable {
  id: string;
  figmaName: string;
  type: 'COLOR' | 'FLOAT' | 'STRING' | 'BOOLEAN';
  groupPath: string[];
  leafName: string;
  scopes: string[];
  emitToPublic: boolean;
  resolvedValuesByMode: Record<string, ResolvedLiteral>;
  rawValuesByMode: Record<string, IRValue>;
  collectionId: string;
  collectionName: string;
  collectionKind: 'primitive' | 'token';
}

export interface TokenTreeNode {
  name: string;
  children: Map<string, TokenTreeNode>;
  variables: Map<string, ResolvedVariable>;
}

export interface GraphCollection {
  id: string;
  name: string;
  kind: 'primitive' | 'token';
  modes: Mode[];
  variables: ResolvedVariable[];
  rootNode: TokenTreeNode;
}

export interface SemanticTokenGraph {
  fileKey: string;
  generatedAt: string;
  collections: GraphCollection[];
  composites: ResolvedComposites;
  resolvedComposites?: ResolvedComposites;
  variableIndex: Map<string, ResolvedVariable>;
  allModes: Mode[];
  warnings: TargetWarning[];
}

export function isSemanticGraph(input: unknown): input is SemanticTokenGraph {
  return Boolean(
    input &&
    typeof input === 'object' &&
    'variableIndex' in input &&
    'allModes' in input,
  );
}
