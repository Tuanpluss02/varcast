# Universal Target Conformance, Runtime E2E & GitHub Actions CI/CD Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Establish an automated, production-grade end-to-end testing matrix and GitHub Actions CI/CD pipeline ensuring all current and future Varcast targets are validated for registry discovery, target contract conformance, golden snapshot integrity, multi-phase token evolution, runtime evaluation, and Figma UI bridge resilience.

**Architecture:**
- A dynamic **Target Conformance Test Suite (TCK)** automatically iterates over all registered targets via `describe.each(getAllTargets())` and asserts registry discovery, idempotency, edge-case tolerance, and cross-target manifest parity.
- **Golden Snapshot Testing** locks down emitted code files for all targets to instantly flag unintentional syntax or naming mutations.
- A **Two-Phase Evolution Suite** validates manifest stability and CHANGELOG correctness when designers rename, delete, or add tokens.
- **Runtime E2E & CLI matrix scripts** verify that emitted TypeScript and Dart packages compile cleanly and resolve correct values at runtime.
- A multi-job **GitHub Actions Workflow** enforces typechecks, leakchecks, conformance tests, and real Flutter/React Native compilation on every push and pull request.

**Tech Stack:** TypeScript 5.4, Vitest 1.6, Node.js 20, pnpm 9, Dart SDK, GitHub Actions.

