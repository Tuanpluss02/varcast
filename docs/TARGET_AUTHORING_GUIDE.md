# Target Authoring Guide: Implementing a New Target in Varcast

This guide is the authoritative reference for engineers and agentic workers adding a new target platform to Varcast (e.g. `swift_ui`, `jetpack_compose`, `tailwind_css`, `style_dictionary`).

---

## 1. The Target Contract (`src/core/target.ts`)

Every target must implement the generic `Target<TOptions, TPrepared>` interface:

```typescript
export interface Target<TOptions = unknown, TPrepared extends PreparedTarget = PreparedTarget> {
  readonly id: string;                              // Matches /^[a-z][a-z0-9_-]*$/
  readonly displayName: string;                     // e.g. "SwiftUI", "Jetpack Compose"
  readonly defaultPackageName: string;              // e.g. "DesignSystem"
  readonly defaultOptions?: TOptions;

  sanitizePackageName?(raw: string): string;
  normalizeOptions?(raw?: unknown): TOptions;
  validateOptions?(raw?: unknown): string[] | null;

  prepare(
    graph: SemanticTokenGraph,
    section: ManifestTargetSection | null,
    options?: TOptions,
  ): TPrepared;

  emit(prepared: TPrepared, options?: TOptions): EmittedFile[];
}
```

### Key Responsibilities:
- `prepare()`: Performs target-specific identifier deduction, reserves stable identifiers via Core toolkit, maps modes, and produces `nextManifestSection`.
- `emit()`: Transforms the prepared data into an array of `EmittedFile` objects (`{ path: string, contents: string }`).

---

## 2. Directory Structure of a Target

Create a new directory under `src/targets/<target_id>/`:

```text
src/targets/<target_id>/
├── index.ts              # Target definition, export, and self-registration
├── options.ts            # Options type, default values, normalization
├── identifier.ts         # Platform naming rules (camelCase, snake_case, etc.)
├── reserved.ts           # Language-specific reserved words (keywords)
└── generator/
    ├── prepare.ts        # Data transformation (MUST USE CORE TOOLKIT)
    ├── emit.ts           # Code emission entrypoint
    ├── emit_theme.ts     # Theme facade / controller
    └── emit_styles.ts    # Composite styles generator
```

---

## 3. The 5 Mandatory Golden Rules

When implementing a target, you **must** adhere to these rules:

### ⭐ Rule 1: Always Use `allocateStableCollectionIdentifiers`
Never write custom deduplication loops or manual suffix appending (`_2`, `_3`). Use the Core helper from `src/core/naming/dedup.ts`:

```typescript
import { allocateStableCollectionIdentifiers } from '../../../core/naming/dedup';

const allocatedMap = allocateStableCollectionIdentifiers(
  collection.variables,
  manifestSection,
  (_rawLeaf, v) => derivePlatformLeaf(v), // Sanitizer function
  {
    getGroupKey: (v) => v.groupPath.join('/'),
    formatStableName: (varId, name) => {
      // Optional hook to escape keywords or group conflicts
      return escapeReserved(name);
    },
  },
);

for (const v of collection.variables) {
  const { stableLeafKey, wasDeduplicated } = allocatedMap.get(v.id)!;
  // Use stableLeafKey for emission and manifest
}
```

### ⭐ Rule 2: Always Use `assembleTargetSection`
To construct the `nextManifestSection` in `prepare()`, use `assembleTargetSection` from `src/core/manifest/section_assembler.ts`:

```typescript
import { assembleTargetSection } from '../../../core/manifest';

const nextManifestSection = assembleTargetSection({
  collections: preparedCollections.map((col) => ({
    id: col.id,
    name: col.figmaName,
    exportName: col.typeName,
    variables: col.variables.map((v) => ({
      id: v.id,
      figmaName: v.figmaName,
      stableLeafKey: v.stableLeafKey,
    })),
  })),
  composites: allComposites.map((s) => ({
    id: s.id,
    figmaName: s.figmaName,
    getterName: s.getterName,
  })),
});
```

### ⭐ Rule 3: Consume Lossless RGBA & Token Provenance
Composites provide a fully calculated `rgba: RGBAValue` (`{ r, g, b, a, hex, rgbaString }` where $r, g, b, a \in [0.0, 1.0]$).
- In SwiftUI: `Color(.sRGB, red: rgba.r, green: rgba.g, blue: rgba.b, opacity: rgba.a)`
- In Compose: `Color(red = ${rgba.r}f, green = ${rgba.g}f, blue = ${rgba.b}f, alpha = ${rgba.a}f)`
- In Flutter: `Color(0x${rgba.hex})`
- In CSS: `rgba(${Math.round(rgba.r * 255)}, ${Math.round(rgba.g * 255)}, ${Math.round(rgba.b * 255)}, ${rgba.a})`

