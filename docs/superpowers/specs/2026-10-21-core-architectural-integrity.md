# Spec: Core Architectural Integrity, Data Model Enrichment & Target Toolkit

## 1. Goal & Architecture
Eliminate all patchwork code and architectural leaks in `Varcast Core`. Transform `core/` into a complete, self-contained, rich semantic compiler that provides full token provenance, lossless primitive representations, unified diagnostics, domain-separated sanitization, and reusable target preparation abstractions.

Future targets (SwiftUI, Jetpack Compose, CSS Variables, Tailwind) will consume this architecture with zero boilerplate and zero modifications to `core/`.

---

## 2. Five Pillars of the Architectural Specification

### 2.1 Pillar 1: Rich Semantic Token Graph (Lossless Data Model)
The `SemanticTokenGraph` is the single source of truth for the entire design system. No target should ever need to maintain separate global reverse-lookup maps or regex-parse string representations.

1. **`ResolvedVariable` Provenance**:
   In `plugin/src/core/graph/types.ts`:
   ```typescript
   export interface ResolvedVariable {
     readonly id: string;
     readonly figmaName: string;
     readonly type: 'COLOR' | 'FLOAT' | 'STRING' | 'BOOLEAN';
     readonly groupPath: string[];
     readonly leafName: string;
     readonly scopes: string[];
     readonly emitToPublic: boolean;
     readonly resolvedValuesByMode: Record<string, ResolvedLiteral>;
     readonly rawValuesByMode: Record<string, IRValue>;

     // Parent collection provenance:
     readonly collectionId: string;
     readonly collectionName: string;
     readonly collectionKind: 'primitive' | 'token';
   }
   ```
   Populated natively in `build_graph.ts` during collection traversal (`col.id`, `col.name`, `col.kind`).

2. **`ResolvedPaintStyle` & `ResolvedEffectStyle` Lossless RGBA**:
   In `plugin/src/core/graph/types.ts` & `plugin/src/core/graph/composite_resolver.ts`:
   ```typescript
   export interface ResolvedPaintValue {
     readonly hex: string | null;
     readonly rgba: RGBAValue | null;
     readonly stops?: Array<{
       hex: string | null;
       rgba: RGBAValue | null;
       position: number;
     }>;
     readonly assetName?: string;
   }

   export interface ResolvedPaintStyle {
     readonly id: string;
     readonly name: string;
     readonly figmaName: string;
     readonly groupPath: string[];
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
     readonly groupPath: string[];
     readonly type: IREffectStyle['type'];
     readonly raw: IREffectStyle;
     readonly valuesByMode: Record<string, ResolvedEffectValue>;
   }
   ```
   Every paint and effect style stores the raw `rgba: RGBAValue | null` (`{ r, g, b, a, hex, rgbaString }`) computed during resolution. Targets like CSS (`rgb(r g b / a)`), Swift (`Color(.sRGB, ...)`), Compose (`Color(r, g, b, a)`), and Flutter (`Color.fromARGB`) use numbers directly without parsing hex strings.

---

### 2.2 Pillar 2: Unified Diagnostics & Warning Pipeline
The core compilation pipeline (`buildSemanticGraph` and `alias_resolver`) must be the sole authority for identifying invalid design token states. Targets must never be forced to traverse AST trees to discover diagnostics.

1. **Graph-Level Warning Collection**:
   In `plugin/src/core/graph/alias_resolver.ts`:
   - When an alias target variable is not found in `lookup`:
     `warn?.('UNRESOLVED_ALIAS', \`Target variable "${targetId}" not found in lookup.\`)`.
   - When a cycle is detected via `visited.has(targetId)`:
     `warn?.('CYCLE', \`Cycle detected in alias chain involving variable "${targetId}".\`)`.
   - Multi-mode fallback continues to emit `MODE_FALLBACK_APPROXIMATED`.

2. **Engine Propagation**:
   - `buildSemanticGraph` gathers all warnings into `graph.warnings: TargetWarning[]`.
   - `emit_engine.ts` appends `graph.warnings` to `EngineOutput.warnings`.
   - **Target Simplification**: Delete the 40-line manual unresolved alias scanning loop from `plugin/src/targets/react_native/generator/prepare.ts:164-206`.

---