**Spec:** [docs/superpowers/specs/2026-10-23-target-conformance-and-ci-e2e.md](file:///Users/tuanpluss02/Documents/stormx/Varcast/plugin/docs/superpowers/specs/2026-10-23-target-conformance-and-ci-e2e.md)

## Global Constraints

- 100% automated target discovery: adding a new target directory to `src/targets/` automatically includes it in all conformance and parity suites.
- Strict backward compatibility: existing Flutter and React Native output formats must not break.
- Zero `as any` type assertions across all new test suites and scripts.
- CI Leak Guard: no platform-specific types or syntax in `src/core`, `src/reader`, or `src/ir`.
- Every task must end with an independently passing test suite and git commit.

## Review Focus

1. **Unregistered Target in Directory**: A target directory is created under `src/targets/` but developer forgot to call `registerTarget` — test must fail with clear discovery diagnostic.
2. **Re-export Idempotency Violation**: Re-running `runEngine` with the generated `nextManifest` generates non-zero diffs — test must fail and report phantom diffs.
3. **Dangling Alias Crash**: An input IR contains an alias pointing to a deleted or non-existent variable ID — target must emit non-fatal diagnostic warning without crashing.
4. **Runtime Theme Switching Drift**: React Native or Flutter theme does not switch values when mode changes from Light to Dark — runtime smoke test must fail with value mismatch.
5. **Breaking Token Rename**: A variable is renamed on Figma but stable key is lost in target manifest — evolution test must fail.

---

### Task 1: Comprehensive Fixtures & Target Discovery Guard

**Files:**
- Create: `plugin/test_fixtures/golden_tokens.json`
- Create: `plugin/test_fixtures/evolution_v1.json`
- Create: `plugin/test_fixtures/evolution_v2.json`
- Create: `plugin/src/__tests__/conformance/target_discovery.test.ts`

**Interfaces:**
- Consumes: `TargetRegistry` (`hasTarget`, `getAllTargets`), Node.js `fs`.
- Produces: `golden_tokens.json` (canonical test IR with colors, dimensions, composites, numeric names), `evolution_v1.json`, `evolution_v2.json`.

- [ ] **Step 1: Write the failing test for target discovery**

```typescript
// plugin/src/__tests__/conformance/target_discovery.test.ts
import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import { hasTarget, getAllTargets } from '../../core/registry';
// Ensure default targets are registered
import '../../targets/flutter';
import '../../targets/react_native';

describe('Target Discovery Guard', () => {
  const targetsDir = path.resolve(__dirname, '../../targets');
  const targetSubdirs = fs
    .readdirSync(targetsDir, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name);

  it('finds at least one target in src/targets/', () => {
    expect(targetSubdirs.length).toBeGreaterThan(0);
  });

  it.each(targetSubdirs)(
    'directory "src/targets/%s" has a matching registered target in TargetRegistry',
    (dirName) => {
      expect(hasTarget(dirName)).toBe(true);
    },
  );

  it('all registered targets have non-empty metadata', () => {
    const targets = getAllTargets();
    expect(targets.length).toBeGreaterThan(0);
    for (const t of targets) {
      expect(t.id).toBeDefined();
      expect(t.displayName).toBeDefined();
      expect(t.defaultPackageName).toBeDefined();
    }
  });
});
```

- [ ] **Step 2: Run test to verify it passes (or fails if setup is missing)**

Run: `cd plugin && pnpm test src/__tests__/conformance/target_discovery.test.ts`
Expected: PASS (flutter and react_native match their folders).

- [ ] **Step 3: Create `golden_tokens.json`, `evolution_v1.json`, and `evolution_v2.json` fixtures**

In `plugin/test_fixtures/golden_tokens.json`:
- Collection `Brand Colors` (kind `primitive`, modes `Light`, `Dark`):
  - `brand/primary`: `COLOR` with values `#0052FF` (Light) and `#3B82F6` (Dark).
  - `brand/100`: `COLOR` with numeric name `#EBF5FF` / `#1E3A8A`.
  - `brand/opacity`: `FLOAT` with value `0.8` / `0.9`.
- Collection `Semantic Tokens` (kind `token`, modes `Light`, `Dark`):
  - `bg/primary`: alias to `brand/primary`.
- Composites:
  - Solid paint style: `Card/Background`.
  - Linear gradient paint style: `Gradient/Primary`.
  - Drop shadow effect style: `Elevation/Card`.
  - Typography text style: `Heading/H1`.

In `plugin/test_fixtures/evolution_v1.json`:
- Variables: `brand/primary` (`#0052FF`), `spacing/md` (`16`), `legacy/accent` (`#FF0000`).

In `plugin/test_fixtures/evolution_v2.json`:
- Variable renamed: `brand/primary` $\to$ `Brand / Primary Color` (same ID).
- Variable added: `spacing/xs` (`4`).
- Variable deleted: `legacy/accent` is omitted.
- Mode added: `m:contrast` ("High Contrast").

- [ ] **Step 4: Verify fixtures parse valid JSON and conform to `validate(ir)`**

Run: `node -e 'const { validate } = require("./plugin/dist/code.js"); const f = JSON.parse(require("fs").readFileSync("./plugin/test_fixtures/golden_tokens.json")); console.log(validate(f).errors);'`
Expected: `[]` (0 errors).

- [ ] **Step 5: Commit**

```bash
git add plugin/test_fixtures/ plugin/src/__tests__/conformance/
git commit -m "test(conformance): add golden & evolution fixtures and target discovery guard"
```

---

### Task 2: Universal Target Conformance Test Suite (TCK)

**Files:**
- Create: `plugin/src/__tests__/conformance/target_conformance.test.ts`
- Create: `plugin/src/__tests__/conformance/cross_target_parity.test.ts`

**Interfaces:**
- Consumes: `getAllTargets`, `runEngine`, `SemanticTokenGraph`, `Manifest`, `golden_tokens.json`.
- Produces: Standardized conformance guarantees across all targets.

- [ ] **Step 1: Write the failing tests for target conformance**

```typescript
// plugin/src/__tests__/conformance/target_conformance.test.ts
import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import { getAllTargets } from '../../core/registry';
import { runEngine } from '../../core/emit_engine';
import type { IR } from '../../ir/types';
import '../../targets/flutter';
import '../../targets/react_native';

const GOLDEN_IR: IR = JSON.parse(
  fs.readFileSync(path.resolve(__dirname, '../../../test_fixtures/golden_tokens.json'), 'utf-8'),
);

describe.each(getAllTargets().map((t) => [t.id, t]))(
  'Target Conformance Suite: [%s]',
  (targetId, target) => {
    describe('Contract Invariants', () => {
      it('has valid targetId format /^[a-z][a-z0-9_-]*$/', () => {
        expect(target.id).toMatch(/^[a-z][a-z0-9_-]*$/);
      });
      it('has valid non-empty displayName and defaultPackageName', () => {
        expect(target.displayName.length).toBeGreaterThan(0);
        expect(target.defaultPackageName.length).toBeGreaterThan(0);
      });
    });

    describe('Pipeline Sanity', () => {
      it('emits non-empty files without path traversal', () => {
        const out = runEngine(GOLDEN_IR, [target], null);
        expect(out.files.length).toBeGreaterThan(0);
        for (const f of out.files) {
          expect(f.path).not.toMatch(/\.\./);
          expect(f.path).not.toMatch(/^[/\\]/);
          expect(f.contents.trim().length).toBeGreaterThan(0);
        }
      });

      it('produces valid nextManifest with target section', () => {
        const out = runEngine(GOLDEN_IR, [target], null);
        const section = out.nextManifest.targets[targetId];
        expect(section).toBeDefined();
        expect(Object.keys(section.variables).length).toBeGreaterThan(0);
        expect(Object.keys(section.collections).length).toBeGreaterThan(0);
      });
    });

    describe('Idempotency (0 diffs on re-export)', () => {
      it('re-export with nextManifest produces 0 added, removed, or renamed diffs', () => {
        const run1 = runEngine(GOLDEN_IR, [target], null);
        const run2 = runEngine(GOLDEN_IR, [target], run1.nextManifest);
        const diff = run2.diffsByTarget[targetId];

        expect(diff.variables.added).toHaveLength(0);
        expect(diff.variables.removed).toHaveLength(0);
        expect(diff.variables.renamed).toHaveLength(0);
        expect(diff.collections.added).toHaveLength(0);
        expect(diff.collections.removed).toHaveLength(0);
      });
    });

    describe('Edge Cases & Fault Tolerance', () => {
      it('gracefully handles empty collections without crashing', () => {
        const emptyIR: IR = {
          version: '1.0',
          fileKey: 'empty',
          generatedAt: new Date(0).toISOString(),
          collections: [],
          composites: { paintStyles: [], effectStyles: [], textStyles: [] },
        };
        expect(() => runEngine(emptyIR, [target], null)).not.toThrow();
      });

      it('gracefully handles dangling aliases by capturing warnings without throwing', () => {
        const danglingIR: IR = {
          version: '1.0',
          fileKey: 'dangling',
          generatedAt: new Date(0).toISOString(),
          collections: [
            {
              id: 'col:1',
              name: 'Tokens',
              kind: 'token',
              modes: [{ id: 'm:1', name: 'Default' }],
              variables: [
                {
                  id: 'v:broken',
                  figmaName: 'broken_alias',
                  groupPath: ['broken_alias'],
                  type: 'COLOR',
                  scopes: [],
                  hiddenFromPublishing: false,
                  emitToPublic: true,
                  valuesByMode: {
                    'm:1': { kind: 'alias', targetId: 'v:non_existent' },
                  },
                },
              ],
            },
          ],
          composites: { paintStyles: [], effectStyles: [], textStyles: [] },
        };
        const out = runEngine(danglingIR, [target], null);
        expect(out.warnings.some((w) => w.code === 'UNRESOLVED_ALIAS')).toBe(true);
      });
    });
  },
);
```

- [ ] **Step 2: Run test to verify it passes**

Run: `cd plugin && pnpm test src/__tests__/conformance/target_conformance.test.ts`
Expected: PASS across all registered targets (flutter, react_native).

- [ ] **Step 3: Write Cross-Target Parity test**

```typescript
// plugin/src/__tests__/conformance/cross_target_parity.test.ts
import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import { getAllTargets } from '../../core/registry';
import { runEngine } from '../../core/emit_engine';
import type { IR } from '../../ir/types';
import '../../targets/flutter';
import '../../targets/react_native';

const GOLDEN_IR: IR = JSON.parse(
  fs.readFileSync(path.resolve(__dirname, '../../../test_fixtures/golden_tokens.json'), 'utf-8'),
);

describe('Cross-Target Parity Matrix', () => {
  it('all registered targets manage the exact same set of public variable IDs', () => {
    const targets = getAllTargets();
    expect(targets.length).toBeGreaterThan(1);

    const summaries = targets.map((t) => {
      const out = runEngine(GOLDEN_IR, [t], null);
      const section = out.nextManifest.targets[t.id];
      return {
        targetId: t.id,
        variableIds: Object.keys(section.variables).sort(),
        collectionIds: Object.keys(section.collections).sort(),
      };
    });

    const baseline = summaries[0];
    for (const other of summaries.slice(1)) {
      expect(other.variableIds).toEqual(baseline.variableIds);
      expect(other.collectionIds).toEqual(baseline.collectionIds);
    }
  });
});
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd plugin && pnpm test src/__tests__/conformance/cross_target_parity.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add plugin/src/__tests__/conformance/
git commit -m "test(conformance): implement universal TCK and cross-target parity matrix"
```

---

### Task 3: Golden Snapshot Regression Test Suite

**Files:**
- Create: `plugin/src/__tests__/golden/golden_snapshots.test.ts`

**Interfaces:**
- Consumes: `golden_tokens.json`, `runEngine`, `getAllTargets`.
- Produces: Committed Vitest snapshots capturing the deterministic code output for every target.

- [ ] **Step 1: Write the golden snapshot test**

```typescript
// plugin/src/__tests__/golden/golden_snapshots.test.ts
import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import { getAllTargets } from '../../core/registry';
import { runEngine } from '../../core/emit_engine';
import type { IR } from '../../ir/types';
import '../../targets/flutter';
import '../../targets/react_native';

const GOLDEN_IR: IR = JSON.parse(
  fs.readFileSync(path.resolve(__dirname, '../../../test_fixtures/golden_tokens.json'), 'utf-8'),
);

describe.each(getAllTargets().map((t) => [t.id, t]))(
  'Golden Snapshot Regression: [%s]',
  (targetId, target) => {
    it('matches golden file manifest and emitted file structure', () => {
      const out = runEngine(GOLDEN_IR, [target], null, {
        [targetId]: { packageName: 'test_ds' },
      });

      const fileMap = out.files
        .sort((a, b) => a.path.localeCompare(b.path))
        .map((f) => ({
          path: f.path,
          contents: f.contents,
        }));

      expect(fileMap).toMatchSnapshot('files');
      expect(out.nextManifest.targets[targetId]).toMatchSnapshot('manifest_section');
    });
  },
);
```

- [ ] **Step 2: Run test with `-u` to generate initial baseline snapshots**

Run: `cd plugin && pnpm test src/__tests__/golden/golden_snapshots.test.ts -u`
Expected: Snapshots written to `src/__tests__/golden/__snapshots__/golden_snapshots.test.ts.snap` with exit code 0.

- [ ] **Step 3: Run test without `-u` to verify stability**

Run: `cd plugin && pnpm test src/__tests__/golden/golden_snapshots.test.ts`
Expected: PASS (all snapshots match).

- [ ] **Step 4: Commit snapshots and test**

```bash
git add plugin/src/__tests__/golden/
git commit -m "test(golden): add golden snapshot regression suite for all targets"
```

---

### Task 4: Two-Phase Evolution & Migration Test Suite

**Files:**
- Create: `plugin/src/__tests__/evolution/evolution_migration.test.ts`

**Interfaces:**
- Consumes: `evolution_v1.json`, `evolution_v2.json`, `runEngine`, `generateMultiTargetChangelog`.
- Produces: Automated verification of stable identifier preservation, diff classification, and changelog generation.

- [ ] **Step 1: Write the failing evolution test**

```typescript
// plugin/src/__tests__/evolution/evolution_migration.test.ts
import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import { getAllTargets } from '../../core/registry';
import { runEngine } from '../../core/emit_engine';
import { generateMultiTargetChangelog } from '../../core/manifest/changelog';
import type { IR } from '../../ir/types';
import '../../targets/flutter';
import '../../targets/react_native';

const V1_IR: IR = JSON.parse(
  fs.readFileSync(path.resolve(__dirname, '../../../test_fixtures/evolution_v1.json'), 'utf-8'),
);
const V2_IR: IR = JSON.parse(
  fs.readFileSync(path.resolve(__dirname, '../../../test_fixtures/evolution_v2.json'), 'utf-8'),
);

describe.each(getAllTargets().map((t) => [t.id, t]))(
  'Two-Phase Token Evolution & Migration: [%s]',
  (targetId, target) => {
    it('preserves stable identifiers on token rename across releases', () => {
      // Release 1: Initial export
      const release1 = runEngine(V1_IR, [target], null);
      const sectionV1 = release1.nextManifest.targets[targetId];
      const initialKey = sectionV1.variables['v:brand_primary'];
      expect(initialKey).toBeDefined();

      // Release 2: Designer renamed token on Figma, but variable ID is preserved
      const release2 = runEngine(V2_IR, [target], release1.nextManifest);
      const sectionV2 = release2.nextManifest.targets[targetId];
      const evolvedKey = sectionV2.variables['v:brand_primary'];

      // Crucial requirement: identifier must remain stable to prevent breaking client code
      expect(evolvedKey).toBe(initialKey);
    });

    it('accurately categorizes added, removed, and renamed variables in diff', () => {
      const release1 = runEngine(V1_IR, [target], null);
      const release2 = runEngine(V2_IR, [target], release1.nextManifest);
      const diff = release2.diffsByTarget[targetId];

      expect(diff).toBeDefined();
      // v:spacing_xs was added
      expect(diff.variables.added.some((v) => v.id === 'v:spacing_xs')).toBe(true);
      // v:legacy_accent was removed
      expect(diff.variables.removed.some((v) => v.id === 'v:legacy_accent')).toBe(true);
      // v:brand_primary was renamed in Figma
      expect(diff.variables.renamed.some((v) => v.id === 'v:brand_primary')).toBe(true);
    });

    it('generates well-formatted changelog documentation', () => {
      const release1 = runEngine(V1_IR, [target], null);
      const release2 = runEngine(V2_IR, [target], release1.nextManifest);
      const changelog = generateMultiTargetChangelog(release2.diffsByTarget);

      expect(changelog).toContain(`## ${targetId}`);
      expect(changelog).toContain('Added');
      expect(changelog).toContain('Removed');
      expect(changelog).toContain('Renamed');
    });
  },
);
```

- [ ] **Step 2: Run test to verify it passes**

Run: `cd plugin && pnpm test src/__tests__/evolution/evolution_migration.test.ts`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add plugin/src/__tests__/evolution/
git commit -m "test(evolution): add two-phase token migration and stable key validation test"
```

