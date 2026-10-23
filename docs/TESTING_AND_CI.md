# Testing, Conformance (TCK) & CI/CD Guide

This document describes the testing layers, the Universal Target Conformance Test Suite (TCK), Golden Snapshot regression mechanisms, runtime smoke runners, and the GitHub Actions CI/CD pipeline.

---

## 1. Testing Architecture Overview

Varcast enforces a multi-tier test pyramid:

```text
▲
│   [Tier 4] GitHub Actions CI: Parallel jobs across Linux/Node/Flutter
│   [Tier 3] Runtime E2E: Execution of compiled code on real runtimes
│   [Tier 2] CLI Smoke Matrix: Real disk write & directory validation
│   [Tier 1] Conformance TCK & Snapshots: Automated contract & regression checks
│   [Tier 0] Static Integrity: TypeScript typecheck & CI Leak Check
▼
```

---

## 2. Universal Target Conformance Suite (TCK)

When you create a new target directory under `src/targets/<target_name>/`, the test suite **automatically discovers and tests it** without requiring per-target test files.

### 2.1 Target Discovery Guard (`src/__tests__/conformance/target_discovery.test.ts`)
Scans `src/targets/` on disk. Asserts that every subfolder registers a corresponding target in `TargetRegistry`. Forgetting to register your target fails this test immediately.

### 2.2 Parametric Conformance Suite (`src/__tests__/conformance/target_conformance.test.ts`)
Uses `describe.each(getAllTargets())` to verify:
1. **Contract Invariants**: `id` matches `/^[a-z][a-z0-9_-]*$/`, non-empty `displayName` and `defaultPackageName`.
2. **Pipeline Sanity**: Emits $\ge 1$ files with non-empty content, zero path traversal (`..` or leading slashes), valid Manifest v2 section.
3. **Idempotency (0 diffs)**: Running `runEngine` twice (Run 1: `manifest = null`, Run 2: `manifest = run1.nextManifest`) produces exactly **0 added, 0 removed, 0 renamed** diffs.
4. **Fault Tolerance**: Gracefully handles empty collections and dangling alias references without unhandled exceptions.

### 2.3 Cross-Target Parity Matrix (`src/__tests__/conformance/cross_target_parity.test.ts`)
Asserts that every target processes the exact same set of public variable and collection IDs from the input IR. Prevents targets from silently dropping variables from the manifest.

---

## 3. Golden Snapshot Regression (`src/__tests__/golden/golden_snapshots.test.ts`)

Varcast locks down emitted code files for all targets against committed snapshots in `src/__tests__/golden/__snapshots__/`.

### Updating Snapshots for a New Target
When adding a new target or modifying Core naming algorithms, update the snapshots:

```bash
pnpm vitest run src/__tests__/golden/golden_snapshots.test.ts -u
```

Review the resulting git diff carefully. Ensure that only your new target's files were added and existing targets did not undergo unintended syntax mutations.

---

## 4. Two-Phase Evolution Suite (`src/__tests__/evolution/evolution_migration.test.ts`)

Simulates realistic design system versioning using `test_fixtures/evolution_v1.json` and `test_fixtures/evolution_v2.json`:
- **Phase 1 (Release 1)**: Emits package with initial manifest.
- **Phase 2 (Release 2)**: Re-exports with an updated Figma file (token renamed, token added, token removed).
- **Assertions**:
  - The renamed token preserves its original stable identifier.
  - Manifest diff correctly marks items as `added`, `removed`, or `renamed`.
  - Multi-target `CHANGELOG.md` generates clean markdown documentation.

---

## 5. CLI & Runtime E2E Matrix

Varcast runs real subprocesses that write to disk and test compilation on target runtimes.

### 5.1 CLI Smoke Matrix (`scripts/e2e_cli_matrix.mjs`)
To include your target in disk generation tests, add it to the `TARGETS` array in `scripts/e2e_cli_matrix.mjs`:

```javascript
const TARGETS = [
  { id: 'flutter', expectedEntry: 'pubspec.yaml' },
  { id: 'react_native', expectedEntry: 'package.json' },
  { id: 'swift_ui', expectedEntry: 'Package.swift' }, // Add your target here
];
```

Run:
```bash
pnpm smoke:cli
```

### 5.2 Runtime Compilation Smoke
- **React Native (`pnpm smoke:rn`)**: Runs `tsc` to compile emitted code, imports `createTheme()`, and tests dynamic mode switching (`setTokenMode`).
- **Flutter (`pnpm smoke:flutter`)**: Runs `dart pub get` and `dart analyze` on the emitted package, asserting 0 warnings/errors.

---

## 6. GitHub Actions CI/CD Pipeline (`.github/workflows/ci.yml`)

The CI workflow triggers on pushes and PRs to `main`:

```text
┌────────────────────────────────────────────────────────┐
│ Job 1: quality                                         │
│ - pnpm typecheck                                       │
│ - pnpm leakcheck                                       │
│ - pnpm test (All 59 Vitest files: TCK, Golden, etc.)   │
│ - pnpm build                                           │
└────────────────────────────────────────────────────────┘
          │
          ├──> Job 2: e2e-cli (CLI Generation Matrix)
          ├──> Job 3: e2e-react-native (TSC & Theme Mode Runtime)
          └──> Job 4: e2e-flutter (Flutter SDK & Dart Analyze)
```

If your new target requires a specific toolchain (e.g. `swiftc`, `kotlinc`), you can add a dedicated job that runs after `quality`.

---

## 7. Pre-Flight Verification Checklist

Before submitting a Pull Request, run the complete verification suite locally:

```bash
# 1. Typecheck & Leak Check
pnpm typecheck
pnpm leakcheck

# 2. Run All Unit, Conformance, and Snapshot Tests
pnpm test

# 3. Update Golden Snapshot (if adding a new target)
pnpm vitest run src/__tests__/golden/golden_snapshots.test.ts -u

# 4. Run Complete CLI and Runtime Smoke Matrix
pnpm smoke:matrix

# Or run everything with one command:
pnpm test:all
```
