# Varcast Architecture & Core Compiler Specification

This document provides a comprehensive technical overview of the Varcast architecture, its multi-stage compiler pipeline, data structures, stable identifier algorithms, and strict system invariants.

---

## 1. High-Level Architectural Overview

Varcast is designed as a **decoupled, multi-platform design token compiler**. Its primary responsibility is transforming raw Figma Variables and Composite Styles into production-ready, strongly typed client code across diverse platforms (e.g. Flutter, React Native, and future targets such as SwiftUI, Jetpack Compose, Tailwind).

```text
┌────────────────┐     ┌────────────────┐     ┌───────────────────────┐
│  Figma API     │ ──> │  Figma Reader  │ ──> │ Intermediate Rep (IR) │
└────────────────┘     └────────────────┘     └───────────────────────┘
                                                          │
                                                          ▼
┌─────────────────────────┐                   ┌───────────────────────┐
│ Core Target Toolkit     │ <──────────────── │ Semantic Token Graph  │
│ (2-Pass Dedup & Naming) │                   │ (Single Source Truth) │
└─────────────────────────┘                   └───────────────────────┘
            │                                             │
            ▼                                             ▼
┌─────────────────────────┐                   ┌───────────────────────┐
│ Target: prepare()       │ ──> PreparedTarget│ Target: emit()        │
└─────────────────────────┘                   └───────────────────────┘
            │                                             │
            └──────────────────────┬──────────────────────┘
                                   ▼
                       ┌───────────────────────┐
                       │ runEngine()           │
                       │ - Multi-target namesp │
                       │ - Manifest v2 Diff    │
                       │ - Changelog generator │
                       └───────────────────────┘
                                   │
                                   ▼
                       ┌───────────────────────┐
                       │ Output Files & _meta/ │
                       │ - Emitted code        │
                       │ - _meta/manifest.json │
                       │ - _meta/ir.json       │
                       │ - CHANGELOG.md        │
                       └───────────────────────┘
```

The system is strictly separated into three layers:
1. **Reader Layer (`src/reader/`, `src/ir/`)**: Interacts with the Figma Plugin API or reads serialized JSON to construct a normalized, target-agnostic **Intermediate Representation (`IR`)**.
2. **Core Semantic Engine (`src/core/`)**: Resolves all variable aliases, builds dependency graphs, detects cycles, calculates lossless composite values, provides deterministic sanitization, and manages Manifest v2 state.
3. **Target Layer (`src/targets/`)**: Platform-specific emitters that format the semantic token data into language constructs (.dart, .ts, .swift, etc.).

---

## 2. Core Data Model (`src/core/graph/`)

The `SemanticTokenGraph` is the **single source of truth** for the entire design system. Targets must consume this graph directly and never reconstruct reverse lookup tables or re-parse color strings.

### 2.1 `ResolvedVariable`
Variables carry complete provenance regarding their parent collection and mode resolutions:

```typescript
export interface ResolvedVariable {
  readonly id: string;                              // Figma Variable ID (e.g. "VariableID:12:34")
  readonly figmaName: string;                       // Raw name in Figma (e.g. "brand/primary/500")
  readonly type: 'COLOR' | 'FLOAT' | 'STRING' | 'BOOLEAN';
  readonly groupPath: string[];                     // Segmented path (e.g. ["brand", "primary"])
  readonly leafName: string;                        // Leaf segment (e.g. "500")
  readonly scopes: string[];                        // Scopes (e.g. ["ALL_FILLS", "CORNER_RADIUS"])
  readonly emitToPublic: boolean;                   // false if hiddenFromPublishing
  readonly rawValuesByMode: Record<string, IRValue>;// Original unresolved values
  readonly resolvedValuesByMode: Record<string, ResolvedLiteral>; // Deeply resolved literals

  // Parent collection provenance
  readonly collectionId: string;
  readonly collectionName: string;
  readonly collectionKind: 'primitive' | 'token';
}
```

### 2.2 Lossless Color Representation (`RGBAValue`)
Composites (paints and effect styles) store raw, lossless RGBA data computed during resolution. Targets do not need to parse hex strings or calculate normalized float values:

```typescript
export interface RGBAValue {
  readonly r: number;          // Normalized 0.0 - 1.0
  readonly g: number;          // Normalized 0.0 - 1.0
  readonly b: number;          // Normalized 0.0 - 1.0
  readonly a: number;          // Normalized 0.0 - 1.0
  readonly hex: string;        // 8-character hex (e.g. "3B82F6FF")
  readonly rgbaString: string; // e.g. "rgba(59, 130, 246, 1)"
}
```

