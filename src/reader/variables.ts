import type {
  IRCollection,
  IRMode,
  IRVariable,
  IRValue,
  RGBA,
  VariableScope,
} from '../ir/types';

// Reads all local Variable Collections + their variables and converts each value to IR.
// Aliases are preserved as `{ kind: 'alias', targetVariableId }` — never flattened.
//
// Identifier sanitization is target-specific; targets derive names from figmaName / groupPath.
export async function readVariables(): Promise<IRCollection[]> {
  const collections = await figma.variables.getLocalVariableCollectionsAsync();
  const variables = await figma.variables.getLocalVariablesAsync();

  return collections.map((col: any) => {
    const colVars = variables.filter((v: any) => v.variableCollectionId === col.id);

    const modes: IRMode[] = col.modes.map((m: any) => ({
      id: m.modeId,
      name: m.name,
    }));

    // Default mode is the first mode in the collection. Variables with no
    // value for some other mode fall back to the default mode's value so the
    // generator never sees `value: undefined` literals.
    const defaultModeId = modes[0]?.id;

    const irVars: IRVariable[] = colVars.map((v: any) => {
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
        type: v.resolvedType as IRVariable['type'],
        scopes: ((v.scopes ?? []) as unknown) as VariableScope[],
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
  if (
    raw !== null &&
    typeof raw === 'object' &&
    'type' in raw &&
    (raw as { type: unknown }).type === 'VARIABLE_ALIAS'
  ) {
    return {
      kind: 'alias',
      targetVariableId: (raw as unknown as { id: string }).id,
    };
  }
  return { kind: 'literal', value: raw as RGBA | number | string | boolean };
}
