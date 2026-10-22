# Core Architectural Integrity Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Establish first-principles architectural integrity across `Varcast Core` by enriching the core semantic data model with provenance and lossless RGBA data, unifying diagnostic warnings, separating sanitization domains to preserve numeric tokens, providing a standardized target preparation toolkit, and supporting consolidated multi-target changelogs.

**Architecture:**
1. `ResolvedVariable` natively includes `collectionId`, `collectionName`, and `collectionKind`.
2. `ResolvedPaintStyle` and `ResolvedEffectStyle` store lossless `rgba: RGBAValue | null` (`{ r, g, b, a, hex, rgbaString }`) across all modes and gradient stops.
3. `core/graph/alias_resolver.ts` and `build_graph.ts` natively emit `UNRESOLVED_ALIAS` and `CYCLE` warnings into `graph.warnings`.
4. `core/sanitize_base.ts` decouples `stripOrderingPrefix` (collection names only) from `processSegment` (which preserves 100% of numeric tokens like `"100 Primary"`, `"400 Regular"`).
5. `core/manifest/section_assembler.ts` (`assembleTargetSection`) and `core/naming/dedup.ts` (`allocateStableCollectionIdentifiers`) encapsulate 2-pass reservation and section assembly into clean Core helpers, eliminating duplicate boilerplate across Flutter and React Native.
6. `core/manifest/changelog.ts` provides `generateMultiTargetChangelog(diffsByTarget)` for unified multi-target export.

**Tech Stack:** TypeScript (strict), Node.js, Vitest, Figma Plugin API.