### 2.3 Composite Styles
- **`ResolvedPaintStyle`**: Supports `SOLID`, `GRADIENT_LINEAR`, `GRADIENT_RADIAL`, `GRADIENT_ANGULAR`, `GRADIENT_DIAMOND`, and `IMAGE`. Gradients provide computed `angleRadians` and an array of `stops` with their own `position` ($0..1$) and `RGBAValue`.
- **`ResolvedEffectStyle`**: Supports `DROP_SHADOW`, `INNER_SHADOW`, `LAYER_BLUR`, and `BACKGROUND_BLUR`, exposing numeric `offsetX`, `offsetY`, `blurRadius`, `spread`, `opacity`, and resolved shadow `RGBAValue`.
- **`ResolvedTextStyle`**: Fully resolved font metrics (`fontFamily`, `fontSize`, `fontWeight`, `lineHeight`, `letterSpacing`).

---

## 3. Stable Identifier Reservation Algorithm (Manifest v2)

When designers update Figma files, variable names may be edited, tokens reordered, or collections restructured. To prevent breaking downstream consumer applications across exports, Core implements a **standardized 2-Pass Stable Identifier Allocation Algorithm** via `allocateStableCollectionIdentifiers` in `src/core/naming/dedup.ts`.

```text
Input: Collection Variables + Previous ManifestTargetSection
                           │
                           ▼
              ┌───────────────────────────┐
              │ Pass 1: Reserve Pinned    │
              │ - Query old manifest      │
              │ - Pre-allocate pinned keys│
              │ - Protect existing API    │
              └───────────────────────────┘
                           │
                           ▼
              ┌───────────────────────────┐
              │ Pass 2: Allocate & Dedup  │
              │ - Sanitize new tokens     │
              │ - Detect sibling collision│
              │ - Suffix if needed (2, 3) │
              └───────────────────────────┘
                           │
                           ▼
              Output: Map<varId, { stableLeafKey, isStable }>
```

### 3.1 Pass 1: Reserve Pinned Identifiers
If a variable ID existed in the previous export's manifest section (`manifestSection.variables[id]`), its generated leaf key is **immediately reserved** in that group's namespace. Even if a newly added variable has a cleaner name, it cannot take an existing variable's identifier.

### 3.2 Pass 2: Allocate & Deduplicate
New variables (not in the manifest) are sanitized and assigned their derived leaf name. If a collision occurs with a reserved name or another new variable, deterministic numeric suffixing is applied (`primary`, `primary2`, `primary3`).

### 3.3 Intermediate Group Path Collisions
If a leaf variable name matches an intermediate group folder (e.g. a token named `color/button` and another named `color/button/primary`), languages like TypeScript and Dart cannot create both an object namespace and a leaf property with the same name. Targets can provide a `formatStableName` hook to escape leaf names (e.g. `buttonValue`).

---

## 4. Manifest v2 & Export State

The exported package includes metadata in `_meta/`:
- **`_meta/manifest.json`**: Records the stable code mapping for each target:
  ```json
  {
    "version": "2.0",
    "fileKey": "sample-file-key",
    "lastExportedAt": "2026-10-23T20:00:00.000Z",
    "targets": {
      "flutter": {
        "variables": { "VariableID:1:2": "brandPrimary" },
        "collections": { "VariableCollectionId:1": "BrandColors" },
        "composites": { "S:123": "elevationCard" },
        "figmaNames": { ... }
      }
    }
  }
  ```
- **`_meta/ir.json`**: An exact snapshot of the Figma tokens at export time. This allows developers to re-generate code or run CLI diffs offline without access to Figma.

---

## 5. System Invariants & Enforcement

The following architectural rules are non-negotiable and strictly enforced by CI:

1. **Target-Neutral Core (CI Leak Check)**:
   Files under `src/core/`, `src/reader/`, and `src/ir/` must never import platform libraries (`react`, `react-native`, `flutter`) or contain platform-specific syntax (`Widget`, `Color(0x...)`, `pubspec.yaml`, JSX tags). Enforced by `pnpm leakcheck` via `scripts/leak_check.js`.
2. **Zero `as any`**:
   All core and target code must be strictly typed in TypeScript.
3. **Preserve Numeric Segments**:
   Sanitization must never strip numbers from token segments (`"100 Primary"` $\to$ `"n100Primary"`). Ordering prefixes are stripped only from collection names (`"[1] Colors"` $\to$ `"Colors"`).
4. **Diagnostics via Graph Warnings**:
   Cycles and dangling aliases must be caught in `core/graph/alias_resolver.ts` and appended to `graph.warnings`. Target emitters must never traverse AST trees to detect unresolvable references.
