import type { IRComposites, IRValue } from '../../ir/types';
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
  modes: Array<{ id: string; name: string; key: string }>;
  variables: ResolvedVariable[];
  rootNode: TokenTreeNode;
}

export interface SemanticTokenGraph {
  fileKey: string;
  generatedAt: string;
  collections: GraphCollection[];
  composites: IRComposites;
  variableIndex: Map<string, ResolvedVariable>;
  allModes: Array<{ id: string; name: string; key: string }>;
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