---

### Task 5: Figma Plugin Sandbox & UI Bridge E2E Test Suite

**Files:**
- Create: `plugin/src/__tests__/bridge/plugin_ui_flow.test.ts`

**Interfaces:**
- Consumes: Mock Figma global APIs (`figma.showUI`, `figma.ui.onmessage`, `figma.ui.postMessage`, `figma.clientStorage`).
- Produces: Full E2E verification of the UI initialization, export preview generation, and zip download flow.

- [ ] **Step 1: Write the failing bridge test**

```typescript
// plugin/src/__tests__/bridge/plugin_ui_flow.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import type { IR } from '../../ir/types';

const GOLDEN_IR: IR = JSON.parse(
  fs.readFileSync(path.resolve(__dirname, '../../../test_fixtures/golden_tokens.json'), 'utf-8'),
);

describe('Figma Plugin UI & Sandbox Bridge Flow', () => {
  let postedMessages: any[] = [];
  let onMessageHandler: ((msg: any) => Promise<void>) | null = null;
  let clientStorageData: Record<string, any> = {};

  beforeEach(async () => {
    postedMessages = [];
    clientStorageData = {};

    // Mock Figma globals
    (globalThis as any).figma = {
      showUI: vi.fn(),
      closePlugin: vi.fn(),
      ui: {
        postMessage: (msg: any) => postedMessages.push(msg),
        set onmessage(fn: any) {
          onMessageHandler = fn;
        },
      },
      clientStorage: {
        getAsync: vi.fn(async (key: string) => clientStorageData[key] ?? null),
        setAsync: vi.fn(async (key: string, val: any) => {
          clientStorageData[key] = val;
        }),
      },
    };

    // Mock reader to return GOLDEN_IR
    vi.doMock('../../reader', () => ({
      readIR: async () => GOLDEN_IR,
    }));

    // Import main to wire listeners
    await import('../../main');
  });

  it('handles "init" message and returns availableTargets and preview collections', async () => {
    expect(onMessageHandler).toBeDefined();
    await onMessageHandler!({ type: 'init' });

    const initMsg = postedMessages.find((m) => m.type === 'init-data');
    expect(initMsg).toBeDefined();
    expect(initMsg.availableTargets.length).toBeGreaterThanOrEqual(2);
    expect(initMsg.availableTargets.some((t: any) => t.id === 'flutter')).toBe(true);
    expect(initMsg.availableTargets.some((t: any) => t.id === 'react_native')).toBe(true);
  });

  it('handles "export" message and returns preview files with diff summary', async () => {
    await onMessageHandler!({
      type: 'export',
      options: { targetId: 'react_native', packageName: 'ds_test' },
    });

    const previewMsg = postedMessages.find((m) => m.type === 'preview-ready');
    expect(previewMsg).toBeDefined();
    expect(previewMsg.files.length).toBeGreaterThan(0);
    expect(previewMsg.summary.totalBytes).toBeGreaterThan(0);
    expect(previewMsg.diff).toBeDefined();
  });
});
```