Never use regular expressions to parse hex colors back into RGB numbers.

### ⭐ Rule 4: Do Not Rescan for Broken Aliases
Core collects cycles and dangling references in `graph.warnings`. Your target does not need to scan collections for unresolved aliases. Simply consume `v.resolvedValuesByMode[modeId]`. If undefined, fallback gracefully according to your target's design.

### ⭐ Rule 5: Zero `as any` Type Assertions
Provide clean interfaces for your `PreparedTarget` and options. Strict type checking is enforced across all targets.

---

## 4. Composites Mapping Matrix (Figma $\to$ Target)

Use this quick-reference matrix when translating composite styles:

### 4.1 Linear Gradients
Figma provides `angleRadians` ($0$ to $2\pi$) and `stops` with `position` ($0..1$).

To convert `angleRadians` ($\theta$) to normalized coordinates $(x_1, y_1)$ to $(x_2, y_2)$ on a unit square $[-1, 1]$ centered at $(0.5, 0.5)$:
```typescript
const cos = Math.cos(angleRadians);
const sin = Math.sin(angleRadians);
const startX = 0.5 - (cos / 2);
const startY = 0.5 - (sin / 2);
const endX = 0.5 + (cos / 2);
const endY = 0.5 + (sin / 2);
```

| Platform | Target Construct |
| :--- | :--- |
| **Flutter** | `LinearGradient(begin: Alignment(x1, y1), end: Alignment(x2, y2), colors: [...], stops: [...])` |
| **SwiftUI** | `LinearGradient(stops: [...], startPoint: UnitPoint(x: x1, y: y1), endPoint: UnitPoint(x: x2, y: y2))` |
| **Compose** | `Brush.linearGradient(colorStops = arrayOf(...), start = Offset(x1, y1), end = Offset(x2, y2))` |
| **CSS** | `linear-gradient(${angleDegrees}deg, color1 stop1, color2 stop2)` |

### 4.2 Shadows (Drop & Inner Shadow)
Figma provides `offsetX`, `offsetY`, `blurRadius`, `spread`, and `rgba`.

| Platform | Handling & Spread Fallback |
| :--- | :--- |
| **Flutter** | Supports spread directly: `BoxShadow(offset: Offset(x, y), blurRadius: b, spreadRadius: s, color: c)` |
| **SwiftUI** | Supports radius and offset: `.shadow(color: c, radius: b / 2, x: x, y: y)` |
| **Compose** | Use `Modifier.shadow(elevation, shape)` or custom `dropShadow(color, blur, offset, spread)` |
| **React Native** | Native shadow doesn't support spread: map to `elevation` on Android and `shadowOffset`/`shadowRadius` on iOS. |

### 4.3 Typography
Figma provides `fontFamily`, `fontSize`, `fontWeight` (numeric $100..900$), `lineHeight`, `letterSpacing`.

| Metric | Mapping Formula |
| :--- | :--- |
| **Font Weight** | Map numeric weight to platform enum (e.g. $400 \to$ `regular` / `w400`, $700 \to$ `bold` / `w700`). |
| **Line Height** | If percentage, compute `fontSize * (lineHeight / 100)`. If pixel, use directly. |
| **Letter Spacing** | If percent, divide by 100. If absolute pixels, pass directly. |

---

## 5. Wiring into Entrypoints

Once your target class is implemented, wire it into the system:

1. **Auto-Register in Target's `index.ts`**:
   ```typescript
   import { hasTarget, registerTarget } from '../../core/registry';
   import type { Target } from '../../core/target';

   export const myTarget: Target = { ... };

   export function registerMyTarget(): void {
     if (!hasTarget('my_target')) {
       registerTarget(myTarget);
     }
   }

   registerMyTarget();
   ```

2. **Register in CLI and Plugin Entrypoints**:
   Add a single import line to:
   - `src/main.ts`:
     ```typescript
     import './targets/my_target';
     ```
   - `src/generator_cli.ts`:
     ```typescript
     import './targets/my_target';
     ```

The Figma UI dropdown `<select id="targetId">` automatically queries `getAllTargets()` and displays your target with zero UI code modifications!