### 2.3 Pillar 3: Domain-Driven Sanitization (Preserving Numbers)
Sanitization must strictly distinguish between **Collection metadata stripping** and **Token word normalization**.

1. **`stripOrderingPrefix(name: string): string`**:
   Dedicated function in `plugin/src/core/sanitize_base.ts` used **only** for Collection names to remove Figma folder ordering numbers (e.g. `"[1] Color-Basic"` $\rightarrow$ `"Color-Basic"`, `"01. Layout"` $\rightarrow$ `"Layout"`).

2. **`processSegment(seg: string): string`**:
   Used for Variable, Style, and Group segments.
   - **Never delete numbers**. Delete the destructive `while (words.length > 0 && /^\d+$/.test(words[0])) words.shift();` block.
   - `"100 Primary"` splits into `['100', 'Primary']` $\rightarrow$ camelCase becomes `"n100Primary"`.
   - `"400 Regular"` $\rightarrow$ `"n400Regular"`.
   - `"Regular 400"` $\rightarrow$ `"regular400"`.
   - `"12 Spacing"` $\rightarrow$ `"n12Spacing"`.
   - Pure numeric segments (`"100"`) produce `"n100"`.

---

### 2.4 Pillar 4: Core Target Toolkit (Eliminate Target Boilerplate)
Targets should only provide platform-specific identifier conventions and code templates. All multi-pass stable allocation and manifest section construction logic belongs in `core/`.

1. **`allocateStableCollectionIdentifiers`** in `plugin/src/core/naming/dedup.ts`:
   ```typescript
   export function allocateStableCollectionIdentifiers<
     TVar extends { id: string; figmaName: string; groupPath: string[]; leafName: string },
   >(
     variables: TVar[],
     manifestSection: ManifestTargetSection | null,
     sanitizeLeaf: (rawLeaf: string) => string,
   ): Map<string, { stableLeafKey: string; isStable: boolean }>;
   ```
   Executes the standardized 2-Pass algorithm:
   - **Pass 1 (Reserve Stable)**: Pre-reserves all variables present in `manifestSection.variables[id]` into group namespaces using `dedupSiblingKeys`.
   - **Pass 2 (Allocate & Dedup)**: Assigns the reserved name for pinned tokens, or sanitizes and allocates deduplicated suffix names (`key2`, `key3`) for new tokens.

2. **`assembleTargetSection`** in `plugin/src/core/manifest/section_assembler.ts`:
   ```typescript
   export interface TargetSectionAssemblyInput {
     readonly collections: Array<{
       readonly id: string;
       readonly name: string;
       readonly exportName: string;
       readonly variables: Array<{
         readonly id: string;
         readonly figmaName: string;
         readonly stableLeafKey: string;
       }>;
     }>;
     readonly composites?: Array<{
       readonly id: string;
       readonly figmaName: string;
       readonly getterName: string;
     }>;
   }

   export function assembleTargetSection(input: TargetSectionAssemblyInput): ManifestTargetSection;
   ```
   Assembles the standard Manifest v2 target section (`variables`, `collections`, `composites`, `figmaNames.variables`, `figmaNames.collections`, `figmaNames.composites`).

3. **Target Refactoring**:
   Flutter `prepare.ts` and React Native `prepare.ts` adopt these helpers, reducing their footprint to lean, platform-focused configuration.

---

### 2.5 Pillar 5: Multi-Target Orchestration & Consolidated Changelog
1. **`generateMultiTargetChangelog`** in `plugin/src/core/manifest/changelog.ts`:
   ```typescript
   export function generateMultiTargetChangelog(
     diffsByTarget: Record<string, ManifestDiff>,
   ): string;
   ```
   - Single target: Emits standard concise changelog.
   - Multiple targets: Emits a unified markdown document with `## <target.id>` sections summarizing additions, modifications, and deletions for each target.
2. **`runEngine` Integration**:
   - `EngineOutput` continues to expose `diffsByTarget`.
   - `main.ts` and `generator_cli.ts` call `generateMultiTargetChangelog` when writing or displaying changelogs.

---

## 3. Invariants & Constraints
- Zero `as any` type assertions.
- 100% backward compatibility for existing Flutter and React Native generated output code.
- All unit, integration, and smoke tests MUST pass cleanly.
