# Spec: Universal Target Conformance, Runtime E2E & GitHub Actions CI/CD

## 1. Goal & Problem Statement
Varcast compiles Figma Variables and Composite Styles into multi-platform design system code (currently Flutter and React Native, with SwiftUI, Jetpack Compose, Tailwind in development).

While the Core Semantic Engine is fully decoupled, the test coverage currently relies on ad-hoc target-specific integration tests. A newly added target has no automated guarantee that:
1. It is registered and discovered by the system.
2. It satisfies the strict Target Contract and Manifest v2 idempotency requirements.
3. Its emitted code compiles and resolves to the exact runtime values at app runtime (e.g., color hex, dark mode switching).
4. Unintended side-effects on existing targets are detected (golden snapshots).
5. Designer migrations and token evolution (renaming, deletion, mode additions) are preserved across exports without breaking client code.
6. The Figma Plugin UI / Sandbox message bridge properly orchestrates the target.

This specification unifies these requirements into a **Universal Target Conformance Test Suite (TCK)**, an **E2E Runtime Matrix**, and a **GitHub Actions CI/CD Pipeline**.

---

## 2. Core Pillars of the Specification

### 2.1 Pillar 1: Target Discovery Guard & Universal Conformance Suite (TCK)
- **Automatic Target Discovery**: Reads `plugin/src/targets/` directory. Asserts that every subfolder registers a corresponding target in `TargetRegistry`. No target can exist in code without being registered.
- **Parametric Conformance Matrix**: `describe.each(getAllTargets())` runs a standardized battery of tests on every registered target without requiring per-target test boilerplate:
  - **Contract & Metadata**: `id` matches `/^[a-z][a-z0-9_-]*$/`, non-empty `displayName` and `defaultPackageName`.
  - **Execution Sanity**: Emits $\ge 1$ non-empty files without path traversal (`..`), produces a valid Manifest v2 target section.
  - **Idempotency**: Running `runEngine` twice (Run 1: `manifest = null`, Run 2: `manifest = run1.nextManifest`) MUST result in 0 variable diffs (`added == 0`, `removed == 0`, `renamed == 0`).
  - **Edge-Case Resilience**: Zero crashing on empty collections/variables, numeric-only token names, cyclic aliases, and unresolvable references.
  - **Cross-Target Parity**: For any given IR, all targets MUST account for the exact same set of public variable IDs in their manifest sections.

### 2.2 Pillar 2: Golden Snapshot Regression
- Dedicated fixture `plugin/test_fixtures/golden_tokens.json` containing:
  - Primitive and token collections.
  - Multi-mode variables (Light, Dark, High Contrast) across COLOR, FLOAT, STRING, BOOLEAN.
  - Composite styles (Solid, Linear Gradient, Radial Gradient, Drop Shadow, Typography).
  - Numeric tokens (`100`, `200 Primary`, `[1] Spacing`).
- A golden test suite compiles all targets and asserts file output against committed snapshots (`toMatchSnapshot()`). Any accidental syntax or naming shift in Core immediately produces a git diff in pull requests.

### 2.3 Pillar 3: Two-Phase Evolution & Migration
- Two distinct fixtures: `evolution_v1.json` and `evolution_v2.json`.
- Simulates realistic design system versioning:
  - Token rename: `primary` $\to$ `Brand / Primary Color`.
  - Token added: `spacing_xs`.
  - Token removed: `legacy_accent`.
  - Mode added: `m:contrast`.
- Asserts that:
  - Stable allocation preserves previous leaf keys for renamed variables.
  - Manifest diff accurately reports `added`, `removed`, and `renamed`.
  - `generateMultiTargetChangelog` generates clean, non-empty Markdown sections for every target.

### 2.4 Pillar 4: Runtime Semantic Evaluation (App Runtime Equivalence)
- **React Native**: Script builds generated code via `tsc`, dynamically imports `createTheme` and `modes`, and verifies:
  - Default mode returns exact expected color strings.
  - Mode switching (`setTokenMode`) dynamically updates theme values to the dark mode equivalents.
- **Flutter**: CLI emits Flutter package to a temp folder; runs `dart pub get` and `dart analyze` to ensure 100% compilation cleanliness, with a lightweight verification test.

### 2.5 Pillar 5: Figma Sandbox <-> UI Bridge E2E
- Simulates message exchange between Figma sandbox (`main.ts`) and UI iframe (`ui/`):
  - `init`: Responds with `init-data` containing `availableTargets` matching `getAllTargets()`.
  - `export`: Generates preview file tree, diff metrics, and byte counts for any requested target.
  - `download-zip`: Generates valid zip archive containing all files and manifest.

---

## 3. GitHub Actions CI/CD Pipeline Specification
File: `plugin/.github/workflows/ci.yml`

- **Triggers**: `push` on `main`, `pull_request` on `main`.
- **Job 1 (`quality`)**:
  - Environment: `ubuntu-latest`, Node.js 20, pnpm 9 with lockfile caching.
  - Steps: `pnpm typecheck`, `pnpm leakcheck`, `pnpm test` (Unit, Conformance, Golden, Evolution, Bridge), `pnpm build`.
- **Job 2 (`e2e-react-native`)**:
  - Runs CLI build, generates RN package, runs `tsc`, and executes runtime evaluation script (`pnpm smoke:rn`).
- **Job 3 (`e2e-flutter`)**:
  - Uses `subosito/flutter-action@v2` (channel: stable).
  - Runs CLI to emit Flutter package, executes `dart pub get` and `dart analyze`.

---

## 4. Invariants & Acceptance Criteria
- 100% automated: Adding a new target requires ZERO new test boilerplate to be covered by the Conformance Suite.
- Zero rò rỉ: Target code must never leak into `src/core`, `src/reader`, or `src/ir` (`leakcheck`).
- All 53 existing test files (407 tests) must remain green, plus all new test suites.
- No `as any` type assertions in new test or source files.
