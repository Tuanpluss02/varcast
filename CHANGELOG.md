# Changelog

## Unreleased

### React Native target — full rewrite

The original RN output (a custom `ThemeProvider`/`useTheme` package with per-collection mode getters) was replaced with two idiomatic flavors picked at export time:

- **NativeWind preset** — emits a Tailwind preset (CommonJS) plus per-mode `.css` and `vars()` JS maps. Tokens resolve through CSS variables so theme switching does not require rebuilding Tailwind. Composite `boxShadow` and `.type-<getter>` utilities are baked from the default mode.
- **Unistyles 3** — emits typed `light`/`dark` themes, a `buildTheme({ ...axes })` factory whose axis options come from collections with multiple modes, and a module augmentation for `react-native-unistyles` so `theme.*` autocompletes inside `StyleSheet.create`.

Both flavors merge tokens from all collections into one tree by Figma `groupPath`, faithful to the spec in `rn_expected.md`. Numeric-only leaf segments stay as bare digits (`theme.space[4]`, `p-4`) instead of receiving the legacy `n` prefix.

The UI now exposes a **React Native flavor** select that appears whenever the target is React Native; the `archMode` toggle remains Flutter-only.

Old smoke scripts (`scripts/rn_smoke_*.mjs`) and the `pnpm smoke:rn` script are removed — vitest now exercises the generated packages end-to-end including a real `tsc --noEmit` against the Unistyles output.

## 0.1.0 — Initial release

First public release of Varcast.

### Targets

- **Flutter** — Dart package with `AppTheme` facade, mode-animated
  `DesignSystemController`, and typed composite getters
  (`DSColorStyles`, `DSShadows`, `DSStyles` / `DSTextStyle`).
- **React Native** — TypeScript package with `ThemeProvider` + `useTheme()`
  hook, per-collection mode state, and composite token files.

### Features

- Read Figma Variables (collections, modes, alias chains) into a target-neutral
  intermediate representation.
- Read local Paint, Effect, and Text styles; preserve variable bindings as
  alias references in the IR.
- Validate IR before emit: cycle detection, unresolved alias warnings,
  float-noise rounding, hidden-variable filtering.
- Per-target stable identifier manifest — Figma renames never break consumer
  code.
- Auto-generated `CHANGELOG.md` per export (added / removed / renamed).
- ZIP packaging entirely in-browser; no network access.