**Spec:** [docs/superpowers/specs/2026-10-21-core-architectural-integrity.md](file:///Users/tuanpluss02/Documents/stormx/Varcast/plugin/docs/superpowers/specs/2026-10-21-core-architectural-integrity.md)

## Global Constraints

- Manifest v2 is the only supported manifest version; all manifest section building belongs to `assembleTargetSection` and final aggregation belongs to `emit_engine.ts`.
- Zero `as any` type assertions across the entire codebase.
- No destructive word/number dropping in token sanitization (`"100 Primary"` must never lose `"100"`).
- All 46 test files and 373 existing tests MUST pass, with new tests added for each pillar.
- Flutter and React Native target outputs must maintain 100% backward compatibility.

## Review Focus

1. **Token number preservation**: Token segments starting with or containing numbers (`"100 Primary"`, `"400 Regular"`, `"12 Spacing"`) must retain their numeric values in identifier output (e.g. `n100Primary`, `n400Regular`).
2. **Reverse collection lookup**: Variables referenced via aliases must provide their parent `collectionId`, `collectionName`, and `collectionKind` directly on `ResolvedVariable`.
3. **Lossless RGBA availability**: Paint styles and effect styles must expose `rgba: RGBAValue | null` with exact numeric floats $0..1$ and hex strings.
4. **Diagnostic warning capture**: Dangling aliases and cycles must trigger `UNRESOLVED_ALIAS` and `CYCLE` warnings on `SemanticTokenGraph.warnings` without throwing.
5. **Multi-target changelog coherence**: Multi-target diffs must render clean markdown sections per target without duplicate headers or corrupting single-target changelogs.

---

### Task 1: Data Model Enrichment (ResolvedVariable Provenance & Lossless RGBA Composites)

**Files:**
- Modify: `plugin/src/core/graph/types.ts`
- Modify: `plugin/src/core/graph/build_graph.ts`
- Modify: `plugin/src/core/graph/composite_resolver.ts`
- Test: `plugin/src/__tests__/core/graph/data_model_enrichment.test.ts`

**Interfaces:**
- Consumes: `SemanticTokenGraph`, `RGBAValue`.
- Produces:
  ```typescript
  // ResolvedVariable carries collection provenance:
  readonly collectionId: string;
  readonly collectionName: string;
  readonly collectionKind: 'primitive' | 'token';

  // ResolvedPaintValue & ResolvedEffectValue carry RGBA:
  readonly rgba: RGBAValue | null;
  ```

- [ ] **Step 1: Write failing tests for data model enrichment**

```typescript
// plugin/src/__tests__/core/graph/data_model_enrichment.test.ts
import { describe, it, expect } from 'vitest';
import { buildSemanticGraph } from '../../core/graph/build_graph';
import type { IR } from '../../ir/types';

describe('Data Model Enrichment', () => {
  const ir: IR = {
    version: '2.0',
    fileKey: 'f1',
    generatedAt: '2026-10-21T00:00:00Z',
    collections: [
      {
        id: 'col_colors',
        name: 'Colors',
        kind: 'primitive',
        modes: [{ id: 'm1', name: 'Light' }],
        variables: [
          {
            id: 'v_blue',
            name: 'blue500',
            figmaName: 'blue/500',
            type: 'COLOR',
            valuesByMode: { m1: { kind: 'literal', value: { r: 0.1, g: 0.2, b: 0.8, a: 1 } } },
          },
        ],
      },
    ],
    composites: {
      paintStyles: [
        {
          id: 'ps_card',
          name: 'cardBg',
          figmaName: 'card/bg',
          type: 'SOLID',
          color: { kind: 'literal', rgba: { r: 0.5, g: 0.5, b: 0.5, a: 0.8 } },
          opacity: 0.8,
        },
      ],
      effectStyles: [],
      textStyles: [],
    },
  };

  it('populates collection provenance on ResolvedVariable', () => {
    const graph = buildSemanticGraph(ir);
    const v = graph.variableIndex.get('v_blue');
    expect(v).toBeDefined();
    expect(v?.collectionId).toBe('col_colors');
    expect(v?.collectionName).toBe('Colors');
    expect(v?.collectionKind).toBe('primitive');
  });

  it('populates lossless rgba structure on ResolvedPaintStyle', () => {
    const graph = buildSemanticGraph(ir);
    const paint = graph.composites.paintStyles[0];
    expect(paint.valuesByMode.m1.rgba).toBeDefined();
    expect(paint.valuesByMode.m1.rgba?.r).toBe(0.5);
    expect(paint.valuesByMode.m1.rgba?.a).toBe(0.8);
    expect(paint.valuesByMode.m1.rgba?.hex).toBe('#808080CC');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd plugin && pnpm vitest run src/__tests__/core/graph/data_model_enrichment.test.ts`
Expected: FAIL (`collectionId` / `rgba` not defined on types/objects).

- [ ] **Step 3: Implement provenance and lossless RGBA in `types.ts`, `build_graph.ts`, and `composite_resolver.ts`**

1. In `plugin/src/core/graph/types.ts`:
   - Add `collectionId: string`, `collectionName: string`, `collectionKind: 'primitive' | 'token'` to `ResolvedVariable`.
   - Update `ResolvedPaintValue` to include `rgba: RGBAValue | null` and gradient stops to include `rgba: RGBAValue | null`.
   - Update `ResolvedEffectValue` to include `rgba: RGBAValue | null`.
2. In `plugin/src/core/graph/build_graph.ts`:
   - When building `resolvedVar`: pass `collectionId: col.id`, `collectionName: col.name`, `collectionKind: col.kind`.
3. In `plugin/src/core/graph/composite_resolver.ts`:
   - In `resolveColorAndOpacity`: return `{ hex: string | null; opacity: number; rgba: RGBAValue | null }`.
   - In `resolvePaintStyle`: assign `rgba` on `valuesByMode[mode.id]` and each gradient stop.
   - In `resolveEffectStyle`: assign `rgba` on `valuesByMode[mode.id]`.
4. Update any existing test fixtures in `plugin/src/__tests__/` that construct manual `ResolvedVariable` objects to provide `collectionId: 'col_1', collectionName: 'Col', collectionKind: 'primitive'`.

- [ ] **Step 4: Run test to verify it passes**

Run: `cd plugin && pnpm vitest run src/__tests__/core/graph/data_model_enrichment.test.ts`
Expected: PASS.

- [ ] **Step 5: Run full test suite & typecheck**

Run: `cd plugin && pnpm typecheck && pnpm test`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
cd plugin
git add src/core/graph/ src/__tests__/
git commit -m "feat(graph): enrich resolved variable provenance and composite lossless rgba"
```

---

### Task 2: Domain-Driven Sanitization (Preserve Numbers & Separate Ordering Prefix)

**Files:**
- Modify: `plugin/src/core/sanitize_base.ts`
- Modify: `plugin/src/targets/flutter/identifier.ts`
- Modify: `plugin/src/targets/react_native/identifier.ts`
- Test: `plugin/src/__tests__/core/sanitize_numeric.test.ts`

**Interfaces:**
- Consumes: Raw name strings.
- Produces:
  ```typescript
  export function stripOrderingPrefix(name: string): string;
  export function processSegment(seg: string): string; // Never deletes digits
  export function sanitizeWords(s: string): string[];
  ```

- [ ] **Step 1: Write failing tests for numeric token preservation and collection prefix stripping**

```typescript
// plugin/src/__tests__/core/sanitize_numeric.test.ts
import { describe, it, expect } from 'vitest';
import { stripOrderingPrefix, processSegment, sanitizeWords } from '../../core/sanitize_base';
import { sanitizeIdentifier } from '../../targets/flutter/identifier';
import { sanitizeJsIdentifier } from '../../targets/react_native/identifier';

describe('Domain-Driven Sanitization', () => {
  it('strips ordering prefix only for collection names', () => {
    expect(stripOrderingPrefix('[1] Color-Basic')).toBe('Color-Basic');
    expect(stripOrderingPrefix('01. Typography')).toBe('Typography');
    expect(stripOrderingPrefix('02 - Spacing')).toBe('Spacing');
    expect(stripOrderingPrefix('Normal Collection')).toBe('Normal Collection');
  });

  it('preserves numeric tokens without dropping digits', () => {
    expect(sanitizeWords('100 Primary')).toEqual(['100', 'primary']);
    expect(sanitizeWords('400 Regular')).toEqual(['400', 'regular']);
    expect(sanitizeWords('12 Spacing')).toEqual(['12', 'spacing']);
    expect(sanitizeWords('Regular 400')).toEqual(['regular', '400']);
  });

  it('formats camelCase safely with leading digits prefixed with n', () => {
    expect(sanitizeIdentifier('100 Primary', 'camel')).toBe('n100Primary');
    expect(sanitizeIdentifier('400 Regular', 'camel')).toBe('n400Regular');
    expect(sanitizeIdentifier('Regular 400', 'camel')).toBe('regular400');
    expect(sanitizeJsIdentifier('100 Primary')).toBe('n100Primary');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd plugin && pnpm vitest run src/__tests__/core/sanitize_numeric.test.ts`
Expected: FAIL (`'100'` dropped by `processSegment`).

- [ ] **Step 3: Implement `stripOrderingPrefix` and preserve numbers in `processSegment`**

1. In `plugin/src/core/sanitize_base.ts`:
   - Export `stripOrderingPrefix(name: string): string`:
     ```typescript
     export function stripOrderingPrefix(name: string): string {
       return name.replace(/^\s*\[?\s*\d+\s*\]?[.\-_:\s]*/, '').trim() || name;
     }
     ```
   - In `processSegment(seg: string)`:
     Remove `while (words.length > 0 && /^\d+$/.test(words[0])) words.shift();`.
     Keep all words.
2. In `plugin/src/targets/flutter/identifier.ts`:
   - In `flutterWordsFromRaw(raw)`: if used for collection name, run `stripOrderingPrefix`.
   - When converting words to camelCase: if `words[0]` starts with a digit, prefix with `'n'`.
3. In `plugin/src/targets/react_native/identifier.ts`:
   - Ensure collection naming uses `stripOrderingPrefix` where appropriate.
   - When converting words to camelCase: if `words[0]` starts with a digit, prefix with `'n'`.

- [ ] **Step 4: Run test to verify it passes**

Run: `cd plugin && pnpm vitest run src/__tests__/core/sanitize_numeric.test.ts`
Expected: PASS.

- [ ] **Step 5: Run full test suite & typecheck**

Run: `cd plugin && pnpm typecheck && pnpm test`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
cd plugin
git add src/core/sanitize_base.ts src/targets/flutter/identifier.ts src/targets/react_native/identifier.ts src/__tests__/core/sanitize_numeric.test.ts
git commit -m "fix(core): preserve numeric token segments and separate collection ordering prefix stripping"
```

---

### Task 3: Unified Diagnostics Pipeline (UNRESOLVED_ALIAS & CYCLE in Core Graph)

**Files:**
- Modify: `plugin/src/core/graph/alias_resolver.ts`
- Modify: `plugin/src/core/graph/build_graph.ts`
- Modify: `plugin/src/targets/react_native/generator/prepare.ts`
- Test: `plugin/src/__tests__/core/graph/diagnostics_pipeline.test.ts`

**Interfaces:**
- Consumes: `IR`, `VariableLookup`.
- Produces:
  - `SemanticTokenGraph.warnings` contains `UNRESOLVED_ALIAS` and `CYCLE` warnings.
  - Zero target-side manual alias scanning loops.

- [ ] **Step 1: Write failing tests for graph diagnostics pipeline**

```typescript
// plugin/src/__tests__/core/graph/diagnostics_pipeline.test.ts
import { describe, it, expect } from 'vitest';
import { buildSemanticGraph } from '../../core/graph/build_graph';
import type { IR } from '../../ir/types';

describe('Unified Diagnostics Pipeline', () => {
  it('records UNRESOLVED_ALIAS warning on graph when alias points to non-existent variable', () => {
    const ir: IR = {
      version: '2.0',
      fileKey: 'f1',
      generatedAt: '2026-10-21T00:00:00Z',
      collections: [
        {
          id: 'c1',
          name: 'Tokens',
          kind: 'token',
          modes: [{ id: 'm1', name: 'Default' }],
          variables: [
            {
              id: 'v_dangling',
              name: 'bg',
              figmaName: 'bg',
              type: 'COLOR',
              valuesByMode: { m1: { kind: 'alias', targetVariableId: 'missing_var_id' } },
            },
          ],
        },
      ],
      composites: { paintStyles: [], effectStyles: [], textStyles: [] },
    };

    const graph = buildSemanticGraph(ir);
    const unresolvedWarn = graph.warnings.find((w) => w.code === 'UNRESOLVED_ALIAS');
    expect(unresolvedWarn).toBeDefined();
    expect(unresolvedWarn?.message).toContain('missing_var_id');
  });

  it('records CYCLE warning on graph when alias loop is detected', () => {
    const ir: IR = {
      version: '2.0',
      fileKey: 'f1',
      generatedAt: '2026-10-21T00:00:00Z',
      collections: [
        {
          id: 'c1',
          name: 'Tokens',
          kind: 'token',
          modes: [{ id: 'm1', name: 'Default' }],
          variables: [
            {
              id: 'v_a',
              name: 'a',
              figmaName: 'a',
              type: 'COLOR',
              valuesByMode: { m1: { kind: 'alias', targetVariableId: 'v_b' } },
            },
            {
              id: 'v_b',
              name: 'b',
              figmaName: 'b',
              type: 'COLOR',
              valuesByMode: { m1: { kind: 'alias', targetVariableId: 'v_a' } },
            },
          ],
        },
      ],
      composites: { paintStyles: [], effectStyles: [], textStyles: [] },
    };

    const graph = buildSemanticGraph(ir);
    const cycleWarn = graph.warnings.find((w) => w.code === 'CYCLE');
    expect(cycleWarn).toBeDefined();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd plugin && pnpm vitest run src/__tests__/core/graph/diagnostics_pipeline.test.ts`
Expected: FAIL (`UNRESOLVED_ALIAS` / `CYCLE` warnings not yet emitted).

- [ ] **Step 3: Implement diagnostic emission in `alias_resolver.ts` and clean RN target**

1. In `plugin/src/core/graph/alias_resolver.ts`:
   - When `!targetVar`: call `warn?.('UNRESOLVED_ALIAS', \`Target variable "${targetId}" not found in lookup.\`)`.
   - When `visited.has(targetId)`: call `warn?.('CYCLE', \`Cycle detected in alias chain involving variable "${targetId}".\`)`.
2. In `plugin/src/targets/react_native/generator/prepare.ts`:
   - Delete the 40-line manual scanning loop for unresolved aliases (formerly lines 164-206).
   - React Native target now relies on `graph.warnings` which is propagated through `emit_engine`.

- [ ] **Step 4: Run test to verify it passes**

Run: `cd plugin && pnpm vitest run src/__tests__/core/graph/diagnostics_pipeline.test.ts`
Expected: PASS.

- [ ] **Step 5: Run full test suite & smoke test**

Run: `cd plugin && pnpm typecheck && pnpm test && pnpm smoke:rn`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
cd plugin
git add src/core/graph/alias_resolver.ts src/targets/react_native/generator/prepare.ts src/__tests__/core/graph/diagnostics_pipeline.test.ts
git commit -m "fix(graph): emit unresolved alias and cycle warnings in core graph and eliminate target duplicate scanning"
```

---

### Task 4: Core Target Toolkit (`assembleTargetSection` & `allocateStableCollectionIdentifiers`)

**Files:**
- Create: `plugin/src/core/manifest/section_assembler.ts`
- Modify: `plugin/src/core/naming/dedup.ts`
- Test: `plugin/src/__tests__/core/manifest/section_assembler.test.ts`
- Test: `plugin/src/__tests__/core/naming/stable_allocator.test.ts`

**Interfaces:**
- Produces:
  ```typescript
  export function assembleTargetSection(input: TargetSectionAssemblyInput): ManifestTargetSection;
  export function allocateStableCollectionIdentifiers<TVar extends { id: string; figmaName: string; groupPath: string[]; leafName: string }>(
    variables: TVar[],
    manifestSection: ManifestTargetSection | null,
    sanitizeLeaf: (rawLeaf: string) => string,
  ): Map<string, { stableLeafKey: string; isStable: boolean }>;
  ```

- [ ] **Step 1: Write failing tests for `assembleTargetSection` and `allocateStableCollectionIdentifiers`**

```typescript
// plugin/src/__tests__/core/manifest/section_assembler.test.ts
import { describe, it, expect } from 'vitest';
import { assembleTargetSection } from '../../core/manifest/section_assembler';

describe('Core Target Section Assembler', () => {
  it('assembles a compliant ManifestTargetSection', () => {
    const section = assembleTargetSection({
      collections: [
        {
          id: 'c1',
          name: 'Colors',
          exportName: 'colors',
          variables: [
            { id: 'v1', figmaName: 'color/primary', stableLeafKey: 'primary' },
          ],
        },
      ],
      composites: [
        { id: 's1', figmaName: 'heading/h1', getterName: 'headingH1' },
      ],
    });

    expect(section.variables['v1']).toBe('primary');
    expect(section.collections['c1']).toBe('colors');
    expect(section.composites?.['s1']).toBe('headingH1');
    expect(section.figmaNames.variables['v1']).toBe('color/primary');
    expect(section.figmaNames.collections['c1']).toBe('Colors');
    expect(section.figmaNames.composites?.['s1']).toBe('heading/h1');
  });
});
```

```typescript
// plugin/src/__tests__/core/naming/stable_allocator.test.ts
import { describe, it, expect } from 'vitest';
import { allocateStableCollectionIdentifiers } from '../../core/naming/dedup';

describe('Stable Collection Identifiers Allocator', () => {
  it('pins existing manifest names and dedupes new collisions safely', () => {
    const vars = [
      { id: 'v_new', figmaName: 'color/primary', groupPath: ['color'], leafName: 'primary' },
      { id: 'v_old', figmaName: 'color/primary_old', groupPath: ['color'], leafName: 'primary_old' },
    ];
    const manifestSection = {
      variables: { v_old: 'primary' },
      collections: {},
    };

    const allocated = allocateStableCollectionIdentifiers(vars, manifestSection, (leaf) => leaf.replace(/[^a-zA-Z0-9]/g, ''));
    expect(allocated.get('v_old')?.stableLeafKey).toBe('primary');
    expect(allocated.get('v_old')?.isStable).toBe(true);
    expect(allocated.get('v_new')?.stableLeafKey).toBe('primary2');
    expect(allocated.get('v_new')?.isStable).toBe(false);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd plugin && pnpm vitest run src/__tests__/core/manifest/section_assembler.test.ts src/__tests__/core/naming/stable_allocator.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement `assembleTargetSection` and `allocateStableCollectionIdentifiers`**

1. Create `plugin/src/core/manifest/section_assembler.ts`:
   - Implement `assembleTargetSection(input: TargetSectionAssemblyInput): ManifestTargetSection`.
   - Re-export from `plugin/src/core/manifest/index.ts`.
2. In `plugin/src/core/naming/dedup.ts`:
   - Implement `allocateStableCollectionIdentifiers`.

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd plugin && pnpm vitest run src/__tests__/core/manifest/section_assembler.test.ts src/__tests__/core/naming/stable_allocator.test.ts`
Expected: PASS.

- [ ] **Step 5: Run full test suite & typecheck**

Run: `cd plugin && pnpm typecheck && pnpm test`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
cd plugin
git add src/core/manifest/ src/core/naming/ src/__tests__/core/manifest/section_assembler.test.ts src/__tests__/core/naming/stable_allocator.test.ts
git commit -m "feat(core): add assembleTargetSection and allocateStableCollectionIdentifiers toolkit"
```

---

### Task 5: Refactor Flutter & React Native Targets to Core Target Toolkit

**Files:**
- Modify: `plugin/src/targets/flutter/generator/prepare.ts`
- Modify: `plugin/src/targets/react_native/generator/prepare.ts`
- Test: `plugin/src/__tests__/targets/toolkit_integration.test.ts`

**Interfaces:**
- Consumes: `allocateStableCollectionIdentifiers`, `assembleTargetSection`, `ResolvedVariable.collectionId`.
- Produces:
  - Streamlined `prepare.ts` in both targets with zero duplicated 2-pass reservation or manual manifest building.

- [ ] **Step 1: Write integration tests ensuring targets work with Core Toolkit**

```typescript
// plugin/src/__tests__/targets/toolkit_integration.test.ts
import { describe, it, expect } from 'vitest';
import { buildSemanticGraph } from '../../core/graph/build_graph';
import { flutterTarget } from '../../targets/flutter';
import { reactNativeTarget } from '../../targets/react_native';
import type { IR } from '../../ir/types';

describe('Targets using Core Toolkit', () => {
  const ir: IR = {
    version: '2.0',
    fileKey: 'f1',
    generatedAt: '2026-10-21T00:00:00Z',
    collections: [
      {
        id: 'c1',
        name: 'Colors',
        kind: 'primitive',
        modes: [{ id: 'm1', name: 'Light' }],
        variables: [
          {
            id: 'v1',
            name: 'brand',
            figmaName: 'brand/main',
            type: 'COLOR',
            valuesByMode: { m1: { kind: 'literal', value: { r: 0, g: 0.5, b: 1, a: 1 } } },
          },
        ],
      },
    ],
    composites: {
      paintStyles: [
        {
          id: 'p1',
          name: 'cardBg',
          figmaName: 'card/bg',
          type: 'SOLID',
          color: { kind: 'literal', rgba: { r: 1, g: 1, b: 1, a: 1 } },
          opacity: 1,
        },
      ],
      effectStyles: [],
      textStyles: [],
    },
  };

  it('produces compliant ManifestTargetSection and EmittedFiles for Flutter', () => {
    const graph = buildSemanticGraph(ir);
    const prepared = flutterTarget.prepare(graph, null);
    expect(prepared.nextManifestSection.variables['v1']).toBe('brandMain');
    expect(prepared.nextManifestSection.collections['c1']).toBe('Colors');
    expect(prepared.nextManifestSection.composites?.['p1']).toBe('cardBg');
    const files = flutterTarget.emit(prepared);
    expect(files.length).toBeGreaterThan(0);
  });

  it('produces compliant ManifestTargetSection and EmittedFiles for React Native', () => {
    const graph = buildSemanticGraph(ir);
    const prepared = reactNativeTarget.prepare(graph, null);
    expect(prepared.nextManifestSection.variables['v1']).toBe('main');
    expect(prepared.nextManifestSection.collections['c1']).toBe('colors');
    expect(prepared.nextManifestSection.composites?.['p1']).toBe('cardBg');
    const files = reactNativeTarget.emit(prepared);
    expect(files.length).toBeGreaterThan(0);
  });
});
```

- [ ] **Step 2: Run test to verify behavior**

Run: `cd plugin && pnpm vitest run src/__tests__/targets/toolkit_integration.test.ts`

- [ ] **Step 3: Refactor Flutter and React Native `prepare.ts`**

1. In `plugin/src/targets/flutter/generator/prepare.ts`:
   - Replace manual 2-pass reservation loops with `allocateStableCollectionIdentifiers`.
   - Replace manual `buildNextManifestSection` with `assembleTargetSection`.
   - Leverage `v.collectionId`, `v.collectionName`, `v.collectionKind` directly from `ResolvedVariable`.
2. In `plugin/src/targets/react_native/generator/prepare.ts`:
   - Replace manual 2-pass reservation loops with `allocateStableCollectionIdentifiers`.
   - Replace manual `buildNextManifestSection` with `assembleTargetSection`.

- [ ] **Step 4: Run test to verify it passes**

Run: `cd plugin && pnpm vitest run src/__tests__/targets/toolkit_integration.test.ts`
Expected: PASS.

- [ ] **Step 5: Run full test suite & smoke test**

Run: `cd plugin && pnpm typecheck && pnpm test && pnpm smoke:rn`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
cd plugin
git add src/targets/flutter/ src/targets/react_native/ src/__tests__/targets/toolkit_integration.test.ts
git commit -m "refactor(targets): adopt core target toolkit for stable allocation and section assembly"
```

---

### Task 6: Multi-Target Orchestration & Consolidated Changelog

**Files:**
- Modify: `plugin/src/core/manifest/changelog.ts`
- Modify: `plugin/src/main.ts`
- Modify: `plugin/src/generator_cli.ts`
- Test: `plugin/src/__tests__/core/manifest/multi_target_changelog.test.ts`

**Interfaces:**
- Produces:
  ```typescript
  export function generateMultiTargetChangelog(
    diffsByTarget: Record<string, ManifestDiff>,
  ): string;
  ```

- [ ] **Step 1: Write failing tests for multi-target changelog**

```typescript
// plugin/src/__tests__/core/manifest/multi_target_changelog.test.ts
import { describe, it, expect } from 'vitest';
import { generateMultiTargetChangelog } from '../../core/manifest/changelog';
import type { ManifestDiff } from '../../core/manifest/diff';

describe('Multi-Target Changelog Generator', () => {
  const emptySummary = { added: 0, modified: 0, removed: 0, unchanged: 0 };
  const diffFlutter: ManifestDiff = {
    targetId: 'flutter',
    summary: { added: 1, modified: 0, removed: 0, unchanged: 0 },
    variables: {
      added: [{ id: 'v1', figmaName: 'color/bg', oldName: null, newName: 'colorBg' }],
      modified: [],
      removed: [],
      unchanged: [],
    },
    collections: { added: [], modified: [], removed: [], unchanged: [] },
    composites: { added: [], modified: [], removed: [], unchanged: [] },
  };

  const diffRN: ManifestDiff = {
    targetId: 'react_native',
    summary: { added: 0, modified: 1, removed: 0, unchanged: 0 },
    variables: {
      added: [],
      modified: [{ id: 'v1', figmaName: 'color/bg', oldName: 'oldBg', newName: 'newBg' }],
      removed: [],
      unchanged: [],
    },
    collections: { added: [], modified: [], removed: [], unchanged: [] },
    composites: { added: [], modified: [], removed: [], unchanged: [] },
  };

  it('renders single-target diff cleanly without redundant target header', () => {
    const log = generateMultiTargetChangelog({ flutter: diffFlutter });
    expect(log).toContain('## Added (1)');
    expect(log).toContain('color/bg');
  });

  it('renders multi-target diffs with clear target sections', () => {
    const log = generateMultiTargetChangelog({ flutter: diffFlutter, react_native: diffRN });
    expect(log).toContain('## Target: flutter');
    expect(log).toContain('## Target: react_native');
    expect(log).toContain('colorBg');
    expect(log).toContain('oldBg');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd plugin && pnpm vitest run src/__tests__/core/manifest/multi_target_changelog.test.ts`
Expected: FAIL (`generateMultiTargetChangelog` not implemented).

- [ ] **Step 3: Implement `generateMultiTargetChangelog` and wire to CLI and Plugin main**

1. In `plugin/src/core/manifest/changelog.ts`:
   - Implement `generateMultiTargetChangelog(diffsByTarget: Record<string, ManifestDiff>): string`.
   - If `Object.keys(diffsByTarget).length === 1`: delegate to existing `generateChangelog(Object.values(diffsByTarget)[0])`.
   - If multi-target: render `# Design System Tokens Changelog` with `## Target: ${targetId}` sections.
2. In `plugin/src/main.ts` & `plugin/src/generator_cli.ts`:
   - Use `generateMultiTargetChangelog(result.diffsByTarget)` when outputting changelog.

- [ ] **Step 4: Run test to verify it passes**

Run: `cd plugin && pnpm vitest run src/__tests__/core/manifest/multi_target_changelog.test.ts`
Expected: PASS.

- [ ] **Step 5: Full verification suite**

Run:
```bash
cd plugin
pnpm typecheck
pnpm test
pnpm smoke:rn
pnpm leakcheck
pnpm build
```
Expected: All 46+ test files PASS (100%), 0 typecheck errors, clean build artifacts.

- [ ] **Step 6: Commit**

```bash
cd plugin
git add src/core/manifest/changelog.ts src/main.ts src/generator_cli.ts src/__tests__/core/manifest/multi_target_changelog.test.ts
git commit -m "feat(core): add multi-target changelog generator and wire to CLI and plugin"
```
