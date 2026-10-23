# Varcast Documentation

Welcome to the Varcast technical documentation. Varcast is a decoupled design token compiler transforming Figma Variables and Styles into multi-platform design systems (Flutter, React Native, SwiftUI, etc.).

---

## Documentation Navigation

This documentation suite is organized by concerns:

### 1. [Architecture & Core Compiler (`ARCHITECTURE.md`)](./ARCHITECTURE.md)
*Read this to understand the internal compiler pipeline and data structures.*
- High-level 3-layer architecture (Reader, Core, Targets).
- `SemanticTokenGraph` and `ResolvedVariable` data model with full provenance.
- Lossless RGBA colors and composite resolution.
- The 2-Pass Stable Identifier Reservation Algorithm (`allocateStableCollectionIdentifiers`).
- Manifest v2 specification and strict target-neutral invariants (`pnpm leakcheck`).

### 2. [Target Authoring Guide (`TARGET_AUTHORING_GUIDE.md`)](./TARGET_AUTHORING_GUIDE.md)
*Read this when implementing a new target platform (e.g. SwiftUI, Compose, Tailwind).*
- The `Target<TOptions, TPrepared>` contract (`prepare` vs `emit`).
- Standard target directory layout (`src/targets/<target_id>/`).
- The 5 Golden Rules (Mandatory use of Core Toolkit).
- Composites Mapping Matrix (Linear gradients, shadows, typography formulas).
- Auto-registration and wiring into Figma UI and CLI entrypoints.

### 3. [Testing, Conformance (TCK) & CI/CD (`TESTING_AND_CI.md`)](./TESTING_AND_CI.md)
*Read this to understand how targets are tested and verified automatically.*
- Universal Target Conformance Suite (TCK): Discovery Guard, Idempotency, and Parity checks.
- Golden Snapshot Regression testing and updating procedures.
- Two-Phase Evolution & Migration testing.
- CLI & Runtime Smoke scripts (`pnpm smoke:matrix`).
- GitHub Actions multi-job CI workflow and pre-flight PR checklist.

---

## Quick Verification Commands

```bash
# Verify static types and architecture boundaries
pnpm typecheck
pnpm leakcheck

# Run test suite (59 test files / 439 tests)
pnpm test

# Run CLI and real runtime smoke tests (TSC, Dart analyze)
pnpm smoke:matrix

# Run all checks in one command
pnpm test:all
```
