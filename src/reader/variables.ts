import type {
  IRCollection,
  IRMode,
  IRVariable,
  IRValue,
  RGBA,
  VariableScope,
} from '../ir/types';

function isVariableAlias(raw: unknown): raw is VariableAlias {
  return (
    raw !== null &&
    typeof raw === 'object' &&
    'type' in raw &&
    (raw as { type: unknown }).type === 'VARIABLE_ALIAS' &&
    'id' in raw &&
    typeof (raw as { id: unknown }).id === 'string'
  );
}

/**
 * Reads all local Figma Variable Collections and variables into IR collections.
 */
export async function readVariables(): Promise<IRCollection[]> {
  const collections = await figma.variables.getLocalVariableCollectionsAsync();
  const variables = await figma.variables.getLocalVariablesAsync();

  return collections.map((col: VariableCollection) => {
    const colVars = variables.filter((v: Variable) => v.variableCollectionId === col.id);

    const modes: IRMode[] = col.modes.map((m: VariableMode) => ({
      id: m.modeId,
      name: m.name,
    }));

    const defaultModeId = modes[0]?.id;

    const irVars: IRVariable[] = colVars.map((v: Variable) => {
      const rawByMode: Record<string, unknown> = v.valuesByMode ?? {};
      const fallback =
        defaultModeId !== undefined ? rawByMode[defaultModeId] : undefined;
      const valuesByMode: Record<string, IRValue> = {};
      for (const mode of modes) {
        const raw = rawByMode[mode.id];
        if (raw === undefined) {
          if (fallback === undefined) continue;
          valuesByMode[mode.id] = buildValue(fallback);
          continue;
        }
        valuesByMode[mode.id] = buildValue(raw);
      }

      return {
        id: v.id,
        figmaName: v.name,
        groupPath: String(v.name)
          .split('/')
          .map((s: string) => s.trim())
          .filter((s: string) => s.length > 0),
        type: v.resolvedType,
        scopes: (v.scopes ?? []) as VariableScope[],
        hiddenFromPublishing: v.hiddenFromPublishing,
        emitToPublic: !v.hiddenFromPublishing,
        valuesByMode,
      };
    });

    const hasAlias = irVars.some((v) =>
      Object.values(v.valuesByMode).some((val) => val.kind === 'alias'),
    );

    return {
      id: col.id,
      name: col.name,
      kind: hasAlias ? 'token' : 'primitive',
      modes,
      variables: irVars,
    } satisfies IRCollection;
  });
}

function buildValue(raw: unknown): IRValue {
  if (isVariableAlias(raw)) {
    return {
      kind: 'alias',
      targetVariableId: raw.id,
    };
  }
  return { kind: 'literal', value: raw as RGBA | number | string | boolean };
}