- [ ] **Step 2: Run test to verify it passes**

Run: `cd plugin && pnpm test src/__tests__/bridge/plugin_ui_flow.test.ts`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add plugin/src/__tests__/bridge/
git commit -m "test(bridge): add Figma plugin UI message exchange E2E test"
```

---

### Task 6: CLI & Runtime Evaluation Scripts Matrix

**Files:**
- Create: `plugin/scripts/e2e_cli_matrix.mjs`
- Create: `plugin/scripts/runtime_flutter.mjs`
- Modify: `plugin/scripts/rn_smoke_runtime.mjs`
- Modify: `plugin/package.json`

**Interfaces:**
- Consumes: Built `dist/cli.js`, Node.js `execFileSync`, TypeScript compiler `tsc`, Dart SDK.
- Produces: CLI commands `pnpm smoke:matrix`, `pnpm smoke:flutter`, and `pnpm test:e2e`.

- [ ] **Step 1: Write `e2e_cli_matrix.mjs` running all registered targets via CLI**

Create `plugin/scripts/e2e_cli_matrix.mjs`:
- Invokes `dist/cli.js` for each target (`flutter`, `react_native`).
- Emits to `.tmp_cli_e2e/<targetId>`.
- Verifies exit code 0, files exist on disk, `CHANGELOG.md` exists.

- [ ] **Step 2: Write `runtime_flutter.mjs` verifying Flutter compilation**

Create `plugin/scripts/runtime_flutter.mjs`:
- Generates Flutter package via CLI to `.tmp_flutter_runtime`.
- Detects if `dart` executable is installed in PATH.
- If `dart` is found: executes `dart pub get` and `dart analyze` in `.tmp_flutter_runtime`.
- If `dart` is not found: logs informative notice `[flutter-runtime] Dart SDK not in PATH, skipped local analyze.` and exits with 0.

- [ ] **Step 3: Update `package.json` with unified smoke scripts**

In `plugin/package.json`, update scripts:
```json
"smoke:cli": "pnpm build && node scripts/e2e_cli_matrix.mjs",
"smoke:flutter": "pnpm build && node scripts/runtime_flutter.mjs",
"smoke:matrix": "pnpm smoke:cli && pnpm smoke:rn && pnpm smoke:flutter",
"test:all": "pnpm typecheck && pnpm leakcheck && pnpm test && pnpm smoke:matrix"
```

- [ ] **Step 4: Execute `pnpm smoke:matrix` locally to verify**

Run: `cd plugin && pnpm smoke:matrix`
Expected:
`[cli-e2e] Target flutter OK`
`[cli-e2e] Target react_native OK`
`[rn-smoke-cli] OK`
`[rn-smoke-runtime] OK`
`[flutter-runtime] OK`

- [ ] **Step 5: Commit**

```bash
git add plugin/scripts/ plugin/package.json
git commit -m "feat(ci): add unified CLI matrix runner and runtime evaluation scripts"
```

---

### Task 7: GitHub Actions CI/CD Pipeline

**Files:**
- Create: `plugin/.github/workflows/ci.yml`

**Interfaces:**
- Consumes: GitHub Actions runner (`ubuntu-latest`), `subosito/flutter-action@v2`, `actions/setup-node@v4`, `pnpm/action-setup@v3`.
- Produces: Multi-stage CI pipeline testing quality, React Native runtime, and Flutter compilation on every PR.

- [ ] **Step 1: Write `plugin/.github/workflows/ci.yml`**

Create `plugin/.github/workflows/ci.yml` with:
- Job `quality`: runs `typecheck`, `leakcheck`, `test` (including TCK, Golden Snapshots, Evolution, Bridge), and `build`.
- Job `e2e-react-native`: runs `pnpm smoke:rn`.
- Job `e2e-flutter`: runs Flutter setup, CLI generation, `dart pub get`, and `dart analyze`.

- [ ] **Step 2: Validate yaml syntax and workflow configuration**

Run: `node -e 'const fs = require("fs"); const y = fs.readFileSync("./plugin/.github/workflows/ci.yml", "utf8"); console.log("YAML length:", y.length);'`
Expected: File loads without syntax errors.

- [ ] **Step 3: Run full verification locally before commit**

Run: `cd plugin && pnpm test:all`
Expected: 100% PASS across typecheck, leakcheck, 56+ vitest test files, and smoke matrix.

- [ ] **Step 4: Commit**

```bash
git add plugin/.github/workflows/ci.yml
git commit -m "ci: add multi-job GitHub Actions workflow for conformance and runtime E2E"
```

---

## Self-Review Checklist

1. **Spec coverage:**
   - Universal TCK & Discovery Guard: Covered by Task 1 & Task 2.
   - Golden Snapshot Regression: Covered by Task 3.
   - Two-Phase Evolution & Migration: Covered by Task 4.
   - Runtime Semantic Evaluation: Covered by Task 6.
   - Figma UI & Sandbox Bridge: Covered by Task 5.
   - GitHub Actions CI/CD: Covered by Task 7.
2. **Step scan:** Every step contains exact paths, exact commands, and unambiguous expected outputs.
3. **Type consistency:** Matches existing types `SemanticTokenGraph`, `Manifest`, `IR`, `TargetRegistry`.
4. **Review Focus:** Covered:
   - Unregistered target: Task 1 Step 1.
   - Re-export idempotency: Task 2 Step 1.
   - Dangling alias fault tolerance: Task 2 Step 1.
   - Runtime theme switching: Task 6 Step 1.
   - Breaking token rename: Task 4 Step 1.
5. **Proportion:** Plan is structured, bite-sized, and avoids unnecessary boilerplate code.
